"use client"

import Link from "next/link"
import {
  Building2,
  Users,
  Trophy,
  CalendarDays,
  Zap,
  ArrowRight,
  Lock,
  CheckCircle2,
  MapPin,
  Globe,
} from "lucide-react"
import { Database } from "@/types/supabase"

type Challenge = Database["public"]["Tables"]["challenges"]["Row"] & {
  organization: { name: string } | null
}

interface ChallengeCardProps {
  challenge: Challenge
  /**
   * When provided (perpetual + all milestones done), the card CTA becomes
   * "View Results" and links to this href instead of the default challenge page.
   */
  perpetualResultsHref?: string
  /**
   * When true, the CTA links to /my-challenges/[id] instead of /challenges/[id]
   * so the student sees their progress page with feedback.
   */
  isParticipant?: boolean
  /** XP range the student can earn from this challenge (personalised to their rank). */
  xpRange?: { min: number; max: number } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "approved":         return "Open"
    case "in_progress":      return "In Progress"
    case "under_review":     return "Under Review"
    case "completed":
    case "closed":           return "Closed"
    case "cancelled":        return "Cancelled"
    case "draft":            return "Draft"
    case "pending_approval": return "Pending"
    default:                 return status ?? "Unknown"
  }
}

function getStatusClass(status: string | null): string {
  switch (status) {
    case "approved":
    case "in_progress":       return "cc-status-active"
    case "under_review":      return "cc-status-review"
    case "completed":
    case "closed":            return "cc-status-closed"
    case "cancelled":         return "cc-status-cancelled"
    default:                  return "cc-status-draft"
  }
}

function getDiffClass(difficulty: string | null): string {
  switch (difficulty?.toLowerCase()) {
    case "beginner":     return "cc-diff-beginner"
    case "intermediate": return "cc-diff-intermediate"
    case "advanced":     return "cc-diff-advanced"
    case "expert":       return "cc-diff-expert"
    default:             return "cc-diff-beginner"
  }
}

function formatCurrency(amount: number | null, currency: string | null): string {
  if (!amount || amount === 0) return "Free"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency || "PHP",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDeadline(dateStr: string | null): { label: string; urgent: boolean } {
  if (!dateStr) return { label: "No deadline", urgent: false }
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (diff < 0)  return { label: "Ended",           urgent: false }
  if (diff === 0) return { label: "Ends today",      urgent: true }
  if (diff === 1) return { label: "1 day left",      urgent: true }
  if (diff <= 7)  return { label: `${diff} days left`, urgent: true }
  return {
    label: new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }),
    urgent: false,
  }
}

