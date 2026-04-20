import { MessageCompanyButton } from "@/components/message-company-button"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { SubmissionForm } from "@/components/submission-form"
import { RubricCriteriaCard } from "@/components/rubric-criteria-card"
import { AlertCircle, CheckCircle2, Lock, MessageSquare } from "lucide-react"
import Link from "next/link"
import { computeFinalScore, splitEvaluationsByRole, type ScoringMode } from "@/lib/scoring-utils"
import { WithdrawButton } from "@/components/withdraw-button"

type Challenge = Database["public"]["Tables"]["challenges"]["Row"]
type Organization = Database["public"]["Tables"]["organizations"]["Row"]
type Milestone = Database["public"]["Tables"]["milestones"]["Row"]
type Submission = Database["public"]["Tables"]["submissions"]["Row"]
type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"]
type Rubric = Database["public"]["Tables"]["rubrics"]["Row"]
type ChallengeParticipant = Database["public"]["Tables"]["challenge_participants"]["Row"]

interface ChallengeProgressData {
  challenge: Challenge & {
    organization: Organization | null
  }
  milestones: Milestone[]
  participant: ChallengeParticipant
  submissions: Submission[]
  evaluations: EvaluationWithRole[]
  rubrics: Rubric[]
}

interface EvaluationWithRole extends Evaluation {
  reviewer_role: string | null
}

type MilestoneStatus = "completed" | "in_progress" | "locked"

interface MilestoneWithStatus extends Milestone {
  status: MilestoneStatus
  submission: Submission | null
  companyEval: EvaluationWithRole | null
  evaluatorEval: EvaluationWithRole | null
  finalScore: number | null
  finalScoreLabel: string
  isFallback: boolean
}

