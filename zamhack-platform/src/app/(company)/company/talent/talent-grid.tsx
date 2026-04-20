"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import {
  Search,
  Loader2,
  GraduationCap,
  Trophy,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  ExternalLink,
  MessageCircle,
  BookOpen,
  Sparkles,
} from "lucide-react"
import type { StudentWithStats } from "./page"
import { MessageModal } from "./message-modal"
import { getRankTitle } from "@/lib/rank-titles"

interface TalentGridProps {
  initialStudents: StudentWithStats[]
  isCacheStale?: boolean
  companyUserId?: string
}

const PAGE_SIZE = 9

const SORT_OPTIONS = [
  { value: "match",     label: "Best Match" },
  { value: "newest",    label: "Newest First" },
  { value: "name",      label: "Name A–Z" },
  { value: "completed", label: "Most Experienced" },
  { value: "active",    label: "Most Active" },
]

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

const RANK_COLOR: Record<string, {
  color: string; bg: string;
  gradient: string; border: string; shadow: string; shadowHover: string; borderHover: string;
}> = {
  beginner:     { color: "#64748B", bg: "rgba(100,116,139,0.10)", gradient: "linear-gradient(90deg, #94A3B8, #64748B)", border: "rgba(100,116,139,0.30)", shadow: "0 2px 10px rgba(100,116,139,0.12)", shadowHover: "0 8px 24px rgba(100,116,139,0.22)", borderHover: "#94A3B8" },
  intermediate: { color: "#0EA5E9", bg: "rgba(14,165,233,0.10)",  gradient: "linear-gradient(90deg, #38BDF8, #0EA5E9)", border: "rgba(14,165,233,0.30)",  shadow: "0 2px 10px rgba(14,165,233,0.12)",  shadowHover: "0 8px 24px rgba(14,165,233,0.22)",  borderHover: "#38BDF8"  },
  advanced:     { color: "#FF9B87", bg: "rgba(255,155,135,0.12)", gradient: "linear-gradient(90deg, #FF9B87, #E8836F)", border: "rgba(255,155,135,0.40)", shadow: "0 2px 10px rgba(255,155,135,0.15)", shadowHover: "0 8px 24px rgba(255,155,135,0.28)", borderHover: "#FF9B87"  },
}

