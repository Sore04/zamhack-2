"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { assignEvaluator, removeEvaluator } from "@/app/admin/actions"
import { UserCheck, Trash2, Plus, Clock, AlertCircle } from "lucide-react"

interface Evaluator {
  evaluator_id: string
  review_deadline: string | null
  assigned_at: string | null
  profile: {
    first_name: string | null
    last_name: string | null
    email?: string | null
  } | null
}

interface AvailableEvaluator {
  id: string
  first_name: string | null
  last_name: string | null
}

interface EvaluatorAssignmentPanelProps {
  challengeId: string
  currentAssignments: Evaluator[]
  availableEvaluators: AvailableEvaluator[]
}

export default function EvaluatorAssignmentPanel({
  challengeId,
  currentAssignments,
  availableEvaluators,
}: EvaluatorAssignmentPanelProps) {
  const [assignments, setAssignments] = useState<Evaluator[]>(currentAssignments)
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState("")
  const [reviewDeadline, setReviewDeadline] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignedIds = new Set(assignments.map(a => a.evaluator_id))
  const unassigned = availableEvaluators.filter(e => !assignedIds.has(e.id))

  const handleAssign = async () => {
    if (!selectedEvaluatorId) { setError("Please select an evaluator"); return }
    setIsAssigning(true)
    setError(null)

    const result = await assignEvaluator(
      challengeId,
      selectedEvaluatorId,
      reviewDeadline || null
    )

    setIsAssigning(false)

    if (!result.success) {
      setError(result.error ?? "Failed to assign evaluator")
      return
    }

    // Update local state
    const ev = availableEvaluators.find(e => e.id === selectedEvaluatorId)
    if (ev) {
      setAssignments(prev => [
        ...prev,
        {
          evaluator_id: ev.id,
          review_deadline: reviewDeadline || null,
          assigned_at: new Date().toISOString(),
          profile: { first_name: ev.first_name, last_name: ev.last_name },
        },
      ])
    }

    setSelectedEvaluatorId("")
    setReviewDeadline("")
  }

  const handleRemove = async (evaluatorId: string) => {
    setRemovingId(evaluatorId)
    setError(null)

    const result = await removeEvaluator(challengeId, evaluatorId)
    setRemovingId(null)

    if (!result.success) {
      setError(result.error ?? "Failed to remove evaluator")
      return
    }

    setAssignments(prev => prev.filter(a => a.evaluator_id !== evaluatorId))
  }

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null
    const d = new Date(deadline)
    const now = new Date()
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    return { label, daysLeft, isOverdue: daysLeft < 0, isSoon: daysLeft >= 0 && daysLeft <= 3 }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Evaluator Assignments</CardTitle>
          {assignments.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {assignments.length} assigned
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Assign expert evaluators to review submissions for this challenge.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Current assignments */}
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No evaluators assigned yet.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {assignments.map((a) => {
              const name = a.profile
                ? `${a.profile.first_name || ""} ${a.profile.last_name || ""}`.trim() || "Unknown"
                : "Unknown"
              const deadline = formatDeadline(a.review_deadline)

              return (
                <div key={a.evaluator_id} className="flex items-center justify-between px-3 py-2.5 gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {deadline ? (
                      <p className={`text-xs flex items-center gap-1 ${
                        deadline.isOverdue ? "text-destructive" :
                        deadline.isSoon ? "text-amber-600" :
                        "text-muted-foreground"
                      }`}>
                        <Clock className="h-3 w-3" />
                        {deadline.isOverdue
                          ? `Overdue — ${deadline.label}`
                          : `Due ${deadline.label}`}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No deadline set</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemove(a.evaluator_id)}
                    disabled={removingId === a.evaluator_id}
                  >
                    {removingId === a.evaluator_id ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Assign new evaluator */}
        {unassigned.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Assign Evaluator
            </p>
            <div className="flex gap-2 flex-wrap">
              <select
                className="flex-1 min-w-[160px] h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedEvaluatorId}
                onChange={e => setSelectedEvaluatorId(e.target.value)}
                aria-label="Select evaluator to assign"
                title="Select evaluator to assign"
              >
                <option value="">Select evaluator...</option>
                {unassigned.map(e => (
                  <option key={e.id} value={e.id}>
                    {`${e.first_name || ""} ${e.last_name || ""}`.trim() || e.id}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                className="w-36 h-9 text-sm"
                value={reviewDeadline}
                onChange={e => setReviewDeadline(e.target.value)}
                placeholder="Deadline (optional)"
                title="Review deadline (optional)"
              />
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={isAssigning || !selectedEvaluatorId}
                className="gap-1.5"
              >
                {isAssigning ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Assign
              </Button>
            </div>
          </div>
        )}

        {unassigned.length === 0 && availableEvaluators.length > 0 && assignments.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            All available evaluators are already assigned to this challenge.
          </p>
        )}

        {availableEvaluators.length === 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            No evaluator accounts exist yet. Create one from the Users → Evaluators tab.
          </p>
        )}
      </CardContent>
    </Card>
  )
}