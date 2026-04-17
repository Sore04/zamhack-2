import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import {
  type TopSchool,
  type TopSkill,
  type ChallengePerf,
  type WeeklySubmission,
  type DegreeSlice,
} from "@/components/company/analytics-charts"
import { AnalyticsDashboard } from "@/components/company/analytics-dashboard"

// ── Data Fetching ──────────────────────────────────────────────────────────

async function getAnalyticsData(organizationId: string) {
  const supabase = await createClient()

  // Org name for the PDF header
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single()

  // All challenges for this org
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, title, status")
    .eq("organization_id", organizationId)

  const challengeIds = (challenges || []).map(c => c.id)

  if (!challengeIds.length) {
    return { orgName: org?.name ?? "", challenges: [], overview: { totalParticipants: 0, totalSubmissions: 0, avgScore: null, completionRate: 0 }, topSchools: [], topSkills: [], challengePerformance: [], submissionsOverTime: [], degreeBreakdown: [] }
  }

  // All participants across all challenges
  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("id, user_id, challenge_id")
    .in("challenge_id", challengeIds)

  const participantsList = participants || []
  const participantIds = participantsList.map(p => p.id)
  const userIds = [...new Set(participantsList.map(p => p.user_id).filter(Boolean) as string[])]

  // Profiles for participants
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, first_name, last_name, university, degree").in("id", userIds)
    : { data: [] }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  // Submissions
  const { data: submissions } = participantIds.length
    ? await supabase.from("submissions").select("id, participant_id, submitted_at").in("participant_id", participantIds)
    : { data: [] }

  const submissionsList = submissions || []
  const submissionIds = submissionsList.map(s => s.id)

  // Evaluations
  const { data: evaluations } = submissionIds.length
    ? await supabase.from("evaluations").select("submission_id, score").in("submission_id", submissionIds).eq("is_draft", false)
    : { data: [] }

  const evaluationsList = evaluations || []

  // Student skills for these users
  const { data: studentSkills } = userIds.length
    ? await supabase.from("student_skills").select("profile_id, level, skill_id").in("profile_id", userIds)
    : { data: [] }

  // Skill names
  const skillIds = [...new Set((studentSkills || []).map(s => s.skill_id).filter(Boolean) as string[])]
  const { data: skillDefs } = skillIds.length
    ? await supabase.from("skills").select("id, name").in("id", skillIds)
    : { data: [] }

  const skillNameMap = new Map((skillDefs || []).map(s => [s.id, s.name]))

  // ── Overview ────────────────────────────────────────────────────────────

  const uniqueParticipants = userIds.length
  const totalSubmissions = submissionsList.length
  const scores = evaluationsList.map(e => e.score).filter((s): s is number => s !== null)
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const participantsWhoSubmitted = new Set(submissionsList.map(s => s.participant_id).filter(Boolean))
  const completionRate = uniqueParticipants > 0 ? Math.round((participantsWhoSubmitted.size / uniqueParticipants) * 100) : 0

  // ── Top Schools ─────────────────────────────────────────────────────────

  const schoolCounts = new Map<string, number>()
  for (const uid of userIds) {
    const profile = profileMap.get(uid)
    const uni = profile?.university?.trim() || "Unknown"
    schoolCounts.set(uni, (schoolCounts.get(uni) || 0) + 1)
  }
  const topSchools: TopSchool[] = [...schoolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([university, count]) => ({ university, count }))

  // ── Degree Breakdown ────────────────────────────────────────────────────

  const degreeCounts = new Map<string, number>()
  for (const uid of userIds) {
    const profile = profileMap.get(uid)
    const deg = profile?.degree?.trim() || "Not specified"
    degreeCounts.set(deg, (degreeCounts.get(deg) || 0) + 1)
  }
  const degreeBreakdown: DegreeSlice[] = [...degreeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([degree, count]) => ({ degree, count }))

  // ── Skills Breakdown ────────────────────────────────────────────────────

  const skillMap = new Map<string, { count: number; beginner: number; intermediate: number; advanced: number }>()
  for (const ss of (studentSkills || [])) {
    if (!ss.skill_id) continue
    const name = skillNameMap.get(ss.skill_id) || "Unknown"
    const existing = skillMap.get(name) || { count: 0, beginner: 0, intermediate: 0, advanced: 0 }
    existing.count++
    if (ss.level === "beginner") existing.beginner++
    else if (ss.level === "intermediate") existing.intermediate++
    else if (ss.level === "advanced") existing.advanced++
    skillMap.set(name, existing)
  }
  const topSkills: TopSkill[] = [...skillMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([skill, v]) => ({ skill, ...v }))

  // ── Challenge Performance ───────────────────────────────────────────────

  const challengePerformance: ChallengePerf[] = (challenges || []).map(challenge => {
    const cParticipants = participantsList.filter(p => p.challenge_id === challenge.id)
    const cParticipantIds = new Set(cParticipants.map(p => p.id))
    const cSubmissions = submissionsList.filter(s => s.participant_id && cParticipantIds.has(s.participant_id))
    const cSubIds = new Set(cSubmissions.map(s => s.id))
    const cEvals = evaluationsList.filter(e => e.submission_id && cSubIds.has(e.submission_id))
    const cScores = cEvals.map(e => e.score).filter((s): s is number => s !== null)
    const cAvgScore = cScores.length > 0 ? Math.round(cScores.reduce((a, b) => a + b, 0) / cScores.length) : null
    const cWhoSubmitted = new Set(cSubmissions.map(s => s.participant_id).filter(Boolean))
    const cCompletionRate = cParticipants.length > 0
      ? Math.round((cWhoSubmitted.size / cParticipants.length) * 100)
      : 0

    return {
      title: challenge.title,
      participants: cParticipants.length,
      submissions: cSubmissions.length,
      avgScore: cAvgScore,
      completionRate: cCompletionRate,
    }
  })

  // ── Submissions Over Time (last 8 weeks) ────────────────────────────────

  const weeklyMap = new Map<string, number>()
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    weeklyMap.set(label, 0)
  }

  for (const sub of submissionsList) {
    if (!sub.submitted_at) continue
    const d = new Date(sub.submitted_at)
    // Find which week bucket it belongs to
    for (const [label] of weeklyMap.entries()) {
      const bucketDate = new Date(label + ` ${now.getFullYear()}`)
      const diff = (now.getTime() - bucketDate.getTime()) / (1000 * 60 * 60 * 24)
      const subDiff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
      if (subDiff <= diff + 7 && subDiff > diff) {
        weeklyMap.set(label, (weeklyMap.get(label) || 0) + 1)
        break
      }
    }
  }

  const submissionsOverTime: WeeklySubmission[] = [...weeklyMap.entries()].map(([week, count]) => ({ week, count }))

  return {
    orgName: org?.name ?? "",
    challenges: challenges || [],
    overview: { totalParticipants: uniqueParticipants, totalSubmissions, avgScore, completionRate },
    topSchools,
    topSkills,
    challengePerformance,
    submissionsOverTime,
    degreeBreakdown,
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CompanyAnalyticsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "company_admin" && profile.role !== "company_member")) {
    redirect("/dashboard")
  }

  if (!profile.organization_id) redirect("/company/dashboard")

  const data = await getAnalyticsData(profile.organization_id)
  return <AnalyticsDashboard data={data} />
}