function orgAccentClass(name: string | undefined | null): string {
  const palette = [
    "cc-accent-coral",
    "cc-accent-navy",
    "cc-accent-indigo",
    "cc-accent-emerald",
    "cc-accent-amber",
  ]
  const idx = (name ?? "")
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0)
  return palette[idx % palette.length]
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ChallengeCard({ challenge, perpetualResultsHref, isParticipant, xpRange }: ChallengeCardProps) {
  const isClosed    = challenge.status === "closed" || challenge.status === "completed"
  const isCancelled = challenge.status === "cancelled"
  const isPerpetual = (challenge as any).is_perpetual === true
  const isInactive  = isClosed || isCancelled

  // If perpetualResultsHref is passed the student completed this perpetual challenge
  const isPerpetualCompleted = !!perpetualResultsHref

  const deadline    = formatDeadline(challenge.end_date)
  const accentClass = orgAccentClass(challenge.organization?.name)

  // For closed non-perpetual challenges, link directly to the official results/leaderboard
  const resultsHref = isClosed && !isPerpetual
    ? `/challenges/${challenge.id}/results`
    : undefined

  // Decide where the CTA links and what it says
  const ctaHref = perpetualResultsHref
    ?? resultsHref
    ?? (isParticipant ? `/my-challenges/${challenge.id}` : `/challenges/${challenge.id}`)

  const ctaContent = (() => {
    if (isPerpetualCompleted) {
      return {
        label: <><CheckCircle2 size={14} /> View Results</>,
        className: "cc-cta cc-cta-muted",
      }
    }
    if (isClosed && !isPerpetual) {
      return {
        label: <><Trophy size={14} /> View Official Results</>,
        className: "cc-cta cc-cta-muted",
      }
    }
    if (isClosed) {
      return {
        label: <><CheckCircle2 size={14} /> View Results</>,
        className: "cc-cta cc-cta-muted",
      }
    }
    if (isCancelled) {
      return {
        label: <><Lock size={14} /> Cancelled</>,
        className: "cc-cta cc-cta-muted",
      }
    }
    return {
      label: <>{isParticipant ? "View Progress" : "View Details"} <ArrowRight size={14} /></>,
      className: "cc-cta cc-cta-primary",
    }
  })()

  return (
    <article className={`cc-card${isInactive || isPerpetualCompleted ? " cc-card-inactive" : ""}`}>

      {/* ── Coloured top stripe ── */}
      <div className={`cc-stripe ${accentClass}`} />

      {/* ── Card header ── */}
      <div className="cc-header">
        <div className="cc-header-top">
          <span className={`cc-status-badge ${getStatusClass(challenge.status)}`}>
            {isPerpetualCompleted ? "Completed" : getStatusLabel(challenge.status)}
          </span>
          {challenge.difficulty && (
            <span className={`cc-diff-badge ${getDiffClass(challenge.difficulty)}`}>
              {challenge.difficulty}
            </span>
          )}
        </div>

        <h3 className="cc-title">{challenge.title}</h3>

        <div className="cc-org">
          <Building2 size={12} />
          <span>{challenge.organization?.name ?? "Unknown Org"}</span>
        </div>
      </div>

      {/* ── Description ── */}
      <div className="cc-body">
        <p className="cc-desc">{challenge.description}</p>
      </div>

      {/* ── Meta strip ── */}
      <div className="cc-meta">
        <div className="cc-meta-item">
          <Users size={13} />
          <span>
            {challenge.max_participants
              ? `${challenge.max_participants} slots`
              : "Unlimited"}
          </span>
        </div>

        <div className="cc-meta-item">
          <Trophy size={13} />
          <span>{formatCurrency(challenge.entry_fee_amount, challenge.currency)}</span>
        </div>

        <div className={`cc-meta-item cc-meta-deadline${deadline.urgent ? " cc-urgent" : ""}`}>
          <CalendarDays size={13} />
          <span>{isPerpetual ? "No deadline" : deadline.label}</span>
        </div>

        {xpRange && (
          <div className="cc-meta-item" style={isInactive ? { opacity: 0.5 } : undefined}>
            <Zap size={13} />
            <span>{xpRange.min}–{xpRange.max} XP</span>
          </div>
        )}
      </div>

      {/* ── Participation type + location pills ── */}
      <div className="cc-pills">
        {challenge.participation_type && (
          <span className="cc-pill">
            <Zap size={10} strokeWidth={2.5} />
            {challenge.participation_type.charAt(0).toUpperCase() +
              challenge.participation_type.slice(1)}
          </span>
        )}
        {(challenge as any).location_type === "onsite" ? (
          <span className="cc-pill cc-pill-onsite">
            <MapPin size={10} strokeWidth={2.5} />
            Onsite
          </span>
        ) : (challenge as any).location_type === "online" ? (
          <span className="cc-pill cc-pill-online">
            <Globe size={10} strokeWidth={2.5} />
            Online
          </span>
        ) : null}
      </div>

      {/* ── CTA footer ── */}
      <div className="cc-footer">
        <Link href={ctaHref} className={ctaContent.className}>
          {ctaContent.label}
        </Link>
      </div>
    </article>
  )
}