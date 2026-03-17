"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { getFinalScore, type ScoringMode } from "@/lib/scoring-utils"

// --- ACTION: JOIN CHALLENGE ---
export async function joinChallenge(challengeId: string, teamId?: string, forceJoin: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "You must be logged in to join a challenge." }

  const { data: targetChallenge, error: fetchError } = await (supabase
    .from("challenges")
    .select("title, start_date, end_date, status, registration_deadline, is_perpetual")
    .eq("id", challengeId)
    .single() as any)

  if (fetchError || !targetChallenge) return { error: "Challenge not found." }

  const isPerpetual: boolean = targetChallenge.is_perpetual === true

  if (!targetChallenge.start_date) {
    return { error: "This challenge has missing date information and cannot be joined." }
  }

  if (!isPerpetual && !targetChallenge.end_date) {
    return { error: "This challenge has missing date information and cannot be joined." }
  }

  const now = new Date()
  const startDate = new Date(targetChallenge.start_date)
  const endDate = targetChallenge.end_date ? new Date(targetChallenge.end_date) : null
  const regDeadline = targetChallenge.registration_deadline
    ? new Date(targetChallenge.registration_deadline)
    : null

  if (targetChallenge.status !== "approved" && targetChallenge.status !== "in_progress") {
    return { error: "This challenge is not open for registration." }
  }

  if (regDeadline && now > regDeadline) {
    return { error: "Registration deadline has passed." }
  }

  if (!isPerpetual && endDate) {
    const oneDay = 24 * 60 * 60 * 1000
    if (endDate.getTime() - now.getTime() < oneDay) {
      return { error: "Registration closed: This challenge ends in less than 24 hours." }
    }
  }

  const { data: existing } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .single()

  if (existing) return { error: "You are already joined in this challenge." }

  if (!forceJoin) {
    const { data: activeParticipations } = await (supabase
      .from("challenge_participants")
      .select(`
        challenge:challenges (
          id,
          title,
          start_date,
          end_date,
          is_perpetual
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active") as any)

    if (activeParticipations && activeParticipations.length > 0) {
      const overlappingChallenge = activeParticipations.find((p: any) => {
        if (!p.challenge || !p.challenge.start_date) return false
        const currentEnd = p.challenge.end_date ? new Date(p.challenge.end_date) : null
        const newEnd = endDate
        if (!currentEnd || !newEnd) return startDate >= new Date(p.challenge.start_date)
        const currentStart = new Date(p.challenge.start_date)
        return startDate <= currentEnd && newEnd >= currentStart
      })

      if (overlappingChallenge) {
        return {
          status: "overlap_warning",
          message: `This overlaps with "${overlappingChallenge.challenge.title}". Do you still want to join?`,
          conflictingId: overlappingChallenge.challenge.id,
        }
      }
    }
  }

  const { error: joinError } = await supabase
    .from("challenge_participants")
    .insert({
      challenge_id: challengeId,
      user_id: user.id,
      team_id: teamId || null,
      status: "active",
      joined_at: new Date().toISOString(),
    })

  if (joinError) {
    console.error("Join error:", joinError)
    return { error: "Failed to join challenge. Please try again." }
  }

  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath(`/dashboard`)
  return { success: true }
}

// --- ACTION: SUBMIT FOR APPROVAL ---
export async function submitChallengeForApproval(challengeId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("created_by")
    .eq("id", challengeId)
    .single()

  if (!challenge) return { error: "Challenge not found" }

  const { error } = await supabase
    .from("challenges")
    .update({ status: "pending_approval" as any })
    .eq("id", challengeId)

  if (error) return { error: "Failed to submit challenge" }

  revalidatePath(`/company/challenges/${challengeId}`)
  return { success: true }
}

// --- ACTION: CLOSE CHALLENGE ---
// Perpetual challenges: just sets status to "closed" — no winners calculated.
// Normal challenges: calculates top 3 winners from scores, then closes.
export async function closeChallenge(challengeId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // 1. Auth & Ownership
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "company_admin" && profile.role !== "company_member")) {
    return { success: false, error: "Only company admins can close challenges." }
  }

  // 2. Fetch challenge — verify org ownership, check perpetual flag, and get scoring_mode
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("organization_id, is_perpetual, scoring_mode")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge || challenge.organization_id !== profile.organization_id) {
    return { success: false, error: "Unauthorized access to this challenge." }
  }

  const isPerpetual: boolean = challenge.is_perpetual === true
  const scoringMode: ScoringMode = (challenge.scoring_mode || "company_only") as ScoringMode

  // 3. Perpetual — just close, skip winner calculation
  if (isPerpetual) {
    const { error: updateError } = await supabase
      .from("challenges")
      .update({ status: "closed" as any })
      .eq("id", challengeId)

    if (updateError) return { success: false, error: "Failed to close challenge." }

    revalidatePath(`/challenges/${challengeId}`)
    revalidatePath(`/company/challenges/${challengeId}`)
    revalidatePath(`/challenges`)
    return { success: true, error: null }
  }

  // 4. Normal — calculate leaderboard and save top 3 winners
  const { data: participants } = await supabase
    .from("challenge_participants")
    .select(`
      id,
      user_id,
      submissions (
        evaluations (
          score,
          profiles (role)
        )
      )
    `)
    .eq("challenge_id", challengeId)

  if (!participants) return { success: false, error: "No participants found." }

  const leaderboard = participants.map((p: any) => {
    const totalScore = p.submissions.reduce((acc: number, sub: any) => {
      const evals = (sub.evaluations || []) as Array<{ score: number | null; profiles: { role: string } | null }>
      const companyEval = evals.find(e =>
        e.profiles?.role === "company_admin" || e.profiles?.role === "company_member"
      )
      const evaluatorEval = evals.find(e => e.profiles?.role === "evaluator")
      const final = getFinalScore({
        companyScore: companyEval?.score ?? null,
        evaluatorScore: evaluatorEval?.score ?? null,
        scoringMode,
      })
      return acc + (final ?? 0)
    }, 0)
    return { profile_id: p.user_id, score: totalScore }
  })

  leaderboard.sort((a, b) => b.score - a.score)

  const winners = leaderboard.slice(0, 3).map((entry, index) => ({
    challenge_id: challengeId,
    profile_id: entry.profile_id!,
    score: entry.score,
    rank: index + 1,
    prize: index === 0 ? "1st Place Prize" : index === 1 ? "2nd Place Prize" : "3rd Place Prize",
  }))

  if (winners.length > 0) {
    await supabase.from("winners").delete().eq("challenge_id", challengeId)
    const { error: winnerError } = await supabase.from("winners").insert(winners)
    if (winnerError) {
      console.error("Winner save error:", winnerError)
      return { success: false, error: "Failed to save winners." }
    }
  }

  const { error: updateError } = await supabase
    .from("challenges")
    .update({ status: "closed" as any })
    .eq("id", challengeId)

  if (updateError) return { success: false, error: "Failed to close challenge." }

  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath(`/company/challenges/${challengeId}`)
  revalidatePath(`/dashboard`)
  revalidatePath(`/challenges`)
  revalidatePath(`/challenges/${challengeId}/results`)

  return { success: true, error: null }
}

// --- ACTION: RECALCULATE WINNERS ---
// Perpetual challenges have no winners — this is blocked for them.
export async function recalculateWinners(challengeId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // 1. Auth & Ownership
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "company_admin" && profile.role !== "company_member")) {
    return { success: false, error: "Only company admins can recalculate winners." }
  }

  // 2. Fetch challenge — verify org, status, perpetual flag, and scoring_mode
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("organization_id, status, is_perpetual, scoring_mode")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge || challenge.organization_id !== profile.organization_id) {
    return { success: false, error: "Unauthorized access to this challenge." }
  }

  // Perpetual challenges have no winners
  if (challenge.is_perpetual === true) {
    return { success: false, error: "Perpetual challenges do not have winners." }
  }

  if (challenge.status !== "closed" && challenge.status !== "completed") {
    return { success: false, error: "Can only recalculate winners for closed challenges." }
  }

  const scoringMode: ScoringMode = (challenge.scoring_mode || "company_only") as ScoringMode

  // 3. Fetch participants with evaluations and reviewer roles
  const { data: participants } = await supabase
    .from("challenge_participants")
    .select(`
      id,
      user_id,
      submissions (
        evaluations (
          score,
          profiles (role)
        )
      )
    `)
    .eq("challenge_id", challengeId)

  if (!participants || participants.length === 0) {
    return { success: false, error: "No participants found for this challenge." }
  }

  // 4. Recalculate leaderboard using scoring_mode
  const leaderboard = participants.map((p: any) => {
    const totalScore = p.submissions.reduce((acc: number, sub: any) => {
      const evals = (sub.evaluations || []) as Array<{ score: number | null; profiles: { role: string } | null }>
      const companyEval = evals.find(e =>
        e.profiles?.role === "company_admin" || e.profiles?.role === "company_member"
      )
      const evaluatorEval = evals.find(e => e.profiles?.role === "evaluator")
      const final = getFinalScore({
        companyScore: companyEval?.score ?? null,
        evaluatorScore: evaluatorEval?.score ?? null,
        scoringMode,
      })
      return acc + (final ?? 0)
    }, 0)
    return { profile_id: p.user_id, score: totalScore }
  })

  leaderboard.sort((a, b) => b.score - a.score)

  const winners = leaderboard.slice(0, 3).map((entry, index) => ({
    challenge_id: challengeId,
    profile_id: entry.profile_id!,
    score: entry.score,
    rank: index + 1,
    prize: index === 0 ? "1st Place Prize" : index === 1 ? "2nd Place Prize" : "3rd Place Prize",
  }))

  await supabase.from("winners").delete().eq("challenge_id", challengeId)
  const { error: winnerError } = await supabase.from("winners").insert(winners)
  if (winnerError) {
    console.error("Recalculate winner save error:", winnerError)
    return { success: false, error: "Failed to save recalculated winners." }
  }

  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath(`/challenges/${challengeId}/results`)
  revalidatePath(`/company/challenges/${challengeId}`)

  return { success: true, error: null }
}