async function getChallengeProgress(
  challengeId: string
): Promise<ChallengeProgressData | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch challenge with organization
  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select(
      `
      *,
      organization:organizations(*)
    `
    )
    .eq("id", challengeId)
    .single()

  if (challengeError || !challenge) {
    return null
  }

  // Fetch milestones ordered by sequence
  const { data: milestones, error: milestonesError } = await supabase
    .from("milestones")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("sequence_order", { ascending: true })

  if (milestonesError) {
    console.error("Error fetching milestones:", milestonesError)
  }

  // Fetch participant record for current user
  const { data: participant, error: participantError } = await supabase
    .from("challenge_participants")
    .select("*")
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (participantError || !participant) {
    return null
  }

  // Fetch submissions for this participant
  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("*")
    .eq("participant_id", participant.id)

  if (submissionsError) {
    console.error("Error fetching submissions:", submissionsError)
  }

  // Fetch evaluations for these submissions — join reviewer role for scoring_mode logic
  const submissionIds = submissions?.map((s) => s.id) || []
  let evaluations: EvaluationWithRole[] = []

  if (submissionIds.length > 0) {
    const { data: evals, error: evaluationsError } = await supabase
      .from("evaluations")
      .select("*, profiles(role)")
      .in("submission_id", submissionIds)
      .eq("is_draft", false)
      .not("reviewer_id", "is", null)

    if (evaluationsError) {
      console.error("Error fetching evaluations:", evaluationsError)
    } else {
      evaluations = (evals || []).map((e: any) => ({
        ...e,
        reviewer_role: e.profiles?.role ?? null,
      }))
    }
  }

  // Fetch rubrics for the challenge
  const { data: rubrics, error: rubricsError } = await supabase
    .from("rubrics")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true })

  if (rubricsError) {
    console.error("Error fetching rubrics:", rubricsError)
  }

  return {
    challenge: challenge as any,
    milestones: milestones || [],
    participant: participant as ChallengeParticipant,
    submissions: submissions || [],
    evaluations: evaluations || [],
    rubrics: rubrics || [],
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "No date set"
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

interface ChallengeProgressPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ChallengeProgressPage({
  params,
}: ChallengeProgressPageProps) {
  const { id } = await params
  const data = await getChallengeProgress(id)

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Challenge not found</h2>
        <p className="text-muted-foreground max-w-[500px]">
          The challenge you are looking for doesn&apos;t exist or you are not a participant.
        </p>
        <Button asChild variant="outline">
          <Link href="/my-challenges">Back to My Challenges</Link>
        </Button>
      </div>
    )
  }

  const { challenge, milestones, participant, submissions, evaluations, rubrics } = data

  // Create a map of milestone_id -> submission
  const submissionMap = new Map<string, Submission>()
  submissions.forEach((sub) => {
    if (sub.milestone_id) {
      submissionMap.set(sub.milestone_id, sub)
    }
  })

  // Group evaluations by submission_id (multiple per submission now)
  const evaluationsBySubmission = new Map<string, EvaluationWithRole[]>()
  evaluations.forEach((e) => {
    if (e.submission_id) {
      const existing = evaluationsBySubmission.get(e.submission_id) || []
      evaluationsBySubmission.set(e.submission_id, [...existing, e])
    }
  })

  // Group rubrics by milestone_id; null key = challenge-level fallback
  const milestoneRubricMap = new Map<string | null, Rubric[]>()
  rubrics.forEach((r) => {
    const key = (r as any).milestone_id ?? null
    const arr = milestoneRubricMap.get(key) ?? []
    arr.push(r)
    milestoneRubricMap.set(key, arr)
  })

  const scoringMode = ((challenge as any).scoring_mode || "company_only") as ScoringMode

  // Determine milestone statuses
  const milestonesWithStatus: MilestoneWithStatus[] = []
  let foundInProgress = false

  for (const milestone of milestones) {
    const submission = submissionMap.get(milestone.id) || null
    const subEvals = submission ? (evaluationsBySubmission.get(submission.id) || []) : []
    const { companyEval, evaluatorEval } = splitEvaluationsByRole(subEvals)
    const { finalScore, label, isFallback } = computeFinalScore({
      companyScore: companyEval?.score ?? null,
      evaluatorScore: evaluatorEval?.score ?? null,
      scoringMode,
    })

    let status: MilestoneStatus = "locked"
    if (submission) {
      status = "completed"
    } else if (!foundInProgress) {
      status = "in_progress"
      foundInProgress = true
    }

    milestonesWithStatus.push({
      ...milestone,
      status,
      submission,
      companyEval,
      evaluatorEval,
      finalScore,
      finalScoreLabel: label,
      isFallback,
    })
  }

  // Calculate progress percentage
  const completedCount = milestonesWithStatus.filter(
    (m) => m.status === "completed"
  ).length
  const progressPercentage =
    milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0

  // Find the current milestone (in progress)
  const currentMilestone = milestonesWithStatus.find(
    (m) => m.status === "in_progress"
  )

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {challenge.title}
            </h1>
            <Badge variant="default">In Progress</Badge>
          </div>
          {challenge.organization && (
            <p className="text-muted-foreground">
              by {challenge.organization.name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
         <MessageCompanyButton challengeId={challenge.id} />
          <WithdrawButton
            challengeId={challenge.id}
            challengeTitle={challenge.title}
        />
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">
                {completedCount} of {milestones.length} milestones completed
              </span>
            </div>
            <Progress value={progressPercentage} />
            <p className="text-xs text-muted-foreground text-right">
              {Math.round(progressPercentage)}% complete
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Milestones Feed */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Milestones</h2>

        {milestonesWithStatus.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                No milestones defined for this challenge.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {milestonesWithStatus.map((milestone, index) => (
              <Card
                key={milestone.id}
                className={
                  milestone.status === "locked"
                    ? "opacity-60"
                    : milestone.status === "in_progress"
                    ? "border-primary"
                    : ""
                }
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {index + 1}
                        </span>
                        <CardTitle>{milestone.title}</CardTitle>
                        {milestone.status === "completed" && (
                          <Badge variant="success" className="ml-2">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Completed
                          </Badge>
                        )}
                        {milestone.status === "in_progress" && (
                          <Badge variant="default" className="ml-2">
                            In Progress
                          </Badge>
                        )}
                        {milestone.status === "locked" && (
                          <Badge variant="secondary" className="ml-2">
                            <Lock className="mr-1 h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground pl-10">
                        Due: {formatDate(milestone.due_date)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {milestone.description && (
                    <p className="text-sm">{milestone.description}</p>
                  )}

                  <div className="flex gap-2">
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

                  {/* Show submission form for in_progress milestone */}
                  {milestone.status === "in_progress" && currentMilestone?.id === milestone.id && (
                    <SubmissionForm
                      milestoneId={milestone.id}
                      participantId={participant.id}
                      requiresGithub={milestone.requires_github}
                      requiresUrl={milestone.requires_url}
                      requiresText={milestone.requires_text}
                    />
                  )}

                  {/* Show feedback for completed milestones */}
                  {milestone.status === "completed" && milestone.submission && (
                    <>
                      {(milestone.companyEval || milestone.evaluatorEval) ? (
                        <Card className="bg-muted/50">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Feedback</CardTitle>
                              {milestone.finalScore !== null && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {milestone.finalScoreLabel}
                                    {milestone.isFallback && " ·  interim"}
                                  </span>
                                  <Badge variant="default">
                                    {milestone.finalScore}/100
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Company feedback */}
                            {milestone.companyEval && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {scoringMode === "evaluator_only"
                                    ? "Company Feedback (advisory)"
                                    : "Company Feedback"}
                                </p>
                                {milestone.companyEval.score !== null && scoringMode !== "evaluator_only" && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Score:</span>
                                    <Badge variant="outline" className="text-xs">
                                      {milestone.companyEval.score}/100
                                    </Badge>
                                  </div>
                                )}
                                {milestone.companyEval.feedback && (
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {milestone.companyEval.feedback}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Evaluator feedback */}
                            {milestone.evaluatorEval && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {scoringMode === "company_only"
                                    ? "Expert Feedback (advisory)"
                                    : "Expert Feedback"}
                                </p>
                                {milestone.evaluatorEval.score !== null && scoringMode !== "company_only" && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Score:</span>
                                    <Badge variant="outline" className="text-xs">
                                      {milestone.evaluatorEval.score}/100
                                    </Badge>
                                  </div>
                                )}
                                {milestone.evaluatorEval.feedback && (
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {milestone.evaluatorEval.feedback}
                                  </p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-6">
                            <p className="text-sm text-muted-foreground">
                              Submission received. Waiting for feedback...
                            </p>
                          </CardContent>
                        </Card>
                      )}

                    </>
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