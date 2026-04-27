import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Database } from "@/types/supabase"
import { Users, Trophy, Activity, UserCheck } from "lucide-react"
import { TalentGrid } from "./talent-grid"
import { type SkillTier } from "@/lib/rank-titles"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

export interface StudentWithStats extends Profile {
  completedChallenges: number
  activeChallenges: number
  matchScore?: number
  matchReason?: string
  highestTier?: SkillTier
}

const COMPLETED_STATUSES = new Set(["completed", "closed"])
const INACTIVE_STATUSES  = new Set(["cancelled", "rejected", "draft", "pending_approval"])

function classifyStatus(status: string): "completed" | "active" | "none" {
  if (COMPLETED_STATUSES.has(status)) return "completed"
  if (INACTIVE_STATUSES.has(status))  return "none"
  return "active"
}

type TalentData = {
  students: StudentWithStats[]
  isCacheStale: boolean
  companyUserId: string
}

async function getTalentData(): Promise<TalentData> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "company_admin" && profile.role !== "company_member")) {
    redirect("/dashboard")
  }

  const { data: students, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("created_at", { ascending: false })

  if (error || !students || students.length === 0) {
    return { students: [], isCacheStale: false, companyUserId: user.id }
  }

  // Fetch cached match scores (including reason and computed_at for staleness check)
  const { data: cacheRows } = await (supabase as any)
    .from("talent_match_cache")
    .select("student_id, score, reason, computed_at")
    .eq("company_id", user.id)

  type CacheRow = { student_id: string; score: number; reason: string | null; computed_at: string | null }
  const cacheMap = new Map<string, CacheRow>()
  for (const row of (cacheRows ?? []) as CacheRow[]) {
    cacheMap.set(row.student_id, row)
  }

  // Stale if any student is missing from cache or any entry is older than 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const isCacheStale =
    !cacheRows ||
    cacheRows.length < students.length ||
    (cacheRows as CacheRow[]).some(
      (row) => !row.computed_at || row.computed_at < twentyFourHoursAgo
    )

  const studentIds = students.map((s) => s.id)

  // ── Direct participations ──
  const { data: directParticipations } = await supabase
    .from("challenge_participants")
    .select("user_id, challenge_id")
    .in("user_id", studentIds)
    .not("challenge_id", "is", null)

  // ── Team-based participations ──
  const { data: teamMemberships } = await supabase
    .from("team_members")
    .select("profile_id, team_id")
    .in("profile_id", studentIds)

  const teamIds = [
    ...new Set(
      (teamMemberships || []).map((tm) => tm.team_id).filter(Boolean) as string[]
    ),
  ]

  const leaderByTeam = new Map<string, string>()
  if (teamIds.length > 0) {
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, leader_id")
      .in("id", teamIds)
    for (const t of teamsData || []) {
      if (t.id && t.leader_id) leaderByTeam.set(t.id, t.leader_id)
    }
  }

  const leaderIds = [...new Set([...leaderByTeam.values()])]
  const leaderChallengeMap = new Map<string, string[]>()

  if (leaderIds.length > 0) {
    const { data: leaderParticipations } = await supabase
      .from("challenge_participants")
      .select("user_id, challenge_id")
      .in("user_id", leaderIds)
      .not("challenge_id", "is", null)
    for (const lp of leaderParticipations || []) {
      if (!lp.user_id || !lp.challenge_id) continue
      const existing = leaderChallengeMap.get(lp.user_id) || []
      existing.push(lp.challenge_id)
      leaderChallengeMap.set(lp.user_id, existing)
    }
  }

  // ── Build per-student challenge set ──
  const studentChallengeMap = new Map<string, Set<string>>()

  for (const p of directParticipations || []) {
    if (!p.user_id || !p.challenge_id) continue
    const set = studentChallengeMap.get(p.user_id) || new Set<string>()
    set.add(p.challenge_id)
    studentChallengeMap.set(p.user_id, set)
  }

  for (const tm of teamMemberships || []) {
    if (!tm.profile_id || !tm.team_id) continue
    const leaderId = leaderByTeam.get(tm.team_id)
    if (!leaderId) continue
    const leaderChallenges = leaderChallengeMap.get(leaderId) || []
    const set = studentChallengeMap.get(tm.profile_id) || new Set<string>()
    for (const cid of leaderChallenges) set.add(cid)
    studentChallengeMap.set(tm.profile_id, set)
  }

  // ── Fetch challenge statuses ──
  const allChallengeIds = [
    ...new Set([...studentChallengeMap.values()].flatMap((s) => [...s])),
  ]

  const challengeStatusMap = new Map<string, string>()
  if (allChallengeIds.length > 0) {
    const { data: challengeData } = await supabase
      .from("challenges")
      .select("id, status")
      .in("id", allChallengeIds)
    for (const c of challengeData || []) {
      if (c.id && c.status) challengeStatusMap.set(c.id, c.status)
    }
  }

  // ── Count per student ──
  const completedMap = new Map<string, number>()
  const activeMap    = new Map<string, number>()

  for (const [studentId, challengeIds] of studentChallengeMap.entries()) {
    for (const challengeId of challengeIds) {
      const status = challengeStatusMap.get(challengeId)
      if (!status) continue
      const classification = classifyStatus(status)
      if (classification === "completed") {
        completedMap.set(studentId, (completedMap.get(studentId) || 0) + 1)
      } else if (classification === "active") {
        activeMap.set(studentId, (activeMap.get(studentId) || 0) + 1)
      }
    }
  }

  const enrichedStudents = (students as Profile[]).map((s) => ({
    ...s,
    completedChallenges: completedMap.get(s.id) || 0,
    activeChallenges:    activeMap.get(s.id)    || 0,
    matchScore:          cacheMap.get(s.id)?.score,
    matchReason:         cacheMap.get(s.id)?.reason ?? undefined,
    highestTier:         ((s as any).xp_rank as SkillTier | undefined) ?? undefined,
  }))

  return { students: enrichedStudents, isCacheStale, companyUserId: user.id }
}

