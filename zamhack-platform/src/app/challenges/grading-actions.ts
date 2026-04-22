"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"
import { awardXp } from "@/lib/award-xp"
import { getFinalScore, type ScoringMode } from "@/lib/scoring-utils"
import { logActivity, ActivityAction } from "@/lib/activity-log"

type EvaluationInsert = Database["public"]["Tables"]["evaluations"]["Insert"]
type EvaluationUpdate = Database["public"]["Tables"]["evaluations"]["Update"]

export async function submitEvaluation(
  submissionId: string,
  rubricScores: { rubric_id: string; score: number }[],
  feedback: string,
  isDraft: boolean,
  directScore?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, error: "User profile not found" }
  }

  const isCompany = profile.role === "company_admin" || profile.role === "company_member"
  const isEvaluator = profile.role === "evaluator"

  if (!isCompany && !isEvaluator) {
    return { success: false, error: "Unauthorized: Only company members or evaluators can evaluate submissions" }
  }

  // Fetch submission
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id, milestone_id, participant_id")
    .eq("id", submissionId)
    .single()

  if (submissionError || !submission) {
    return { success: false, error: "Submission not found" }
  }

  if (!submission.milestone_id) {
    return { success: false, error: "Submission is not linked to a milestone" }
  }

  // Fetch milestone → challenge
  const { data: milestone, error: milestoneError } = await supabase
    .from("milestones")
    .select("challenge_id")
    .eq("id", submission.milestone_id)
    .single()

  if (milestoneError || !milestone || !milestone.challenge_id) {
    return { success: false, error: "Milestone not found" }
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, organization_id, is_perpetual, difficulty, xp_multiplier, scoring_mode")
    .eq("id", milestone.challenge_id)
    .single()

  if (challengeError || !challenge) {
    return { success: false, error: "Challenge not found" }
  }

  // ── Ownership check (different per role) ──────────────────────────────────

  if (isCompany) {
    if (challenge.organization_id !== profile.organization_id) {
      return { success: false, error: "Unauthorized: You can only evaluate submissions for your organization's challenges" }
    }
  }

  if (isEvaluator) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("challenge_evaluators")
      .select("evaluator_id")
      .eq("challenge_id", challenge.id)
      .eq("evaluator_id", user.id)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return { success: false, error: "Unauthorized: You are not assigned to evaluate this challenge" }
    }
  }

  // ── Compute score ─────────────────────────────────────────────────────────

  const totalScore = directScore !== undefined
    ? directScore
    : rubricScores.reduce((sum, item) => sum + item.score, 0)

  // ── Upsert evaluation — scoped to this reviewer ───────────────────────────
  // Each reviewer (company or evaluator) gets their own evaluation row.
  // Match on submission_id AND reviewer_id to avoid overwriting each other.

  const { data: existingEvaluation } = await supabase
    .from("evaluations")
    .select("id, is_draft")
    .eq("submission_id", submissionId)
    .eq("reviewer_id", user.id)
    .maybeSingle()

  const evaluationData: EvaluationInsert | EvaluationUpdate = {
    submission_id: submissionId,
    reviewer_id: user.id,
    score: totalScore,
    feedback: feedback,
    is_draft: isDraft,
    updated_at: new Date().toISOString(),
  }

  let evalError: { error: string } | null = null

  if (existingEvaluation) {
    const { error: updateError } = await supabase
      .from("evaluations")
      .update(evaluationData)
      .eq("id", existingEvaluation.id)

    if (updateError) {
      evalError = { error: updateError.message || "Failed to update evaluation" }
    } else if (existingEvaluation.is_draft === false && !isDraft) {
      // A previously submitted evaluation was edited — log it.
      await logActivity({
        log_type: isEvaluator ? "admin" : "company",
        actor_id: user.id,
        action: ActivityAction.EVALUATION_EDITED,
        entity_type: "submission",
        entity_id: submissionId,
        metadata: {
          challenge_id: challenge.id,
          submission_id: submissionId,
          new_score: totalScore,
          new_feedback: feedback,
        },
      })
    }
  } else {
    const { error: insertError } = await supabase
      .from("evaluations")
      .insert(evaluationData)

    if (insertError) {
      evalError = { error: insertError.message || "Failed to create evaluation" }
    }
  }

  if (evalError) {
    return { success: false, error: evalError.error }
  }

  // ── Save rubric scores ────────────────────────────────────────────────────

  await supabase
    .from("scores" as any)
    .delete()
    .eq("submission_id", submissionId)

  if (rubricScores.length > 0) {
    const scoreRows = rubricScores.map((s) => ({
      submission_id: submissionId,
      rubric_id: s.rubric_id,
      points_awarded: s.score,
    }))

    const { error: scoresError } = await supabase
      .from("scores" as any)
      .insert(scoreRows)

    if (scoresError) {
      console.error("Failed to insert detailed scores:", scoresError)
      return { success: false, error: "Saved overall evaluation, but failed to save detailed rubric scores." }
    }
  }

  // Revalidate relevant paths for both roles
  revalidatePath(`/company/challenges/${milestone.challenge_id}`)
  revalidatePath(`/evaluator/assignments/${milestone.challenge_id}`)

  // --- PERPETUAL CHALLENGE XP AWARD ---
  // For perpetual challenges (no close event), award XP when a final evaluation
  // is submitted. Non-perpetual challenges get XP via closeChallenge() instead.
  if (!isDraft && (challenge as any).is_perpetual === true) {
    // Get the participant's user_id
    const { data: participantRow } = await supabase
      .from("challenge_participants")
      .select("user_id")
      .eq("id", submission.participant_id!)
      .single()

    const participantUserId = participantRow?.user_id
    if (participantUserId) {
      // Check all milestones are submitted for this participant
      const { data: milestoneIds } = await supabase
        .from("milestones")
        .select("id")
        .eq("challenge_id", challenge.id)

      const { count: totalMilestones } = await supabase
        .from("milestones")
        .select("id", { count: "exact" })
        .eq("challenge_id", challenge.id)

      const { count: submittedCount } = await supabase
        .from("submissions")
        .select("id", { count: "exact" })
        .eq("participant_id", submission.participant_id!)
        .in("milestone_id", milestoneIds?.map((m) => m.id) ?? [])

      if (submittedCount === totalMilestones && totalMilestones !== null && totalMilestones > 0) {
        // Fetch all evaluations for this participant to compute final score
        const { data: participantEvalRow } = await supabase
          .from("challenge_participants")
          .select(`
            submissions (
              evaluations (
                score,
                is_draft,
                profiles ( role )
              )
            )
          `)
          .eq("challenge_id", challenge.id)
          .eq("user_id", participantUserId)
          .single()

        const allEvals = ((participantEvalRow as any)?.submissions ?? [])
          .flatMap((s: any) => s.evaluations ?? [])
          .filter((e: any) => e.is_draft === false)

        const companyEval = allEvals.find(
          (e: any) =>
            e.profiles?.role === "company_admin" || e.profiles?.role === "company_member"
        )
        const evaluatorEval = allEvals.find((e: any) => e.profiles?.role === "evaluator")

        const scoringMode = ((challenge as any).scoring_mode ?? "company_only") as ScoringMode
        const finalScore = getFinalScore({
          companyScore: companyEval?.score ?? null,
          evaluatorScore: evaluatorEval?.score ?? null,
          scoringMode,
        }) ?? 0

        // Fetch global XP formula settings (same as closeChallenge)
        const { data: xpSettings } = await (supabase
          .from("platform_settings")
          .select("xp_score_threshold, xp_penalty, xp_base_min, xp_base_max")
          .eq("id", true)
          .single() as any)

        const xpFormulaOptions = {
          xpMultiplier: (challenge as any).xp_multiplier ?? 1.0,
          scoreThreshold: (xpSettings as any)?.xp_score_threshold ?? 70,
          penalty: (xpSettings as any)?.xp_penalty ?? 50,
          baseMin: (xpSettings as any)?.xp_base_min ?? 50,
          baseMax: (xpSettings as any)?.xp_base_max ?? 400,
        }

        const challengeDifficulty = (challenge as any).difficulty ?? "beginner"
        await awardXp(supabase, participantUserId, challengeDifficulty, finalScore, xpFormulaOptions)
      }
    }
  }

  return { success: true }
}

