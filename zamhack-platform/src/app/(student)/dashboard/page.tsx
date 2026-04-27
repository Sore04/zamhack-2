import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Zap,
  Trophy,
  Star,
  Layers,
  ArrowRight,
  CalendarClock,
  AlertCircle,
  ChevronRight,
  BookOpen,
  ShieldAlert,
} from "lucide-react"
import { getRankTitle, type SkillTier } from "@/lib/rank-titles"

// ── Types ─────────────────────────────────────────────────────────────────

interface ActiveChallenge {
  id: string
  title: string
  status: string | null
  end_date: string | null
  organization: { name: string } | null
  milestonesTotal: number
  milestonesCompleted: number
  
}

interface UpcomingDeadline {
  challengeId: string
  challengeTitle: string
  milestoneTitle: string
  dueDate: string
  daysLeft: number
}

interface RecommendedChallenge {
  id: string
  title: string
  difficulty: string | null
  industry: string | null
  participation_type: string | null
  end_date: string | null
  organization: { name: string } | null
}

interface DashboardData {
  firstName: string
  slotsUsed: number
  slotsMax: number
  activeChallengesCount: number
  completedChallengesCount: number
  skillsCount: number
  activeChallenges: ActiveChallenge[]
  upcomingDeadlines: UpcomingDeadline[]
  recommendedChallenges: RecommendedChallenge[]
  xpPoints: number
  xpRank: string
  guardrailLimit: number | null
  beginnerJoinsThisWeek: number | null
}

// ── Data Fetching ─────────────────────────────────────────────────────────