export default async function TalentPage() {
  const { students, isCacheStale, companyUserId } = await getTalentData()

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="cp-page-title">Talent Search</h1>
        <p className="cp-page-subtitle">
          Discover and connect with students ready to solve your challenges.
        </p>
      </div>

      <div className="cp-grid-4">
        <div className="cp-stat-card indigo">
          <div className="cp-stat-icon"><Users className="w-5 h-5" /></div>
          <p className="cp-stat-value">{students.length}</p>
          <p className="cp-stat-label">Total Students</p>
        </div>
        <div className="cp-stat-card primary">
          <div className="cp-stat-icon"><Trophy className="w-5 h-5" /></div>
          <p className="cp-stat-value">{students.filter((s) => s.completedChallenges > 0).length}</p>
          <p className="cp-stat-label">With Experience</p>
        </div>
        <div className="cp-stat-card emerald">
          <div className="cp-stat-icon"><Activity className="w-5 h-5" /></div>
          <p className="cp-stat-value">{students.filter((s) => s.activeChallenges > 0).length}</p>
          <p className="cp-stat-label">Currently Active</p>
        </div>
        <div className="cp-stat-card navy">
          <div className="cp-stat-icon"><UserCheck className="w-5 h-5" /></div>
          <p className="cp-stat-value">{students.filter((s) => s.bio).length}</p>
          <p className="cp-stat-label">Full Profiles</p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="cp-card">
          <div className="cp-empty-state">
            <div className="cp-empty-icon"><Users style={{ width: "1.75rem", height: "1.75rem" }} /></div>
            <p className="cp-empty-title">No students yet</p>
            <p className="cp-empty-desc">Students will appear here once they register on the platform.</p>
          </div>
        </div>
      ) : (
        <TalentGrid initialStudents={students} isCacheStale={isCacheStale} companyUserId={companyUserId} />
      )}
    </div>
  )
}