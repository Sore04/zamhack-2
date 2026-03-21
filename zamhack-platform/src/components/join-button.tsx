"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { joinChallenge } from "@/app/challenges/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface JoinButtonProps {
  challengeId: string
  isFull?: boolean // This is the prop that was missing
}

export function JoinButton({ challengeId, isFull = false }: JoinButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const router = useRouter()

  const handleJoin = async (force: boolean = false) => {
    setIsLoading(true)
    setOverlapWarning(null) // Reset dialog state if retrying

    try {
      // FIX: Pass undefined for teamId so force becomes the third parameter
      const result = await joinChallenge(challengeId, undefined, force)

      if (result.error === "advanced_limit") {
        const date = new Date(result.nextEligibleAt).toLocaleDateString()
        toast.error(`Weekly limit reached — you can join another beginner challenge on ${date}`)
        return
      } else if (result.error === "skill_gate") {
        router.push(`/challenges/${challengeId}/skill-gate?tier=${result.requiredTier}&difficulty=${result.difficulty}`)
        return
      } else if (result.error) {
        toast.error(result.error)
      } else if (result.status === "overlap_warning") {
        // Trigger the dialog
        setOverlapWarning(result.message || "Schedule overlap detected.")
      } else if (result.success) {
        toast.success("Successfully joined the challenge!")
        router.refresh()
        router.push("/my-challenges") // Redirect to My Challenges
      }
    } catch (error) {
      toast.error("Something went wrong.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button 
        size="lg" 
        className={isFull ? "w-full" : ""} 
        onClick={() => handleJoin(false)} 
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Join Challenge
      </Button>

      <AlertDialog open={!!overlapWarning} onOpenChange={(open) => !open && setOverlapWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Conflict Detected</AlertDialogTitle>
            <AlertDialogDescription>
              {overlapWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault() // Prevent auto-close to show loading state
                handleJoin(true)
              }}
              disabled={isLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isLoading ? "Joining..." : "Yes, Join Anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}