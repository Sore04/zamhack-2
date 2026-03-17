import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GradingForm } from "@/components/challenges/grading-form"
import { Database } from "@/types/supabase"
import Link from "next/link"
import { ExternalLink, Github, Globe } from "lucide-react"

type Submission = Database["public"]["Tables"]["submissions"]["Row"]
type Milestone = Database["public"]["Tables"]["milestones"]["Row"]
type Challenge = Database["public"]["Tables"]["challenges"]["Row"]
type Participant = Database["public"]["Tables"]["challenge_participants"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"]
type Rubric = Database["public"]["Tables"]["rubrics"]["Row"]
type Score = Database["public"]["Tables"]["scores"]["Row"]

interface SubmissionReviewData {
  submission: Submission
  milestone: Milestone | null
  challenge: Challenge | null
  participant: Participant | null
  profile: Profile | null
  evaluation: Evaluation | null
  rubrics: Rubric[]
  scores: Score[]
}

async function getSubmissionReviewData(
  submissionId: string,
  challengeId: string
): Promise<SubmissionReviewData | null> {
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

  // Fetch challenge and verify ownership
  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .single()

  if (challengeError || !challenge) {
    return null
  }

  // Security check: verify user's organization owns this challenge
  if (challenge.organization_id !== profile.organization_id) {
    redirect("/company/dashboard")
  }

  // Fetch submission
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .single()

  if (submissionError || !submission) {
    return null
  }

  // Verify submission belongs to this challenge
  if (!submission.milestone_id) {
    return null
  }

  // Fetch milestone
  const { data: milestone, error: milestoneError } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", submission.milestone_id)
    .single()

  if (milestoneError || !milestone) {
    return null
  }

  if (milestone.challenge_id !== challengeId) {
    return null
  }

  // Fetch participant
  let participant: Participant | null = null
  let profileData: Profile | null = null

  if (submission.participant_id) {
    const { data: participantData, error: participantError } = await supabase
      .from("challenge_participants")
      .select("*")
      .eq("id", submission.participant_id)
      .single()

    if (!participantError && participantData) {
      participant = participantData

      // Fetch profile if participant has user_id
      if (participant.user_id) {
        const { data: profileResult, error: profileFetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", participant.user_id)
          .single()

        if (!profileFetchError && profileResult) {
          profileData = profileResult
        }
      }
    }
  }

  // Fetch milestone-scoped rubrics; fall back to challenge-level (milestone_id IS NULL)
  const { data: milestoneRubrics } = await (supabase
    .from("rubrics")
    .select("*")
    .eq("challenge_id", challengeId) as any)
    .eq("milestone_id", submission.milestone_id)
    .order("created_at")

  let rubrics = (milestoneRubrics as any[]) ?? []
  if (rubrics.length === 0) {
    const { data: fallbackRubrics } = await (supabase
      .from("rubrics")
      .select("*")
      .eq("challenge_id", challengeId) as any)
      .is("milestone_id", null)
      .order("created_at")
    rubrics = (fallbackRubrics as any[]) ?? []
  }

  // Fetch the company reviewer's own evaluation only (not the auto-eval draft with reviewer_id=null)
  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("*")
    .eq("submission_id", submissionId)
    .eq("reviewer_id", user.id)
    .maybeSingle()

  // Only fetch scores if the company reviewer has their own evaluation already.
  // Auto-eval writes scores too, but we don't want those pre-filling the company form.
  let scores: any[] = []
  if (evaluation) {
    const { data: existingScores } = await supabase
      .from("scores")
      .select("*")
      .eq("submission_id", submissionId)
    scores = existingScores || []
  }

  return {
    submission,
    milestone,
    challenge,
    participant,
    profile: profileData,
    evaluation: evaluation || null,
    rubrics: rubrics || [],
    scores,
  }
}

const getInitials = (firstName: string | null, lastName: string | null): string => {
  const first = firstName?.charAt(0).toUpperCase() || ""
  const last = lastName?.charAt(0).toUpperCase() || ""
  return first + last || "U"
}

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>
}) {
  const { id: challengeId, submissionId } = await params
  const data = await getSubmissionReviewData(submissionId, challengeId)

  if (!data) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Submission not found</p>
            <Link href={`/company/challenges/${challengeId}`}>
              <Button variant="outline" className="mt-4">
                Back to Challenge
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { submission, milestone, profile, evaluation, rubrics, scores } = data

  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown Student"
    : "Unknown Student"

  const initials = getInitials(profile?.first_name || null, profile?.last_name || null)

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <Link href={`/company/challenges/${challengeId}`}>
          <Button variant="ghost" className="mb-4">
            ← Back to Challenge
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Submission Review</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: The Work */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary overflow-hidden shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <CardTitle>{fullName}</CardTitle>
                  {profile?.university && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {profile.university}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {milestone && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Milestone
                    </h3>
                    <Badge variant="secondary">{milestone.title}</Badge>
                  </div>
                )}

                {/* Submission Content */}
                <div className="space-y-4">
                  {submission.github_link && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Github className="h-4 w-4" />
                          <CardTitle className="text-base">GitHub Repository</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <a
                          href={submission.github_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-2"
                        >
                          {submission.github_link}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </CardContent>
                    </Card>
                  )}

                  {submission.demo_url && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <CardTitle className="text-base">Demo Website</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <a
                          href={submission.demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-2"
                        >
                          {submission.demo_url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </CardContent>
                    </Card>
                  )}

                  {submission.written_response && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Written Response</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap text-sm">
                            {submission.written_response}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!submission.github_link &&
                    !submission.demo_url &&
                    !submission.written_response && (
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-muted-foreground text-sm">
                            No submission content available.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: The Grade */}
        <div>
          <GradingForm
            submissionId={submissionId}
            initialEvaluation={evaluation}
            rubrics={rubrics}
            existingScores={scores}
          />
        </div>
      </div>
    </div>
  )
}