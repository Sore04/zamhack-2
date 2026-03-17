"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

// ==========================================
// ORGANIZATION ACTIONS
// ==========================================

export async function approveOrganization(orgId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) return { success: false, error: "Profile not found" }
  if (profile.role !== "admin") return { success: false, error: "Unauthorized: Admin access required" }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ status: "active" })
    .eq("id", orgId)

  if (updateError) return { success: false, error: updateError.message || "Failed to approve organization" }

  revalidatePath("/admin/dashboard")
  return { success: true }
}

export async function rejectOrganization(orgId: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) return { success: false, error: "Profile not found" }
  if (profile.role !== "admin") return { success: false, error: "Unauthorized: Admin access required" }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ status: "rejected" })
    .eq("id", orgId)

  if (updateError) return { success: false, error: updateError.message || "Failed to reject organization" }

  revalidatePath("/admin/dashboard")
  return { success: true }
}

// ==========================================
// CHALLENGE ACTIONS
// ==========================================

export async function approveChallenge(challengeId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") throw new Error("Unauthorized")

  const { error } = await supabase
    .from("challenges")
    .update({ status: "approved" })
    .eq("id", challengeId)

  if (error) throw new Error("Failed to approve challenge")

  revalidatePath("/admin/dashboard")
  revalidatePath(`/admin/challenges/${challengeId}`)
}

export async function rejectChallenge(challengeId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") throw new Error("Unauthorized")

  const { error } = await supabase
    .from("challenges")
    .update({ status: "draft" })
    .eq("id", challengeId)

  if (error) throw new Error("Failed to reject challenge")

  revalidatePath("/admin/dashboard")
  revalidatePath(`/admin/challenges/${challengeId}`)
}

// ==========================================
// PENDING EDIT ACTIONS
// ==========================================

