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

  const handleClose = async () => {
    setLoading(true)
    const result = await closeChallenge(challengeId)
    if (result.success) {
      toast.success("Challenge closed and winners announced!")
      window.location.reload() // Reload to update UI state
    } else {
      toast.error(result.error || "Failed to close challenge")
    }
    setLoading(false)
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full" disabled={disabled || loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
          Close Challenge & Announce Winners
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will officially close the challenge. The system will automatically calculate the top scorers based on your evaluations and publish the results to the Student Dashboard. 
            <br /><br />
            <strong>This action cannot be undone.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClose} className="bg-destructive hover:bg-destructive/90">
            Yes, Close Challenge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}