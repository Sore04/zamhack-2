import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { History, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default async function EvaluatorHistoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "evaluator") redirect("/login")

  // All completed (non-draft) evaluations by this evaluator
  const { data: evaluations } = await supabase
    .from("evaluations")
    .select("id, score, feedback, updated_at, submission_id")
    .eq("reviewer_id", user.id)
    .eq("is_draft", false)
    .order("updated_at", { ascending: false })

  const evalList = evaluations || []
  const submissionIds = evalList.map(e => e.submission_id).filter(Boolean) as string[]

  // Fetch submission + milestone + participant details
  const submissionDetailsMap = new Map<string, any>()
  if (submissionIds.length > 0) {
    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, participant_id, milestone_id, milestones(title, challenges(id, title))")
      .in("id", submissionIds)

    const participantIds = (submissions || [])
      .map(s => s.participant_id)
      .filter(Boolean) as string[]

    const participantProfileMap = new Map<string, any>()
    if (participantIds.length > 0) {
      const { data: participants } = await supabase
        .from("challenge_participants")
        .select("id, profiles(first_name, last_name)")
        .in("id", participantIds)

      for (const p of participants || []) {
        participantProfileMap.set(p.id, p.profiles)
      }
    }

    for (const sub of submissions || []) {
      submissionDetailsMap.set(sub.id, {
        ...sub,
        participantProfile: sub.participant_id
          ? participantProfileMap.get(sub.participant_id) || null
          : null,
      })
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return "N/A"
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Review <span>History</span></h1>
        <p className="page-subtitle">All evaluations you've submitted.</p>
      </div>

      {evalList.length === 0 ? (
        <div className="ev-empty">
          <div className="ev-empty-icon">
            <History size={24} />
          </div>
          <p className="ev-empty-title">No reviews yet</p>
          <p className="ev-empty-text">
            Your completed reviews will appear here once you start evaluating submissions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {evalList.map((ev) => {
            const sub = ev.submission_id ? submissionDetailsMap.get(ev.submission_id) : null
            const milestone = (sub as any)?.milestones
            const challenge = (milestone as any)?.challenges
            const pProfile = (sub as any)?.participantProfile
            const studentName = pProfile
              ? `${pProfile.first_name || ""} ${pProfile.last_name || ""}`.trim() || "Unknown"
              : "Unknown"

            return (
              <div
                key={ev.id}
                className="ev-challenge-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {studentName}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      {challenge?.title && (
                        <span className="truncate">{challenge.title}</span>
                      )}
                      {milestone?.title && (
                        <>
                          <span>·</span>
                          <span>{milestone.title}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>Reviewed {formatDate(ev.updated_at)}</span>
                    </div>
                    {ev.feedback && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        "{ev.feedback.slice(0, 120)}{ev.feedback.length > 120 ? "…" : ""}"
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {ev.score}/100
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}