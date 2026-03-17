import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { SubmissionForm } from "@/components/submission-form"
import { JoinButton } from "@/components/join-button"
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  CreditCard,
  Clock,
  Trophy,
  MapPin,
  Globe,
} from "lucide-react"
import Link from "next/link"
import DownloadCertificateButton from "@/components/certificate/download-certificate-btn"
import { RubricCriteriaCard } from "@/components/rubric-criteria-card"

// --- Types ---
type Challenge = Database["public"]["Tables"]["challenges"]["Row"]
type Organization = Database["public"]["Tables"]["organizations"]["Row"]
type Milestone = Database["public"]["Tables"]["milestones"]["Row"]
type Submission = Database["public"]["Tables"]["submissions"]["Row"]
type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"]
type Rubric = Database["public"]["Tables"]["rubrics"]["Row"]
type ChallengeParticipant =
  Database["public"]["Tables"]["challenge_participants"]["Row"]

interface TeamData {
  id: string
  name: string
  leader_id: string | null
}

interface ChallengeProgressData {
  challenge: Challenge & { organization: Organization | null }
  milestones: Milestone[]
  participant: ChallengeParticipant | null
  submissions: Submission[]
  evaluations: Evaluation[]
  rubrics: Rubric[]
  userTeam: TeamData | null
  userId: string
  studentName: string
}

type MilestoneStatus = "completed" | "in_progress" | "locked"

interface MilestoneWithStatus extends Milestone {
  status: MilestoneStatus
  submission: Submission | null
  evaluation: Evaluation | null
}

// --- Data Fetching ---
async function getChallengeData(
  id: string
): Promise<ChallengeProgressData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // 1. Challenge details
  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("*, organization:organizations(*)")
    .eq("id", id)
    .single()

  if (challengeError || !challenge) return null

  // 2. Milestones
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("challenge_id", id)
    .order("sequence_order", { ascending: true })

  // 3. Participation
  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("*")
    .eq("challenge_id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  // 4. Submissions + Evaluations
  let submissions: Submission[] = []
  let evaluations: Evaluation[] = []

  if (participant) {
    const { data: subs } = await supabase
      .from("submissions")
      .select("*")
      .eq("participant_id", participant.id)
      .order("submitted_at", { ascending: false })

    if (subs) {
      submissions = subs
      const submissionIds = subs.map((s) => s.id)
      if (submissionIds.length > 0) {
        const { data: evals } = await supabase
          .from("evaluations")
          .select("*")
          .in("submission_id", submissionIds)
        if (evals) evaluations = evals
      }
    }
  }

  // 5. Rubrics
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("*")
    .eq("challenge_id", id)
    .order("created_at", { ascending: true })

  // 6. Team
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("team:teams(id, name, leader_id)")
    .eq("user_id", user.id)
    .maybeSingle()

  const userTeam = (teamMember?.team as unknown as TeamData | null) ?? null

  // 7. Profile (for certificate)
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single()

  const studentName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      "Student"
    : "Student"

  return {
    challenge: challenge as any,
    milestones: milestones || [],
    participant,
    submissions,
    evaluations,
    rubrics: rubrics || [],
    userTeam,
    userId: user.id,
    studentName,
  }
}

