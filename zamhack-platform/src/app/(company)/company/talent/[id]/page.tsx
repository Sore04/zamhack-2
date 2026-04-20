import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { Database } from "@/types/supabase"
import Link from "next/link"
import {
  ArrowLeft,
  Github,
  Linkedin,
  FileText,
  GraduationCap,
  MapPin,
  Trophy,
  Zap,
  BookOpen,
  ExternalLink,
  Star,
  Calendar,
  CheckCircle2,
} from "lucide-react"
import { RANK_TITLES } from "@/lib/rank-titles"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

function getInitials(first: string | null, last: string | null): string {
  return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase() || "?"
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #FF9B87 0%, #E8836F 100%)",
  "linear-gradient(135deg, #2C3E50 0%, #3D5166 100%)",
  "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)",
  "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)",
  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
]

function avatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; dots: number }> = {
  beginner:     { label: RANK_TITLES.beginner,     color: "#64748B", bg: "rgba(100,116,139,0.10)", dots: 1 },
  intermediate: { label: RANK_TITLES.intermediate, color: "#0EA5E9", bg: "rgba(14,165,233,0.10)",  dots: 2 },
  advanced:     { label: RANK_TITLES.advanced,     color: "#FF9B87", bg: "rgba(255,155,135,0.12)", dots: 3 },
  expert:       { label: "Expert",                 color: "#2C3E50", bg: "rgba(44,62,80,0.10)",    dots: 4 },
}

async function getParticipantProfile(studentId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!viewer || (viewer.role !== "company_admin" && viewer.role !== "company_member")) {
    redirect("/dashboard")
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", studentId)
    .eq("role", "student")
    .single()

  if (error || !profile) notFound()

  const { data: studentSkills } = await supabase
    .from("student_skills")
    .select("level, skill:skills(id, name, category)")
    .eq("profile_id", studentId)

  const { data: participations } = await supabase
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", studentId)
    .not("challenge_id", "is", null)

  let completedCount = 0
  let activeCount = 0

  if (participations && participations.length > 0) {
    const challengeIds = participations.map((p) => p.challenge_id).filter(Boolean) as string[]
    const { data: challenges } = await supabase
      .from("challenges")
      .select("id, status")
      .in("id", challengeIds)

    if (challenges) {
      completedCount = challenges.filter((c) =>
        ["completed", "closed"].includes(c.status || "")
      ).length
      activeCount = challenges.filter((c) =>
        !["completed", "closed", "cancelled", "rejected", "draft", "pending_approval"].includes(c.status || "")
      ).length
    }
  }

  return {
    profile: profile as Profile,
    studentSkills: studentSkills || [],
    completedCount,
    activeCount,
    totalParticipations: participations?.length || 0,
  }
}

