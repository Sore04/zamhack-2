"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { submitMilestone } from "@/app/challenges/submission-actions"
import { AlertCircle } from "lucide-react"

interface SubmissionFormProps {
  milestoneId: string
  participantId: string
  // New props added to match page.tsx usage
  teamId?: string
  isTeamLeader?: boolean
  requiresGithub?: boolean | null
  requiresUrl?: boolean | null
  requiresText?: boolean | null
}

export const SubmissionForm = ({
  milestoneId,
  participantId,
  teamId,
  isTeamLeader = false,
  requiresGithub = false,
  requiresUrl = false,
  requiresText = false,
}: SubmissionFormProps) => {
  const [githubLink, setGithubLink] = useState("")
  const [demoUrl, setDemoUrl] = useState("")
  const [writtenResponse, setWrittenResponse] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const router = useRouter()

  // Determine if the user is allowed to submit
  // Logic: If it's a team (teamId exists), only the leader can submit. 
  // If it's solo (no teamId), anyone can submit.
  const canSubmit = !teamId || isTeamLeader

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canSubmit) {
      setToast({ message: "Only team leaders can submit milestones.", type: "error" })
      return
    }

    setIsSubmitting(true)
    setToast(null)

    try {
      const formData = new FormData()
      formData.append("milestone_id", milestoneId)
      formData.append("participant_id", participantId)
      
      // Optionally append team info if needed by server action
      if (teamId) {
        formData.append("team_id", teamId)
      }

      if (githubLink.trim()) {
        formData.append("github_link", githubLink.trim())
      }
      if (demoUrl.trim()) {
        formData.append("demo_url", demoUrl.trim())
      }
      if (writtenResponse.trim()) {
        formData.append("written_response", writtenResponse.trim())
      }

      const result = await submitMilestone(formData)

      if (result.error) {
        setToast({ message: result.error, type: "error" })
      } else {
        setToast({ message: "Submission received!", type: "success" })
        // Clear form on success
        setGithubLink("")
        setDemoUrl("")
        setWrittenResponse("")
        // Refresh the page to update the UI
        router.refresh()
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasRequiredFields = requiresGithub || requiresUrl || requiresText
  const isFormValid = () => {
    if (requiresGithub && !githubLink.trim()) return false
    if (requiresUrl && !demoUrl.trim()) return false
    if (requiresText && !writtenResponse.trim()) return false
    return true
  }

  if (!hasRequiredFields) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No submission requirements for this milestone.
          </p>
          {/* Still allow submitting to mark as complete if no requirements */}
          <div className="mt-4">
             <Button 
               onClick={handleSubmit} 
               disabled={isSubmitting || !canSubmit}
             >
               {isSubmitting ? "Marking as Complete..." : "Mark as Complete"}
             </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Your Work</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Warning for non-leaders */}
        {!canSubmit && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2 text-yellow-800 text-sm">
            <AlertCircle className="h-4 w-4" />
            Only the team leader can submit milestones.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {requiresGithub && (
            <div className="space-y-2">
              <Label htmlFor="github-link">
                GitHub Link <span className="text-destructive">*</span>
              </Label>
              <Input
                id="github-link"
                type="url"
                placeholder="https://github.com/username/repo"
                value={githubLink}
                onChange={(e) => setGithubLink(e.target.value)}
                required={requiresGithub}
                disabled={isSubmitting || !canSubmit}
              />
            </div>
          )}

          {requiresUrl && (
            <div className="space-y-2">
              <Label htmlFor="demo-url">
                Demo URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="demo-url"
                type="url"
                placeholder="https://your-demo-url.com"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                required={requiresUrl}
                disabled={isSubmitting || !canSubmit}
              />
            </div>
          )}

          {requiresText && (
            <div className="space-y-2">
              <Label htmlFor="written-response">
                Written Response <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="written-response"
                placeholder="Describe your submission, approach, and any relevant details..."
                value={writtenResponse}
                onChange={(e) => setWrittenResponse(e.target.value)}
                required={requiresText}
                rows={6}
                disabled={isSubmitting || !canSubmit}
              />
            </div>
          )}

          <div className="space-y-2">
            <Button 
              type="submit" 
              disabled={isSubmitting || !isFormValid() || !canSubmit}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>

            {toast && (
              <div
                className={`mt-2 p-3 rounded-md text-sm ${
                  toast.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
                role="alert"
              >
                {toast.message}
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}