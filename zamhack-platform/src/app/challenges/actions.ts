"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { getFinalScore, type ScoringMode } from "@/lib/scoring-utils"
import { checkParticipationGate } from "@/lib/participation-gate"
import { awardChallengeSkills } from "@/lib/award-skills"
import { awardXp } from "@/lib/award-xp"
import { computeRankedResults, shouldUseRankedMode, type EvaluatorScore } from "@/lib/rank-scoring"
import { logActivity, ActivityAction, EntityType } from "@/lib/activity-log"

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

        // ── Slot limit check ──────────────────────────────────────────────────────
    const { data: profileSlots } = await supabase
      .from("profiles")
      .select("max_active_challenges")
      .eq("id", user.id)
      .single()

    const maxSlots = profileSlots?.max_active_challenges ?? 3

    // Count participations where the joined challenge is still active.
    // Exclude participants already marked completed and perpetual challenges
    // where the student has submitted all milestones (handles pre-fix rows too).
    const { data: rawParts } = await supabase
      .from("challenge_participants")
      .select("id, challenge_id, status")
      .eq("user_id", user.id)
      .neq("status", "completed")

    const rawChallengeIds = (rawParts ?? [])
      .map((p) => p.challenge_id)
      .filter(Boolean) as string[]

    let activeSlotCount = 0
    if (rawChallengeIds.length > 0) {
      const nowStr = new Date().toISOString()
      const { data: runningChallenges } = await (supabase
        .from("challenges")
        .select("id, is_perpetual")
        .in("id", rawChallengeIds)
        .in("status", ["approved", "in_progress"])
        .or(`end_date.is.null,end_date.gt.${nowStr}`) as any)

      const perpetualIds = new Set<string>(
        (runningChallenges ?? [])
          .filter((c: any) => c.is_perpetual === true)
          .map((c: any) => c.id as string)
      )
      // Non-perpetual running challenges always consume a slot
      activeSlotCount += (runningChallenges ?? []).filter((c: any) => !c.is_perpetual).length

      if (perpetualIds.size > 0) {
        const perpetualParts = (rawParts ?? []).filter(
          (p) => p.challenge_id && perpetualIds.has(p.challenge_id)
        )
        const perpetualPartIds = perpetualParts.map((p) => p.id)

        const { data: milestones } = await supabase
          .from("milestones")
          .select("id, challenge_id")
          .in("challenge_id", [...perpetualIds])

        const { data: submissions } = await supabase
          .from("submissions")
          .select("participant_id, milestone_id")
          .in("participant_id", perpetualPartIds)

        const milestoneCounts = new Map<string, number>()
        for (const m of milestones ?? []) {
          if (!m.challenge_id) continue
          milestoneCounts.set(m.challenge_id, (milestoneCounts.get(m.challenge_id) ?? 0) + 1)
        }
        const submittedByPart = new Map<string, Set<string>>()
        for (const s of submissions ?? []) {
          if (!s.participant_id || !s.milestone_id) continue
          if (!submittedByPart.has(s.participant_id)) submittedByPart.set(s.participant_id, new Set())
          submittedByPart.get(s.participant_id)!.add(s.milestone_id)
        }

        for (const part of perpetualParts) {
          const total = milestoneCounts.get(part.challenge_id!) ?? 0
          const submitted = submittedByPart.get(part.id)?.size ?? 0
          const done = total > 0 && submitted >= total
          if (!done) activeSlotCount += 1
        }
      }
    }
 
    if (activeSlotCount >= maxSlots) {
      return {
        error: `You've reached your limit of ${maxSlots} active challenge${maxSlots !== 1 ? "s" : ""}. Complete or wait for one to end before joining another.`
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
  const isAdvisoryOnly =
    !gateResult.allowed && gateResult.reason === "xp_rank_advisory"

  if (!gateResult.allowed && !isAdvisoryOnly) {
    if (gateResult.reason === "advanced_limit") {
      return {
        error: "advanced_limit",
        nextEligibleAt: gateResult.nextEligibleAt,
        effectiveLimit: gateResult.effectiveLimit,
      }
    }

    // ✅ FIX: Handle xp_rank_gate before falling through to skill_gate.
    // Without this branch, TypeScript cannot narrow the union and errors on
    // gateResult.missingSkillIds (which does not exist on xp_rank_gate).
    if (gateResult.reason === "xp_rank_gate") {
      return {
        error: "xp_rank_gate",
        requiredRank: gateResult.requiredRank,
        currentRank: gateResult.currentRank,
      }
    }

    // At this point TypeScript knows the only remaining variant is skill_gate,
    // so missingSkillIds, requiredTier, and difficulty are all safe to access.
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
// Core close logic — accepts any Supabase client (user session or service role).
// Called by closeChallenge (with auth) and the cron route (with service role).
export async function closeChallengeInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  challengeId: string,
  forceClose = false,
): Promise<{
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
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("organization_id, is_perpetual, scoring_mode, difficulty")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge) return { success: false, error: "Challenge not found." }

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

    for (const p of (participants as any[]).filter((p: any) => !!p.user_id)) {
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
      // Sort by raw mean + company score blend for average mode
      orderedResults = [...rankedResults].sort((a, b) => {
        const aScores = evaluatorScores.filter((s) => s.participantId === a.participantId).map((s) => s.rawScore)
        const bScores = evaluatorScores.filter((s) => s.participantId === b.participantId).map((s) => s.rawScore)
        const aRawMean = aScores.length > 0 ? aScores.reduce((x, y) => x + y, 0) / aScores.length : 0
        const bRawMean = bScores.length > 0 ? bScores.reduce((x, y) => x + y, 0) / bScores.length : 0
        const aFinal = (aRawMean + (companyScores.get(a.participantId) ?? 0)) / 2
        const bFinal = (bRawMean + (companyScores.get(b.participantId) ?? 0)) / 2
        return bFinal - aFinal
      })
      // Re-assign finalRank after re-sort
      orderedResults.forEach((r, i) => { r.finalRank = i + 1 })
    }

    // Compute raw mean per participant for display
    const rawMeanMap = new Map<string, number>()
    const uniqueParticipantIds = [...new Set(evaluatorScores.map((s) => s.participantId))]
    for (const pid of uniqueParticipantIds) {
      const scores = evaluatorScores
        .filter((s) => s.participantId === pid)
        .map((s) => s.rawScore)
      rawMeanMap.set(pid, scores.reduce((a, b) => a + b, 0) / scores.length)
    }

    winners = orderedResults.slice(0, 3).map((r) => {
      const rawMean = rawMeanMap.get(r.participantId) ?? 0
      const displayScore =
        scoringMode === "average"
          ? Math.round((rawMean + (companyScores.get(r.participantId) ?? 0)) / 2)
          : Math.round(rawMean)

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
    const leaderboard = (participants as any[]).filter((p: any) => !!p.user_id).map((p: any) => {
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

  // Fetch challenge difficulty and per-challenge XP multiplier
  const { data: challengeForXp } = await (supabase
    .from("challenges")
    .select("difficulty, xp_multiplier")
    .eq("id", challengeId)
    .single() as any)

  const challengeDifficulty = (challengeForXp as any)?.difficulty ?? "beginner"
  const challengeXpMultiplier: number = (challengeForXp as any)?.xp_multiplier ?? 1.0

  // Fetch global XP formula settings from platform_settings
  const { data: xpSettings } = await (supabase
    .from("platform_settings")
    .select("xp_score_threshold, xp_penalty, xp_base_min, xp_base_max")
    .eq("id", true)
    .single() as any)

  const xpFormulaOptions = {
    xpMultiplier: challengeXpMultiplier,
    scoreThreshold: (xpSettings as any)?.xp_score_threshold ?? 70,
    penalty: (xpSettings as any)?.xp_penalty ?? 50,
    baseMin: (xpSettings as any)?.xp_base_min ?? 50,
    baseMax: (xpSettings as any)?.xp_base_max ?? 400,
  }

  for (const p of activeParticipants ?? []) {
    if (!p.user_id) continue

    // Award skill tags — unchanged, do not remove
    await awardChallengeSkills(supabase, challengeId, p.user_id, scoringMode)

    // Compute this participant's final score (0–100) for XP calculation
    const { data: participantRow } = await supabase
      .from("challenge_participants")
      .select(`
        submissions (
          evaluations (
            score,
            profiles ( role )
          )
        )
      `)
      .eq("challenge_id", challengeId)
      .eq("user_id", p.user_id)
      .single()

    const allEvals = ((participantRow as any)?.submissions ?? [])
      .flatMap((s: any) => s.evaluations ?? [])

    const companyEval = allEvals.find(
      (e: any) =>
        e.profiles?.role === "company_admin" || e.profiles?.role === "company_member"
    )
    const evaluatorEval = allEvals.find((e: any) => e.profiles?.role === "evaluator")

    const finalScore = getFinalScore({
      companyScore: companyEval?.score ?? null,
      evaluatorScore: evaluatorEval?.score ?? null,
      scoringMode,
    }) ?? 0

    await awardXp(supabase, p.user_id, challengeDifficulty, finalScore, xpFormulaOptions)
  }

  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath(`/company/challenges/${challengeId}`)
  revalidatePath(`/dashboard`)
  revalidatePath(`/challenges`)
  revalidatePath(`/challenges/${challengeId}/results`)

  return { success: true, error: null }
}

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

  const { data: challenge } = await (supabase
    .from("challenges")
    .select("organization_id")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge || challenge.organization_id !== profile.organization_id) {
    return { success: false, error: "Unauthorized access to this challenge." }
  }

  return closeChallengeInternal(supabase, challengeId, forceClose)
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
      // Sort by raw mean + company score blend for average mode
      orderedResults = [...rankedResults].sort((a, b) => {
        const aScores = evaluatorScores.filter((s) => s.participantId === a.participantId).map((s) => s.rawScore)
        const bScores = evaluatorScores.filter((s) => s.participantId === b.participantId).map((s) => s.rawScore)
        const aRawMean = aScores.length > 0 ? aScores.reduce((x, y) => x + y, 0) / aScores.length : 0
        const bRawMean = bScores.length > 0 ? bScores.reduce((x, y) => x + y, 0) / bScores.length : 0
        const aFinal = (aRawMean + (companyScores.get(a.participantId) ?? 0)) / 2
        const bFinal = (bRawMean + (companyScores.get(b.participantId) ?? 0)) / 2
        return bFinal - aFinal
      })
      orderedResults.forEach((r, i) => { r.finalRank = i + 1 })
    }

    // Compute raw mean per participant for display
    const rawMeanMap = new Map<string, number>()
    const uniqueParticipantIds = [...new Set(evaluatorScores.map((s) => s.participantId))]
    for (const pid of uniqueParticipantIds) {
      const scores = evaluatorScores
        .filter((s) => s.participantId === pid)
        .map((s) => s.rawScore)
      rawMeanMap.set(pid, scores.reduce((a, b) => a + b, 0) / scores.length)
    }

    winners = orderedResults.slice(0, 3).map((r) => {
      const rawMean = rawMeanMap.get(r.participantId) ?? 0
      const displayScore =
        scoringMode === "average"
          ? Math.round((rawMean + (companyScores.get(r.participantId) ?? 0)) / 2)
          : Math.round(rawMean)

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
    const leaderboard = (participants as any[]).filter((p: any) => !!p.user_id).map((p: any) => {
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
      profile.role !== "company_admin")
  ) {
    return { success: false, error: "Unauthorized" }
  }

  // 2. Company org ownership check
  if (profile.role === "company_admin") {
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

  await logActivity({
    log_type: profile.role === "admin" ? "admin" : "company",
    actor_id: user.id,
    action: ActivityAction.TIE_RESOLVED,
    entity_type: EntityType.CHALLENGE,
    entity_id: params.challengeId,
    metadata: {
      challenge_id: params.challengeId,
      resolutions: params.resolutions,
      resolver_role: profile.role,
    },
  })

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

// --- ACTION: GET CHALLENGE TABULATION ---
export async function getChallengeTabulation(challengeId: string): Promise<{
  scoringMode: string
  isRankedMode: boolean
  evaluators: Array<{
    evaluatorId: string
    evaluatorName: string
    isChief: boolean
  }>
  rows: Array<{
    participantId: string
    participantName: string
    rawScores: Record<string, number | null>
    companyScore: number | null
    rankPerEvaluator: Record<string, number | null>
    rankSum: number | null
    normalizedScoreAvg: number | null
    finalRank: number | null
    isTied: boolean
    tiebreakerUsed: string
  }>
}> {
  const empty = (scoringMode: string) => ({
    scoringMode,
    isRankedMode: false as const,
    evaluators: [] as Array<{ evaluatorId: string; evaluatorName: string; isChief: boolean }>,
    rows: [] as Array<{
      participantId: string
      participantName: string
      rawScores: Record<string, number | null>
      companyScore: number | null
      rankPerEvaluator: Record<string, number | null>
      rankSum: number | null
      normalizedScoreAvg: number | null
      finalRank: number | null
      isTied: boolean
      tiebreakerUsed: string
    }>,
  })

  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty("company_only")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile) return empty("company_only")

  // 2. Fetch challenge scoring_mode and organization_id
  const { data: challenge } = await supabase
    .from("challenges")
    .select("scoring_mode, organization_id")
    .eq("id", challengeId)
    .single()

  if (!challenge) return empty("company_only")

  // Authorize: admin or company member/admin matching the challenge org
  const isAdmin = profile.role === "admin"
  const isCompanyMember =
    (profile.role === "company_admin" || profile.role === "company_member") &&
    profile.organization_id === challenge.organization_id

  if (!isAdmin && !isCompanyMember) return empty(challenge.scoring_mode ?? "company_only")

  const scoringMode = (challenge.scoring_mode ?? "company_only") as "company_only" | "evaluator_only" | "average"

  // 3. Fetch evaluators with profile names (explicit FK to avoid PGRST201)
  const { data: evaluatorRows } = await (supabase
    .from("challenge_evaluators")
    .select(`
      evaluator_id,
      is_chief,
      profiles!challenge_evaluators_evaluator_id_fkey (first_name, last_name)
    `)
    .eq("challenge_id", challengeId) as any)

  const evaluators: Array<{ evaluatorId: string; evaluatorName: string; isChief: boolean }> =
    ((evaluatorRows ?? []) as any[]).map((r: any) => ({
      evaluatorId: r.evaluator_id as string,
      evaluatorName:
        `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.trim() || "Unknown",
      isChief: r.is_chief === true,
    }))

  // 4. Gate on ranked mode
  const isRankedMode = shouldUseRankedMode({ scoringMode, evaluatorCount: evaluators.length })
  if (!isRankedMode) return { ...empty(scoringMode), scoringMode }

  // 5. Chief evaluator
  const chiefRow = evaluators.find((e) => e.isChief)
  const chiefEvaluatorId: string | null = chiefRow?.evaluatorId ?? null

  // 6. Fetch active participants with profile names (explicit FK)
  const { data: participantRows } = await (supabase
    .from("challenge_participants")
    .select(`
      id,
      user_id,
      profiles!challenge_participants_user_id_fkey (first_name, last_name)
    `)
    .eq("challenge_id", challengeId)
    .eq("status", "active") as any)

  const participants: Array<{
    id: string
    user_id: string
    first_name: string | null
    last_name: string | null
  }> = ((participantRows ?? []) as any[]).map((p: any) => ({
    id: p.id as string,
    user_id: p.user_id as string,
    first_name: (p.profiles?.first_name ?? null) as string | null,
    last_name: (p.profiles?.last_name ?? null) as string | null,
  }))

  // 7. Single query — participants + submissions + evaluations (no N+1)
  const { data: participantsWithEvals } = await (supabase
    .from("challenge_participants")
    .select(`
      id,
      user_id,
      submissions (
        evaluations (
          score,
          reviewer_id,
          is_draft,
          profiles!evaluations_reviewer_id_fkey (role)
        )
      )
    `)
    .eq("challenge_id", challengeId)
    .eq("status", "active") as any)

  // 8. Build evaluatorScores and companyScores
  const evaluatorScores: EvaluatorScore[] = []
  const companyScores = new Map<string, number | null>()

  for (const p of ((participantsWithEvals ?? []) as any[])) {
    companyScores.set(p.user_id as string, null)

    for (const sub of ((p.submissions ?? []) as any[])) {
      for (const ev of ((sub.evaluations ?? []) as any[])) {
        if (ev.is_draft !== false) continue

        const role = ev.profiles?.role as string | undefined

        if (role === "evaluator" && ev.score !== null && ev.reviewer_id !== null) {
          evaluatorScores.push({
            evaluatorId: ev.reviewer_id as string,
            participantId: p.user_id as string,
            rawScore: ev.score as number,
          })
        }

        if (
          (role === "company_admin" || role === "company_member") &&
          ev.score !== null
        ) {
          companyScores.set(p.user_id as string, ev.score as number)
        }
      }
    }
  }

  // 9. Compute ranked results
  const rankedResults = computeRankedResults({ evaluatorScores, companyScores, chiefEvaluatorId })
  const rankedMap = new Map(rankedResults.map((r) => [r.participantId, r]))

  // 10. Build rankPerEvaluator: group evaluator scores by evaluatorId, assign average ranks
  const byEvaluator = new Map<string, EvaluatorScore[]>()
  for (const s of evaluatorScores) {
    const group = byEvaluator.get(s.evaluatorId) ?? []
    group.push(s)
    byEvaluator.set(s.evaluatorId, group)
  }

  // For each evaluator → Map<participantId, rank>
  const evaluatorRankMaps = new Map<string, Map<string, number>>()
  for (const [evalId, scores] of byEvaluator) {
    const sorted = [...scores].sort((a, b) => b.rawScore - a.rawScore)
    const rankMap = new Map<string, number>()
    let i = 0
    while (i < sorted.length) {
      let j = i
      while (j < sorted.length && sorted[j].rawScore === sorted[i].rawScore) {
        j++
      }
      const avgRank = (i + 1 + j) / 2
      for (let k = i; k < j; k++) {
        rankMap.set(sorted[k].participantId, avgRank)
      }
      i = j
    }
    evaluatorRankMaps.set(evalId, rankMap)
  }

  // 11. Build rows — one per participant
  const rows = participants.map((p) => {
    const rankedResult = rankedMap.get(p.user_id)

    const rawScores: Record<string, number | null> = {}
    const rankPerEvaluator: Record<string, number | null> = {}

    for (const ev of evaluators) {
      const score = evaluatorScores.find(
        (s) => s.evaluatorId === ev.evaluatorId && s.participantId === p.user_id
      )
      rawScores[ev.evaluatorId] = score?.rawScore ?? null
      rankPerEvaluator[ev.evaluatorId] =
        evaluatorRankMaps.get(ev.evaluatorId)?.get(p.user_id) ?? null
    }

    return {
      participantId: p.user_id,
      participantName: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown",
      rawScores,
      companyScore: companyScores.get(p.user_id) ?? null,
      rankPerEvaluator,
      rankSum: rankedResult?.rankSum ?? null,
      normalizedScoreAvg: rankedResult?.normalizedScoreAvg ?? null,
      finalRank: rankedResult?.finalRank ?? null,
      isTied: rankedResult?.isTied ?? false,
      tiebreakerUsed: rankedResult?.tiebreakerUsed ?? "none",
    }
  })

  // 12. Sort by finalRank ascending, nulls last
  rows.sort((a, b) => {
    if (a.finalRank === null) return 1
    if (b.finalRank === null) return -1
    return a.finalRank - b.finalRank
  })

  // 13. Return
  return {
    scoringMode,
    isRankedMode: true,
    evaluators,
    rows,
  }
}