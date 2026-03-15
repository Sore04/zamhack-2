import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Lock } from "lucide-react"
import { submitChallengeForApproval } from "@/app/challenges/actions"
import { CloseChallengeButton } from "@/components/challenges/close-challenge-button"
import { RecalculateWinnersButton } from "@/components/challenges/recalculate-winners-button"
type Challenge = Database["public"]["Tables"]["challenges"]["Row"]
type Participant = Database["public"]["Tables"]["challenge_participants"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Milestone = Database["public"]["Tables"]["milestones"]["Row"]
type Submission = Database["public"]["Tables"]["submissions"]["Row"]
type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"]

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
    case "approved":         return "success"
    case "in_progress":      return "default"
    case "under_review":     return "warning"
    case "draft":            return "outline"
    case "pending_approval": return "warning"
    case "completed":        return "success"
    case "closed":           return "destructive"
    case "cancelled":        return "destructive"
    default:                 return "outline"
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{challenge.title}</h1>
            <Badge variant={getStatusBadgeVariant(challenge.status) as any}>
              {challenge.status?.replace("_", " ") || "Unknown"}
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

      </Tabs>
    </div>
  )
}