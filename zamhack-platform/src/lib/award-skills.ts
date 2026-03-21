import { SupabaseClient } from "@supabase/supabase-js"
import { getFinalScore, type ScoringMode } from "@/lib/scoring-utils"

const TIER_RANK = { beginner: 1, intermediate: 2, advanced: 3 } as const
type Tier = keyof typeof TIER_RANK

async function meetsScoreThreshold(
  supabase: SupabaseClient,
  challengeId: string,
  profileId: string,
  scoringMode: ScoringMode
): Promise<boolean> {
  // Path 1: rubric-based scoring
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("max_points")
    .eq("challenge_id", challengeId)

  const maxPoints = (rubrics ?? []).reduce((sum, r) => sum + (r.max_points ?? 0), 0)

  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("user_id", profileId)
    .maybeSingle()

  if (!participant) return false

  const { data: subs } = await supabase
    .from("submissions")
    .select("id")
    .eq("participant_id", participant.id)

  if (!subs || subs.length === 0) return false
  const submissionIds = subs.map((s) => s.id)

  if (maxPoints > 0) {
    const { data: scoreRows } = await supabase
      .from("scores")
      .select("points_awarded")
      .in("submission_id", submissionIds)

    const actual = (scoreRows ?? []).reduce((sum, s) => sum + (s.points_awarded ?? 0), 0)
    return actual / maxPoints >= 0.7
  }

  // Path 2: evaluation-based scoring (no rubrics)
  const { data: evals } = await (supabase
    .from("evaluations")
    .select("score, is_draft, profiles(role)")
    .in("submission_id", submissionIds)
    .eq("is_draft", false) as any)

  if (!evals || evals.length === 0) return true // fail-open: no evaluations yet

  const companyEval = evals.find((e: any) =>
    e.profiles?.role === "company_admin" || e.profiles?.role === "company_member"
  )
  const evaluatorEval = evals.find((e: any) => e.profiles?.role === "evaluator")

  const score = getFinalScore({
    companyScore: companyEval?.score ?? null,
    evaluatorScore: evaluatorEval?.score ?? null,
    scoringMode,
  })

  return score !== null && score >= 70
}

export async function awardChallengeSkills(
  supabase: SupabaseClient,
  challengeId: string,
  profileId: string,
  scoringMode: ScoringMode = "company_only"
) {
  const qualifies = await meetsScoreThreshold(supabase, challengeId, profileId, scoringMode)
  if (!qualifies) return

  const { data: challenge } = await supabase
    .from("challenges")
    .select("difficulty")
    .eq("id", challengeId)
    .single()

  if (!challenge?.difficulty) return

  const tier = challenge.difficulty as Tier

  const { data: challengeSkills } = await supabase
    .from("challenge_skills")
    .select("skill_id")
    .eq("challenge_id", challengeId)

  if (!challengeSkills || challengeSkills.length === 0) return

  for (const cs of challengeSkills) {
    if (!cs.skill_id) continue

    const { data: existing } = await (supabase
      .from("student_earned_skills")
      .select("id, tier")
      .eq("profile_id", profileId)
      .eq("skill_id", cs.skill_id)
      .maybeSingle() as any)

    if (existing) {
      // Only upgrade, never downgrade
      if (TIER_RANK[tier] > TIER_RANK[existing.tier as Tier]) {
        await (supabase
          .from("student_earned_skills")
          .update({ tier, challenge_id: challengeId, awarded_at: new Date().toISOString() })
          .eq("id", existing.id) as any)
      }
    } else {
      await (supabase
        .from("student_earned_skills")
        .insert({
          profile_id: profileId,
          skill_id: cs.skill_id,
          tier,
          source: "challenge",
          challenge_id: challengeId,
        }) as any)
    }
  }
}
