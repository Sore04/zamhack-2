"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { logActivity, ActivityAction, EntityType } from "@/lib/activity-log"

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

  await logActivity({
    log_type: 'admin',
    actor_id: user.id,
    action: ActivityAction.ORG_APPROVED,
    entity_type: EntityType.ORGANIZATION,
    entity_id: orgId,
    entity_label: undefined,
    metadata: { org_id: orgId },
  })

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

  await logActivity({
    log_type: 'admin',
    actor_id: user.id,
    action: ActivityAction.ORG_REJECTED,
    entity_type: EntityType.ORGANIZATION,
    entity_id: orgId,
    metadata: { org_id: orgId },
  })

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

  const { data: challengeForLog } = await supabase
    .from('challenges')
    .select('title, organization_id')
    .eq('id', challengeId)
    .single()

  const { error } = await supabase
    .from("challenges")
    .update({ status: "approved" })
    .eq("id", challengeId)

  if (error) throw new Error("Failed to approve challenge")

  await logActivity({
    log_type: 'admin',
    actor_id: user.id,
    action: ActivityAction.CHALLENGE_APPROVED,
    entity_type: EntityType.CHALLENGE,
    entity_id: challengeId,
    entity_label: challengeForLog?.title ?? undefined,
    organization_id: challengeForLog?.organization_id ?? undefined,
    metadata: { challenge_id: challengeId },
  })

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

  const { data: challengeForLog } = await supabase
    .from('challenges')
    .select('title, organization_id')
    .eq('id', challengeId)
    .single()

  const { error } = await supabase
    .from("challenges")
    .update({ status: "draft" })
    .eq("id", challengeId)

  if (error) throw new Error("Failed to reject challenge")

  await logActivity({
    log_type: 'admin',
    actor_id: user.id,
    action: ActivityAction.CHALLENGE_REJECTED,
    entity_type: EntityType.CHALLENGE,
    entity_id: challengeId,
    entity_label: challengeForLog?.title ?? undefined,
    organization_id: challengeForLog?.organization_id ?? undefined,
    metadata: { challenge_id: challengeId },
  })

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

  await logActivity({
    log_type: 'admin',
    actor_id: user.id,
    action: ActivityAction.PENDING_EDIT_APPROVED,
    entity_type: EntityType.PENDING_EDIT,
    entity_id: pendingEditId,
    entity_label: undefined,
    metadata: {
      pending_edit_id: pendingEditId,
      challenge_id: pendingEdit.challenge_id,
    },
  })

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

  await logActivity({
    log_type: 'admin',
    actor_id: user.id,
    action: ActivityAction.PENDING_EDIT_REJECTED,
    entity_type: EntityType.PENDING_EDIT,
    entity_id: pendingEditId,
    entity_label: undefined,
    metadata: {
      pending_edit_id: pendingEditId,
      challenge_id: pendingEdit.challenge_id,
    },
  })

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

export async function setChiefEvaluator(
  challengeId: string,
  evaluatorId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { success: false, error: "Unauthorized" }

  // Guard: block reassignment once any non-draft evaluation exists for this challenge.
  // Step 1 — collect all milestone IDs for this challenge.
  const { data: milestoneRows } = await supabase
    .from("milestones")
    .select("id")
    .eq("challenge_id", challengeId)

  const milestoneIds = (milestoneRows ?? []).map((m) => m.id)

  if (milestoneIds.length > 0) {
    // Step 2 — count finalized evaluations on submissions for those milestones.
    const { data: submissionRows } = await supabase
      .from("submissions")
      .select("id")
      .in("milestone_id", milestoneIds)

    const submissionIds = (submissionRows ?? []).map((s) => s.id)

    if (submissionIds.length > 0) {
      const { count } = await supabase
        .from("evaluations")
        .select("id", { count: "exact", head: true })
        .in("submission_id", submissionIds)
        .eq("is_draft", false)

      if ((count ?? 0) > 0) {
        return {
          success: false,
          error: "Cannot reassign chief evaluator after evaluations have begun.",
        }
      }
    }
  }

  // Clear any existing chief for this challenge
  const { error: clearError } = await (supabase
    .from("challenge_evaluators")
    .update({ is_chief: false } as any)
    .eq("challenge_id", challengeId) as any)

  if (clearError) return { success: false, error: clearError.message }

  // Set the new chief
  const { error: setError } = await (supabase
    .from("challenge_evaluators")
    .update({ is_chief: true } as any)
    .eq("challenge_id", challengeId)
    .eq("evaluator_id", evaluatorId) as any)

  if (setError) return { success: false, error: setError.message }

  revalidatePath(`/admin/challenges/${challengeId}`)
  return { success: true, error: null }
}

// ==========================================
// EVALUATOR CREATION
// ==========================================

// ==========================================
// EARNED SKILL GRANT (ADMIN)
// ==========================================

export async function grantEarnedSkill(
  profileId: string,
  skillId: string,
  tier: string
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

  const validTiers = ["beginner", "intermediate", "advanced"]
  if (!validTiers.includes(tier)) return { success: false, error: "Invalid tier" }

  const { error } = await (supabase
    .from("student_earned_skills")
    .upsert(
      {
        profile_id: profileId,
        skill_id: skillId,
        tier: tier as "beginner" | "intermediate" | "advanced",
        source: "admin",
        challenge_id: null,
      },
      { onConflict: "profile_id,skill_id" }
    ) as any)

  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/users")
  revalidatePath("/profile")
  return { success: true }
}

// ==========================================
// GUARDRAIL SETTINGS (ADMIN)
// ==========================================

export async function updateGuardrailLimit(
  limit: number | null
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

  if (limit !== null && (limit < 0 || !Number.isInteger(limit))) {
    return { success: false, error: "Limit must be a non-negative integer or null" }
  }

  const { error } = await (supabase
    .from("platform_settings")
    .update({ advanced_beginner_weekly_limit: limit })
    .eq("id", true) as any)

  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/challenges")
  return { success: true }
}

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

export async function adjustStudentXp(
  profileId: string,
  newXpPoints: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (adminProfile?.role !== "admin") return { success: false, error: "Unauthorized" }
  if (newXpPoints < 0) return { success: false, error: "XP cannot be negative" }

  const newRank =
    newXpPoints >= 5001 ? "advanced" :
    newXpPoints >= 2001 ? "intermediate" :
    "beginner"

  const { error } = await supabase
    .from("profiles")
    .update({ xp_points: newXpPoints, xp_rank: newRank } as any)
    .eq("id", profileId)

  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateXpGlobalSettings(settings: {
  scoreThreshold: number
  penalty: number
  baseMin: number
  baseMax: number
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") return { success: false, error: "Unauthorized" }

  const { error } = await (supabase
    .from("platform_settings")
    .update({
      xp_score_threshold: settings.scoreThreshold,
      xp_penalty: settings.penalty,
      xp_base_min: settings.baseMin,
      xp_base_max: settings.baseMax,
    })
    .eq("id", true) as any)

  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/challenges")
  return { success: true }
}

export async function updateChallengeXpMultiplier(
  challengeId: string,
  multiplier: number
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
  if (multiplier <= 0) return { success: false, error: "Multiplier must be positive" }

  const { error } = await (supabase
    .from("challenges")
    .update({ xp_multiplier: multiplier })
    .eq("id", challengeId) as any)

  if (error) return { success: false, error: error.message }

  revalidatePath("/admin/challenges")
  return { success: true }
}