export async function approvePendingEdit(pendingEditId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") throw new Error("Unauthorized")

  const { data: pendingEdit, error: fetchError } = await supabase
    .from("challenge_pending_edits")
    .select("*")
    .eq("id", pendingEditId)
    .single()

  if (fetchError || !pendingEdit) throw new Error("Pending edit not found")
  if (pendingEdit.status !== "pending") throw new Error("Edit has already been reviewed")

  const payload = pendingEdit.payload as any
  const challengeId = pendingEdit.challenge_id

  // Apply core challenge fields (original columns — always work)
  const { error: challengeError } = await supabase
    .from("challenges")
    .update({
      title: payload.title,
      description: payload.description,
      problem_brief: payload.problem_brief,
      industry: payload.industries?.[0] ?? payload.industry ?? null,
      difficulty: payload.difficulty,
      status: payload.status,
      participation_type: payload.participation_type,
      max_participants: payload.max_participants,
      max_teams: payload.max_teams,
      max_team_size: payload.max_team_size,
      start_date: payload.is_perpetual ? null : (payload.start_date || null),
      end_date: payload.is_perpetual ? null : (payload.end_date || null),
      registration_deadline: payload.is_perpetual ? null : (payload.registration_deadline || null),
      entry_fee_amount: payload.entry_fee_amount,
      currency: payload.currency,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", challengeId)

  if (challengeError) throw new Error(`Failed to apply challenge edits: ${challengeError.message}`)

  // Apply new columns separately (industries, location, perpetual)
  const { error: newFieldsError } = await supabase
    .from("challenges")
    .update({
      industries: payload.industries ?? [],
      is_perpetual: payload.is_perpetual ?? false,
      location_type: payload.location_type ?? null,
      location_details: payload.location_type === "onsite"
        ? (payload.location_details ?? null)
        : null,
    } as any)
    .eq("id", challengeId)

  if (newFieldsError) throw new Error(`Failed to apply new fields: ${newFieldsError.message}`)

  // Apply milestone changes
  for (const milestone of payload.milestones ?? []) {
    if (milestone.id) {
      await supabase
        .from("milestones")
        .update({
          title: milestone.title,
          description: milestone.description,
          due_date: milestone.due_date || null,
          sequence_order: milestone.sequence_order,
          requires_github: milestone.requires_github,
          requires_url: milestone.requires_url,
          requires_text: milestone.requires_text,
        })
        .eq("id", milestone.id)
    } else {
      await supabase.from("milestones").insert({
        challenge_id: challengeId,
        title: milestone.title,
        description: milestone.description,
        due_date: milestone.due_date || null,
        sequence_order: milestone.sequence_order,
        requires_github: milestone.requires_github,
        requires_url: milestone.requires_url,
        requires_text: milestone.requires_text,
      })
    }
  }

  // Mark as approved
  await supabase
    .from("challenge_pending_edits")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", pendingEditId)

  revalidatePath(`/admin/challenges/${challengeId}`)
  revalidatePath(`/company/challenges/${challengeId}`)
  revalidatePath(`/challenges/${challengeId}`)
}

export async function rejectPendingEdit(pendingEditId: string, adminNote?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") throw new Error("Unauthorized")

  const { data: pendingEdit, error: fetchError } = await supabase
    .from("challenge_pending_edits")
    .select("challenge_id, status")
    .eq("id", pendingEditId)
    .single()

  if (fetchError || !pendingEdit) throw new Error("Pending edit not found")
  if (pendingEdit.status !== "pending") throw new Error("Edit has already been reviewed")

  const { error } = await supabase
    .from("challenge_pending_edits")
    .update({
      status: "rejected",
      admin_note: adminNote ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", pendingEditId)

  if (error) throw new Error("Failed to reject pending edit")

  revalidatePath(`/admin/challenges/${pendingEdit.challenge_id}`)
  revalidatePath(`/company/challenges/${pendingEdit.challenge_id}`)
}

// ==========================================
// EVALUATOR ASSIGNMENT ACTIONS
// ==========================================

export async function assignEvaluator(
  challengeId: string,
  evaluatorId: string,
  reviewDeadline: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { success: false, error: "Unauthorized" }

  // Verify the evaluator exists and has the evaluator role
  const { data: evaluatorProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", evaluatorId)
    .single()

  if (!evaluatorProfile || evaluatorProfile.role !== "evaluator") {
    return { success: false, error: "User is not an evaluator" }
  }

  // Upsert — if already assigned, update the deadline
  const { error } = await supabase
    .from("challenge_evaluators")
    .upsert(
      {
        challenge_id: challengeId,
        evaluator_id: evaluatorId,
        assigned_at: new Date().toISOString(),
        review_deadline: reviewDeadline || null,
      },
      { onConflict: "challenge_id,evaluator_id" }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/admin/challenges/${challengeId}`)
  revalidatePath(`/evaluator/assignments`)
  return { success: true }
}

export async function removeEvaluator(
  challengeId: string,
  evaluatorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { success: false, error: "Unauthorized" }

  const { error } = await supabase
    .from("challenge_evaluators")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("evaluator_id", evaluatorId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/admin/challenges/${challengeId}`)
  revalidatePath(`/evaluator/assignments`)
  return { success: true }
}
// ==========================================
// EVALUATOR CREATION
// ==========================================

export async function createEvaluator(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ success: boolean; error?: string }> {
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js")

  // Verify calling user is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { success: false, error: "Unauthorized" }

  // Use service role client to create auth user
  const serviceClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Invite user by email — sends set-password link
  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    email,
    { data: { first_name: firstName, last_name: lastName } }
  )

  if (inviteError || !inviteData.user) {
    return { success: false, error: inviteError?.message || "Failed to send invite" }
  }

  // Update their profile to set role + name
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({
      role: "evaluator",
      first_name: firstName,
      last_name: lastName,
    })
    .eq("id", inviteData.user.id)

  if (profileError) {
    return { success: false, error: "Invite sent but failed to set evaluator role: " + profileError.message }
  }

  revalidatePath("/admin/users")
  return { success: true }
}