"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/types/supabase"

type ChallengeStatus = Database["public"]["Enums"]["challenge_status"]
type ProficiencyLevel = Database["public"]["Enums"]["proficiency_level"]

interface MilestoneInput {
  title: string
  description?: string
  dueDate: string
  requiresGithub: boolean
  requiresUrl: boolean
  requiresText: boolean
  criteria?: { criteriaName: string; maxPoints: number }[]
}

interface CreateChallengeInput {
  title: string
  description: string

  /** @deprecated use industries[] instead — kept for DB backward compat */
  industry: string
  /** Multi-select industries array */
  industries: string[]

  difficulty: ProficiencyLevel
  participationType: "solo" | "team" | "both"
  maxParticipants?: number
  maxTeams?: number
  maxTeamSize?: number

  startDate: string
  /** Null when isPerpetual is true */
  endDate: string | null
  registrationDeadline?: string

  /** "online" | "onsite" */
  locationType: "online" | "onsite"
  /** Free-text onsite location, e.g. "Makati City" or "TBA". Null for online. */
  locationDetails: string | null

  /** If true, no end date is stored */
  isPerpetual: boolean

  /** How submission scores are calculated when both company and evaluator review */
  scoringMode: "company_only" | "evaluator_only" | "average"

  milestones: MilestoneInput[]
  skills: string[]
  organizationId: string
  entryFeeAmount?: number
  currency?: string
}

export const createChallenge = async (
  input: CreateChallengeInput
): Promise<{ success: boolean; challengeId?: string; error?: string }> => {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  // Verify user has organization
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, error: "User profile not found" }
  }

  if (profile.role !== "company_admin" && profile.role !== "company_member") {
    return { success: false, error: "Unauthorized" }
  }

  if (profile.organization_id !== input.organizationId) {
    return { success: false, error: "Organization mismatch" }
  }

  try {
    // Step 1: Create or get skill IDs
    const skillIds: string[] = []
    for (const skillName of input.skills) {
      const { data: existingSkill } = await supabase
        .from("skills")
        .select("id")
        .eq("name", skillName)
        .single()

      if (existingSkill) {
        skillIds.push(existingSkill.id)
      } else {
        const { data: newSkill, error: skillError } = await supabase
          .from("skills")
          .insert({ name: skillName })
          .select("id")
          .single()

        if (skillError || !newSkill) {
          console.error("Error creating skill:", skillError)
        } else {
          skillIds.push(newSkill.id)
        }
      }
    }

    // Step 2: Insert challenge
    const challengeData = {
      title: input.title,
      description: input.description,

      // Legacy single-industry field — store the first selected industry for backward compat
      industry: input.industries[0] || input.industry || null,
      // New multi-industry array
      industries: input.industries,

      difficulty: input.difficulty,
      participation_type: input.participationType,
      max_participants: input.maxParticipants ?? null,
      max_teams: input.maxTeams ?? null,
      max_team_size: input.maxTeamSize ?? null,
      start_date: input.startDate,
      end_date: input.isPerpetual ? null : (input.endDate ?? null),
      registration_deadline: input.registrationDeadline ?? null,
      organization_id: input.organizationId,
      created_by: user.id,
      status: "draft" as ChallengeStatus,
      entry_fee_amount: input.entryFeeAmount ?? null,
      currency: input.currency ?? null,

      // New location fields
      location_type: input.locationType,
      location_details: input.locationType === "onsite" ? (input.locationDetails || "TBA") : null,

      // New perpetual field
      is_perpetual: input.isPerpetual,

      // Scoring mode
      scoring_mode: input.scoringMode,
    }

    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .insert(challengeData)
      .select("id")
      .single()

    if (challengeError || !challenge) {
      return {
        success: false,
        error: challengeError?.message || "Failed to create challenge",
      }
    }

    const challengeId = challenge.id

    // Step 3: Insert milestones
    const milestonesData = input.milestones.map((milestone, index) => ({
      challenge_id: challengeId,
      title: milestone.title,
      description: milestone.description || null,
      due_date: milestone.dueDate,
      sequence_order: index + 1,
      requires_github: milestone.requiresGithub,
      requires_url: milestone.requiresUrl,
      requires_text: milestone.requiresText,
    }))

    const { data: insertedMilestones, error: milestonesError } = await supabase
      .from("milestones")
      .insert(milestonesData)
      .select("id, sequence_order")

    if (milestonesError || !insertedMilestones) {
      await supabase.from("challenges").delete().eq("id", challengeId)
      return {
        success: false,
        error: milestonesError?.message || "Failed to create milestones",
      }
    }

    // Step 3b: Insert rubrics for each milestone's criteria
    const rubricsData: { challenge_id: string; milestone_id: string; criteria_name: string; max_points: number }[] = []
    for (let i = 0; i < input.milestones.length; i++) {
      const milestone = input.milestones[i]
      const insertedMilestone = insertedMilestones[i]
      if (!insertedMilestone) continue
      for (const c of milestone.criteria ?? []) {
        rubricsData.push({
          challenge_id: challengeId,
          milestone_id: insertedMilestone.id,
          criteria_name: c.criteriaName,
          max_points: c.maxPoints,
        })
      }
    }
    if (rubricsData.length > 0) {
      const { error: rubricsError } = await supabase.from("rubrics").insert(rubricsData as any)
      if (rubricsError) {
        await supabase.from("milestones").delete().eq("challenge_id", challengeId)
        await supabase.from("challenges").delete().eq("id", challengeId)
        return { success: false, error: rubricsError.message || "Failed to create rubrics" }
      }
    }

    // Step 4: Link skills to challenge
    if (skillIds.length > 0) {
      const challengeSkillsData = skillIds.map((skillId) => ({
        challenge_id: challengeId,
        skill_id: skillId,
      }))

      const { error: skillsError } = await supabase
        .from("challenge_skills")
        .insert(challengeSkillsData)

      if (skillsError) {
        await supabase.from("milestones").delete().eq("challenge_id", challengeId)
        await supabase.from("challenges").delete().eq("id", challengeId)
        return {
          success: false,
          error: skillsError.message || "Failed to link skills",
        }
      }
    }

    revalidatePath("/company/challenges")
    revalidatePath("/company/dashboard")

    return { success: true, challengeId }
  } catch (error) {
    console.error("Error creating challenge:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }
  }
}