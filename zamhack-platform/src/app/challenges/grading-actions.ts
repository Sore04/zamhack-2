"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"

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
    .select("id, organization_id")
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
    .select("id")
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