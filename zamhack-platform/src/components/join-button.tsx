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
  difficulty?: string
}

const DIFFICULTY_CONFIRM: Record<string, { title: string; description: string; actionLabel: string }> = {
  intermediate: {
    title: "Intermediate Challenge",
    description:
      "This is an Intermediate challenge, designed for participants with some hands-on experience. It may be more demanding than a Beginner challenge. Are you sure you want to join?",
    actionLabel: "Yes, Join Challenge",
  },
  advanced: {
    title: "Advanced Challenge",
    description:
      "This is an Advanced challenge, intended for experienced participants. It is significantly more difficult and competitive. Are you sure you want to join?",
    actionLabel: "Yes, I'm Ready",
  },
}

export function JoinButton({ challengeId, isFull = false, difficulty = "beginner" }: JoinButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [showDifficultyConfirm, setShowDifficultyConfirm] = useState(false)
  const router = useRouter()

  const difficultyPrompt = DIFFICULTY_CONFIRM[difficulty] ?? null

  const handleButtonClick = () => {
    if (difficultyPrompt) {
      setShowDifficultyConfirm(true)
    } else {
      handleJoin(false)
    }
  }

  const handleJoin = async (force: boolean = false) => {
    setIsLoading(true)
    setOverlapWarning(null) // Reset dialog state if retrying

    try {
      // FIX: Pass undefined for teamId so force becomes the third parameter
      const result = await joinChallenge(challengeId, undefined, force)

      if (result.error === "advanced_limit") {
        const date = new Date(result.nextEligibleAt!).toLocaleDateString()
        toast.error(`Weekly limit reached — you can join another beginner challenge on ${date}`)
        return
      } else if (result.error === "skill_gate") {
        router.push(`/challenges/${challengeId}/skill-gate?tier=${result.requiredTier}&difficulty=${result.difficulty}`)
        return
      } else if (result.error === "xp_rank_gate") {
        router.push(
          `/challenges/${challengeId}/rank-gate?required=${(result as any).requiredRank}&current=${(result as any).currentRank}&difficulty=${difficulty}`
        )
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
        onClick={handleButtonClick}
        disabled={isLoading}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Join Challenge
      </Button>

      {/* Difficulty confirmation — shown before joining intermediate / advanced challenges */}
      {difficultyPrompt && (
        <AlertDialog open={showDifficultyConfirm} onOpenChange={setShowDifficultyConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{difficultyPrompt.title}</AlertDialogTitle>
              <AlertDialogDescription>{difficultyPrompt.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  setShowDifficultyConfirm(false)
                  handleJoin(false)
                }}
                disabled={isLoading}
              >
                {isLoading ? "Joining..." : difficultyPrompt.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Schedule overlap confirmation */}
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
                e.preventDefault()
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