export default async function ParticipantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, studentSkills, completedCount, activeCount, totalParticipations } =
    await getParticipantProfile(id)

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Student"
  const initials = getInitials(profile.first_name, profile.last_name)
  const gradient = avatarGradient(fullName)
  const location = [profile.address_city, profile.address_country].filter(Boolean).join(", ")
  const headline = [profile.degree, profile.university].filter(Boolean).join(" · ")

  const skillsByLevel = studentSkills.reduce(
    (acc, s) => {
      const level = s.level || "beginner"
      if (!acc[level]) acc[level] = []
      const skillName = (s.skill as { name: string } | null)?.name || "Unknown"
      acc[level].push(skillName)
      return acc
    },
    {} as Record<string, string[]>
  )

  const levelOrder = ["expert", "advanced", "intermediate", "beginner"]

  const socialLinks = [
    { href: profile.github_url,   label: "GitHub",   Icon: Github,   color: "#1A252F" },
    { href: profile.linkedin_url, label: "LinkedIn",  Icon: Linkedin, color: "#0A66C2" },
    { href: profile.resume_link,  label: "Resume",    Icon: FileText, color: "#FF9B87" },
  ].filter((l) => Boolean(l.href))

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null

  const statusLabel = activeCount > 0 ? "Active" : completedCount > 0 ? "Available" : "New"
  const statusBg    = activeCount > 0 ? "rgba(16,185,129,0.12)" : completedCount > 0 ? "rgba(255,155,135,0.12)" : "var(--cp-surface-2)"
  const statusColor = activeCount > 0 ? "#065F46" : completedCount > 0 ? "var(--cp-coral-dark)" : "var(--cp-text-muted)"

  const xpRank   = (profile as any).xp_rank   as string | null
  const xpPoints = (profile as any).xp_points as number | null
  const xpCfg    = LEVEL_CONFIG[xpRank || "beginner"] ?? LEVEL_CONFIG.beginner

  return (
    <div className="space-y-6 p-6">

      {/* Back */}
      <Link
        href="/company/talent"
        className="cp-btn cp-btn-ghost"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", fontSize: "0.875rem" }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Back to Talent Search
      </Link>

      {/* ── Hero ── */}
      <div style={{
        background: "var(--cp-white)",
        border: "1px solid var(--cp-border)",
        borderRadius: "var(--cp-radius-xl)",
        boxShadow: "var(--cp-shadow-sm)",
        position: "relative",  /* avatar is positioned relative to this */
      }}>
        {/* Banner — overflow:hidden is safe here because avatar lives outside it */}
        <div style={{
          height: "110px",
          borderRadius: "var(--cp-radius-xl) var(--cp-radius-xl) 0 0",
          background: "linear-gradient(135deg, #2C3E50 0%, #3D5166 55%, rgba(255,155,135,0.6) 100%)",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -10, width: 160, height: 160, background: "rgba(255,155,135,0.2)", borderRadius: "50%", filter: "blur(45px)" }} />
          <div style={{ position: "absolute", bottom: -50, left: "40%", width: 130, height: 130, background: "rgba(255,255,255,0.06)", borderRadius: "50%", filter: "blur(35px)" }} />
        </div>

        {/* Avatar — absolutely placed so it straddles the banner edge, never clipped */}
        <div style={{ position: "absolute", top: "66px", left: "1.75rem" }}>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={fullName}
              style={{ width: "88px", height: "88px", borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 2px 12px rgba(44,62,80,0.18)", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "88px", height: "88px", borderRadius: "50%",
              border: "3px solid #fff", boxShadow: "0 2px 12px rgba(44,62,80,0.18)",
              background: gradient, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.875rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em",
            }}>
              {initials}
            </div>
          )}
        </div>

        <div style={{ padding: "0 1.75rem 1.75rem" }}>
          {/* Spacer so content starts below the avatar */}
          <div style={{ height: "60px" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--cp-navy)", letterSpacing: "-0.03em", margin: 0 }}>
                {fullName}
              </h1>
              {headline && (
                <span style={{ fontSize: "0.875rem", color: "var(--cp-text-secondary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <GraduationCap style={{ width: "0.875rem", height: "0.875rem", color: "var(--cp-coral)", flexShrink: 0 }} />
                  {headline}
                </span>
              )}
              {xpRank && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.625rem", borderRadius: "99px", background: xpCfg.bg, color: xpCfg.color, width: "fit-content" }}>
                  <Zap style={{ width: "0.75rem", height: "0.75rem" }} />
                  {xpCfg.label}
                  {xpPoints != null && ` · ${xpPoints.toLocaleString()} XP`}
                </span>
              )}
              {location && (
                <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <MapPin style={{ width: "0.8125rem", height: "0.8125rem", flexShrink: 0 }} />
                  {location}
                </span>
              )}
              {joinedDate && (
                <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <Calendar style={{ width: "0.8125rem", height: "0.8125rem", flexShrink: 0 }} />
                  Member since {joinedDate}
                </span>
              )}
            </div>

            {socialLinks.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {socialLinks.map(({ href, label, Icon, color }) => (
                  <a
                    key={label}
                    href={href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.375rem",
                      padding: "0.4375rem 0.875rem",
                      borderRadius: "var(--cp-radius-md)",
                      border: "1.5px solid var(--cp-border)",
                      background: "var(--cp-white)",
                      fontSize: "0.8125rem", fontWeight: 600,
                      color: "var(--cp-text-secondary)",
                      textDecoration: "none",
                    }}
                  >
                    <Icon style={{ width: "0.875rem", height: "0.875rem", color }} />
                    {label}
                    <ExternalLink style={{ width: "0.6875rem", height: "0.6875rem", opacity: 0.4 }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="cp-grid-3">
        <div className="cp-stat-card primary">
          <div className="cp-stat-icon">
            <Trophy style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <p className="cp-stat-value">{completedCount}</p>
          <p className="cp-stat-label">Completed Challenges</p>
        </div>
        <div className="cp-stat-card">
          <div className="cp-stat-icon" style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
            <Zap style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <p className="cp-stat-value">{activeCount}</p>
          <p className="cp-stat-label">Active Challenges</p>
        </div>
        <div className="cp-stat-card navy">
          <div className="cp-stat-icon">
            <Star style={{ width: "1.125rem", height: "1.125rem" }} />
          </div>
          <p className="cp-stat-value">{studentSkills.length}</p>
          <p className="cp-stat-label">Skills Listed</p>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem", alignItems: "start" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* About + Challenge Activity — side by side row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

            {/* About */}
            {profile.bio ? (
              <div className="cp-card" style={{ padding: "1.25rem 1.5rem" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--cp-text-muted)", margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <BookOpen style={{ width: "0.8rem", height: "0.8rem" }} /> About
                </p>
                <p style={{ fontSize: "0.9rem", color: "var(--cp-text-secondary)", lineHeight: 1.75, margin: 0 }}>
                  {profile.bio}
                </p>
              </div>
            ) : (
              <div className="cp-card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", margin: 0 }}>No bio provided.</p>
              </div>
            )}

            {/* Challenge Activity */}
            {totalParticipations > 0 ? (
              <div className="cp-card" style={{ padding: "1.25rem 1.5rem" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--cp-text-muted)", margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <CheckCircle2 style={{ width: "0.8rem", height: "0.8rem" }} /> Challenge Activity
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", fontWeight: 600 }}>Completion Rate</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--cp-navy)", fontWeight: 800 }}>
                        {Math.round((completedCount / totalParticipations) * 100)}%
                      </span>
                    </div>
                    <div style={{ height: "8px", borderRadius: "99px", background: "var(--cp-surface-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(completedCount / totalParticipations) * 100}%`, background: "var(--cp-grad-coral)", borderRadius: "99px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {[
                      { label: "Total",     value: totalParticipations, color: "var(--cp-navy)" },
                      { label: "Completed", value: completedCount,       color: "var(--cp-coral)" },
                      { label: "Active",    value: activeCount,           color: "#10B981" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)" }}>
                          {label}: <strong style={{ color: "var(--cp-text-primary)" }}>{value}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="cp-card" style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", margin: 0 }}>No challenge activity yet.</p>
              </div>
            )}
          </div>

          {/* Skills */}
          {studentSkills.length > 0 && (
            <div className="cp-card" style={{ padding: "1.25rem 1.5rem" }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--cp-text-muted)", margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Star style={{ width: "0.8rem", height: "0.8rem" }} /> Skills
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {levelOrder.filter((lvl) => (skillsByLevel[lvl]?.length ?? 0) > 0).map((lvl) => {
                  const cfg = LEVEL_CONFIG[lvl]
                  return (
                    <div key={lvl}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "0.175rem 0.55rem", borderRadius: "99px", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                          {cfg.label}
                        </span>
                        <div style={{ display: "flex", gap: "3px" }}>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: i < cfg.dots ? cfg.color : "var(--cp-border-strong)" }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {skillsByLevel[lvl].map((name) => (
                          <span key={name} style={{ padding: "0.3rem 0.75rem", borderRadius: "var(--cp-radius-sm)", fontSize: "0.8125rem", fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}28` }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Education */}
          {(profile.university || profile.degree) && (
            <div className="cp-card" style={{ padding: "1.25rem 1.5rem" }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--cp-text-muted)", margin: "0 0 0.875rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <GraduationCap style={{ width: "0.8rem", height: "0.8rem" }} /> Education
              </p>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div style={{ width: "40px", height: "40px", flexShrink: 0, borderRadius: "var(--cp-radius-md)", background: "var(--cp-navy-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <GraduationCap style={{ width: "1.125rem", height: "1.125rem", color: "var(--cp-navy)" }} />
                </div>
                <div>
                  {profile.university && <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--cp-navy)", margin: 0 }}>{profile.university}</p>}
                  {profile.degree     && <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-secondary)", margin: "0.15rem 0 0" }}>{profile.degree}</p>}
                  {profile.graduation_year && <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", margin: "0.1rem 0 0" }}>Class of {profile.graduation_year}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Profile Info */}
          <div className="cp-card" style={{ padding: "1.25rem 1.5rem" }}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--cp-text-muted)", margin: "0 0 0.5rem" }}>
              Profile Info
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {([
                { label: "Status",     node: <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.175rem 0.625rem", borderRadius: "99px", background: statusBg, color: statusColor }}>{statusLabel}</span> },
                { label: "Challenges", node: <strong style={{ fontSize: "0.875rem", color: "var(--cp-navy)" }}>{totalParticipations} total</strong> },
                { label: "Skills",     node: <strong style={{ fontSize: "0.875rem", color: "var(--cp-navy)" }}>{studentSkills.length} listed</strong> },
                ...(xpRank ? [{ label: "XP Rank",   node: <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.175rem 0.625rem", borderRadius: "99px", background: xpCfg.bg, color: xpCfg.color }}>{xpCfg.label}</span> }] : []),
                ...(xpPoints != null ? [{ label: "XP Points", node: <strong style={{ fontSize: "0.875rem", color: "var(--cp-navy)" }}>{xpPoints.toLocaleString()}</strong> }] : []),
                ...(joinedDate ? [{ label: "Joined", node: <strong style={{ fontSize: "0.8125rem", color: "var(--cp-navy)" }}>{joinedDate}</strong> }] : []),
              ] as { label: string; node: React.ReactNode }[]).map(({ label, node }, i, arr) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 0", borderBottom: i < arr.length - 1 ? "1px solid var(--cp-border)" : "none" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", fontWeight: 500 }}>{label}</span>
                  {node}
                </div>
              ))}
            </div>
          </div>

          {/* No skills state */}
          {studentSkills.length === 0 && (
            <div className="cp-card" style={{ padding: "1.5rem", textAlign: "center" }}>
              <Star style={{ width: "1.375rem", height: "1.375rem", color: "var(--cp-border-strong)", margin: "0 auto 0.4rem" }} />
              <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", margin: 0 }}>No skills listed yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}