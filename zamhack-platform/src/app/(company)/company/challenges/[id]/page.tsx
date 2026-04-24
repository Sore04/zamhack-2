import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Lock, Trophy, CreditCard } from "lucide-react"
import { submitChallengeForApproval, getTiedParticipantDetails } from "@/app/challenges/actions"
import { computeRankedResultsWithBreakdown, shouldUseRankedMode, EvaluatorScore, RankedParticipantWithBreakdown } from "@/lib/rank-scoring"
import { CloseChallengeButton } from "@/components/challenges/close-challenge-button"
import { RecalculateWinnersButton } from "@/components/challenges/recalculate-winners-button"
import { ResolveTieModal } from "@/components/challenges/resolve-tie-modal"
import { RankingBreakdown } from "@/components/challenges/ranking-breakdown"
type Challenge = Database["public"]["Tables"]["challenges"]["Row"]
type Participant = Database["public"]["Tables"]["challenge_participants"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Milestone = Database["public"]["Tables"]["milestones"]["Row"]
type Submission = Database["public"]["Tables"]["submissions"]["Row"]
type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"]

export interface RankingBreakdownResult {
  rankedParticipants: RankedParticipantWithBreakdown[]
  evaluatorList: Array<{ evaluatorId: string; evaluatorName: string; isChief: boolean }>
  participantNames: Map<string, string>   // participantId (user_id) → display name
  companyScores: Map<string, number | null>  // userId → company evaluation score
  scoringMode: string
  isRankedMode: boolean
  resolvedByNames: Record<string, string>  // profile_id → resolver display name
}

interface ParticipantWithProfile extends Participant {
  profile: Profile | null
}

interface SubmissionWithDetails extends Submission {
  milestone: Milestone | null
  participant: ParticipantWithProfile | null
  evaluation: Evaluation | null
}

interface ChallengeManagementData {
  challenge: Challenge
  participants: ParticipantWithProfile[]
  submissions: SubmissionWithDetails[]
  milestones: Milestone[]
  stats: {
    totalParticipants: number
    totalSubmissions: number
    pendingReviews: number
    avgScore: number | null
    completionRate: number
  }
  milestoneProgress: Array<{
    milestone: Milestone
    completed: number
    total: number
    percentage: number
  }>
}

async function getRankingBreakdownData(challengeId: string): Promise<RankingBreakdownResult | null> {
  const supabase = await createClient()

  // a. Fetch scoring_mode from challenges
  const { data: challengeRow, error: challengeErr } = await supabase
    .from("challenges")
    .select("scoring_mode")
    .eq("id", challengeId)
    .single()

  if (challengeErr || !challengeRow) return null

  const scoringMode: string = challengeRow.scoring_mode ?? "company_only"

  // b. Fetch challenge_evaluators with profile join
  const { data: evaluatorRows } = await (supabase
    .from("challenge_evaluators")
    .select("evaluator_id, is_chief, profiles(first_name, last_name)")
    .eq("challenge_id", challengeId) as any)

  const evaluatorRowList: any[] = evaluatorRows ?? []

  const evaluatorNames = new Map<string, string>()
  const evaluatorList: Array<{ evaluatorId: string; evaluatorName: string; isChief: boolean }> = []
  let chiefEvaluatorId: string | null = null

  for (const row of evaluatorRowList) {
    const firstName: string = row.profiles?.first_name ?? ""
    const lastName: string = row.profiles?.last_name ?? ""
    const name = `${firstName} ${lastName}`.trim() || row.evaluator_id
    evaluatorNames.set(row.evaluator_id, name)
    evaluatorList.push({
      evaluatorId: row.evaluator_id,
      evaluatorName: name,
      isChief: row.is_chief === true,
    })
    if (row.is_chief === true) {
      chiefEvaluatorId = row.evaluator_id
    }
  }

  const evaluatorCount = evaluatorRowList.length

  // c. Determine ranked mode (computed early; data fetch happens before early return
  //    so companyScores are available for the simple display path too)
  const isRankedMode = shouldUseRankedMode({
    scoringMode: scoringMode as "company_only" | "evaluator_only" | "average",
    evaluatorCount,
  })

  // d. Fetch active participants with profile join
  const { data: participantRows } = await (supabase
    .from("challenge_participants")
    .select("id, user_id, profiles(first_name, last_name)")
    .eq("challenge_id", challengeId)
    .eq("status", "active") as any)

  const participantRowList: any[] = participantRows ?? []
  const participantNames = new Map<string, string>()
  // challenge_participants.id → user_id
  const participantIdToUserId = new Map<string, string>()

  for (const row of participantRowList) {
    if (!row.user_id) continue
    const firstName: string = row.profiles?.first_name ?? ""
    const lastName: string = row.profiles?.last_name ?? ""
    const name = `${firstName} ${lastName}`.trim() || row.user_id
    participantNames.set(row.user_id, name)
    participantIdToUserId.set(row.id, row.user_id)
  }

  // e. Fetch non-draft evaluations via join chain
  const { data: evalRows } = await (supabase
    .from("evaluations")
    .select(`
      reviewer_id,
      score,
      is_draft,
      profiles(role),
      submissions(
        participant_id,
        milestones(challenge_id)
      )
    `)
    .eq("is_draft", false) as any)

  const allEvals: any[] = evalRows ?? []

  // Filter to only evaluations belonging to this challenge
  const challengeEvals = allEvals.filter((e: any) => {
    return e.submissions?.milestones?.challenge_id === challengeId
  })

  // f. Build EvaluatorScore[]
  const evaluatorScores: EvaluatorScore[] = []
  // g. Build companyScores Map — init all active participants to null
  const companyScores = new Map<string, number | null>()
  for (const userId of participantNames.keys()) {
    companyScores.set(userId, null)
  }

  for (const e of challengeEvals) {
    const role: string | null = e.profiles?.role ?? null
    const participantRowId: string | null = e.submissions?.participant_id ?? null
    const rawScore: number | null = e.score ?? null
    const reviewerId: string | null = e.reviewer_id ?? null

    if (!participantRowId || rawScore === null || !reviewerId) continue

    const userId = participantIdToUserId.get(participantRowId)
    if (!userId) continue

    if (role === "evaluator") {
      evaluatorScores.push({
        evaluatorId: reviewerId,
        participantId: userId,
        rawScore,
      })
    } else if (role === "company_admin" || role === "company_member") {
      companyScores.set(userId, rawScore)
    }
  }

  // g2. Fetch winner rows to build resolver name map
  const { data: winnerRows } = await (supabase
    .from("winners")
    .select(`
      profile_id,
      tie_resolved_by,
      resolver:profiles!winners_tie_resolved_by_fkey(first_name, last_name)
    `)
    .eq("challenge_id", challengeId) as any)

  const resolvedByNames: Record<string, string> = {}
  for (const row of (winnerRows ?? []) as any[]) {
    if (row.tie_resolved_by && row.resolver) {
      const name = `${row.resolver.first_name ?? ""} ${row.resolver.last_name ?? ""}`.trim()
      if (name) resolvedByNames[row.profile_id] = name
    }
  }

  // Early return for non-ranked mode — include companyScores for simple score display
  if (!isRankedMode) {
    return {
      rankedParticipants: [],
      evaluatorList,
      participantNames,
      companyScores,
      scoringMode,
      isRankedMode: false,
      resolvedByNames,
    }
  }

  // h. Call computeRankedResultsWithBreakdown
  const rankedParticipants = computeRankedResultsWithBreakdown({
    evaluatorScores,
    companyScores,
    chiefEvaluatorId,
    evaluatorNames,
  })

  // i. Return assembled result
  return {
    rankedParticipants,
    evaluatorList,
    participantNames,
    companyScores,
    scoringMode,
    isRankedMode: true,
    resolvedByNames,
  }
}

async function getChallengeManagementData(
  challengeId: string
): Promise<ChallengeManagementData | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    redirect("/login")
  }

  if (profile.role !== "company_admin" && profile.role !== "company_member") {
    redirect("/dashboard")
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .single()

  if (challengeError || !challenge) {
    return null
  }

  if (challenge.organization_id !== profile.organization_id) {
    redirect("/company/dashboard")
  }

  const { data: milestones, error: milestonesError } = await supabase
    .from("milestones")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("sequence_order", { ascending: true })

  if (milestonesError) {
    console.error("Error fetching milestones:", milestonesError)
  }

  const milestonesList = milestones || []

  const { data: participants, error: participantsError } = await supabase
    .from("challenge_participants")
    .select("*")
    .eq("challenge_id", challengeId)

  if (participantsError) {
    console.error("Error fetching participants:", participantsError)
  }

  const participantsList = participants || []
  const participantIds = participantsList.map((p) => p.id)

  const userIds = participantsList
    .map((p) => p.user_id)
    .filter(Boolean) as string[]

  let profilesMap = new Map<string, Profile>()
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds)

    if (!profilesError && profiles) {
      profilesMap = new Map(profiles.map((p) => [p.id, p]))
    }
  }

  const participantsWithProfiles: ParticipantWithProfile[] = participantsList.map(
    (p) => ({
      ...p,
      profile: p.user_id ? profilesMap.get(p.user_id) || null : null,
    })
  )

  let submissionsList: Submission[] = []
  if (participantIds.length > 0) {
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("*")
      .in("participant_id", participantIds)
      .order("submitted_at", { ascending: false })

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError)
    } else {
      submissionsList = submissions || []
    }
  }

  const submissionIds = submissionsList.map((s) => s.id)
  let evaluationsMap = new Map<string, Evaluation>()
  if (submissionIds.length > 0) {
    const { data: evaluations, error: evaluationsError } = await supabase
      .from("evaluations")
      .select("*")
      .in("submission_id", submissionIds)
      .eq("is_draft", false)

    if (!evaluationsError && evaluations) {
      evaluationsMap = new Map(
        evaluations
          .filter((e) => e.submission_id !== null)
          .map((e) => [e.submission_id as string, e])
      )
    }
  }

  const milestoneMap = new Map(milestonesList.map((m) => [m.id, m]))
  const participantMap = new Map(participantsWithProfiles.map((p) => [p.id, p]))

  const submissionsWithDetails: SubmissionWithDetails[] = submissionsList.map(
    (sub) => ({
      ...sub,
      milestone: sub.milestone_id ? milestoneMap.get(sub.milestone_id) || null : null,
      participant: sub.participant_id
        ? participantMap.get(sub.participant_id) || null
        : null,
      evaluation: evaluationsMap.get(sub.id) || null,
    })
  )

  const totalParticipants = participantsList.length
  const totalSubmissions = submissionsList.length
  const pendingReviews = submissionsList.filter(
    (s) => !evaluationsMap.has(s.id)
  ).length

  const evaluatedSubmissions = submissionsList.filter((s) =>
    evaluationsMap.has(s.id)
  )
  const scores = evaluatedSubmissions
    .map((s) => {
      const evaluationItem = evaluationsMap.get(s.id)
      return evaluationItem?.score ?? null
    })
    .filter((score): score is number => score !== null)

  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

  const participantsWithSubmissions = new Set(
    submissionsList.map((s) => s.participant_id).filter(Boolean)
  )
  const completionRate =
    totalParticipants > 0
      ? Math.round((participantsWithSubmissions.size / totalParticipants) * 100)
      : 0

  const milestoneProgress = milestonesList.map((milestone) => {
    const milestoneSubmissions = submissionsList.filter(
      (s) => s.milestone_id === milestone.id
    )
    const completed = milestoneSubmissions.length
    const total = totalParticipants
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { milestone, completed, total, percentage }
  })

  return {
    challenge,
    participants: participantsWithProfiles,
    submissions: submissionsWithDetails,
    milestones: milestonesList,
    stats: {
      totalParticipants,
      totalSubmissions,
      pendingReviews,
      avgScore,
      completionRate,
    },
    milestoneProgress,
  }
}

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case "approved":                    return "success"
    case "in_progress":                 return "default"
    case "under_review":                return "warning"
    case "draft":                       return "outline"
    case "pending_approval":            return "warning"
    case "approved_awaiting_payment":   return "warning"
    case "completed":                   return "success"
    case "closed":                      return "destructive"
    case "cancelled":                   return "destructive"
    default:                            return "outline"
  }
}