async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, max_active_challenges, xp_points, xp_rank")
    .eq("id", user.id)
    .single()

  const firstName = profile?.first_name || "there"
  const slotsMax = profile?.max_active_challenges ?? 3

  const { data: participations } = await supabase
    .from("challenge_participants")
    .select(`
      id, status, challenge_id,
      challenges ( id, title, status, end_date, is_perpetual, organizations ( name ) )
    `)
    .eq("user_id", user.id)

  const allParticipations = participations || []
  const activeStatuses = ["approved", "in_progress", "under_review"]

  const now = new Date()
  const activeParts = allParticipations.filter((p) => {
    const challenge = p.challenges as any
    if (p.status === "completed") return false
    if (!activeStatuses.includes(challenge?.status || "")) return false
    if (challenge?.end_date && new Date(challenge.end_date) < now) return false
    return true
  })

  const completedParts = allParticipations.filter((p) =>
    ["completed", "closed"].includes((p.challenges as any)?.status || "")
  )

  const slotsUsed = activeParts.length
  const activeChallengesCount = activeParts.length
  const completedChallengesCount =
    completedParts.length + allParticipations.filter((p) => p.status === "completed").length

  const { count: skillsCount } = await supabase
    .from("student_skills")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)

  const activeChallengeIds = activeParts
    .map((p) => (p.challenges as any)?.id)
    .filter(Boolean)

  let activeChallenges: ActiveChallenge[] = []

  if (activeChallengeIds.length > 0) {
    const { data: allMilestones } = await supabase
      .from("milestones")
      .select("id, challenge_id")
      .in("challenge_id", activeChallengeIds)

    const activeParticipantIds = activeParts.map((p) => p.id)
    const { data: submissions } = await supabase
      .from("submissions")
      .select("milestone_id, participant_id")
      .in("participant_id", activeParticipantIds)

    const submittedMilestoneIds = new Set(
      (submissions || []).map((s) => s.milestone_id)
    )

    activeChallenges = activeParts.map((p) => {
      const challenge = p.challenges as any
      const challengeMilestones = (allMilestones || []).filter(
        (m) => m.challenge_id === challenge?.id
      )
      const completed = challengeMilestones.filter((m) =>
        submittedMilestoneIds.has(m.id)
      ).length

      return {
        id: challenge?.id,
        title: challenge?.title || "Untitled",
        status: challenge?.status,
        end_date: challenge?.end_date,
        organization: challenge?.organizations
          ? { name: challenge.organizations.name }
          : null,
        milestonesTotal: challengeMilestones.length,
        milestonesCompleted: completed,
      }
    })
  }

  let upcomingDeadlines: UpcomingDeadline[] = []

  if (activeChallengeIds.length > 0) {
    const now = new Date()
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: dueMilestones } = await supabase
      .from("milestones")
      .select("id, title, due_date, challenge_id, challenges(id, title)")
      .in("challenge_id", activeChallengeIds)
      .gte("due_date", now.toISOString())
      .lte("due_date", in7.toISOString())
      .order("due_date", { ascending: true })
      .limit(5)

    upcomingDeadlines = (dueMilestones || []).map((m) => {
      const daysLeft = Math.ceil(
        (new Date(m.due_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      const challenge = m.challenges as any
      return {
        challengeId: challenge?.id || m.challenge_id,
        challengeTitle: challenge?.title || "Unknown",
        milestoneTitle: m.title,
        dueDate: m.due_date!,
        daysLeft,
      }
    })
  }

  const joinedIds = new Set(allParticipations.map((p) => p.challenge_id))

  const { data: recommended } = await supabase
    .from("challenges")
    .select("id, title, difficulty, industry, participation_type, end_date, organizations(name)")
    .in("status", ["approved", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(20)

  const recommendedChallenges: RecommendedChallenge[] = ((recommended || []) as any[])
    .filter((c) => !joinedIds.has(c.id))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      title: c.title,
      difficulty: c.difficulty,
      industry: c.industry,
      participation_type: c.participation_type,
      end_date: c.end_date,
      organization: c.organizations ? { name: c.organizations.name } : null,
    }))

  const xpRankValue: string = (profile as any)?.xp_rank ?? "beginner"

  let guardrailLimit: number | null = null
  let beginnerJoinsThisWeek: number | null = null

  if (xpRankValue === "advanced") {
    const { data: settings } = await supabase
      .from("platform_settings")
      .select("advanced_beginner_weekly_limit")
      .eq("id", true)
      .single()

    const limit = (settings as any)?.advanced_beginner_weekly_limit ?? null

    if (limit != null) {
      guardrailLimit = limit

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: recentJoins } = await (supabase
        .from("challenge_participants")
        .select("joined_at, challenges(difficulty)")
        .eq("user_id", user.id)
        .neq("status", "withdrawn")
        .gte("joined_at", weekAgo) as any)

      beginnerJoinsThisWeek = ((recentJoins ?? []) as any[]).filter(
        (p) => p.challenges?.difficulty === "beginner"
      ).length
    }
  }

  return {
    firstName,
    slotsUsed,
    slotsMax,
    activeChallengesCount,
    completedChallengesCount,
    skillsCount: skillsCount || 0,
    activeChallenges,
    upcomingDeadlines,
    recommendedChallenges,
    xpPoints: (profile as any)?.xp_points ?? 0,
    xpRank: xpRankValue,
    guardrailLimit,
    beginnerJoinsThisWeek,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(dateString: string | null) {
  if (!dateString) return "—"
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function difficultyColor(d: string | null) {
  if (d === "advanced") return { bg: "rgba(239,68,68,0.1)", color: "#dc2626" }
  if (d === "intermediate") return { bg: "rgba(234,179,8,0.1)", color: "#b45309" }
  return { bg: "rgba(34,197,94,0.1)", color: "#16a34a" }
}

// ── Deadline Card — shared between mobile strip and desktop sidebar ─────────

function DeadlineItem({ d }: { d: UpcomingDeadline }) {
  return (
    <Link href={`/my-challenges/${d.challengeId}`} style={{ textDecoration: "none" }}>
      <div
        className="flex items-start gap-2 rounded-xl p-3"
        style={{
          background: d.daysLeft <= 2 ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.7)",
          border: `1px solid ${d.daysLeft <= 2 ? "rgba(239,68,68,0.2)" : "#f3f4f6"}`,
        }}
      >
        <AlertCircle
          className="mt-0.5 h-4 w-4 flex-shrink-0"
          style={{ color: d.daysLeft <= 2 ? "#dc2626" : "#ff9b87" }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "#2c3e50" }}>
            {d.milestoneTitle}
          </p>
          <p className="truncate text-xs" style={{ color: "#9ca3af" }}>
            {d.challengeTitle}
          </p>
          <span
            className="text-xs font-bold"
            style={{ color: d.daysLeft <= 2 ? "#dc2626" : "#e8836f" }}
          >
            {d.daysLeft === 0 ? "Due today!" : d.daysLeft === 1 ? "Due tomorrow" : `${d.daysLeft} days left`}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const {
    firstName,
    slotsUsed,
    slotsMax,
    activeChallengesCount,
    completedChallengesCount,
    skillsCount,
    activeChallenges,
    upcomingDeadlines,
    recommendedChallenges,
    xpPoints,
    xpRank,
    guardrailLimit,
    beginnerJoinsThisWeek,
  } = await getDashboardData()

  const slotsFree = slotsMax - slotsUsed
  const slotsPercent = Math.round((slotsUsed / slotsMax) * 100)

  return (
    <div className="student-portal space-y-4 md:space-y-6">

      {/* ── Welcome Banner ─────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between md:p-7"
        style={{ background: "linear-gradient(135deg, #2c3e50 0%, #1a252f 100%)" }}
      >
        <div>
          <p className="text-lg font-bold text-white md:text-xl">
            Welcome back, {firstName}! 👋
          </p>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            You have{" "}
            <span className="font-bold" style={{ color: slotsFree > 0 ? "#ff9b87" : "#f87171" }}>
              {slotsFree} slot{slotsFree !== 1 ? "s" : ""}
            </span>{" "}
            remaining —{" "}
            {slotsFree > 0 ? "ready to take on a new challenge?" : "you're at full capacity."}
          </p>
        </div>
        <Link
          href="/challenges"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white sm:w-auto sm:py-2.5"
          style={{ background: "#ff9b87", flexShrink: 0 }}
        >
          Browse Challenges
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* ── Stat Scorecards: 2-col on mobile, 4-col on md+ ────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">

        {/* Slots */}
        <div className="stat-card stat-card-coral flex flex-col gap-2 md:gap-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af" }}>
              Slots
            </p>
            <div className="stat-icon stat-icon-coral" style={{ width: 32, height: 32, borderRadius: 9 }}>
              <Layers style={{ width: "0.875rem", height: "0.875rem" }} />
            </div>
          </div>
          <p className="stat-value" style={{ fontSize: "1.625rem" }}>
            {slotsUsed}
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#9ca3af" }}>/{slotsMax}</span>
          </p>
          <div style={{ height: 4, background: "rgba(255,155,135,0.2)", borderRadius: 99 }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: "linear-gradient(90deg, #ff9b87, #e8836f)",
              width: `${slotsPercent}%`,
            }} />
          </div>
        </div>

        {/* Active */}
        <div className="stat-card flex flex-col gap-2 md:gap-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af" }}>
              Active
            </p>
            <div className="stat-icon" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1", width: 32, height: 32, borderRadius: 9 }}>
              <Zap style={{ width: "0.875rem", height: "0.875rem" }} />
            </div>
          </div>
          <p className="stat-value" style={{ fontSize: "1.625rem" }}>{activeChallengesCount}</p>
          <p style={{ fontSize: "0.65rem", color: "#9ca3af" }}>in progress</p>
        </div>

        {/* Completed */}
        <div className="stat-card stat-card-navy flex flex-col gap-2 md:gap-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af" }}>
              Done
            </p>
            <div className="stat-icon stat-icon-navy" style={{ width: 32, height: 32, borderRadius: 9 }}>
              <Trophy style={{ width: "0.875rem", height: "0.875rem" }} />
            </div>
          </div>
          <p className="stat-value" style={{ fontSize: "1.625rem" }}>{completedChallengesCount}</p>
          <p style={{ fontSize: "0.65rem", color: "#9ca3af" }}>completed</p>
        </div>

        {/* Skills */}
        <div className="stat-card flex flex-col gap-2 md:gap-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af" }}>
              Skills
            </p>
            <div className="stat-icon stat-icon-green" style={{ width: 32, height: 32, borderRadius: 9 }}>
              <Star style={{ width: "0.875rem", height: "0.875rem" }} />
            </div>
          </div>
          <p className="stat-value" style={{ fontSize: "1.625rem" }}>{skillsCount}</p>
          <p style={{ fontSize: "0.65rem" }}>
            <Link href="/profile" style={{ color: "#ff9b87", textDecoration: "none", fontWeight: 600 }}>
              Manage →
            </Link>
          </p>
        </div>

        {/* XP */}
        <div className="stat-card flex flex-col gap-2 md:gap-3">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af" }}>
              XP
            </p>
            <div className="stat-icon" style={{ background: "rgba(234,179,8,0.12)", color: "#b45309", width: 32, height: 32, borderRadius: 9 }}>
              <Zap style={{ width: "0.875rem", height: "0.875rem" }} />
            </div>
          </div>
          <p className="stat-value" style={{ fontSize: "1.625rem" }}>{xpPoints.toLocaleString()}</p>
          <p style={{ fontSize: "0.65rem", textTransform: "capitalize" }}>
            <span style={{ color: "#9ca3af" }}>{getRankTitle(xpRank as SkillTier)} · </span>
            <Link href="/profile" style={{ color: "#eab308", textDecoration: "none", fontWeight: 600 }}>
              How to earn →
            </Link>
          </p>
        </div>

      </div>

      {/* ── Advanced Guardrail Notice — only for advanced-XP students ──── */}
      {xpRank === "advanced" && guardrailLimit != null && beginnerJoinsThisWeek != null && (() => {
        const joinsLeft = Math.max(0, guardrailLimit - beginnerJoinsThisWeek)
        const pct = Math.min(100, Math.round((beginnerJoinsThisWeek / guardrailLimit) * 100))
        const atLimit = beginnerJoinsThisWeek >= guardrailLimit
        return (
          <div
            className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{
              background: atLimit
                ? "linear-gradient(135deg, rgba(239,68,68,0.07) 0%, rgba(239,68,68,0.03) 100%)"
                : "linear-gradient(135deg, rgba(234,179,8,0.07) 0%, rgba(234,179,8,0.03) 100%)",
              border: `1px solid ${atLimit ? "rgba(239,68,68,0.2)" : "rgba(234,179,8,0.2)"}`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex-shrink-0 rounded-lg p-2"
                style={{
                  background: atLimit ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                  color: atLimit ? "#dc2626" : "#b45309",
                }}
              >
                <ShieldAlert style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#2c3e50" }}>
                  Beginner Challenge Guardrail
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>
                  {atLimit
                    ? "You've reached your weekly beginner challenge limit."
                    : `You have ${joinsLeft} beginner challenge slot${joinsLeft !== 1 ? "s" : ""} remaining this week.`}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 sm:min-w-[140px]">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: atLimit ? "#dc2626" : "#b45309" }}>
                  {beginnerJoinsThisWeek}
                </span>
                <span className="text-sm font-medium" style={{ color: "#9ca3af" }}>
                  / {guardrailLimit} this week
                </span>
              </div>
              <div className="w-full sm:w-36" style={{ height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 99 }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 99,
                    width: `${pct}%`,
                    background: atLimit
                      ? "linear-gradient(90deg, #ef4444, #dc2626)"
                      : "linear-gradient(90deg, #f59e0b, #b45309)",
                  }}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Deadlines strip — mobile only (appears between cards and active list) */}
      {upcomingDeadlines.length > 0 && (
        <div className="stat-card stat-card-coral p-4 md:hidden">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" style={{ color: "#e8836f" }} />
            <p className="text-sm font-bold" style={{ color: "#2c3e50" }}>Deadlines This Week</p>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingDeadlines.map((d, i) => <DeadlineItem key={i} d={d} />)}
          </div>
        </div>
      )}

      {/* ── Two-Column: Active Challenges + Deadlines sidebar ──────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">

        {/* Active challenges */}
        <div className="stat-card p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-bold" style={{ color: "#2c3e50" }}>My Active Challenges</p>
            <Link
              href="/my-challenges"
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#ff9b87", textDecoration: "none" }}
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {activeChallenges.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center" style={{ color: "#9ca3af" }}>
              <BookOpen className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm font-semibold">No active challenges</p>
              <p className="mt-1 text-xs">
                <Link href="/challenges" style={{ color: "#ff9b87", textDecoration: "none" }}>
                  Browse challenges
                </Link>{" "}
                to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeChallenges.map((c) => {
                const pct = c.milestonesTotal > 0
                  ? Math.round((c.milestonesCompleted / c.milestonesTotal) * 100)
                  : 0
                return (
                  <Link key={c.id} href={`/my-challenges/${c.id}`} style={{ textDecoration: "none" }}>
                    <div
                      className="rounded-xl border p-3 transition-shadow hover:shadow-sm active:opacity-80"
                      style={{ background: "#fafafa", borderColor: "#f3f4f6" }}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: "#2c3e50" }}>
                            {c.title}
                          </p>
                          <p className="text-xs" style={{ color: "#9ca3af" }}>
                            {c.organization?.name}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-bold" style={{ color: "#ff9b87" }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "#e5e7eb" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: pct === 100
                              ? "linear-gradient(90deg, #22c55e, #16a34a)"
                              : "linear-gradient(90deg, #ff9b87, #e8836f)",
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between">
                        <p className="text-xs" style={{ color: "#9ca3af" }}>
                          {c.milestonesCompleted}/{c.milestonesTotal} milestones
                        </p>
                        {c.end_date && (
                          <p className="text-xs" style={{ color: "#9ca3af" }}>
                            Due {formatDate(c.end_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Deadlines sidebar — desktop only */}
        <div className="stat-card stat-card-coral hidden p-5 md:block">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" style={{ color: "#e8836f" }} />
            <p className="font-bold" style={{ color: "#2c3e50" }}>Deadlines This Week</p>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs" style={{ color: "#9ca3af" }}>
                No milestones due this week 🎉
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingDeadlines.map((d, i) => <DeadlineItem key={i} d={d} />)}
            </div>
          )}
        </div>

      </div>

      {/* ── Recommended Challenges ──────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-bold" style={{ color: "#2c3e50" }}>Recommended for You</p>
            <p className="text-xs" style={{ color: "#9ca3af" }}>Challenges you haven&apos;t joined yet</p>
          </div>
          <Link
            href="/challenges"
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: "#ff9b87", textDecoration: "none" }}
          >
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recommendedChallenges.length === 0 ? (
          <div className="stat-card p-6 text-center">
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              You&apos;ve joined all available challenges!{" "}
              <Link href="/challenges" style={{ color: "#ff9b87", textDecoration: "none" }}>
                Check back soon.
              </Link>
            </p>
          </div>
        ) : (
          /* 1 col → 2 col (sm) → 3 col (lg) */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedChallenges.map((c) => {
              const { bg, color } = difficultyColor(c.difficulty)
              return (
                <Link key={c.id} href={`/challenges/${c.id}`} style={{ textDecoration: "none" }}>
                  <div className="challenge-card active:opacity-80">
                    <div className="challenge-card-header">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold" style={{ color: "#2c3e50" }}>
                          {c.title}
                        </p>
                        <p className="text-xs" style={{ color: "#9ca3af" }}>
                          {c.organization?.name}
                        </p>
                      </div>
                      {c.difficulty && (
                        <span
                          className="ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-bold capitalize"
                          style={{ background: bg, color }}
                        >
                          {c.difficulty}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {c.industry && (
                        <span
                          className="rounded px-2 py-0.5 text-xs font-semibold"
                          style={{ color: "#6366f1", background: "rgba(99,102,241,0.08)" }}
                        >
                          {c.industry}
                        </span>
                      )}
                      {c.participation_type && (
                        <span
                          className="rounded px-2 py-0.5 text-xs font-semibold capitalize"
                          style={{ color: "#2c3e50", background: "#f3f4f6" }}
                        >
                          {c.participation_type}
                        </span>
                      )}
                    </div>

                    <div className="challenge-card-footer">
                      <span className="text-xs" style={{ color: "#9ca3af" }}>
                        {c.end_date ? `Ends ${formatDate(c.end_date)}` : "Open-ended"}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#ff9b87" }}>
                        View <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}