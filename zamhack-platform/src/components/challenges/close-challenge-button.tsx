"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { closeChallenge } from "@/app/challenges/actions"
import { toast } from "sonner"
import { Lock, Loader2 } from "lucide-react"

export function CloseChallengeButton({ challengeId, disabled }: { challengeId: string, disabled?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"confirm" | "warning">("confirm")
  const [missingList, setMissingList] = useState<Array<{
    evaluatorId: string
    evaluatorName: string
    participantId: string
    participantName: string
  }>>([])

  const handleClose = async () => {
    setLoading(true)
    try {
      const result = await closeChallenge(challengeId)
      if (result.success) {
        toast.success("Challenge closed and winners announced!")
        window.location.reload()
      } else if (result.requiresConfirmation) {
        // Switch to warning view — show incomplete evaluations
        setMissingList(result.missing ?? [])
        setStep("warning")
      } else {
        toast.error(result.error ?? "Failed to close challenge")
      }
    } catch (e) {
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleForceClose = async () => {
    setLoading(true)
    try {
      const result = await closeChallenge(challengeId, true)
      if (result.success) {
        toast.success("Challenge closed and winners announced!")
        window.location.reload()
      } else {
        toast.error(result.error ?? "Failed to close challenge")
      }
    } catch (e) {
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog onOpenChange={(open) => { if (!open) setStep("confirm") }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={disabled || loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
          Close Challenge
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === "confirm" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will officially close the challenge. The system will
                automatically calculate the top scorers based on your evaluations
                and publish the results to the Student Dashboard.
                <br /><br />
                <strong>This action cannot be undone.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClose}
                className="bg-destructive hover:bg-destructive/90"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Yes, Close Challenge
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <span className="text-yellow-600">⚠</span>
                Some evaluations are incomplete
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>The following evaluations have not been submitted yet:</p>
                  <ul className="max-h-48 overflow-y-auto rounded-md border bg-muted/50 p-3 space-y-1">
                    {missingList.map((m, i) => (
                      <li key={i} className="text-sm text-foreground">
                        <span className="font-medium">{m.evaluatorName}</span>
                        {" has not scored "}
                        <span className="font-medium">{m.participantName}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm">
                    Do you want to close the challenge anyway?
                    Unscored participants will be excluded from ranking.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStep("confirm")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleForceClose}
                className="bg-destructive hover:bg-destructive/90"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Close Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
