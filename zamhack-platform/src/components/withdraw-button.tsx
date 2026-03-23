"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
} 
from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { withdrawFromChallenge } from "@/app/(student)/my-challenges/actions"
import { LogOut, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface WithdrawButtonProps {
  challengeId: string
  challengeTitle: string
}

export function WithdrawButton({ challengeId, challengeTitle }: WithdrawButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleWithdraw = async () => {
    setIsLoading(true)
    const result = await withdrawFromChallenge(challengeId)
    if (result?.error) {
      toast.error(result.error)
      setIsLoading(false)
    }
    // On success the server action redirects — no need to handle here
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Withdraw
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw from challenge?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to withdraw from{" "}
            <span className="font-semibold text-foreground">{challengeTitle}</span>.
            <br /><br />
            Your progress and any submissions will be lost and you will be
            removed from the participant list. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleWithdraw}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Withdrawing…
              </>
            ) : (
              "Yes, withdraw"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}