// ─── Rubric Management ────────────────────────────────────────────────────────

async function getCompanyChallenge(challengeId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { supabase, user: null, error: "Not authenticated" }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) return { supabase, user, error: "Profile not found" }
  if (profile.role !== "company_admin" && profile.role !== "company_member") {
    return { supabase, user, error: "Unauthorized" }
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id, organization_id")
    .eq("id", challengeId)
    .single()

  if (challengeError || !challenge) return { supabase, user, error: "Challenge not found" }
  if (challenge.organization_id !== profile.organization_id) {
    return { supabase, user, error: "Unauthorized: This challenge does not belong to your organization" }
  }

  return { supabase, user, error: null }
}

export async function saveRubric(
  challengeId: string,
  criteriaName: string,
  maxPoints: number,
  rubricId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const { supabase, error: authError } = await getCompanyChallenge(challengeId)
  if (authError) return { success: false, error: authError }

  const trimmedName = criteriaName.trim()
  if (!trimmedName) return { success: false, error: "Criteria name cannot be empty" }
  if (maxPoints < 1 || maxPoints > 1000) return { success: false, error: "Max points must be between 1 and 1000" }

  if (rubricId) {
    const { data: existing, error: fetchError } = await supabase
      .from("rubrics")
      .select("id, challenge_id")
      .eq("id", rubricId)
      .single()

    if (fetchError || !existing) return { success: false, error: "Rubric not found" }
    if (existing.challenge_id !== challengeId) return { success: false, error: "Unauthorized" }

    const { error: updateError } = await supabase
      .from("rubrics")
      .update({ criteria_name: trimmedName, max_points: maxPoints })
      .eq("id", rubricId)

    if (updateError) return { success: false, error: updateError.message }

    revalidatePath(`/company/challenges/${challengeId}`)
    return { success: true, id: rubricId }
  }

  const { data: newRubric, error: insertError } = await supabase
    .from("rubrics")
    .insert({ challenge_id: challengeId, criteria_name: trimmedName, max_points: maxPoints })
    .select("id")
    .single()

  if (insertError || !newRubric) return { success: false, error: insertError?.message || "Failed to create rubric" }

  revalidatePath(`/company/challenges/${challengeId}`)
  return { success: true, id: newRubric.id }
}

export async function deleteRubric(
  rubricId: string,
  challengeId: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, error: authError } = await getCompanyChallenge(challengeId)
  if (authError) return { success: false, error: authError }

  const { data: existing, error: fetchError } = await supabase
    .from("rubrics")
    .select("id, challenge_id")
    .eq("id", rubricId)
    .single()

  if (fetchError || !existing) return { success: false, error: "Rubric not found" }
  if (existing.challenge_id !== challengeId) return { success: false, error: "Unauthorized" }

  const { error: deleteError } = await supabase
    .from("rubrics")
    .delete()
    .eq("id", rubricId)

  if (deleteError) return { success: false, error: deleteError.message }

  revalidatePath(`/company/challenges/${challengeId}`)
  return { success: true }
}
