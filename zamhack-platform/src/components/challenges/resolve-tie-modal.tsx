"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { resolveTie } from "@/app/challenges/actions"

interface ResolveTieModalProps {
  challengeId: string
  tiedWinners: Array<{
    profileId: string
    firstName: string | null
    lastName: string | null
    currentRank: number
    evaluatorScores: Array<{
      evaluatorName: string
      score: number
      feedback: string | null
    }>
    normalizedScoreAvg: number
    companyScore: number | null
  }>
  onResolved: () => void
  trigger: React.ReactNode
}

const getParticipantName = (
  firstName: string | null,
  lastName: string | null
): string => {
  const name = [firstName, lastName].filter(Boolean).join(" ")
  return name || "Unknown"
}

export const ResolveTieModal = ({
  challengeId,
  tiedWinners,
  onResolved,
  trigger,
}: ResolveTieModalProps) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const baseRank = tiedWinners[0]?.currentRank ?? 1
  const rankOptions = Array.from(
    { length: tiedWinners.length },
    (_, i) => baseRank + i
  )

  const initialAssignments = Object.fromEntries(
    tiedWinners.map((w) => [w.profileId, w.currentRank])
  )
  const [rankAssignments, setRankAssignments] =
    useState<Record<string, number>>(initialAssignments)

  const assignedRanks = Object.values(rankAssignments)
  const hasDuplicates =
    new Set(assignedRanks).size < assignedRanks.length

  const handleConfirm = async () => {
    setLoading(true)
    const resolutions = Object.entries(rankAssignments).map(
      ([profileId, newRank]) => ({ profileId, newRank })
    )
    const result = await resolveTie({ challengeId, resolutions })
    setLoading(false)

    if (result.success) {
      toast.success("Tie resolved!")
      setOpen(false)
      onResolved()
    } else {
      toast.error(result.error ?? "Failed to resolve tie")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Resolve Tie — Rank {tiedWinners[0]?.currentRank}
          </DialogTitle>
          <DialogDescription>
            Review each participant&apos;s scores, then assign their final
            ranks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {tiedWinners.map((winner) => (
            <Card key={winner.profileId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {getParticipantName(winner.firstName, winner.lastName)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {/* Evaluator Scores */}
                <div>
                  <p className="font-medium mb-1">Evaluator Scores</p>
                  {winner.evaluatorScores.length === 0 ? (
                    <p className="text-muted-foreground">No evaluator scores</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {winner.evaluatorScores.map((es, idx) => (
                        <div key={idx}>
                          <p>
                            <span className="font-medium">{es.evaluatorName}</span>
                            {" — "}
                            <span>{es.score}/100</span>
                          </p>
                          {es.feedback && (
                            <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground italic">
                              {es.feedback}
                            </blockquote>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Normalized Score */}
                <div>
                  <p className="font-medium mb-1">Normalized Score</p>
                  <p>{(winner.normalizedScoreAvg * 100).toFixed(1)}%</p>
                </div>

                {/* Company Score */}
                <div>
                  <p className="font-medium mb-1">Company Score</p>
                  <p>
                    {winner.companyScore !== null
                      ? `${winner.companyScore}/100`
                      : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Rank Assignment */}
          <div className="flex flex-col gap-3 pt-2">
            <p className="font-medium text-sm">Assign Final Ranks</p>
            {tiedWinners.map((winner) => (
              <div
                key={winner.profileId}
                className="flex items-center gap-3 text-sm"
              >
                <span className="flex-1 truncate">
                  {getParticipantName(winner.firstName, winner.lastName)}
                </span>
                <span className="text-muted-foreground shrink-0">→ Rank:</span>
                <Select
                  value={String(rankAssignments[winner.profileId])}
                  onValueChange={(val) =>
                    setRankAssignments((prev) => ({
                      ...prev,
                      [winner.profileId]: Number(val),
                    }))
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rankOptions.map((rank) => (
                      <SelectItem key={rank} value={String(rank)}>
                        {rank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {hasDuplicates && (
              <p className="text-sm text-destructive">
                Each participant must receive a unique rank
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={hasDuplicates || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Resolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
