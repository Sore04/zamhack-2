import { createClient } from "@/utils/supabase/server"
import { ChallengeCard } from "@/components/challenge-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Database } from "@/types/supabase"

type ChallengeWithOrg = Database["public"]["Tables"]["challenges"]["Row"] & {
  organization: { name: string } | null
}

const PAST_CHALLENGE_STATUSES = ["closed", "completed", "cancelled"]

export default async function MyChallengesPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  // 1. Fetch all participations
  const { data: participations } = await supabase
    .from("challenge_participants")
    .select("id, status, challenge_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })

  const allParticipations = participations || []
  const challengeIds = allParticipations
    .map((p) => p.challenge_id)
    .filter(Boolean) as string[]

  // 2. Fetch challenges
  let challenges: ChallengeWithOrg[] = []
  if (challengeIds.length > 0) {
    const { data: challengeData } = await supabase
      .from("challenges")
      .select("*, is_perpetual, organization:organizations(name)")
      .in("id", challengeIds)
    challenges = (challengeData as unknown as ChallengeWithOrg[]) || []
  }

  // 2b. Separately fetch which of these challenges are perpetual.
  //     This is a dedicated query so we never rely on TS types for is_perpetual.
  const perpetualSet = new Set<string>()
  if (challengeIds.length > 0) {
    const { data: perpetualRows } = await supabase
      .from("challenges")
      .select("id")
      .in("id", challengeIds)
      .eq("is_perpetual", true)
    for (const row of perpetualRows ?? []) {
      perpetualSet.add(row.id)
    }
  }

  // 3. Build completionMap for ALL challenges (not just perpetual)
  //    completionMap: challengeId → true if submitted >= total milestones > 0
  const completionMap = new Map<string, boolean>()

const participantIds = allParticipations.map((p) => p.id)

const [milestonesResult, submissionsResult] = await Promise.all([
  challengeIds.length > 0
    ? supabase.from("milestones").select("challenge_id").in("challenge_id", challengeIds)
    : { data: [] },
  participantIds.length > 0
    ? supabase.from("submissions").select("participant_id").in("participant_id", participantIds)
    : { data: [] },
])

// Count milestones per challenge
const milestoneCountMap = new Map<string, number>()
for (const m of milestonesResult.data ?? []) {
  if (!m.challenge_id) continue
  milestoneCountMap.set(m.challenge_id, (milestoneCountMap.get(m.challenge_id) ?? 0) + 1)
}

// Count submissions per participant
const submissionCountMap = new Map<string, number>()
for (const s of submissionsResult.data ?? []) {
  if (!s.participant_id) continue
  submissionCountMap.set(s.participant_id, (submissionCountMap.get(s.participant_id) ?? 0) + 1)
}

for (const participation of allParticipations) {
  const challengeId = participation.challenge_id as string
  const total = milestoneCountMap.get(challengeId) ?? 0
  const submitted = submissionCountMap.get(participation.id) ?? 0
  completionMap.set(challengeId, total > 0 && submitted >= total)
}

  // 4. Sort: perpetual + all milestones done → Past. Everything else follows status.
  const challengeMap = new Map(challenges.map((c) => [c.id, c]))
  const activeChallenges: ChallengeWithOrg[] = []
  const pastChallenges: ChallengeWithOrg[] = []

  for (const participation of allParticipations) {
    const challenge = challengeMap.get(participation.challenge_id as string)
    if (!challenge) continue

    const isPerpetual = perpetualSet.has(challenge.id)
    const isCompleted = completionMap.get(challenge.id) ?? false
    const isStatusPast = PAST_CHALLENGE_STATUSES.includes(challenge.status as string)
    const isEnded = challenge.end_date ? new Date(challenge.end_date) < new Date() : false

    const participantDone = participation.status === "completed"

    if (isStatusPast || (isPerpetual && (isCompleted || participantDone)) || isEnded) {
      pastChallenges.push(challenge)
    } else {
      activeChallenges.push(challenge)
    }
  }

  const hasAnyChallenges = activeChallenges.length > 0 || pastChallenges.length > 0

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">My Challenges</h1>
        <p className="text-muted-foreground">
          Track your progress and manage your active challenges.
        </p>
      </div>

      {!hasAnyChallenges ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center">
          <p className="text-lg font-medium text-foreground">
            You haven't joined any challenges yet
          </p>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Browse available challenges and start your journey.
          </p>
          <Button asChild>
            <Link href="/challenges">Browse Challenges</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active ({activeChallenges.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastChallenges.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeChallenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">No active challenges</p>
                <p className="text-sm mt-2">You don't have any active challenges at the moment.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} isParticipant={true} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {pastChallenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">No past challenges</p>
                <p className="text-sm mt-2">Your completed challenges will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pastChallenges.map((challenge) => {
                  const isPerpetual = perpetualSet.has(challenge.id)
                  const isCompleted = completionMap.get(challenge.id) ?? false
                  return (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      isParticipant={true}
                      perpetualResultsHref={
                        isPerpetual && isCompleted
                          ? `/challenges/${challenge.id}`
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
