import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChallengeCard } from "@/components/challenge-card"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"

type Challenge = Database["public"]["Tables"]["challenges"]["Row"]

interface DashboardData {
  firstName: string | null
  activeChallenges: Challenge[]
  activeCount: number
  completedCount: number
}

async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  // Fetch user profile for first_name
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .single()

  // Fetch active challenges where user is a participant
  // First, get challenge IDs where user is participating
  const { data: participantData } = await supabase
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", user.id)
    .not("challenge_id", "is", null)

  // FIX: Explicitly filter with a type predicate so TypeScript knows this is strictly string[]
  const challengeIds = participantData
    ?.map((p) => p.challenge_id)
    .filter((id): id is string => id !== null) || []

  // Fetch challenges that are approved or in_progress and user is participating
  let activeChallenges: Challenge[] = []
  if (challengeIds.length > 0) {
    const { data, error: challengesError } = await supabase
      .from("challenges")
      .select("*")
      .in("id", challengeIds)
      .in("status", ["approved", "in_progress"])
      .order("end_date", { ascending: true })
      .limit(5)

    if (challengesError) {
      console.error("Error fetching challenges:", challengesError)
    } else {
      activeChallenges = (data as Challenge[]) || []
    }
  }

  // Count active challenges
  const { count: activeCount } = await supabase
    .from("challenge_participants")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("challenge_id", "is", null)

  // Count completed challenges
  const { count: completedCount } = await supabase
    .from("challenge_participants")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed")

  return {
    firstName: profile?.first_name || null,
    activeChallenges,
    activeCount: activeCount || 0,
    completedCount: completedCount || 0,
  }
}

export default async function StudentDashboard() {
  const { firstName, activeChallenges, activeCount, completedCount } =
    await getDashboardData()

  const displayName = firstName || "there"

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome back, {displayName}!</h1>
        <p className="text-muted-foreground">
          Here is what&apos;s happening with your challenges.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">
              Challenges in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">
              Challenges completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skills Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Skills from challenges
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Challenges Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Active Challenges</h2>

        {activeChallenges.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                No active challenges found
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start by browsing available challenges
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}