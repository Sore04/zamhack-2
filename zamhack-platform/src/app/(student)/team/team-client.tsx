"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createTeam, joinTeam, leaveTeam, deleteTeam } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Copy, LogOut, Trash2, Users, AlertCircle, CheckCircle2 } from "lucide-react"
import { Database } from "@/types/supabase"

type Team = Database["public"]["Tables"]["teams"]["Row"]
type TeamMember = Database["public"]["Tables"]["team_members"]["Row"]
type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface TeamMemberWithProfile extends TeamMember {
  profile: Profile | null
}

interface TeamData {
  team: Team
  members: TeamMemberWithProfile[]
  isLeader: boolean
}

interface TeamPageClientProps {
  initialData: TeamData | null
}

const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(50, "Team name is too long"),
})

const joinTeamSchema = z.object({
  code: z.string().length(6, "Join code must be 6 characters").toUpperCase(),
})

type CreateTeamFormValues = z.infer<typeof createTeamSchema>
type JoinTeamFormValues = z.infer<typeof joinTeamSchema>

// Helper to get user initials
const getInitials = (profile: Profile | null): string => {
  if (!profile) return "?"
  const firstName = profile.first_name || ""
  const lastName = profile.last_name || ""
  const firstInitial = firstName.charAt(0).toUpperCase()
  const lastInitial = lastName.charAt(0).toUpperCase()
  return firstInitial && lastInitial ? `${firstInitial}${lastInitial}` : firstInitial || "?"
}

// Helper to get full name
const getFullName = (profile: Profile | null): string => {
  if (!profile) return "Unknown"
  const firstName = profile.first_name || ""
  const lastName = profile.last_name || ""
  return `${firstName} ${lastName}`.trim() || "Unknown"
}

export const TeamPageClient = ({ initialData }: TeamPageClientProps) => {
  const [teamData, setTeamData] = useState<TeamData | null>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const createTeamForm = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
  })

  const joinTeamForm = useForm<JoinTeamFormValues>({
    resolver: zodResolver(joinTeamSchema),
  })

  const handleCreateTeam = async (data: CreateTeamFormValues) => {
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const result = await createTeam(data.name)
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess("Team created successfully!")
        // Refresh the page to show the new team
        window.location.reload()
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinTeam = async (data: JoinTeamFormValues) => {
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const result = await joinTeam(data.code)
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess("Successfully joined the team!")
        // Refresh the page to show the team
        window.location.reload()
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!confirm("Are you sure you want to leave this team?")) {
      return
    }

    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const result = await leaveTeam()
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess("You have left the team")
        setTeamData(null)
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      return
    }

    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const result = await deleteTeam()
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess("Team deleted successfully")
        setTeamData(null)
      }
    } catch (err) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyCode = () => {
    if (!teamData?.team.join_code) return
    navigator.clipboard.writeText(teamData.team.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // No Team State
  if (!teamData) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My Team</h1>
          <p className="text-muted-foreground mt-2">Create or join a team to collaborate on challenges</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Team Card */}
          <Card>
            <CardHeader>
              <CardTitle>Create Team</CardTitle>
              <CardDescription>Start a new team and invite others to join</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createTeamForm.handleSubmit(handleCreateTeam)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    placeholder="Enter team name"
                    {...createTeamForm.register("name")}
                    disabled={isSubmitting}
                  />
                  {createTeamForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {createTeamForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Creating..." : "Create Team"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Join Team Card */}
          <Card>
            <CardHeader>
              <CardTitle>Join Team</CardTitle>
              <CardDescription>Enter a join code to join an existing team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={joinTeamForm.handleSubmit(handleJoinTeam)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode">Join Code</Label>
                  <Input
                    id="joinCode"
                    placeholder="Enter 6-character code"
                    maxLength={6}
                    {...joinTeamForm.register("code")}
                    disabled={isSubmitting}
                    className="uppercase"
                  />
                  {joinTeamForm.formState.errors.code && (
                    <p className="text-sm text-destructive">
                      {joinTeamForm.formState.errors.code.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Joining..." : "Join Team"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Has Team State
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{teamData.team.name}</h1>
          <p className="text-muted-foreground mt-2">Manage your team members and settings</p>
        </div>
        <Button
          variant="destructive"
          onClick={handleLeaveTeam}
          disabled={isSubmitting || teamData.isLeader}
          title={teamData.isLeader ? "Leaders cannot leave. Delete team instead." : ""}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Leave Team
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Invite Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invite Members</CardTitle>
          <CardDescription>Share this code with others to invite them to your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="joinCode">Join Code</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  id="joinCode"
                  value={teamData.team.join_code || ""}
                  readOnly
                  className="font-mono text-lg font-semibold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyCode}
                  title="Copy join code"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {teamData.members.length} of 4 members
              </CardDescription>
            </div>
            {teamData.isLeader && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteTeam}
                disabled={isSubmitting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Team
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamData.members.map((member) => {
              const profile = member.profile
              const isLeader = teamData.team.leader_id === profile?.id
              const initials = getInitials(profile)
              const fullName = getFullName(profile)

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{fullName}</p>
                        {isLeader && (
                          <Badge variant="default">Leader</Badge>
                        )}
                        {!isLeader && (
                          <Badge variant="secondary">Member</Badge>
                        )}
                      </div>
                      {/* Removed email display to prevent TypeScript error */}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}