import { SupabaseClient } from "@supabase/supabase-js"

type Tier = "beginner" | "intermediate" | "advanced"

export type GateResult =
  | { allowed: true }
  | {
      allowed: false
      reason: "skill_gate"
      requiredTier: "beginner" | "intermediate"
      difficulty: string
      missingSkillIds: string[]
    }
  | {
      allowed: false
      reason: "advanced_limit"
      nextEligibleAt: string
      effectiveLimit: number
    }

export async function checkParticipationGate(
  supabase: SupabaseClient,
  challengeId: string,
  profileId: string
): Promise<GateResult> {
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("difficulty, challenge_skills(skill_id)")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge) return { allowed: true } // fail-open

  const difficulty: string = challenge.difficulty ?? "beginner"

  if (difficulty === "beginner") {
    // Use this challenge's skills to determine overqualification
    const challengeSkillIds: string[] = (challenge.challenge_skills ?? [])
      .map((cs: any) => cs.skill_id)
      .filter(Boolean)

    console.log("[gate] beginner branch | challengeSkillIds:", challengeSkillIds)

    // No skills on this challenge → can't determine overqualification → allow
    if (challengeSkillIds.length === 0) {
      console.log("[gate] EXIT: challenge has no challenge_skills — allowed")
      return { allowed: true }
    }

    // Fetch global guardrail limit from platform_settings
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("advanced_beginner_weekly_limit")
      .eq("id", true)
      .single()

    // undefined = column missing or query failed (fail-open); null = admin disabled guardrail
    const globalLimit = (settings as any)?.advanced_beginner_weekly_limit
    console.log("[gate] globalLimit from platform_settings:", globalLimit)
    if (globalLimit == null) {
      console.log("[gate] EXIT: globalLimit is null/undefined — allowed (guardrail disabled or column missing)")
      return { allowed: true }
    }

    // Check if student has any of THIS challenge's specific skills at advanced tier
    const { data: matchingAdvanced } = await (supabase
      .from("student_earned_skills")
      .select("skill_id")
      .eq("profile_id", profileId)
      .in("skill_id", challengeSkillIds)
      .eq("tier", "advanced") as any)

    console.log("[gate] matchingAdvanced skills:", matchingAdvanced)
    if (!matchingAdvanced || matchingAdvanced.length === 0) {
      console.log("[gate] EXIT: student has no advanced tier for this challenge's skills — allowed")
      return { allowed: true }
    }

    // Get the specific skill IDs the student holds at advanced (that match this challenge)
    const advancedSkillIds: string[] = (matchingAdvanced as any[])
      .map((s: any) => s.skill_id)
      .filter(Boolean)

    // Find all challenge IDs that have any of those same advanced skills
    const { data: relevantChallengeSkills } = await (supabase
      .from("challenge_skills")
      .select("challenge_id")
      .in("skill_id", advancedSkillIds) as any)

    const relevantChallengeIds = [
      ...new Set(
        (relevantChallengeSkills ?? [])
          .map((cs: any) => cs.challenge_id)
          .filter(Boolean)
      ),
    ] as string[]

    console.log("[gate] relevantChallengeIds count:", relevantChallengeIds.length)
    if (relevantChallengeIds.length === 0) {
      console.log("[gate] EXIT: no challenges found with those skills — allowed")
      return { allowed: true }
    }

    // Count beginner joins THIS WEEK only in challenges with those same skills
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentJoins } = await (supabase
      .from("challenge_participants")
      .select("joined_at, challenges(difficulty)")
      .eq("user_id", profileId)
      .in("challenge_id", relevantChallengeIds)
      .neq("status", "withdrawn")
      .gte("joined_at", weekAgo) as any)

    const beginnerJoins = (recentJoins ?? []).filter(
      (p: any) => p.challenges?.difficulty === "beginner"
    )

    console.log("[gate] beginnerJoins this week:", beginnerJoins.length, "| limit:", globalLimit)

    if (beginnerJoins.length >= globalLimit) {
      const sorted = [...beginnerJoins].sort(
        (a: any, b: any) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
      )
      const nextEligibleAt = new Date(
        new Date(sorted[0].joined_at).getTime() + 7 * 24 * 60 * 60 * 1000
      ).toISOString()

      return {
        allowed: false,
        reason: "advanced_limit",
        nextEligibleAt,
        effectiveLimit: globalLimit,
      }
    }

    return { allowed: true }
  }

  const requiredSkillIds: string[] = (challenge.challenge_skills ?? [])
    .map((cs: any) => cs.skill_id)
    .filter(Boolean)

  if (requiredSkillIds.length === 0) return { allowed: true } // no skills defined = no gate

  const requiredTier = difficulty === "advanced" ? "intermediate" : "beginner"
  const allowedTiers: Tier[] = difficulty === "advanced"
    ? ["intermediate", "advanced"]
    : ["beginner", "intermediate", "advanced"]

  const { data: earnedMatch } = await (supabase
    .from("student_earned_skills")
    .select("skill_id, tier")
    .eq("profile_id", profileId)
    .in("skill_id", requiredSkillIds)
    .in("tier", allowedTiers)
    .limit(1) as any)

  if (earnedMatch && earnedMatch.length > 0) return { allowed: true }

  return {
    allowed: false,
    reason: "skill_gate",
    requiredTier: requiredTier as "beginner" | "intermediate",
    difficulty,
    missingSkillIds: requiredSkillIds,
  }
}
