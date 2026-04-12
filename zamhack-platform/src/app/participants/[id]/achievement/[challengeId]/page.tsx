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
          signature_url
        )
      )
    `)
    .eq("profile_id", id)
    .eq("challenge_id", challengeId)
    .single()

  if (!winnerRow) notFound()

  const winner = winnerRow as unknown as WinnerRow
  const challenge = winner.challenge
  const org = challenge?.organization

  if (!challenge) notFound()

  // Generate a signed URL for the signature image (1 hour expiry)
  let signatureUrl: string | null = null
  if (org?.signature_url) {
    const { data: signedData } = await supabase.storage
      .from("signatures")
      .createSignedUrl(org.signature_url, 3600)
    signatureUrl = signedData?.signedUrl ?? null
  }

  const studentName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Student"

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
  // If the certificate carry a ?type= param, honour it so the correct cert is shown.
  // Falls back to rank-based logic for old links that predate the param.
  const isWinner = type === "completion" ? false
    : type === "winner" ? (rank >= 1 && rank <= 3)
    : (rank >= 1 && rank <= 3)
  const verifyUrl = `zamhack.vercel.app/participants/${id}/achievement/${challengeId}${type ? `?type=${type}` : ""}`

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
              <strong>{challenge.title}</strong>. It has not been falsified.
            </p>
          </div>
        </div>

        {/* Certificate rendered as HTML */}
        <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
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
          />
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
