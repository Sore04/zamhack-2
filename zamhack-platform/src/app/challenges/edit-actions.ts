// src/app/challenges/edit-actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { type Enums } from "@/types/supabase";

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
  participation_type: "solo" | "team" | "both";
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
  milestones: MilestoneInput[];
};

// Challenges in these statuses have no live participants yet,
// so edits can be applied directly without admin review.
const DIRECT_EDIT_STATUSES = ["draft", "pending_approval"];

export type UpdateChallengeResult =
  | { type: "updated"; redirectTo: string }
  | { type: "pending_review"; redirectTo: string };

export async function updateChallenge(
  challengeId: string,
  data: UpdateChallengeInput
): Promise<UpdateChallengeResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  const { data: existing, error: fetchError } = await supabase
    .from("challenges")
    .select("status, created_by")
    .eq("id", challengeId)
    .single();

  if (fetchError || !existing) throw new Error("Challenge not found");
  if (existing.created_by !== user.id) throw new Error("Unauthorized");

  const isDirect = DIRECT_EDIT_STATUSES.includes(existing.status ?? "");

  if (isDirect) {
    // Draft / Pending Approval → apply directly
    const { error: challengeError } = await supabase
      .from("challenges")
      .update({
        title: data.title,
        description: data.description,
        problem_brief: data.problem_brief,
        industry: data.industries?.[0] ?? null,
        industries: data.industries,
        difficulty: data.difficulty,
        status: data.status,
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
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", challengeId)
      .eq("created_by", user.id);

    if (challengeError) throw new Error(challengeError.message);

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

    revalidatePath(`/company/challenges/${challengeId}`);
    return { type: "updated", redirectTo: `/company/challenges/${challengeId}` };

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