// --- Main Page Component ---
export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getChallengeData(id)

  if (!data) {
    return (
      <div className="container py-12 text-center">
        <h1 className="text-2xl font-bold">Challenge not found</h1>
        <Button asChild className="mt-4">
          <Link href="/challenges">Back to Challenges</Link>
        </Button>
      </div>
    )
  }

  const {
    challenge,
    milestones,
    participant,
    submissions,
    evaluations,
    rubrics,
    userTeam,
    userId,
    studentName,
  } = data

  // --- Logic ---
  const hasJoined = !!participant
  const deadline = challenge.registration_deadline
  const isRegistrationClosed = deadline
    ? new Date(deadline) < new Date()
    : false
  const startDate = challenge.start_date
  const endDate = challenge.end_date
  const isEnded =
    challenge.status === "closed" || challenge.status === "completed"

  const isPerpetual: boolean = (challenge as any).is_perpetual === true
  const orgName =
    (challenge as any).organization?.name ?? "ZamHack"
  const completionDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const hasEntryFee = (challenge.entry_fee_amount || 0) > 0
  const feeAmount = challenge.entry_fee_amount
  const currency = challenge.currency || "PHP"

  // Group rubrics by milestone_id; null key = challenge-level fallback
  const milestoneRubricMap = new Map<string | null, Rubric[]>()
  rubrics.forEach((r) => {
    const key = (r as any).milestone_id ?? null
    const arr = milestoneRubricMap.get(key) ?? []
    arr.push(r)
    milestoneRubricMap.set(key, arr)
  })

  // Build milestone statuses
  let previousMilestoneCompleted = true
  const milestonesWithStatus: MilestoneWithStatus[] = milestones.map(
    (milestone) => {
      const submission =
        submissions.find((s) => s.milestone_id === milestone.id) || null
      const evaluation = submission
        ? evaluations.find((e) => e.submission_id === submission.id) || null
        : null

      let status: MilestoneStatus = "locked"
      if (hasJoined) {
        if (submission) status = "completed"
        else if (previousMilestoneCompleted) status = "in_progress"
      }
      previousMilestoneCompleted = !!submission

      return { ...milestone, status, submission, evaluation }
    }
  )

  const completedCount = submissions.length
  const totalMilestones = milestones.length
  const progressPercentage =
    totalMilestones > 0
      ? Math.round((completedCount / totalMilestones) * 100)
      : 0

  // KEY: show certificate when perpetual + joined + ALL milestones submitted
  // Does NOT require the challenge to be closed
  const allMilestonesCompleted =
    totalMilestones > 0 && completedCount === totalMilestones

  const showCertificate = isPerpetual && hasJoined && allMilestonesCompleted

  return (
    <div className="container py-8 space-y-8">
      {/* --- HEADER --- */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div>
            <Badge variant="outline" className="mb-2">
              {(challenge as any).industry || "General"}
            </Badge>
            <h1 className="text-3xl font-bold">{challenge.title}</h1>
            <p className="text-lg text-muted-foreground mt-2">
              By {(challenge as any).organization?.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span>
                Registration Deadline:{" "}
                {deadline
                  ? new Date(deadline).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {isPerpetual ? (
                <span>
                  Starts:{" "}
                  {startDate
                    ? new Date(startDate).toLocaleDateString()
                    : "TBD"}{" "}
                  · ∞ Open-ended
                </span>
              ) : (
                <span>
                  Duration:{" "}
                  {startDate
                    ? new Date(startDate).toLocaleDateString()
                    : "TBD"}{" "}
                  -{" "}
                  {endDate
                    ? new Date(endDate).toLocaleDateString()
                    : "TBD"}
                </span>
              )}
            </div>

            {/* Location tag */}
            {(challenge as any).location_type === "onsite" ? (
              <div className="flex items-center gap-1 text-orange-700 font-medium px-2 py-0.5 bg-orange-50 rounded-full border border-orange-200">
                <MapPin className="h-4 w-4" />
                <span>
                  Onsite
                  {(challenge as any).location_details
                    ? ` · ${(challenge as any).location_details}`
                    : ""}
                </span>
              </div>
            ) : (challenge as any).location_type === "online" ? (
              <div className="flex items-center gap-1 text-blue-700 font-medium px-2 py-0.5 bg-blue-50 rounded-full border border-blue-200">
                <Globe className="h-4 w-4" />
                <span>Online</span>
              </div>
            ) : null}

            {hasEntryFee ? (
              <div className="flex items-center gap-1 text-green-700 font-medium px-2 py-0.5 bg-green-50 rounded-full border border-green-200">
                <CreditCard className="h-4 w-4" />
                <span>
                  Entry Fee: {currency} {feeAmount}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-green-700 font-medium px-2 py-0.5 bg-green-50 rounded-full border border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <span>Free Entry</span>
              </div>
            )}
          </div>

          <div className="prose max-w-none pt-4 border-t">
            <h3 className="text-lg font-semibold">About this Challenge</h3>
            <p className="whitespace-pre-wrap">{challenge.description}</p>
          </div>
        </div>

        {/* --- SIDEBAR --- */}
        <div className="space-y-6">
          <Card className="border-2 shadow-sm">
            <CardHeader className="bg-muted/10 pb-4">
              <CardTitle>Challenge Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {hasJoined ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Progress</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {completedCount} of {totalMilestones} milestones submitted
                  </p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-2 text-sm">
                  Join this challenge to start tracking your progress and
                  submitting solutions.
                </div>
              )}

              {/* ── ACTION BUTTONS ── */}
              <div className="space-y-3">
                {/* CASE 1: Perpetual + student finished all milestones → Certificate */}
                {showCertificate ? (
                  <DownloadCertificateButton
                    type="completion"
                    studentName={studentName}
                    challengeTitle={challenge.title}
                    organizationName={orgName}
                    completionDate={completionDate}
                    totalScore={null}
                  />
                ) : isEnded && isPerpetual ? (
                  /* CASE 2: Perpetual + closed + student didn't finish */
                  <Button disabled className="w-full" variant="secondary">
                    Challenge Closed
                  </Button>
                ) : isEnded && !isPerpetual ? (
                  /* CASE 3: Normal challenge closed → results page */
                  <Button
                    asChild
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                  >
                    <Link href={`/challenges/${challenge.id}/results`}>
                      <Trophy className="mr-2 h-4 w-4" />
                      View Official Results
                    </Link>
                  </Button>
                ) : hasJoined ? (
                  /* CASE 4: Active + already joined */
                  <Button
                    disabled
                    className="w-full bg-green-600/20 text-green-600 hover:bg-green-600/20 font-semibold"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Already Joined
                  </Button>
                ) : isRegistrationClosed ? (
                  /* CASE 5: Registration closed */
                  <Button disabled className="w-full" variant="secondary">
                    <Lock className="mr-2 h-4 w-4" />
                    Registration Closed
                  </Button>
                ) : hasEntryFee ? (
                  /* CASE 6: Paid entry */
                  <Button
                    asChild
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-md"
                    size="lg"
                  >
                    <Link href={`/challenges/${challenge.id}/payment`}>
                      Join for {currency} {feeAmount}
                    </Link>
                  </Button>
                ) : (
                  /* CASE 7: Free entry */
                  <JoinButton challengeId={id} isFull />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --- MILESTONES --- */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Milestones
          <Badge variant="secondary" className="text-sm font-normal">
            {milestones.length} Steps
          </Badge>
        </h2>

        {milestonesWithStatus.length === 0 ? (
          <p className="text-muted-foreground italic">
            No milestones have been set for this challenge yet.
          </p>
        ) : (
          <div className="grid gap-6">
            {milestonesWithStatus.map((milestone, index) => (
              <Card
                key={milestone.id}
                className={`transition-all duration-200 ${
                  milestone.status === "locked"
                    ? "opacity-60 border-dashed"
                    : milestone.status === "completed"
                    ? "border-green-200"
                    : "border-primary/30 shadow-sm"
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          milestone.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : milestone.status === "in_progress"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {milestone.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : milestone.status === "locked" ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Step {index + 1}
                          {milestone.status === "completed" &&
                            " · Completed"}
                          {milestone.status === "in_progress" &&
                            " · In Progress"}
                          {milestone.status === "locked" && " · Locked"}
                        </p>
                        <CardTitle className="text-base">
                          {milestone.title}
                        </CardTitle>
                      </div>
                    </div>
                    {milestone.due_date && (
                      <span className="text-sm text-muted-foreground hidden sm:block">
                        Due:{" "}
                        {new Date(milestone.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {milestone.description && (
                    <p className="text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {milestone.requires_github && (
                      <Badge variant="outline" className="text-[10px]">
                        GitHub
                      </Badge>
                    )}
                    {milestone.requires_url && (
                      <Badge variant="outline" className="text-[10px]">
                        Demo URL
                      </Badge>
                    )}
                    {milestone.requires_text && (
                      <Badge variant="outline" className="text-[10px]">
                        Report
                      </Badge>
                    )}
                  </div>

                  {/* Scoring Criteria for this milestone */}
                  {(() => {
                    const milestoneRubrics =
                      milestoneRubricMap.get(milestone.id) ??
                      milestoneRubricMap.get(null) ??
                      []
                    return milestoneRubrics.length > 0 ? (
                      <RubricCriteriaCard rubrics={milestoneRubrics} />
                    ) : null
                  })()}

                  {/* Submission form */}
                  {milestone.status === "in_progress" && participant && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Submit Your Work
                      </h4>
                      <SubmissionForm
                        milestoneId={milestone.id}
                        participantId={participant.id}
                        teamId={userTeam?.id || undefined}
                        isTeamLeader={userTeam?.leader_id === userId}
                        requiresGithub={milestone.requires_github}
                        requiresUrl={milestone.requires_url}
                        requiresText={milestone.requires_text}
                      />
                    </div>
                  )}

                  {/* Feedback */}
                  {milestone.status === "completed" &&
                    milestone.evaluation && (
                      <Card className="bg-green-50/50 border-green-200 mt-4">
                        <CardContent className="pt-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-green-100 pb-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                              <h4 className="font-semibold text-green-900">
                                Feedback Received
                              </h4>
                            </div>
                            {milestone.evaluation.score !== null && (
                              <div className="text-lg font-bold text-green-800 flex items-center gap-2">
                                <span className="text-sm font-normal text-green-700/80 uppercase tracking-wide">
                                  Score
                                </span>
                                <Badge
                                  variant="default"
                                  className="text-base px-3 py-1"
                                >
                                  {milestone.evaluation.score}/100
                                </Badge>
                              </div>
                            )}
                          </div>
                          {milestone.evaluation.feedback && (
                            <div className="prose prose-sm prose-green max-w-none">
                              <p className="whitespace-pre-wrap text-green-800/90">
                                {milestone.evaluation.feedback}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                  {/* Pending feedback */}
                  {milestone.status === "completed" &&
                    milestone.submission &&
                    !milestone.evaluation && (
                      <Card className="bg-muted/30 border-dashed mt-4">
                        <CardContent className="pt-6 flex flex-col items-center justify-center text-center py-8">
                          <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center mb-3">
                            <Clock className="h-5 w-5 text-yellow-600" />
                          </div>
                          <h4 className="font-semibold text-foreground">
                            Submission Received
                          </h4>
                          <p className="text-sm text-muted-foreground max-w-xs mt-1">
                            Your work has been submitted successfully.
                            Waiting for organizer review and feedback.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}