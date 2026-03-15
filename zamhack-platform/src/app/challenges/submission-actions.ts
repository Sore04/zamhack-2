"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"
import { autoEvaluateSubmission } from "@/lib/auto-evaluate"

type SubmissionInsert = Database["public"]["Tables"]["submissions"]["Insert"]

export async function submitMilestone(formData: FormData) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be logged in to submit a milestone" }
  }

  // Extract form data
  const milestoneId = formData.get("milestone_id") as string
  const participantId = formData.get("participant_id") as string
  const githubLink = formData.get("github_link") as string | null
  const demoUrl = formData.get("demo_url") as string | null
  const writtenResponse = formData.get("written_response") as string | null

  // Validate required fields
  if (!milestoneId || !participantId) {
    return { error: "Missing required fields: milestone_id and participant_id are required" }
  }

  // Verify participant belongs to the current user
  const { data: participant, error: participantError } = await supabase
    .from("challenge_participants")
    .select("id, user_id")
    .eq("id", participantId)
    .single()

  if (participantError || !participant) {
    return { error: "Participant record not found" }
  }

  if (participant.user_id !== user.id) {
    return { error: "You are not authorized to submit for this participant" }
  }

  // Check if submission already exists
  const { data: existingSubmission } = await supabase
    .from("submissions")
    .select("id")
    .eq("milestone_id", milestoneId)
    .eq("participant_id", participantId)
    .maybeSingle()

  const submissionData: SubmissionInsert = {
    milestone_id: milestoneId,
    participant_id: participantId,
    github_link: githubLink || null,
    demo_url: demoUrl || null,
    written_response: writtenResponse || null,
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  let error: { error: string } | null = null
  let submissionId: string | null = existingSubmission?.id ?? null

  if (existingSubmission) {
    // Update existing submission
    const { error: updateError } = await supabase
      .from("submissions")
      .update(submissionData)
      .eq("id", existingSubmission.id)

    if (updateError) {
      error = { error: updateError.message || "Failed to update submission" }
    }
  } else {
    // Insert new submission
    const { data: insertedRow, error: insertError } = await supabase
      .from("submissions")
      .insert(submissionData)
      .select("id")
      .single()

    if (insertError) {
      error = { error: insertError.message || "Failed to create submission" }
    } else {
      submissionId = insertedRow?.id ?? null
    }
  }

  if (error) {
    return error
  }

  // Revalidate the challenge page to update UI immediately
  // We need to get the challenge_id from the milestone to revalidate the correct path
  const { data: milestone } = await supabase
    .from("milestones")
    .select("challenge_id, requires_text, requires_github, requires_url")
    .eq("id", milestoneId)
    .single()

  if (milestone?.challenge_id) {
    revalidatePath(`/my-challenges/${milestone.challenge_id}`)
    revalidatePath(`/challenges/${milestone.challenge_id}`)
  }

  // Trigger LLM auto-evaluation after response is sent (non-blocking)
  // Only evaluate text-only milestones — skip when GitHub or URL submissions are required
  const isTextOnly =
    milestone?.requires_text === true &&
    !milestone?.requires_github &&
    !milestone?.requires_url

  if (submissionId && milestone?.challenge_id && isTextOnly) {
    after(() =>
      autoEvaluateSubmission(submissionId!, milestone.challenge_id!, milestoneId).catch((err) =>
        console.error("[auto-eval] failed:", err?.message ?? err)
      )
    )
  }

  return { success: true }
}















