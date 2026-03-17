import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function EvaluatorAssignmentDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>
}) {
  const { challengeId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "evaluator") redirect("/login")

  // Verify assignment
  const { data: assignment } = await supabase
    .from("challenge_evaluators")
    .select("review_deadline")
    .eq("challenge_id", challengeId)
    .eq("evaluator_id", user.id)
    .maybeSingle()

  if (!assignment) redirect("/evaluator/assignments")

  // Fetch challenge
  const { data: challenge } = await supabase
    .from("challenges")
    .select("*, organizations(name)")
    .eq("id", challengeId)
    .single()

  if (!challenge) redirect("/evaluator/assignments")

  // Fetch milestones
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("sequence_order", { ascending: true })

  // Fetch participants + profiles
  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("id, user_id, profiles(first_name, last_name)")
    .eq("challenge_id", challengeId)

  const participantIds = (participants || []).map(p => p.id)

  // Fetch submissions
  const { data: submissions } = participantIds.length
    ? await supabase
        .from("submissions")
        .select("id, participant_id, milestone_id, submitted_at, milestones(title)")
        .in("participant_id", participantIds)
        .order("submitted_at", { ascending: false })
    : { data: [] }

  const submissionList = submissions || []
  const submissionIds = submissionList.map(s => s.id)

  // My evaluations
  const { data: myEvals } = submissionIds.length
    ? await supabase
        .from("evaluations")
        .select("submission_id, score, is_draft")
        .in("submission_id", submissionIds)
        .eq("reviewer_id", user.id)
        .eq("is_draft", false)
    : { data: [] }

  const myEvalMap = new Map((myEvals || []).map(e => [e.submission_id, e]))

  // Participant map
  const participantMap = new Map(
    (participants || []).map(p => [p.id, p])
  )

  const milestoneMap = new Map((milestones || []).map(m => [m.id, m]))

  const now = new Date()
  const deadline = assignment.review_deadline ? new Date(assignment.review_deadline) : null
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3

  const formatDate = (d: string | null) => {
    if (!d) return "N/A"
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const getParticipantName = (participantId: string | null) => {
    if (!participantId) return "Unknown"
    const p = participantMap.get(participantId) as any
    if (!p?.profiles) return "Unknown"
    return `${p.profiles.first_name || ""} ${p.profiles.last_name || ""}`.trim() || "Unknown"
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link
        href="/evaluator/assignments"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft size={16} /> Back to Assignments
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="page-title">{challenge.title}</h1>
            <Badge variant="outline" className="capitalize text-xs">
              {challenge.status?.replace("_", " ")}
            </Badge>
          </div>
          {(challenge as any).organizations && (
            <p className="page-subtitle">by {(challenge as any).organizations.name}</p>
          )}
        </div>
        {deadline && (
          <span className={`ev-deadline-badge ${isOverdue ? "overdue" : isSoon ? "soon" : ""}`}>
            <Clock size={12} />
            {isOverdue
              ? `Review deadline passed`
              : daysLeft === 0 ? "Due today"
              : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} to review`}
          </span>
        )}
      </div>

      {/* Challenge overview — read only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Challenge Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          {challenge.description && <p>{challenge.description}</p>}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Start</span>
              <p className="mt-0.5">{formatDate(challenge.start_date)}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">End</span>
              <p className="mt-0.5">{formatDate(challenge.end_date)}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Participants</span>
              <p className="mt-0.5">{participantIds.length}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Milestones</span>
              <p className="mt-0.5">{(milestones || []).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions list */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-700">
          Submissions ({submissionList.length})
        </h2>

        {submissionList.length === 0 ? (
          <div className="ev-empty">
            <div className="ev-empty-icon"><AlertCircle size={22} /></div>
            <p className="ev-empty-title">No submissions yet</p>
            <p className="ev-empty-text">Students haven't submitted anything for this challenge yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {submissionList.map((sub) => {
              const myEval = myEvalMap.get(sub.id)
              const reviewed = !!myEval
              const milestone = sub.milestone_id ? milestoneMap.get(sub.milestone_id) : null

              return (
                <Link
                  key={sub.id}
                  href={`/evaluator/assignments/${challengeId}/review/${sub.id}`}
                  className="ev-challenge-card flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {getParticipantName(sub.participant_id)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{(milestone as any)?.title || "Unknown milestone"}</span>
                      <span>Submitted {formatDate(sub.submitted_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {reviewed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 size={13} /> Reviewed ({myEval.score}/100)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <AlertCircle size={13} /> Pending
                      </span>
                    )}
                    <ChevronRight size={15} className="text-slate-300" />
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