const getStatusLabel = (status: string | null): string => {
  switch (status) {
    case "approved":                    return "Approved"
    case "in_progress":                 return "In Progress"
    case "under_review":                return "Under Review"
    case "draft":                       return "Draft"
    case "pending_approval":            return "Pending Approval"
    case "approved_awaiting_payment":   return "Awaiting Payment"
    case "completed":                   return "Completed"
    case "closed":                      return "Closed"
    case "cancelled":                   return "Cancelled"
    default:                            return status ?? "Unknown"
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString()
}

const getParticipantName = (participant: ParticipantWithProfile) => {
  if (participant.profile) {
    const { first_name, last_name } = participant.profile
    const name = `${first_name || ""} ${last_name || ""}`.trim()
    return name || "Unknown"
  }
  return "Unknown"
}

const getParticipantEmail = (_participant: ParticipantWithProfile) => {
  return "N/A"
}

export default async function ChallengeManagementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getChallengeManagementData(id)

  if (!data) {
    redirect("/company/dashboard")
  }

  const { challenge, participants, submissions, stats, milestoneProgress, milestones } = data

  const isDraft = challenge.status === "draft"
  const isClosed = challenge.status === "closed" || challenge.status === "completed"

  // Fetch tied winner details for the banner (only relevant when closed)
  const { tiedWinners } = isClosed
    ? await getTiedParticipantDetails(id)
    : { tiedWinners: [] }

  const rankingData = isClosed ? await getRankingBreakdownData(id) : null
  const hasTies = tiedWinners.length > 0

  return (
    <div className="space-y-6 p-6">
      {/* Banner */}
      {(challenge as any).banner_image ? (
        <div className="w-full h-48 md:h-64 overflow-hidden rounded-xl">
          <img
            src={(challenge as any).banner_image}
            alt="Challenge banner"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full h-48 md:h-64 rounded-xl bg-gradient-to-br from-[#E8826A] to-[#F4A58A]" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{challenge.title}</h1>
            <Badge variant={getStatusBadgeVariant(challenge.status) as any}>
              {getStatusLabel(challenge.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">{challenge.description}</p>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <form
              action={async () => {
                "use server"
                await submitChallengeForApproval(challenge.id)
              }}
            >
              <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                Submit for Approval
              </Button>
            </form>
          )}

          <Button variant="outline" asChild>
            <Link href={`/company/challenges/${id}/edit`}>Edit Challenge</Link>
          </Button>

          {isClosed ? (
            <div className="flex flex-col gap-2">
              <Button variant="outline" disabled className="opacity-50">
                <Lock className="mr-2 h-4 w-4" />
                Challenge Closed
              </Button>
              <RecalculateWinnersButton challengeId={challenge.id} />
            </div>
          ) : (
            <CloseChallengeButton challengeId={challenge.id} />
          )}
        </div>
      </div>

      {/* Payment Banner */}
      {challenge.status === "approved_awaiting_payment" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-1.5">
              <CreditCard className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                Payment required to go live
              </p>
              <p className="text-sm text-amber-700">
                Your challenge has been approved with a listing fee of{" "}
                <span className="font-semibold">
                  PHP {(challenge.listing_fee ?? 0).toFixed(2)}
                </span>
                . Complete payment to publish it to students.
              </p>
            </div>
          </div>
          <Link href={`/company/challenges/${challenge.id}/payment`}>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap shrink-0"
            >
              Pay Now
            </Button>
          </Link>
        </div>
      )}

      {/* Rejection Banner */}
      {challenge.status === "rejected" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-red-100 p-1.5 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">Challenge Rejected</p>
            <p className="text-sm text-red-700 mt-0.5">
              {(challenge as any).rejection_feedback
                ? (challenge as any).rejection_feedback
                : "This challenge was rejected by an admin. Please review and resubmit as a new challenge."}
            </p>
          </div>
        </div>
      )}

      {/* Tie Banner */}
      {hasTies && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <span className="text-yellow-600 text-lg mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              Tie detected — results are not yet final
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Some participants are tied and require manual resolution
              before final rankings are confirmed.
            </p>
            <div className="mt-3">
              <ResolveTieModal
                challengeId={id}
                tiedWinners={tiedWinners}
                onResolved={() => {}}
                trigger={
                  <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100">
                    Resolve Tie
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">
            Participants ({stats.totalParticipants})
          </TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions ({stats.totalSubmissions})
          </TabsTrigger>
          {isClosed && (
            <TabsTrigger value="rankings">
              <Trophy className="h-4 w-4 mr-2" />
              Rankings
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalParticipants}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingReviews}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.avgScore !== null ? `${stats.avgScore}%` : "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Participants who submitted at least one milestone</span>
                  <span className="font-medium">{stats.completionRate}%</span>
                </div>
                <Progress value={stats.completionRate} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Milestone Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {milestoneProgress.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No milestones defined for this challenge.
                </p>
              ) : (
                milestoneProgress.map((mp) => (
                  <div key={mp.milestone.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{mp.milestone.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {formatDate(mp.milestone.due_date)}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {mp.completed} / {mp.total}
                      </span>
                    </div>
                    <Progress value={mp.percentage} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {participants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p>No participants yet.</p>
                </div>
              ) : (
                <div className="rounded-md border bg-card">
                  <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Email</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {participants.map((participant) => (
                          <tr key={participant.id} className="border-b transition-colors hover:bg-muted/50">
                            <td className="p-4 align-middle font-medium">{getParticipantName(participant)}</td>
                            <td className="p-4 align-middle">{getParticipantEmail(participant)}</td>
                            <td className="p-4 align-middle">
                              <Badge variant="outline">{participant.status || "active"}</Badge>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/profiles/${participant.profile?.id || ""}`}>
                                  View Profile
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Submissions Tab */}
        <TabsContent value="submissions" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p>No submissions yet.</p>
                </div>
              ) : (
                <div className="rounded-md border bg-card">
                  <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Student</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Milestone</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Submitted Date</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {submissions.map((submission) => (
                          <tr key={submission.id} className="border-b transition-colors hover:bg-muted/50">
                            <td className="p-4 align-middle font-medium">
                              {submission.participant ? getParticipantName(submission.participant) : "Unknown"}
                            </td>
                            <td className="p-4 align-middle">{submission.milestone?.title || "N/A"}</td>
                            <td className="p-4 align-middle">{formatDate(submission.submitted_at)}</td>
                            <td className="p-4 align-middle">
                              <Badge variant={submission.evaluation ? "success" : "warning"}>
                                {submission.evaluation ? "Reviewed" : "Pending"}
                              </Badge>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/company/challenges/${id}/submissions/${submission.id}`}>
                                  Review
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isClosed && rankingData && (
          <TabsContent value="rankings">
            <RankingBreakdown
              rankedParticipants={rankingData.rankedParticipants}
              evaluatorList={rankingData.evaluatorList}
              participantNames={Object.fromEntries(rankingData.participantNames)}
              companyScores={Object.fromEntries(rankingData.companyScores)}
              scoringMode={rankingData.scoringMode}
              isRankedMode={rankingData.isRankedMode}
              resolvedByNames={rankingData.resolvedByNames}
            />
          </TabsContent>
        )}

      </Tabs>
    </div>
  )
}