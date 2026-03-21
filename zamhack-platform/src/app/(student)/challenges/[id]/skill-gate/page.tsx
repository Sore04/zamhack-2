import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Lock, Star, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"

const TIER_LABELS: Record<string, string> = {
  beginner: "Beginner ⭐",
  intermediate: "Intermediate ⭐⭐",
  advanced: "Advanced ⭐⭐⭐",
}

const DIFFICULTY_LABELS: Record<string, string> = {
  intermediate: "Intermediate",
  advanced: "Advanced",
}

export default async function SkillGatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tier?: string; difficulty?: string }>
}) {
  const { id: challengeId } = await params
  const { tier, difficulty } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch challenge with required skills
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("id, title, difficulty, challenge_skills(skill_id, skills(id, name, category))")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge) redirect("/challenges")

  // Fetch student's earned skills for the required skill IDs
  const requiredSkillIds = ((challenge.challenge_skills ?? []) as Array<{ skill_id: string | null }>)
    .map((cs) => cs.skill_id)
    .filter((id): id is string => id !== null)

  const { data: earnedSkills } = await (supabase
    .from("student_earned_skills")
    .select("skill_id, tier")
    .eq("profile_id", user.id)
    .in("skill_id", requiredSkillIds) as any)

  const earnedSkillIds = new Set((earnedSkills ?? []).map((e: any) => e.skill_id))

  const missingSkills = ((challenge.challenge_skills ?? []) as Array<{ skill_id: string | null; skills: { id: string; name: string; category: string | null } | null }>)
    .filter((cs) => cs.skill_id && !earnedSkillIds.has(cs.skill_id))
    .map((cs) => cs.skills)
    .filter((s): s is { id: string; name: string; category: string | null } => s !== null)

  const missingSkillIds = missingSkills.map((s) => s.id)

  // Fetch path challenges — beginner/intermediate challenges that award the missing skills
  const pathDifficulties = difficulty === "advanced" ? ["beginner", "intermediate"] : ["beginner"]
  let pathChallenges: Array<{ id: string; title: string; difficulty: string | null }> = []

  if (missingSkillIds.length > 0) {
    const { data: pc } = await (supabase
      .from("challenges")
      .select("id, title, difficulty, challenge_skills!inner(skill_id)")
      .in("challenge_skills.skill_id", missingSkillIds)
      .in("difficulty", pathDifficulties as any)
      .eq("status", "approved")
      .neq("id", challengeId)
      .limit(5) as any)
    pathChallenges = pc ?? []
  }

  const requiredTier = tier ?? "beginner"
  const challengeDifficulty = difficulty ?? challenge.difficulty ?? "intermediate"

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>

      {/* Back link */}
      <Link
        href={`/challenges/${challengeId}`}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--student-primary, #4f46e5)", marginBottom: "1.5rem", textDecoration: "none" }}
      >
        <ArrowLeft size={16} />
        Back to Challenge
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <div style={{ background: "#fee2e2", borderRadius: "0.5rem", padding: "0.5rem" }}>
          <Lock size={20} style={{ color: "#dc2626" }} />
        </div>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0 }}>Credential Required</h1>
      </div>
      <p style={{ color: "#6b7280", marginBottom: "2rem", lineHeight: 1.6 }}>
        <strong>{challenge.title}</strong> is an {DIFFICULTY_LABELS[challengeDifficulty] ?? challengeDifficulty} challenge.
        You need at least <strong>{TIER_LABELS[requiredTier] ?? requiredTier}</strong> earned credentials in the required skills to join.
      </p>

      {/* Missing credentials */}
      {missingSkills.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Star size={16} style={{ color: "#ea580c" }} />
            <span style={{ fontWeight: 600, color: "#ea580c", fontSize: "0.875rem" }}>Missing Credentials</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {missingSkills.map((skill) => (
              <span
                key={skill.id}
                style={{ background: "#fff", border: "1px solid #fdba74", borderRadius: "999px", padding: "0.25rem 0.75rem", fontSize: "0.8125rem", color: "#9a3412" }}
              >
                {skill.name} · {TIER_LABELS[requiredTier] ?? requiredTier} required
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Path challenges */}
      {pathChallenges.length > 0 && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Trophy size={16} style={{ color: "#16a34a" }} />
            <span style={{ fontWeight: 600, color: "#16a34a", fontSize: "0.875rem" }}>
              Challenges That Can Unlock This
            </span>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#15803d", marginBottom: "0.75rem" }}>
            Complete one of these challenges to earn the required credential:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pathChallenges.map((pc) => (
              <Link
                key={pc.id}
                href={`/challenges/${pc.id}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #bbf7d0", borderRadius: "0.5rem", padding: "0.625rem 0.875rem", textDecoration: "none", color: "inherit" }}
              >
                <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#111827" }}>{pc.title}</span>
                <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "capitalize" }}>
                  {pc.difficulty ?? "beginner"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Profile link */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b", margin: "0 0 0.125rem" }}>Your Skill Profile</p>
          <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: 0 }}>View your earned and portfolio skills</p>
        </div>
        <Link href="/profile#earned-skills">
          <Button variant="outline" size="sm">View Profile</Button>
        </Link>
      </div>

      <Link href={`/challenges/${challengeId}`}>
        <Button variant="outline" className="w-full">
          <ArrowLeft size={16} className="mr-2" />
          Return to Challenge
        </Button>
      </Link>
    </div>
  )
}
