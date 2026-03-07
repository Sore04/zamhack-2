import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Ribbon, ArrowLeft, Star } from "lucide-react"
import Link from "next/link"

// Define the exact shape of our joined data to satisfy TypeScript
interface WinnerData {
  rank: number
  prize: string | null
  profile_id: string  // added: needed to match with participant scores
  profile: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    university: string | null
  } | null
}

interface ParticipantScore {
  user_id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  university: string | null
  totalScore: number
}

export default async function ChallengeResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch Challenge Status
  const { data: challenge } = await supabase
    .from("challenges")
    .select("title, status, organization:organizations(name)")
    .eq("id", id)
    .single()

  if (!challenge) redirect("/challenges")

  // Only show results if closed
  if (challenge.status !== "closed" && challenge.status !== "completed") {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="bg-muted p-4 rounded-full">
          <Trophy className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Results Pending</h1>
        <p className="text-muted-foreground max-w-md">
          The winners for <span className="font-semibold">{challenge.title}</span> have not been announced yet.
        </p>
        <Button asChild variant="outline">
          <Link href={`/challenges/${id}`}>Back to Challenge</Link>
        </Button>
      </div>
    )
  }

  // 2. Fetch Winners — added profile_id to select so we can match scores below
  const { data } = await supabase
    .from("winners")
    .select(`
      rank,
      prize,
      profile_id,
      profile:profiles (first_name, last_name, avatar_url, university)
    `)
    .eq("challenge_id", id)
    .order("rank", { ascending: true })

  const winners = data as unknown as WinnerData[] | null

  // 3. Fetch all participants + compute their total score from evaluations
  const { data: participantsRaw } = await supabase
    .from("challenge_participants")
    .select(`
      user_id,
      profile:profiles (first_name, last_name, avatar_url, university),
      submissions (
        evaluations (score)
      )
    `)
    .eq("challenge_id", id)

  const allParticipants: ParticipantScore[] = ((participantsRaw ?? []) as any[])
    .map((p) => {
      const totalScore = (p.submissions ?? []).reduce((acc: number, sub: any) => {
        return acc + (sub.evaluations?.[0]?.score ?? 0)
      }, 0)
      return {
        user_id: p.user_id,
        first_name: p.profile?.first_name ?? null,
        last_name: p.profile?.last_name ?? null,
        avatar_url: p.profile?.avatar_url ?? null,
        university: p.profile?.university ?? null,
        totalScore,
      }
    })
    .sort((a, b) => b.totalScore - a.totalScore)

  // Attach computed score to each winner card
  const winnersWithScore = (winners ?? []).map((w) => ({
    ...w,
    totalScore: allParticipants.find((p) => p.user_id === w.profile_id)?.totalScore ?? 0,
  }))

  const getRankConfig = (rank: number) => {
    switch (rank) {
      case 1: return {
        color: "text-yellow-600",
        bg: "bg-gradient-to-b from-yellow-50 to-yellow-100/60 border-yellow-200",
        iconColor: "text-yellow-500",
        icon: Trophy,
        badgeBg: "bg-black/90 text-white hover:bg-black/80",
        heightClass: "md:min-h-[22rem]",
        scale: "scale-105 z-10",
        scoreColor: "text-yellow-700",
      }
      case 2: return {
        color: "text-slate-600",
        bg: "bg-gradient-to-b from-slate-50 to-slate-100/60 border-slate-200",
        iconColor: "text-slate-400",
        icon: Ribbon,
        badgeBg: "bg-black/90 text-white hover:bg-black/80",
        heightClass: "md:min-h-[19rem]",
        scale: "scale-100",
        scoreColor: "text-slate-600",
      }
      case 3: return {
        color: "text-amber-700",
        bg: "bg-gradient-to-b from-orange-50 to-orange-100/60 border-orange-200",
        iconColor: "text-amber-600",
        icon: Ribbon,
        badgeBg: "bg-black/90 text-white hover:bg-black/80",
        heightClass: "md:min-h-[17rem]",
        scale: "scale-100",
        scoreColor: "text-amber-700",
      }
      default: return {
        color: "text-blue-600",
        bg: "bg-card",
        iconColor: "text-blue-600",
        icon: Star,
        badgeBg: "bg-black/90 text-white hover:bg-black/80",
        heightClass: "h-auto",
        scale: "",
        scoreColor: "text-muted-foreground",
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20">
      <div className="container max-w-4xl py-12 px-4 mx-auto">
        <Button variant="ghost" asChild className="mb-8">
          <Link href={`/challenges/${id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Challenge</Link>
        </Button>

        {/* Hero header */}
        <div className="text-center mb-16 space-y-2">
          {/* Glowing trophy accent above title */}
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-yellow-100 opacity-60 blur-md" />
              <Trophy className="relative h-10 w-10 text-yellow-500" />
            </div>
          </div>

          <Badge variant="outline" className="mb-2 border-primary/20 text-primary bg-primary/5">Official Results</Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Winners Announced</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Celebrating the top innovators for <span className="text-foreground font-semibold">{challenge.title}</span>
          </p>

          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="h-px w-16 bg-border" />
            <Star className="h-3 w-3 text-muted-foreground/40" />
            <div className="h-px w-16 bg-border" />
          </div>
        </div>

        {/* Podium Layout: 2nd, 1st, 3rd */}
        <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6 mb-16">
          {[2, 1, 3].map((rank) => {
            const winner = winnersWithScore.find((w) => w.rank === rank)
            if (!winner) return null

            const config = getRankConfig(rank)
            const Icon = config.icon
            const profile = winner.profile

            return (
              <Card
                key={rank}
                className={`
                  relative w-full md:w-1/3 border-2 flex flex-col items-center justify-between
                  shadow-sm transition-transform rounded-2xl
                  ${config.bg} ${config.heightClass} ${config.scale}
                `}
              >
                {/* Rank number watermark */}
                <span className={`absolute bottom-4 right-5 text-7xl font-black opacity-[0.07] select-none leading-none ${config.color}`}>
                  {rank}
                </span>

                <div className="pt-8 flex flex-col items-center w-full px-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-full bg-white shadow-sm mb-4 ${config.iconColor}`}>
                    <Icon className="h-8 w-8" />
                  </div>

                  <Avatar className="h-20 w-20 border-4 border-white shadow-md mb-4">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-lg font-bold">
                      {profile?.first_name?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="font-bold text-lg text-center leading-tight">
                    {profile?.first_name} {profile?.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    {profile?.university}
                  </p>

                  {/* Total score */}
                  <div className={`mt-3 text-2xl font-extrabold ${config.scoreColor}`}>
                    {winner.totalScore}
                    <span className="text-xs font-medium text-muted-foreground ml-1">pts</span>
                  </div>
                </div>

                <div className="pb-8 flex flex-col items-center">
                  {winner.prize && (
                    <Badge className={`${config.badgeBg} mb-2`}>
                      {winner.prize}
                    </Badge>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Full Leaderboard */}
        {allParticipants.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold">Full Leaderboard</h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">
                {allParticipants.length} participant{allParticipants.length !== 1 ? "s" : ""}
              </span>
            </div>

            <Card className="overflow-hidden border shadow-sm">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left font-semibold text-muted-foreground px-5 py-3 w-12">#</th>
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3">Participant</th>
                      <th className="text-left font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">University</th>
                      <th className="text-right font-semibold text-muted-foreground px-5 py-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allParticipants.map((p, i) => {
                      const position = i + 1
                      const isTop3 = position <= 3

                      return (
                        <tr
                          key={p.user_id}
                          className={`border-b last:border-0 transition-colors hover:bg-muted/30 ${isTop3 ? "bg-muted/10" : ""}`}
                        >
                          {/* Rank badge */}
                          <td className="px-5 py-3 w-12">
                            {isTop3 ? (
                              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                                position === 1 ? "bg-yellow-100 text-yellow-700"
                                : position === 2 ? "bg-slate-100 text-slate-600"
                                : "bg-orange-100 text-amber-700"
                              }`}>
                                {position}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 font-mono">{position}</span>
                            )}
                          </td>

                          {/* Name + avatar */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 border border-border">
                                <AvatarImage src={p.avatar_url || undefined} />
                                <AvatarFallback className="text-xs bg-muted font-semibold">
                                  {p.first_name?.[0] ?? "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{p.first_name} {p.last_name}</span>
                            </div>
                          </td>

                          {/* University */}
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {p.university ?? "—"}
                          </td>

                          {/* Score */}
                          <td className="px-5 py-3 text-right">
                            <span className={`font-bold tabular-nums ${isTop3 ? "text-foreground" : "text-muted-foreground"}`}>
                              {p.totalScore}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">pts</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}