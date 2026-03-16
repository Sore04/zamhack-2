import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Clock, ClipboardList, ChevronRight } from "lucide-react"

export default async function EvaluatorAssignmentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "evaluator") redirect("/login")

  // Fetch assignments with challenge details
  const { data: assignments } = await supabase
    .from("challenge_evaluators")
    .select("challenge_id, review_deadline, assigned_at, challenges(id, title, status, description)")
    .eq("evaluator_id", user.id)
    .order("assigned_at", { ascending: false })

  const assignmentList = assignments || []
  const challengeIds = assignmentList.map(a => a.challenge_id)

  // Build pending count per challenge
  const pendingMap = new Map<string, number>()
  const completedMap = new Map<string, number>()

  if (challengeIds.length > 0) {
    for (const challengeId of challengeIds) {
      const { data: participants } = await supabase
        .from("challenge_participants")
        .select("id")
        .eq("challenge_id", challengeId)

      const participantIds = (participants || []).map(p => p.id)
      if (!participantIds.length) {
        pendingMap.set(challengeId, 0)
        completedMap.set(challengeId, 0)
        continue
      }

      const { data: submissions } = await supabase
        .from("submissions")
        .select("id")
        .in("participant_id", participantIds)

      const submissionIds = (submissions || []).map(s => s.id)
      if (!submissionIds.length) {
        pendingMap.set(challengeId, 0)
        completedMap.set(challengeId, 0)
        continue
      }

      const { data: myEvals } = await supabase
        .from("evaluations")
        .select("submission_id")
        .in("submission_id", submissionIds)
        .eq("reviewer_id", user.id)
        .eq("is_draft", false)

      const done = (myEvals || []).length
      completedMap.set(challengeId, done)
      pendingMap.set(challengeId, submissionIds.length - done)
    }
  }

  const now = new Date()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">My <span>Assignments</span></h1>
        <p className="page-subtitle">Challenges you've been assigned to evaluate.</p>
      </div>

      {assignmentList.length === 0 ? (
        <div className="ev-empty">
          <div className="ev-empty-icon">
            <ClipboardList size={24} />
          </div>
          <p className="ev-empty-title">No assignments yet</p>
          <p className="ev-empty-text">
            Once an admin assigns you to a challenge, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignmentList.map((a) => {
            const challenge = a.challenges as any
            const deadline = a.review_deadline ? new Date(a.review_deadline) : null
            const daysLeft = deadline
              ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null
            const isOverdue = daysLeft !== null && daysLeft < 0
            const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
            const pending = pendingMap.get(a.challenge_id) ?? 0
            const completed = completedMap.get(a.challenge_id) ?? 0
            const total = pending + completed

            return (
              <Link
                key={a.challenge_id}
                href={`/evaluator/assignments/${a.challenge_id}`}
                className="ev-challenge-card flex items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 text-sm truncate">
                      {challenge?.title || "Untitled Challenge"}
                    </p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize shrink-0">
                      {challenge?.status?.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{completed}/{total} reviewed</span>
                    {deadline && (
                      <span className={`ev-deadline-badge ${isOverdue ? "overdue" : isSoon ? "soon" : ""}`}>
                        <Clock size={10} />
                        {isOverdue
                          ? `Overdue by ${Math.abs(daysLeft!)}d`
                          : daysLeft === 0 ? "Due today"
                          : `${daysLeft}d left`}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}