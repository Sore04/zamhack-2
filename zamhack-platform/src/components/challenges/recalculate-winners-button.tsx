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
import { recalculateWinners } from "@/app/challenges/actions"
import { toast } from "sonner"
import { RefreshCw, Loader2 } from "lucide-react"

export function RecalculateWinnersButton({ challengeId }: { challengeId: string }) {
  const [loading, setLoading] = useState(false)

  const handleRecalculate = async () => {
    setLoading(true)
    const result = await recalculateWinners(challengeId)
    if (result.success) {
      toast.success("Winners recalculated successfully!")
      window.location.reload()
    } else {
      toast.error(result.error || "Failed to recalculate winners")
    }
    setLoading(false)
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={loading}>
          {loading
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />
          }
          Recalculate Winners
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recalculate Winners?</AlertDialogTitle>
          <AlertDialogDescription>
            This will re-score all participants based on their current evaluations
            and update the winners board. Use this if scores appear as 0 or are
            incorrect on the results page.
            <br /><br />
            The challenge will remain closed — only the winner scores and rankings
            will be updated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRecalculate}>
            Yes, Recalculate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}