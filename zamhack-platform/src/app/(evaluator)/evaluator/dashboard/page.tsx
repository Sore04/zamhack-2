import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ClipboardList, Clock, CheckCircle2, AlertCircle } from "lucide-react"

export default async function EvaluatorDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "evaluator") redirect("/login")

  // Assigned challenges
  const { data: assignments } = await supabase
    .from("challenge_evaluators")
    .select("challenge_id, review_deadline, challenges(id, title, status)")
    .eq("evaluator_id", user.id)

  const assignmentList = assignments || []
  const challengeIds = assignmentList.map(a => a.challenge_id)

  // All participants across assigned challenges
  let pendingCount = 0
  let completedCount = 0

  if (challengeIds.length > 0) {
    const { data: participants } = await supabase
      .from("challenge_participants")
      .select("id")
      .in("challenge_id", challengeIds)

    const participantIds = (participants || []).map(p => p.id)

    if (participantIds.length > 0) {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("id")
        .in("participant_id", participantIds)

      const submissionIds = (submissions || []).map(s => s.id)

      if (submissionIds.length > 0) {
        const { data: myEvals } = await supabase
          .from("evaluations")
          .select("submission_id")
          .in("submission_id", submissionIds)
          .eq("reviewer_id", user.id)
          .eq("is_draft", false)

        completedCount = (myEvals || []).length
        pendingCount = submissionIds.length - completedCount
      }
    }
  }

  const firstName = profile.first_name || "Evaluator"
  const now = new Date()

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">
          Welcome back, <span>{firstName}</span>
        </h1>
        <p className="page-subtitle">Here's your evaluation overview.</p>
      </div>

      {/* Stats */}
      <div className="ev-stats-grid">
        <div className="ev-stat-card">
          <p className="ev-stat-label">Assigned Challenges</p>
          <p className="ev-stat-value indigo">{assignmentList.length}</p>
        </div>
        <div className="ev-stat-card">
          <p className="ev-stat-label">Pending Reviews</p>
          <p className="ev-stat-value amber">{pendingCount}</p>
        </div>
        <div className="ev-stat-card">
          <p className="ev-stat-label">Completed Reviews</p>
          <p className="ev-stat-value green">{completedCount}</p>
        </div>
      </div>

      {/* Empty state */}
      {assignmentList.length === 0 && (
        <div className="ev-empty">
          <div className="ev-empty-icon">
            <ClipboardList size={24} />
          </div>
          <p className="ev-empty-title">No assignments yet</p>
          <p className="ev-empty-text">
            You haven't been assigned to any challenges yet. Your admin will
            notify you once you've been assigned. In the meantime, feel free to
            update your account settings.
          </p>
        </div>
      )}

      {/* Assigned challenges list */}
      {assignmentList.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-700">Your Assignments</h2>
          <div className="space-y-3">
            {assignmentList.map((a) => {
              const challenge = a.challenges as any
              const deadline = a.review_deadline ? new Date(a.review_deadline) : null
              const daysLeft = deadline
                ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null
              const isOverdue = daysLeft !== null && daysLeft < 0
              const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3

              return (
                <Link
                  key={a.challenge_id}
                  href={`/evaluator/assignments/${a.challenge_id}`}
                  className="ev-challenge-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800 text-sm">
                        {challenge?.title || "Untitled Challenge"}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {challenge?.status?.replace("_", " ") || "Unknown status"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {deadline && (
                        <span className={`ev-deadline-badge ${isOverdue ? "overdue" : isSoon ? "soon" : ""}`}>
                          <Clock size={11} />
                          {isOverdue
                            ? `Overdue by ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) !== 1 ? "s" : ""}`
                            : daysLeft === 0
                            ? "Due today"
                            : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                          <AlertCircle size={11} />
                          {pendingCount} pending
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}