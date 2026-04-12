import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ShieldCheck,
  Trophy,
  Medal,
  Award,
  Star,
  GraduationCap,
  Building2,
  CalendarDays,
} from "lucide-react"

interface WinnerWithChallenge {
  id: string
  rank: number
  score: number | null
  prize: string | null
  announced_at: string | null
  challenge: {
    title: string
    difficulty: string | null
    organization: { name: string } | null
  } | null
}

interface EarnedSkillWithName {
  id: string
  tier: string
  awarded_at: string | null
  skill: { name: string; category: string | null } | null
}

const RANK_LABEL: Record<number, string> = {
  1: "1st Place",
  2: "2nd Place",
  3: "3rd Place",
}

const TIER_COLORS: Record<string, string> = {
  advanced: "bg-purple-100 text-purple-800 border-purple-200",
  intermediate: "bg-blue-100 text-blue-800 border-blue-200",
  beginner: "bg-green-100 text-green-800 border-green-200",
}

const RANK_BADGE: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-800 border-yellow-300",
  2: "bg-slate-100 text-slate-700 border-slate-300",
  3: "bg-orange-100 text-orange-800 border-orange-300",
}

function rankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />
  if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />
  return <Star className="h-4 w-4 text-muted-foreground" />
}

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Use service-role client so this public verification page works without auth
  // and is not blocked by RLS policies
  const supabase = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, university, avatar_url")
    .eq("id", id)
    .single()

  if (!profile) notFound()

  const { data: winnerRows } = await supabase
    .from("winners")
    .select(`
      id, rank, score, prize, announced_at,
      challenge:challenges (
        title,
        difficulty,
        organization:organizations (name)
      )
    `)
    .eq("profile_id", id)
    .order("rank", { ascending: true })

  const { data: earnedSkillRows } = await supabase
    .from("student_earned_skills")
    .select(`
      id, tier, awarded_at,
      skill:skills (name, category)
    `)
    .eq("profile_id", id)
    .order("awarded_at", { ascending: false })

  const winners = (winnerRows ?? []) as unknown as WinnerWithChallenge[]
  const earnedSkills = (earnedSkillRows ?? []) as unknown as EarnedSkillWithName[]

  const fullName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Student"
  const initials =
    (profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "")

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-16">
      <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6">

        {/* Verification banner */}
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              Certificate Verified — Issued by ZamHack
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              This page confirms that the certificate below was legitimately generated
              by the ZamHack platform and has not been falsified.
            </p>
          </div>
        </div>

        {/* Profile identity card */}
        <Card className="border shadow-sm">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-border flex-shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg font-bold bg-muted">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold leading-tight">{fullName}</h1>
                {profile.university && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <GraduationCap className="h-3.5 w-3.5 flex-shrink-0" />
                    {profile.university}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Challenge results */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Verified Challenge Results ({winners.length})
          </h2>

          {winners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded challenge results.</p>
          ) : (
            <div className="space-y-3">
              {winners.map((w) => (
                <Card key={w.id} className="border shadow-sm">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 flex-shrink-0">{rankIcon(w.rank)}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-snug truncate">
                            {w.challenge?.title ?? "—"}
                          </p>
                          {w.challenge?.organization?.name && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3 flex-shrink-0" />
                              {w.challenge.organization.name}
                            </p>
                          )}
                          {w.announced_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <CalendarDays className="h-3 w-3 flex-shrink-0" />
                              {new Date(w.announced_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${RANK_BADGE[w.rank] ?? "bg-muted text-muted-foreground border-border"}`}
                        >
                          {RANK_LABEL[w.rank] ?? `Rank ${w.rank}`}
                        </Badge>
                        {w.score !== null && (
                          <p className="text-xs text-muted-foreground">{w.score} pts</p>
                        )}
                        {w.prize && (
                          <p className="text-xs font-medium text-amber-700">{w.prize}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Earned skills */}
        {earnedSkills.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Skills Earned via Challenges ({earnedSkills.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {earnedSkills.map((s) => (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                    TIER_COLORS[s.tier] ?? "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {s.skill?.name}
                  <span className="opacity-60 capitalize">· {s.tier}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            This verification page is automatically maintained by ZamHack.
            The data shown here is the authoritative record.
          </p>
          <Link
            href="/"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            zamhack.vercel.app
          </Link>
        </div>

      </div>
    </div>
  )
}
