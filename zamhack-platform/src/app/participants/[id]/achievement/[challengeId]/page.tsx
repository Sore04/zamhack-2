import type { ReactNode } from "react"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import CertificateDisplay from "./certificate-display"

interface WinnerRow {
  rank: number
  score: number | null
  announced_at: string | null
  challenge: {
    id: string
    title: string
    organization: {
      name: string
      representative_name: string | null
      signature_url: string | null
      logo_url: string | null
    } | null
  } | null
}

export default async function CertificateVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; challengeId: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { id, challengeId } = await params
  const { type } = await searchParams

  const supabase = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch student profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, university, avatar_url")
    .eq("id", id)
    .single()

  if (!profile) notFound()

  // Fetch the winner record for this student + this specific challenge
  const { data: winnerRow } = await supabase
    .from("winners")
    .select(`
      rank,
      score,
      announced_at,
      challenge:challenges (
        id,
        title,
        organization:organizations (
          name,
          representative_name,
          signature_url,
          logo_url
        )
      )
    `)
    .eq("profile_id", id)
    .eq("challenge_id", challengeId)
    .single()

  const studentName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Student"

  // ── NORMAL CHALLENGE PATH (winner row exists) ────────────────────────────
  if (winnerRow) {
    const winner = winnerRow as unknown as WinnerRow
    const challenge = winner.challenge
    const org = challenge?.organization

    if (!challenge) notFound()

    let signatureUrl: string | null = null
    if (org?.signature_url) {
      const { data: signedData } = await supabase.storage
        .from("signatures")
        .createSignedUrl(org.signature_url, 3600)
      signatureUrl = signedData?.signedUrl ?? null
    }

    let logoDataUrl: string | null = null
    if (org?.logo_url) {
      try {
        const res = await fetch(org.logo_url)
        if (res.ok) {
          const buffer = await res.arrayBuffer()
          const contentType = res.headers.get("content-type") ?? "image/png"
          const base64 = Buffer.from(buffer).toString("base64")
          logoDataUrl = `data:${contentType};base64,${base64}`
        }
      } catch {
        // silently fall back to null — logo just won't show
      }
    }

    const completionDate = winner.announced_at
      ? new Date(winner.announced_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })

    const rank = winner.rank
    const isWinner = type === "completion" ? false
      : type === "winner" ? (rank >= 1 && rank <= 3)
      : (rank >= 1 && rank <= 3)
    const verifyUrl = `zamhack.vercel.app/participants/${id}/achievement/${challengeId}${type ? `?type=${type}` : ""}`

    return (
      <VerifyPageShell studentName={studentName} challengeTitle={challenge.title}>
        <CertificateDisplay
          type={isWinner ? "winner" : "completion"}
          rank={isWinner ? (rank as 1 | 2 | 3) : undefined}
          studentName={studentName}
          challengeTitle={challenge.title}
          organizationName={org?.name ?? "ZamHack"}
          completionDate={completionDate}
          totalScore={winner.score}
          representativeName={org?.representative_name ?? null}
          signatureUrl={signatureUrl}
          verifyUrl={verifyUrl}
          organizationLogoUrl={logoDataUrl}
        />
      </VerifyPageShell>
    )
  }

  // ── PERPETUAL CHALLENGE FALLBACK ─────────────────────────────────────────
  // No winner row — check if this is a completed perpetual challenge.
  const { data: challenge } = await (supabase
    .from("challenges")
    .select("title, is_perpetual, organization:organizations(name, representative_name, signature_url, logo_url)")
    .eq("id", challengeId)
    .single() as any)

  if (!challenge || !(challenge as any).is_perpetual) notFound()

  // Confirm the student actually participated
  const { data: participant } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("user_id", id)
    .maybeSingle()

  if (!participant) notFound()

  // Fetch milestone IDs for this challenge
  const { data: milestones, count: totalMilestones } = await supabase
    .from("milestones")
    .select("id", { count: "exact" })
    .eq("challenge_id", challengeId)

  if (!totalMilestones || totalMilestones === 0) notFound()

  const milestoneIds = (milestones ?? []).map((m) => m.id)

  // Confirm all milestones have been submitted
  const { data: submissions, count: submittedCount } = await supabase
    .from("submissions")
    .select("submitted_at", { count: "exact" })
    .eq("participant_id", participant!.id)
    .in("milestone_id", milestoneIds)

  if (!submittedCount || submittedCount < totalMilestones!) notFound()

  const org = (challenge as any).organization as {
    name: string
    representative_name: string | null
    signature_url: string | null
    logo_url: string | null
  } | null

  let signatureUrl: string | null = null
  if (org?.signature_url) {
    const { data: signedData } = await supabase.storage
      .from("signatures")
      .createSignedUrl(org.signature_url, 3600)
    signatureUrl = signedData?.signedUrl ?? null
  }

  let logoDataUrl: string | null = null
  if (org?.logo_url) {
    try {
      const res = await fetch(org.logo_url)
      if (res.ok) {
        const buffer = await res.arrayBuffer()
        const contentType = res.headers.get("content-type") ?? "image/png"
        const base64 = Buffer.from(buffer).toString("base64")
        logoDataUrl = `data:${contentType};base64,${base64}`
      }
    } catch {
      // silently fall back to null — logo just won't show
    }
  }

  // Use the latest submission date as completion date
  const latestSubmission = (submissions ?? [])
    .map((s) => s.submitted_at)
    .filter(Boolean)
    .sort()
    .at(-1)

  const completionDate = latestSubmission
    ? new Date(latestSubmission).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

  const verifyUrl = `zamhack.vercel.app/participants/${id}/achievement/${challengeId}?type=completion`

  return (
    <VerifyPageShell studentName={studentName} challengeTitle={(challenge as any).title}>
      <CertificateDisplay
        type="completion"
        studentName={studentName}
        challengeTitle={(challenge as any).title}
        organizationName={org?.name ?? "ZamHack"}
        completionDate={completionDate}
        totalScore={null}
        representativeName={org?.representative_name ?? null}
        signatureUrl={signatureUrl}
        verifyUrl={verifyUrl}
        organizationLogoUrl={logoDataUrl}
      />
    </VerifyPageShell>
  )
}

// ── Shared page shell ────────────────────────────────────────────────────────
function VerifyPageShell({
  studentName,
  challengeTitle,
  children,
}: {
  studentName: string
  challengeTitle: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-16">
      <div className="container max-w-4xl mx-auto py-10 px-4 space-y-6">

        {/* Verification banner */}
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              Certificate Verified — Issued by ZamHack
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              This page confirms that the certificate below was legitimately generated
              by the ZamHack platform for <strong>{studentName}</strong> upon completing{" "}
              <strong>{challengeTitle}</strong>. It has not been falsified.
            </p>
          </div>
        </div>

        {/* Certificate rendered as HTML */}
        <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
          {children}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            This verification page is automatically maintained by ZamHack.
            The certificate shown here is the authoritative record.
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