export function TalentGrid({ initialStudents, isCacheStale, companyUserId }: TalentGridProps) {
  const [students, setStudents] = useState<StudentWithStats[]>(initialStudents)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("match")
  const [filterExperience, setFilterExperience] = useState<"all" | "experienced" | "active" | "new">("all")
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [isScoring, setIsScoring] = useState(false)

  // Messaging state
  const [messagingStudent, setMessagingStudent] = useState<StudentWithStats | null>(null)

  // Cached baseline scores — updated after the recommend fetch, never by search scoring
  const cachedScoresRef = useRef<Map<string, number>>(
    new Map(initialStudents.map((s) => [s.id, s.matchScore ?? 0]))
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch match scores on mount
  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const res = await fetch("/api/talent/recommend")
        if (!res.ok) return
        const data = await res.json()
        if (data.students && Array.isArray(data.students)) {
          // Build a map of id -> matchScore
          const scoreMap = new Map<string, number>()
          for (const s of data.students) {
            if (s.id && typeof s.matchScore === "number") {
              scoreMap.set(s.id, s.matchScore)
            }
          }
          // Merge matchScore into students — only update if new score is higher
          setStudents((prev) => {
            const updated = prev.map((student) => {
              const newScore = scoreMap.get(student.id)
              if (newScore == null) return student
              const existing = student.matchScore ?? 0
              return { ...student, matchScore: Math.max(existing, newScore) }
            })
            // Persist merged scores as the new cached baseline
            for (const s of updated) cachedScoresRef.current.set(s.id, s.matchScore ?? 0)
            return updated
          })
        }
        console.log("[talent-grid] recommend API response:", data)
      } catch (err) {
        console.log("[talent-grid] recommend API error:", err)
      }
    }
    fetchRecommendations()
  }, [])

  // Debounced skill-based search scoring
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = search.trim()

    if (trimmed.length === 0) {
      // Revert to cached baseline scores
      setStudents((prev) =>
        prev.map((s) => ({ ...s, matchScore: cachedScoresRef.current.get(s.id) ?? s.matchScore }))
      )
      return
    }

    if (trimmed.length < 3) return

    debounceRef.current = setTimeout(async () => {
      // Send the full phrase as a single item — substring matching in compute-match-score
      // handles both single-word ("python") and multi-word ("social media marketing") queries
      const requiredSkills = [trimmed]
      setIsScoring(true)
      try {
        const url = "/api/talent/match"
        const body = JSON.stringify({ requiredSkills })
        console.log("[talent-grid] match fetch →", url, body)
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })
        console.log("[talent-grid] match fetch ←", res.status, res.statusText)
        if (!res.ok) return
        const data = await res.json()
        if (data.students && Array.isArray(data.students)) {
          const scoreMap = new Map<string, number>()
          for (const s of data.students) {
            if (s.id && typeof s.matchScore === "number") scoreMap.set(s.id, s.matchScore)
          }
          setStudents((prev) =>
            prev.map((student) => {
              const newScore = scoreMap.get(student.id)
              if (newScore == null) return student
              // Math.max against cached baseline — race-condition safe
              const cached = cachedScoresRef.current.get(student.id) ?? 0
              return { ...student, matchScore: Math.max(cached, newScore) }
            })
          )
          // Refresh the talent_match_cache for each re-scored student so the
          // baseline cache stays in sync with the latest computed scores
          for (const s of data.students) {
            if (s.id) {
              fetch("/api/talent/recompute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId: s.id }),
              }).catch(() => {})
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setIsScoring(false)
      }
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Fire AI enrichment in the background when cache is stale
  useEffect(() => {
    if (!isCacheStale || !companyUserId) return
    fetch("/api/talent/ai-enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyUserId }),
    }).catch(() => {})
  }, [isCacheStale, companyUserId])

  // "Top Talent for You" — top 6 students by score (no minimum threshold)
  const topTalent = useMemo(
    () =>
      [...students]
        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
        .slice(0, 6),
    [students]
  )
  const topTalentIds = useMemo(() => new Set(topTalent.map((s) => s.id)), [topTalent])

  const isSearching = search.trim().length > 0
  const isApiSearch = search.trim().length >= 3

  const filtered = useMemo(() => {
    // When searching, include all students (including top talent); otherwise exclude top talent
    let list = isSearching ? [...students] : students.filter((s) => !topTalentIds.has(s.id))

    if (isSearching && !isApiSearch) {
      // Short query (1–2 chars): use text filter while waiting for API threshold
      const q = search.toLowerCase()
      list = list.filter((s) => {
        const name        = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase()
        const bio         = (s.bio || "").toLowerCase()
        const uni         = (s.university || "").toLowerCase()
        const degree      = (s.degree || "").toLowerCase()
        const matchReason = (s.matchReason || "").toLowerCase()
        return name.includes(q) || bio.includes(q) || uni.includes(q) || degree.includes(q) || matchReason.includes(q)
      })
    }
    // For isApiSearch (3+ chars): show all students — skill scoring drives the ranking

    if (filterExperience === "experienced") list = list.filter((s) => s.completedChallenges > 0)
    if (filterExperience === "active")      list = list.filter((s) => s.activeChallenges > 0)
    if (filterExperience === "new")         list = list.filter((s) => s.completedChallenges === 0 && s.activeChallenges === 0)

    // When searching, always sort by match score descending
    if (isSearching) {
      list.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      return list
    }

    switch (sortBy) {
      case "match":
        list.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
        break
      case "name":
        list.sort((a, b) => {
          const an = `${a.first_name || ""} ${a.last_name || ""}`.toLowerCase()
          const bn = `${b.first_name || ""} ${b.last_name || ""}`.toLowerCase()
          return an.localeCompare(bn)
        })
        break
      case "completed":
        list.sort((a, b) => b.completedChallenges - a.completedChallenges)
        break
      case "active":
        list.sort((a, b) => b.activeChallenges - a.activeChallenges)
        break
      default:
        list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    }

    return list
  }, [students, topTalentIds, isSearching, isApiSearch, search, sortBy, filterExperience])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const resetPage  = () => setPage(1)

  const activeFiltersCount = filterExperience !== "all" ? 1 : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* ── Top Talent for You ── */}
      {topTalent.length > 0 && !isSearching && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles style={{ width: "1.125rem", height: "1.125rem", color: "var(--cp-coral)" }} />
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--cp-navy)" }}>
              Top Talent for You
            </p>
            <span style={{
              padding: "0.125rem 0.625rem",
              borderRadius: "99px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "var(--cp-coral-muted)",
              color: "var(--cp-coral-dark)",
            }}>
              {topTalent.length} strong match{topTalent.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div
            className="talent-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}
          >
            {topTalent.map((student) => {
              const name          = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student"
              const initials      = getInitials(student.first_name, student.last_name)
              const gradient      = avatarGradient(name)
              const headline      = [student.degree, student.university].filter(Boolean).join(" · ")
              const hasExperience = student.completedChallenges > 0
              const rc            = RANK_COLOR[student.highestTier ?? "beginner"] ?? RANK_COLOR.beginner

              return (
                <div
                  key={student.id}
                  style={{
                    background: rc.bg,
                    border: `2px solid ${rc.border}`,
                    borderRadius: "var(--cp-radius-xl, 20px)",
                    overflow: "hidden",
                    boxShadow: rc.shadow,
                    transition: "all 0.25s ease",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.transform   = "translateY(-3px)"
                    el.style.boxShadow   = rc.shadowHover
                    el.style.borderColor = rc.borderHover
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.transform   = "translateY(0)"
                    el.style.boxShadow   = rc.shadow
                    el.style.borderColor = rc.border
                  }}
                >
                  <div style={{ height: "6px", background: rc.gradient }} />
                  <div style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                      {student.avatar_url ? (
                        <img
                          src={student.avatar_url}
                          alt={name}
                          style={{
                            width: "3rem", height: "3rem", borderRadius: "50%",
                            objectFit: "cover", flexShrink: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "3rem", height: "3rem", borderRadius: "50%",
                          background: gradient, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1rem", fontWeight: 700, color: "white",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        }}>
                          {initials}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontWeight: 700, fontSize: "0.9375rem",
                          color: "var(--cp-navy)", lineHeight: 1.2,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {name}
                        </p>
                        {headline && (
                          <p style={{
                            fontSize: "0.75rem", color: "var(--cp-text-muted)",
                            marginTop: "0.2rem", lineHeight: 1.3,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            <GraduationCap style={{ width: "0.75rem", height: "0.75rem", display: "inline", marginRight: "0.25rem", verticalAlign: "middle" }} />
                            {headline}
                          </p>
                        )}
                      </div>
                    </div>
                    {student.highestTier && (() => {
                      const rc = RANK_COLOR[student.highestTier] ?? RANK_COLOR.beginner
                      return (
                        <span style={{
                          display: "inline-block",
                          padding: "0.2rem 0.625rem",
                          borderRadius: "99px",
                          fontSize: "0.7rem", fontWeight: 700,
                          background: rc.bg,
                          color: rc.color,
                          width: "fit-content",
                        }}>
                          {getRankTitle(student.highestTier)}
                        </span>
                      )
                    })()}
                    {student.bio && (
                      <p style={{
                        fontSize: "0.8125rem", color: "var(--cp-text-secondary)",
                        lineHeight: 1.55,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {student.bio}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "99px",
                        fontSize: "0.75rem", fontWeight: 600,
                        background: (student.matchScore ?? 0) >= 40 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                        color: (student.matchScore ?? 0) >= 40 ? "#059669" : "#D97706",
                      }}>
                        <Sparkles style={{ width: "0.7rem", height: "0.7rem" }} />
                        {student.matchScore}% match
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "99px",
                        fontSize: "0.75rem", fontWeight: 600,
                        background: hasExperience ? "var(--cp-coral-muted)" : "var(--cp-border)",
                        color: hasExperience ? "var(--cp-coral-dark)" : "var(--cp-text-muted)",
                      }}>
                        <Trophy style={{ width: "0.7rem", height: "0.7rem" }} />
                        {student.completedChallenges} completed
                      </span>
                      {student.activeChallenges > 0 && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "0.3rem",
                          padding: "0.25rem 0.625rem",
                          borderRadius: "99px",
                          fontSize: "0.75rem", fontWeight: 600,
                          background: "rgba(99,102,241,0.1)",
                          color: "#4F46E5",
                        }}>
                          <BookOpen style={{ width: "0.7rem", height: "0.7rem" }} />
                          {student.activeChallenges} active
                        </span>
                      )}
                    </div>
                    {student.matchReason && (
                      <p style={{
                        fontSize: "0.75rem",
                        fontStyle: "italic",
                        color: "var(--cp-text-muted)",
                        lineHeight: 1.4,
                        marginTop: "-0.25rem",
                      }}>
                        {student.matchReason}
                      </p>
                    )}
                  </div>
                  <div style={{
                    padding: "0.875rem 1.25rem",
                    borderTop: "1px solid var(--cp-border)",
                    display: "flex",
                    gap: "0.5rem",
                    background: "transparent",
                  }}>
                    <Link
                      href={`/company/talent/${student.id}`}
                      className="cp-btn cp-btn-ghost cp-btn-sm"
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <ExternalLink style={{ width: "0.875rem", height: "0.875rem" }} />
                      View Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMessagingStudent(student)}
                      className="cp-btn cp-btn-primary cp-btn-sm"
                      aria-label={`Message ${name}`}
                      title={`Send message to ${name}`}
                      style={{ gap: "0.375rem", paddingInline: "0.875rem" }}
                    >
                      <MessageCircle style={{ width: "0.875rem", height: "0.875rem" }} />
                      Message
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--cp-border)", margin: "0.25rem 0" }} />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>

        {/* Search */}
        <div style={{ flex: "1", minWidth: "200px", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div className="cp-search-wrapper">
            {isScoring ? (
              <Loader2
                className="cp-search-icon"
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Search className="cp-search-icon" />
            )}
            <input
              className="cp-search-input"
              type="text"
              placeholder="Search by name, skill, degree... (3+ chars for smart scoring)"
              value={search}
              aria-label="Search students"
              onChange={(e) => { setSearch(e.target.value); resetPage() }}
            />
          </div>
          {isScoring && (
            <p style={{ fontSize: "0.7rem", color: "var(--cp-coral-dark)", paddingLeft: "0.25rem", fontWeight: 600 }}>
              Scoring students by skill match…
            </p>
          )}
          {isSearching && !isScoring && isApiSearch && (
            <p style={{ fontSize: "0.7rem", color: "var(--cp-text-muted)", paddingLeft: "0.25rem" }}>
              Showing results scored by skill match
            </p>
          )}
          {isSearching && !isApiSearch && (
            <p style={{ fontSize: "0.7rem", color: "var(--cp-text-muted)", paddingLeft: "0.25rem" }}>
              Showing results sorted by match score
            </p>
          )}
        </div>

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-label={showFilters ? "Hide filters" : "Show filters"}
          className="cp-btn cp-btn-ghost"
          style={{
            gap: "0.5rem",
            borderColor: activeFiltersCount > 0 ? "var(--cp-coral)"      : undefined,
            color:       activeFiltersCount > 0 ? "var(--cp-coral-dark)" : undefined,
          } as CSSProperties}
        >
          <SlidersHorizontal style={{ width: "1rem", height: "1rem" }} />
          Filters
          {activeFiltersCount > 0 && (
            <span style={{
              minWidth: "1.25rem", height: "1.25rem", borderRadius: "99px",
              background: "var(--cp-coral)", color: "white",
              fontSize: "0.6875rem", fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0 0.3rem",
            }}>
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Sort */}
        <label htmlFor="talent-sort" style={{ display: "none" }}>Sort students</label>
        <select
          id="talent-sort"
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); resetPage() }}
          className="cp-input"
          style={{ width: "auto", minWidth: "160px", padding: "0.5rem 0.875rem" } as CSSProperties}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Result count */}
        <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 700, color: "var(--cp-navy)" }}>{filtered.length}</span> students found
        </p>
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <div className="cp-card" style={{ padding: "1.25rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--cp-navy)" }}>Filter By</p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => { setFilterExperience("all"); resetPage() }}
                aria-label="Clear all filters"
                style={{
                  fontSize: "0.75rem", color: "var(--cp-coral-dark)", fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer" as CSSProperties["cursor"],
                  display: "flex", alignItems: "center", gap: "0.25rem",
                } as CSSProperties}
              >
                <X style={{ width: "0.75rem", height: "0.75rem" }} /> Clear all
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p style={{
              fontSize: "0.75rem", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.07em",
              color: "var(--cp-text-muted)",
            }}>
              Experience Level
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["all", "experienced", "active", "new"] as const).map((val) => {
                const labels: Record<typeof val, string> = {
                  all:         "All Students",
                  experienced: "Has Completed Challenges",
                  active:      "Currently Active",
                  new:         "New / No Challenges",
                }
                const isActive = filterExperience === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setFilterExperience(val); resetPage() }}
                    aria-label={`${labels[val]}${isActive ? ", selected" : ""}`}
                    style={{
                      padding: "0.375rem 0.875rem",
                      borderRadius: "99px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      border: "1.5px solid",
                      cursor: "pointer" as CSSProperties["cursor"],
                      transition: "all 0.15s ease",
                      borderColor: isActive ? "var(--cp-coral)"       : "var(--cp-border-strong)",
                      background:  isActive ? "var(--cp-coral-muted)" : "transparent",
                      color:       isActive ? "var(--cp-coral-dark)"  : "var(--cp-text-secondary)",
                    } as CSSProperties}
                  >
                    {labels[val]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {paginated.length === 0 ? (
        <div className="cp-card">
          <div className="cp-empty-state">
            <div className="cp-empty-icon">
              <Search style={{ width: "1.5rem", height: "1.5rem" }} />
            </div>
            <p className="cp-empty-title">No students found</p>
            <p className="cp-empty-desc">
              {search
                ? `No results for "${search}". Try a different search term.`
                : "No students match your current filters."}
            </p>
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterExperience("all"); resetPage() }}
              className="cp-btn cp-btn-outline"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <div
          className="talent-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}
        >
          {paginated.map((student) => {
            const name          = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student"
            const initials      = getInitials(student.first_name, student.last_name)
            const gradient      = avatarGradient(name)
            const headline      = [student.degree, student.university].filter(Boolean).join(" · ")
            const hasExperience = student.completedChallenges > 0
            const rc            = RANK_COLOR[student.highestTier ?? "beginner"] ?? RANK_COLOR.beginner

            return (
              <div
                key={student.id}
                style={{
                  background: rc.bg,
                  border: `1px solid ${rc.border}`,
                  borderRadius: "var(--cp-radius-xl, 20px)",
                  overflow: "hidden",
                  boxShadow: rc.shadow,
                  transition: "all 0.25s ease",
                  display: "flex",
                  flexDirection: "column",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.transform   = "translateY(-3px)"
                  el.style.boxShadow   = rc.shadowHover
                  el.style.borderColor = rc.borderHover
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.transform   = "translateY(0)"
                  el.style.boxShadow   = rc.shadow
                  el.style.borderColor = rc.border
                }}
              >
                {/* Accent strip */}
                <div style={{ height: "6px", background: rc.gradient }} />

                {/* Body */}
                <div style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>

                  {/* Avatar + Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                    {student.avatar_url ? (
                      <img
                        src={student.avatar_url}
                        alt={name}
                        style={{
                          width: "3rem", height: "3rem", borderRadius: "50%",
                          objectFit: "cover", flexShrink: 0,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                      />
                    ) : (
                      <div style={{
                        width: "3rem", height: "3rem", borderRadius: "50%",
                        background: gradient, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1rem", fontWeight: 700, color: "white",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      }}>
                        {initials}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 700, fontSize: "0.9375rem",
                        color: "var(--cp-navy)", lineHeight: 1.2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {name}
                      </p>
                      {headline && (
                        <p style={{
                          fontSize: "0.75rem", color: "var(--cp-text-muted)",
                          marginTop: "0.2rem", lineHeight: 1.3,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          <GraduationCap style={{ width: "0.75rem", height: "0.75rem", display: "inline", marginRight: "0.25rem", verticalAlign: "middle" }} />
                          {headline}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rank title */}
                  {student.highestTier && (() => {
                    const rc = RANK_COLOR[student.highestTier] ?? RANK_COLOR.beginner
                    return (
                      <span style={{
                        display: "inline-block",
                        padding: "0.2rem 0.625rem",
                        borderRadius: "99px",
                        fontSize: "0.7rem", fontWeight: 700,
                        background: rc.bg,
                        color: rc.color,
                        width: "fit-content",
                      }}>
                        {getRankTitle(student.highestTier)}
                      </span>
                    )
                  })()}

                  {/* Bio */}
                  {student.bio && (
                    <p style={{
                      fontSize: "0.8125rem", color: "var(--cp-text-secondary)",
                      lineHeight: 1.55,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {student.bio}
                    </p>
                  )}

                  {/* Stats */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {student.matchScore != null && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "99px",
                        fontSize: "0.75rem", fontWeight: 600,
                        background: student.matchScore >= 40 ? "rgba(16,185,129,0.15)" :
                                    student.matchScore >= 25 ? "rgba(245,158,11,0.15)" :
                                    "var(--cp-border)",
                        color: student.matchScore >= 40 ? "#059669" :
                               student.matchScore >= 25 ? "#D97706" :
                               "var(--cp-text-muted)",
                      }}>
                        <Sparkles style={{ width: "0.7rem", height: "0.7rem" }} />
                        {student.matchScore}% match
                      </span>
                    )}
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      padding: "0.25rem 0.625rem",
                      borderRadius: "99px",
                      fontSize: "0.75rem", fontWeight: 600,
                      background: hasExperience ? "var(--cp-coral-muted)" : "var(--cp-border)",
                      color: hasExperience ? "var(--cp-coral-dark)" : "var(--cp-text-muted)",
                    }}>
                      <Trophy style={{ width: "0.7rem", height: "0.7rem" }} />
                      {student.completedChallenges} completed
                    </span>

                    {student.activeChallenges > 0 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "99px",
                        fontSize: "0.75rem", fontWeight: 600,
                        background: "rgba(99,102,241,0.1)",
                        color: "#4F46E5",
                      }}>
                        <BookOpen style={{ width: "0.7rem", height: "0.7rem" }} />
                        {student.activeChallenges} active
                      </span>
                    )}
                  </div>

                  {/* AI match reason */}
                  {student.matchReason && (
                    <p style={{
                      fontSize: "0.75rem",
                      fontStyle: "italic",
                      color: "var(--cp-text-muted)",
                      lineHeight: 1.4,
                      marginTop: "-0.25rem",
                    }}>
                      {student.matchReason}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div style={{
                  padding: "0.875rem 1.25rem",
                  borderTop: "1px solid var(--cp-border)",
                  display: "flex",
                  gap: "0.5rem",
                  background: "var(--cp-background, #fafafa)",
                }}>
                  <Link
                    href={`/company/talent/${student.id}`}
                    className="cp-btn cp-btn-ghost cp-btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <ExternalLink style={{ width: "0.875rem", height: "0.875rem" }} />
                    View Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMessagingStudent(student)}
                    className="cp-btn cp-btn-primary cp-btn-sm"
                    aria-label={`Message ${name}`}
                    title={`Send message to ${name}`}
                    style={{
                      gap: "0.375rem",
                      paddingInline: "0.875rem",
                    }}
                  >
                    <MessageCircle style={{ width: "0.875rem", height: "0.875rem" }} />
                    Message
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 0", gap: "1rem", flexWrap: "wrap",
        }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)" }}>
            Showing{" "}
            <span style={{ fontWeight: 700, color: "var(--cp-navy)" }}>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
            </span>
            {" "}of{" "}
            <span style={{ fontWeight: 700, color: "var(--cp-navy)" }}>{filtered.length}</span>
            {" "}students
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="cp-btn cp-btn-ghost cp-btn-sm cp-btn-icon"
              style={{
                opacity: safePage === 1 ? 0.4 : 1,
                cursor: (safePage === 1 ? "not-allowed" : "pointer") as CSSProperties["cursor"],
              }}
            >
              <ChevronLeft style={{ width: "1rem", height: "1rem" }} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true
                if (p === 1 || p === totalPages) return true
                if (Math.abs(p - safePage) <= 1) return true
                return false
              })
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push("…")
                }
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{ padding: "0 0.25rem", color: "var(--cp-text-muted)", fontSize: "0.875rem" }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p as number)}
                    aria-label={`Page ${p}`}
                    aria-current={safePage === p ? "page" : undefined}
                    style={{
                      minWidth: "2rem", height: "2rem",
                      padding: "0 0.5rem",
                      borderRadius: "var(--cp-radius-md, 12px)",
                      fontSize: "0.8125rem", fontWeight: 600,
                      border: "none",
                      cursor: "pointer" as CSSProperties["cursor"],
                      transition: "all 0.15s ease",
                      background: safePage === p ? "var(--cp-coral)"  : "transparent",
                      color:      safePage === p ? "white"            : "var(--cp-text-secondary)",
                      boxShadow:  safePage === p ? "0 2px 8px rgba(255,155,135,0.4)" : "none",
                    } as CSSProperties}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="cp-btn cp-btn-ghost cp-btn-sm cp-btn-icon"
              style={{
                opacity: safePage === totalPages ? 0.4 : 1,
                cursor: (safePage === totalPages ? "not-allowed" : "pointer") as CSSProperties["cursor"],
              }}
            >
              <ChevronRight style={{ width: "1rem", height: "1rem" }} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .talent-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 640px)  { .talent-grid { grid-template-columns: 1fr !important; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Message Modal ── */}
      {messagingStudent && (
        <MessageModal
          student={messagingStudent}
          onClose={() => setMessagingStudent(null)}
        />
      )}
    </div>
  )
}