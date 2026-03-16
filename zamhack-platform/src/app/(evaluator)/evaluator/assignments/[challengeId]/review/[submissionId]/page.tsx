import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Github, Globe, FileText, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GradingForm } from "@/components/challenges/grading-form"

export default async function EvaluatorReviewPage({
  params,
}: {
  params: Promise<{ challengeId: string; submissionId: string }>
}) {
  const { challengeId, submissionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "evaluator") redirect("/login")

  // Verify evaluator is assigned to this challenge
  const { data: assignment } = await supabase
    .from("challenge_evaluators")
    .select("review_deadline")
    .eq("challenge_id", challengeId)
    .eq("evaluator_id", user.id)
    .maybeSingle()

  if (!assignment) redirect("/evaluator/assignments")

  // Fetch submission
  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .single()

  if (!submission) redirect(`/evaluator/assignments/${challengeId}`)

  // Fetch milestone + challenge
  const { data: milestone } = submission.milestone_id
    ? await supabase.from("milestones").select("*, challenges(id, title, scoring_mode)").eq("id", submission.milestone_id).single()
    : { data: null }

  // Fetch participant + profile
  const { data: participant } = submission.participant_id
    ? await supabase
        .from("challenge_participants")
        .select("id, user_id, profiles(first_name, last_name, university, degree, avatar_url)")
        .eq("id", submission.participant_id)
        .single()
    : { data: null }

  // Fetch rubrics
  const { data: rubrics } = await supabase
    .from("rubrics")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true })

  // Fetch my existing evaluation (evaluator)
  const { data: myEvaluation } = await supabase
    .from("evaluations")
    .select("*")
    .eq("submission_id", submissionId)
    .eq("reviewer_id", user.id)
    .maybeSingle()

  // Fetch my existing scores
  const { data: myScores } = await supabase
    .from("scores" as any)
    .select("*")
    .eq("submission_id", submissionId)

  // Fetch company evaluation (cross-visibility — read only)
  // We need to find evaluations by company_admin or company_member roles
  const { data: allEvals } = await supabase
    .from("evaluations")
    .select("*, profiles(role, first_name, last_name)")
    .eq("submission_id", submissionId)
    .eq("is_draft", false)
    .neq("reviewer_id", user.id)

  const companyEval = (allEvals || []).find(
    e => (e.profiles as any)?.role === "company_admin" || (e.profiles as any)?.role === "company_member"
  ) || null

  const challenge = (milestone as any)?.challenges
  const participantProfile = (participant as any)?.profiles

  const fullName = participantProfile
    ? `${participantProfile.first_name || ""} ${participantProfile.last_name || ""}`.trim() || "Unknown Student"
    : "Unknown Student"

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        href={`/evaluator/assignments/${challengeId}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft size={16} /> Back to {challenge?.title || "Challenge"}
      </Link>

      <div>
        <h1 className="page-title">Review <span>Submission</span></h1>
        <p className="page-subtitle">{challenge?.title} · {(milestone as any)?.title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: The Work ── */}
        <div className="space-y-4">
          {/* Student info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                  {participantProfile?.avatar_url ? (
                    <img src={participantProfile.avatar_url} alt={fullName} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    getInitials(fullName)
                  )}
                </div>
                <div>
                  <CardTitle className="text-base">{fullName}</CardTitle>
                  {participantProfile?.university && (
                    <p className="text-xs text-slate-400 mt-0.5">{participantProfile.university}</p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Submission content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submitted Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {submission.github_link && (
                <a
                  href={submission.github_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                >
                  <Github size={15} /> {submission.github_link}
                </a>
              )}
              {submission.demo_url && (
                <a
                  href={submission.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                >
                  <Globe size={15} /> {submission.demo_url}
                </a>
              )}
              {submission.written_response && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <FileText size={12} /> Written Response
                  </p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {submission.written_response}
                  </p>
                </div>
              )}
              {!submission.github_link && !submission.demo_url && !submission.written_response && (
                <p className="text-sm text-slate-400">No submission content available.</p>
              )}
            </CardContent>
          </Card>

          {/* Company feedback — cross-visibility, read only */}
          {companyEval && (
            <div className="ev-prior-feedback">
              <p className="ev-prior-feedback-label">
                <Eye size={12} /> Company Feedback (read-only)
              </p>
              <div className="space-y-2">
                {companyEval.score !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Score:</span>
                    <Badge variant="outline" className="text-xs">{companyEval.score}/100</Badge>
                  </div>
                )}
                {companyEval.feedback && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {companyEval.feedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Scoring form ── */}
        <div className="space-y-4">
          <GradingForm
            submissionId={submissionId}
            rubrics={rubrics || []}
            existingScores={(myScores as any) || []}
            initialEvaluation={myEvaluation || null}
          />
        </div>
      </div>
    </div>
  )
}