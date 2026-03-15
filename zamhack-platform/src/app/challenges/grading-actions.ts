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

  if (profile.role !== "company_admin" && profile.role !== "company_member") {
    return { success: false, error: "Unauthorized: Only company members can evaluate submissions" }
  }

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

  if (challenge.organization_id !== profile.organization_id) {
    return { success: false, error: "Unauthorized: You can only evaluate submissions for your organization's challenges" }
  }

  const totalScore = directScore !== undefined
    ? directScore
    : rubricScores.reduce((sum, item) => sum + item.score, 0)

  const { data: existingEvaluation } = await supabase
    .from("evaluations")
    .select("id")
    .eq("submission_id", submissionId)
    .maybeSingle()

  const evaluationData: EvaluationInsert | EvaluationUpdate = {
    submission_id: submissionId,
    reviewer_id: user.id,
    score: totalScore,
    feedback: feedback,
    is_draft: isDraft,
    updated_at: new Date().toISOString(),
  }

  let error: { error: string } | null = null

  if (existingEvaluation) {
    const { error: updateError } = await supabase
      .from("evaluations")
      .update(evaluationData)
      .eq("id", existingEvaluation.id)

    if (updateError) {
      error = { error: updateError.message || "Failed to update evaluation" }
    }
  } else {
    const { error: insertError } = await supabase
      .from("evaluations")
      .insert(evaluationData)

    if (insertError) {
      error = { error: insertError.message || "Failed to create evaluation" }
    }
  }

  if (error) {
    return { success: false, error: error.error }
  }

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

  revalidatePath(`/company/challenges/${milestone.challenge_id}`)

  return { success: true }
}

