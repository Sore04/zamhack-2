// src/app/challenges/edit-actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { type Enums, Database } from "@/types/supabase";
import { logActivity, ActivityAction, EntityType } from "@/lib/activity-log";

function getAdminSupabase() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type MilestoneInput = {
  id?: string;
  title: string;
  description: string;
  due_date: string;
  sequence_order: number;
  requires_github: boolean;
  requires_url: boolean;
  requires_text: boolean;
  criteria?: { criteriaName: string; maxPoints: number }[];
};

export type UpdateChallengeInput = {
  title: string;
  description: string;
  problem_brief: string;
  industries: string[];
  difficulty: Enums<"proficiency_level">;
  status: Enums<"challenge_status">;
  participation_type: "solo";
  max_participants: number;
  max_teams: number;
  max_team_size: number;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  entry_fee_amount: number;
  currency: string;
  is_perpetual: boolean;
  location_type: "online" | "onsite" | null;
  location_details: string | null;
  scoring_mode: "company_only" | "evaluator_only" | "average";
  milestones: MilestoneInput[];
};

// Challenges in these statuses have no live participants yet,
// so edits can be applied directly without admin review.
const DIRECT_EDIT_STATUSES = ["draft", "pending_approval", "rejected"];

export type UpdateChallengeResult =
  | { type: "updated"; redirectTo: string }
  | { type: "resubmitted"; redirectTo: string }
  | { type: "pending_review"; redirectTo: string };

export async function updateChallenge(
  challengeId: string,
  data: UpdateChallengeInput,
  bannerFormData: FormData | null = null
): Promise<UpdateChallengeResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  const { data: existing, error: fetchError } = await supabase
    .from("challenges")
    .select("status, created_by, organization_id")
    .eq("id", challengeId)
    .single();

  if (fetchError || !existing) throw new Error("Challenge not found");
  if (existing.created_by !== user.id) throw new Error("Unauthorized");

  const isDirect = DIRECT_EDIT_STATUSES.includes(existing.status ?? "");

  if (isDirect) {
    // Draft / Pending Approval → apply directly
    // Rejected challenges re-enter the approval queue on save.
    const resolvedStatus = data.status === "rejected" ? "pending_approval" : data.status;

    const { error: challengeError } = await supabase
      .from("challenges")
      .update({
        title: data.title,
        description: data.description,
        problem_brief: data.problem_brief,
        industry: data.industries?.[0] ?? null,
        industries: data.industries,
        difficulty: data.difficulty,
        status: resolvedStatus,
        participation_type: data.participation_type,
        max_participants: data.max_participants,
        max_teams: data.max_teams,
        max_team_size: data.max_team_size,
        start_date: data.is_perpetual ? null : (data.start_date || null),
        end_date: data.is_perpetual ? null : (data.end_date || null),
        registration_deadline: data.is_perpetual ? null : (data.registration_deadline || null),
        entry_fee_amount: data.entry_fee_amount,
        currency: data.currency,
        is_perpetual: data.is_perpetual,
        location_type: data.location_type,
        location_details: data.location_type === "onsite" ? data.location_details : null,
        scoring_mode: data.scoring_mode,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", challengeId)
      .eq("created_by", user.id);

    if (challengeError) throw new Error(challengeError.message);

    // Upload banner image if provided
    if (bannerFormData) {
      const bannerFile = bannerFormData.get("banner");
      if (bannerFile instanceof File && bannerFile.size > 0) {
        const adminSupabase = getAdminSupabase();
        const bytes = await bannerFile.arrayBuffer();
        await adminSupabase.storage
          .from("challenge-banners")
          .upload(`challenge-${challengeId}/banner`, bytes, {
            contentType: bannerFile.type,
            upsert: true,
          });
        const { data: { publicUrl } } = adminSupabase.storage
          .from("challenge-banners")
          .getPublicUrl(`challenge-${challengeId}/banner`);
        await adminSupabase
          .from("challenges")
          .update({ banner_image: publicUrl } as any)
          .eq("id", challengeId);
      }
    }

    for (const milestone of data.milestones) {
      if (!milestone.requires_github && !milestone.requires_url && !milestone.requires_text) {
        throw new Error(`Milestone "${milestone.title}" must require at least one submission type.`);
      }
    }

    for (const milestone of data.milestones) {
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
          .eq("id", milestone.id);

        // Replace criteria for this milestone
        await (supabase.from("rubrics") as any).delete().eq("milestone_id", milestone.id);
        if (milestone.criteria && milestone.criteria.length > 0) {
          await supabase.from("rubrics").insert(
            milestone.criteria.map((c) => ({
              challenge_id: challengeId,
              milestone_id: milestone.id,
              criteria_name: c.criteriaName,
              max_points: c.maxPoints,
            })) as any
          );
        }
      } else {
        const { data: newMilestone } = await supabase.from("milestones").insert({
          challenge_id: challengeId,
          title: milestone.title,
          description: milestone.description,
          due_date: milestone.due_date || null,
          sequence_order: milestone.sequence_order,
          requires_github: milestone.requires_github,
          requires_url: milestone.requires_url,
          requires_text: milestone.requires_text,
        }).select("id").single();

        if (newMilestone && milestone.criteria && milestone.criteria.length > 0) {
          await supabase.from("rubrics").insert(
            milestone.criteria.map((c) => ({
              challenge_id: challengeId,
              milestone_id: newMilestone.id,
              criteria_name: c.criteriaName,
              max_points: c.maxPoints,
            })) as any
          );
        }
      }
    }

    await logActivity({
      log_type: 'company',
      actor_id: user.id,
      organization_id: existing.organization_id ?? undefined,
      action: ActivityAction.CHALLENGE_EDITED,
      entity_type: EntityType.CHALLENGE,
      entity_id: challengeId,
      entity_label: data.title,
      metadata: { pending_review: false },
    })

    revalidatePath(`/company/challenges/${challengeId}`);
    const resultType = data.status === "rejected" ? "resubmitted" : "updated";
    return { type: resultType, redirectTo: `/company/challenges/${challengeId}` };

  } else {
    // Live challenge → stage for admin review
    const { error: insertError } = await supabase
      .from("challenge_pending_edits")
      .insert({
        challenge_id: challengeId,
        submitted_by: user.id,
        payload: JSON.parse(JSON.stringify(data)),
        status: "pending",
      });

    if (insertError) throw new Error(insertError.message);

    await logActivity({
      log_type: 'company',
      actor_id: user.id,
      organization_id: existing.organization_id ?? undefined,
      action: ActivityAction.CHALLENGE_EDITED,
      entity_type: EntityType.CHALLENGE,
      entity_id: challengeId,
      entity_label: data.title,
      metadata: { pending_review: true },
    })

    revalidatePath(`/company/challenges/${challengeId}`);
    return { type: "pending_review", redirectTo: `/company/challenges/${challengeId}` };
  }
}

export async function getChallengeForEdit(challengeId: string) {
  const supabase = await createClient();

  const { data: challenge, error } = await supabase
    .from("challenges")
    .select(`*, milestones(*, rubrics(*))`)
    .eq("id", challengeId)
    .single();

  if (error || !challenge) return null;
  return challenge;
}