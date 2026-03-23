"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { getFinalScore, type ScoringMode } from "@/lib/scoring-utils"
import { checkParticipationGate } from "@/lib/participation-gate"
import { awardChallengeSkills } from "@/lib/award-skills"
import { computeRankedResults, shouldUseRankedMode, type EvaluatorScore } from "@/lib/rank-scoring"

// --- ACTION: JOIN CHALLENGE ---
export async function joinChallenge(challengeId: string, teamId?: string, forceJoin: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "You must be logged in to join a challenge." }

  const { data: targetChallenge, error: fetchError } = await (supabase
    .from("challenges")
    .select("title, start_date, end_date, status, registration_deadline, is_perpetual, difficulty, challenge_skills(skill_id)")
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

  // --- PARTICIPATION GATE ---
  const gateResult = await checkParticipationGate(supabase, challengeId, user.id)
  if (!gateResult.allowed) {
    if (gateResult.reason === "advanced_limit") {
      return {
        error: "advanced_limit",
        nextEligibleAt: gateResult.nextEligibleAt,
        effectiveLimit: gateResult.effectiveLimit,
      }
    }
    return {
      error: "skill_gate",
      requiredSkillIds: gateResult.missingSkillIds,
      requiredTier: gateResult.requiredTier,
      difficulty: gateResult.difficulty,
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

// --- ACTION: CHECK EVALUATION COMPLETENESS ---
export async function checkEvaluationCompleteness(challengeId: string): Promise<{
  isComplete: boolean
  missing: Array<{
    evaluatorId: string
    evaluatorName: string
    participantId: string
    participantName: string
  }>
}> {
  const supabase = await createClient()

  // 1. Fetch all evaluators assigned to this challenge
  const { data: evaluatorRows } = await (supabase
    .from("challenge_evaluators")
    .select("evaluator_id, profiles(first_name, last_name)")
    .eq("challenge_id", challengeId) as any)

  const evaluators: Array<{ evaluatorId: string; evaluatorName: string }> =
    (evaluatorRows ?? []).map((row: any) => ({
      evaluatorId: row.evaluator_id as string,
      evaluatorName: `${row.profiles?.first_name ?? ""} ${row.profiles?.last_name ?? ""}`.trim(),
    }))

  // 2. Fetch all active participants with their submissions and non-draft evaluations
  const { data: participantRows } = await (supabase
    .from("challenge_participants")
    .select(`
      user_id,
      profiles(first_name, last_name),
      submissions(
        evaluations(reviewer_id, is_draft)
      )
    `)
    .eq("challenge_id", challengeId)
    .eq("status", "active") as any)

  const participants: Array<{
    userId: string
    participantName: string
    reviewerIds: Set<string>
  }> = (participantRows ?? []).map((row: any) => {
    const reviewerIds = new Set<string>()
    for (const sub of (row.submissions ?? []) as any[]) {
      for (const ev of (sub.evaluations ?? []) as any[]) {
        if (ev.is_draft === false && ev.reviewer_id) {
          reviewerIds.add(ev.reviewer_id as string)
        }
      }
    }
    return {
      userId: row.user_id as string,
      participantName: `${row.profiles?.first_name ?? ""} ${row.profiles?.last_name ?? ""}`.trim(),
      reviewerIds,
    }
  })

  // 3. Build missing pairs: every evaluator × participant where no finalized eval exists
  const missing: Array<{
    evaluatorId: string
    evaluatorName: string
    participantId: string
    participantName: string
  }> = []

  for (const evaluator of evaluators) {
    for (const participant of participants) {
      if (!participant.reviewerIds.has(evaluator.evaluatorId)) {
        missing.push({
          evaluatorId: evaluator.evaluatorId,
          evaluatorName: evaluator.evaluatorName,
          participantId: participant.userId,
          participantName: participant.participantName,
        })
      }
    }
  }

  return { isComplete: missing.length === 0, missing }
}

// --- ACTION: CLOSE CHALLENGE ---
// Perpetual challenges: just sets status to "closed" — no winners calculated.
// Normal challenges: calculates top 3 winners from scores, then closes.
export async function closeChallenge(challengeId: string, forceClose = false): Promise<{
  success: boolean
  error: string | null
  requiresConfirmation?: boolean
  missing?: Array<{
    evaluatorId: string
    evaluatorName: string
    participantId: string
    participantName: string
  }>
}> {
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

  // 2. Fetch challenge — verify org ownership, check perpetual flag, difficulty, and scoring_mode
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("organization_id, is_perpetual, scoring_mode, difficulty")
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

  // 3b. Pre-flight: warn if not all evaluators have scored all participants
  if (!forceClose) {
    const completeness = await checkEvaluationCompleteness(challengeId)
    if (!completeness.isComplete) {
      return {
        success: false,
        error: null,
        requiresConfirmation: true,
        missing: completeness.missing,
      }
    }
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
          reviewer_id,
          profiles (role)
        )
      )
    `)
    .eq("challenge_id", challengeId)

  if (!participants) return { success: false, error: "No participants found." }

  // Fetch evaluator metadata for ranked mode
  const { data: evaluatorRows } = await (supabase
    .from("challenge_evaluators")
    .select("evaluator_id, is_chief")
    .eq("challenge_id", challengeId) as any)

  const evaluatorCount = (evaluatorRows ?? []).length
  const chiefEvaluatorRow = (evaluatorRows ?? []).find((r: any) => r.is_chief === true)
  const chiefEvaluatorId: string | null = chiefEvaluatorRow?.evaluator_id ?? null

  const useRanked = shouldUseRankedMode({ scoringMode, evaluatorCount })

  let winners: Array<{
    challenge_id: string
    profile_id: string
    rank: number
    score: number
    prize: string
    is_tied: boolean
    tie_resolved_by: null
  }>

  if (useRanked) {
    // ── RANKED MODE ──────────────────────────────────────────────
    // Build evaluator scores array from all evaluator-role evaluations
    const evaluatorScores: EvaluatorScore[] = []
    const companyScores = new Map<string, number | null>()

    for (const p of participants as any[]) {
      // Initialize company score as null for every participant
      companyScores.set(p.user_id, null)

      for (const sub of (p.submissions ?? []) as any[]) {
        const evals = (sub.evaluations ?? []) as Array<{
          score: number | null
          reviewer_id: string | null
          profiles: { role: string } | null
        }>

        for (const ev of evals) {
          if (
            ev.profiles?.role === "evaluator" &&
            ev.score !== null &&
            ev.reviewer_id !== null
          ) {
            evaluatorScores.push({
              evaluatorId: ev.reviewer_id,
              participantId: p.user_id,
              rawScore: ev.score,
            })
          }

          if (
            (ev.profiles?.role === "company_admin" ||
              ev.profiles?.role === "company_member") &&
            ev.score !== null
          ) {
            companyScores.set(p.user_id, ev.score)
          }
        }
      }
    }

    const rankedResults = computeRankedResults({
      evaluatorScores,
      companyScores,
      chiefEvaluatorId,
    })

    // For "average" mode: blend normalized evaluator score with company score
    // For "evaluator_only" mode: use rank order directly
    let orderedResults = rankedResults

    if (scoringMode === "average") {
      // Convert normalizedScoreAvg (0–1) to 0–100, then average with company score
      orderedResults = [...rankedResults].sort((a, b) => {
        const aEval = Math.round(a.normalizedScoreAvg * 100)
        const bEval = Math.round(b.normalizedScoreAvg * 100)
        const aCompany = companyScores.get(a.participantId) ?? 0
        const bCompany = companyScores.get(b.participantId) ?? 0
        const aFinal = (aEval + aCompany) / 2
        const bFinal = (bEval + bCompany) / 2
        return bFinal - aFinal
      })
      // Re-assign finalRank after re-sort
      orderedResults.forEach((r, i) => { r.finalRank = i + 1 })
    }

    winners = orderedResults.slice(0, 3).map((r) => {
      const displayScore =
        scoringMode === "average"
          ? Math.round(
              (Math.round(r.normalizedScoreAvg * 100) +
                (companyScores.get(r.participantId) ?? 0)) /
                2
            )
          : Math.round(r.normalizedScoreAvg * 100)

      return {
        challenge_id: challengeId,
        profile_id: r.participantId,
        rank: r.finalRank,
        score: displayScore,
        prize:
          r.finalRank === 1
            ? "1st Place Prize"
            : r.finalRank === 2
              ? "2nd Place Prize"
              : "3rd Place Prize",
        is_tied: r.isTied,
        tie_resolved_by: null,
      }
    })
  } else {
    // ── EXISTING NON-RANKED MODE (keep exactly as-is) ────────────
    const leaderboard = (participants as any[]).map((p: any) => {
      const totalScore = p.submissions.reduce((acc: number, sub: any) => {
        const evals = (sub.evaluations || []) as Array<{
          score: number | null
          profiles: { role: string } | null
        }>
        const companyEval = evals.find(
          (e) =>
            e.profiles?.role === "company_admin" ||
            e.profiles?.role === "company_member"
        )
        const evaluatorEval = evals.find((e) => e.profiles?.role === "evaluator")
        const final = getFinalScore({
          companyScore: companyEval?.score ?? null,
          evaluatorScore: evaluatorEval?.score ?? null,
          scoringMode,
        })
        return acc + (final ?? 0)
      }, 0)
      return { profile_id: p.user_id, score: totalScore }
    })

    leaderboard.sort((a: any, b: any) => b.score - a.score)

    winners = leaderboard.slice(0, 3).map((entry: any, index: number) => ({
      challenge_id: challengeId,
      profile_id: entry.profile_id!,
      score: entry.score,
      rank: index + 1,
      prize:
        index === 0
          ? "1st Place Prize"
          : index === 1
            ? "2nd Place Prize"
            : "3rd Place Prize",
      is_tied: false,
      tie_resolved_by: null,
    }))
  }

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

  // Award earned skills to all active participants (upgrade-safe)
  const { data: activeParticipants } = await supabase
    .from("challenge_participants")
    .select("user_id")
    .eq("challenge_id", challengeId)
    .eq("status", "active")

  for (const p of activeParticipants ?? []) {
    if (p.user_id) await awardChallengeSkills(supabase, challengeId, p.user_id, scoringMode)
  }

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
          reviewer_id,
          profiles (role)
        )
      )
    `)
    .eq("challenge_id", challengeId)

  if (!participants || participants.length === 0) {
    return { success: false, error: "No participants found for this challenge." }
  }

  // Fetch evaluator metadata for ranked mode
  const { data: evaluatorRows } = await (supabase
    .from("challenge_evaluators")
    .select("evaluator_id, is_chief")
    .eq("challenge_id", challengeId) as any)

  const evaluatorCount = (evaluatorRows ?? []).length
  const chiefEvaluatorRow = (evaluatorRows ?? []).find((r: any) => r.is_chief === true)
  const chiefEvaluatorId: string | null = chiefEvaluatorRow?.evaluator_id ?? null
  const useRanked = shouldUseRankedMode({ scoringMode, evaluatorCount })

  // 4. Recalculate leaderboard using scoring_mode
  let winners: Array<{
    challenge_id: string
    profile_id: string
    rank: number
    score: number
    prize: string
    is_tied: boolean
    tie_resolved_by: null
  }>

  if (useRanked) {
    // ── RANKED MODE ──────────────────────────────────────────────
    const evaluatorScores: EvaluatorScore[] = []
    const companyScores = new Map<string, number | null>()

    for (const p of participants as any[]) {
      companyScores.set(p.user_id, null)

      for (const sub of (p.submissions ?? []) as any[]) {
        const evals = (sub.evaluations ?? []) as Array<{
          score: number | null
          reviewer_id: string | null
          profiles: { role: string } | null
        }>

        for (const ev of evals) {
          if (
            ev.profiles?.role === "evaluator" &&
            ev.score !== null &&
            ev.reviewer_id !== null
          ) {
            evaluatorScores.push({
              evaluatorId: ev.reviewer_id,
              participantId: p.user_id,
              rawScore: ev.score,
            })
          }

          if (
            (ev.profiles?.role === "company_admin" ||
              ev.profiles?.role === "company_member") &&
            ev.score !== null
          ) {
            companyScores.set(p.user_id, ev.score)
          }
        }
      }
    }

    const rankedResults = computeRankedResults({
      evaluatorScores,
      companyScores,
      chiefEvaluatorId,
    })

    let orderedResults = rankedResults

    if (scoringMode === "average") {
      orderedResults = [...rankedResults].sort((a, b) => {
        const aEval = Math.round(a.normalizedScoreAvg * 100)
        const bEval = Math.round(b.normalizedScoreAvg * 100)
        const aCompany = companyScores.get(a.participantId) ?? 0
        const bCompany = companyScores.get(b.participantId) ?? 0
        const aFinal = (aEval + aCompany) / 2
        const bFinal = (bEval + bCompany) / 2
        return bFinal - aFinal
      })
      orderedResults.forEach((r, i) => { r.finalRank = i + 1 })
    }

    winners = orderedResults.slice(0, 3).map((r) => {
      const displayScore =
        scoringMode === "average"
          ? Math.round(
              (Math.round(r.normalizedScoreAvg * 100) +
                (companyScores.get(r.participantId) ?? 0)) /
                2
            )
          : Math.round(r.normalizedScoreAvg * 100)

      return {
        challenge_id: challengeId,
        profile_id: r.participantId,
        rank: r.finalRank,
        score: displayScore,
        prize:
          r.finalRank === 1
            ? "1st Place Prize"
            : r.finalRank === 2
              ? "2nd Place Prize"
              : "3rd Place Prize",
        is_tied: r.isTied,
        tie_resolved_by: null,
      }
    })
  } else {
    // ── EXISTING NON-RANKED MODE (keep exactly as-is) ────────────
    const leaderboard = (participants as any[]).map((p: any) => {
      const totalScore = p.submissions.reduce((acc: number, sub: any) => {
        const evals = (sub.evaluations || []) as Array<{
          score: number | null
          profiles: { role: string } | null
        }>
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

    leaderboard.sort((a: any, b: any) => b.score - a.score)

    winners = leaderboard.slice(0, 3).map((entry: any, index: number) => ({
      challenge_id: challengeId,
      profile_id: entry.profile_id!,
      score: entry.score,
      rank: index + 1,
      prize:
        index === 0
          ? "1st Place Prize"
          : index === 1
            ? "2nd Place Prize"
            : "3rd Place Prize",
      is_tied: false,
      tie_resolved_by: null,
    }))
  }

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

// --- ACTION: RESOLVE TIE ---
export async function resolveTie(params: {
  challengeId: string
  resolutions: Array<{ profileId: string; newRank: number }>
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "company_admin" &&
      profile.role !== "company_member")
  ) {
    return { success: false, error: "Unauthorized" }
  }

  // 2. Company org ownership check
  if (profile.role === "company_admin" || profile.role === "company_member") {
    const { data: challenge } = await supabase
      .from("challenges")
      .select("organization_id")
      .eq("id", params.challengeId)
      .single()

    if (!challenge || challenge.organization_id !== profile.organization_id) {
      return { success: false, error: "Unauthorized access to this challenge." }
    }
  }

  // 3. Update each winner row
  for (const resolution of params.resolutions) {
    const { error } = await (supabase
      .from("winners")
      .update({
        rank: resolution.newRank,
        is_tied: false,
        tie_resolved_by: user.id,
      } as any)
      .eq("challenge_id", params.challengeId)
      .eq("profile_id", resolution.profileId) as any)

    if (error) {
      console.error("Tie resolution update error:", error)
      return { success: false, error: "Failed to resolve tie." }
    }
  }

  // 4. Revalidate paths
  revalidatePath(`/challenges/${params.challengeId}/results`)
  revalidatePath(`/company/challenges/${params.challengeId}`)
  revalidatePath(`/admin/challenges/${params.challengeId}`)

  return { success: true, error: null }
}

// --- ACTION: GET TIED PARTICIPANT DETAILS ---
export async function getTiedParticipantDetails(challengeId: string): Promise<{
  tiedWinners: Array<{
    profileId: string
    firstName: string | null
    lastName: string | null
    currentRank: number
    evaluatorScores: Array<{
      evaluatorName: string
      score: number
      feedback: string | null
    }>
    normalizedScoreAvg: number
    companyScore: number | null
  }>
}> {
  const supabase = await createClient()

  // 1. Fetch tied winners joined with profiles
  const { data: winnerRows } = await (supabase
    .from("winners")
    .select(`
      profile_id,
      rank,
      score,
      profile:profiles (first_name, last_name)
    `)
    .eq("challenge_id", challengeId)
    .eq("is_tied", true)
    .order("rank", { ascending: true }) as any)

  if (!winnerRows || (winnerRows as any[]).length === 0) {
    return { tiedWinners: [] }
  }

  // 2. For each tied winner, fetch their evaluation scores
  const tiedWinners = await Promise.all(
    (winnerRows as any[]).map(async (winner: any) => {
      // Find their participant row
      const { data: participant } = await supabase
        .from("challenge_participants")
        .select("id")
        .eq("challenge_id", challengeId)
        .eq("user_id", winner.profile_id)
        .single()

      const evaluatorScores: Array<{
        evaluatorName: string
        score: number
        feedback: string | null
      }> = []
      let companyScore: number | null = null

      if (participant) {
        const { data: submissionRows } = await (supabase
          .from("submissions")
          .select(`
            evaluations (
              score,
              feedback,
              is_draft,
              reviewer_id,
              profiles (first_name, last_name, role)
            )
          `)
          .eq("participant_id", participant.id) as any)

        for (const sub of (submissionRows ?? []) as any[]) {
          for (const ev of (sub.evaluations ?? []) as any[]) {
            if (ev.is_draft !== false) continue

            const role = ev.profiles?.role
            const name =
              `${ev.profiles?.first_name ?? ""} ${ev.profiles?.last_name ?? ""}`.trim() ||
              "Unknown"

            if (role === "evaluator" && ev.score !== null) {
              evaluatorScores.push({
                evaluatorName: name,
                score: ev.score as number,
                feedback: (ev.feedback as string | null) ?? null,
              })
            } else if (
              (role === "company_admin" || role === "company_member") &&
              ev.score !== null &&
              companyScore === null
            ) {
              companyScore = ev.score as number
            }
          }
        }
      }

      return {
        profileId: winner.profile_id as string,
        firstName: (winner.profile?.first_name ?? null) as string | null,
        lastName: (winner.profile?.last_name ?? null) as string | null,
        currentRank: winner.rank as number,
        evaluatorScores,
        normalizedScoreAvg: (winner.score ?? 0) / 100,
        companyScore,
      }
    })
  )

  return { tiedWinners }
}