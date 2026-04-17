"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import {
  SlidersHorizontal,
  X,
  Download,
  Users2,
  FileCheck2,
  Star,
  TrendingUp,
  BarChart3,
} from "lucide-react"
import { parse, isValid } from "date-fns"
import { exportAnalyticsPDF } from "@/components/company/analytics-pdf"
import {
  TopSchoolsChart,
  TopSkillsChart,
  ChallengeComparisonChart,
  SubmissionsOverTimeChart,
  DegreeBreakdownChart,
  type TopSchool,
  type TopSkill,
  type ChallengePerf,
  type WeeklySubmission,
  type DegreeSlice,
} from "@/components/company/analytics-charts"
import { ChallengePerformanceTable } from "@/components/company/challenge-performance-table"

// ── Types ──────────────────────────────────────────────────────────────────

interface ChallengeRef {
  id: string
  title: string
  status: string | null
}

export interface AnalyticsData {
  orgName: string
  challenges: ChallengeRef[]
  overview: {
    totalParticipants: number
    totalSubmissions: number
    avgScore: number | null
    completionRate: number
  }
  topSchools: TopSchool[]
  topSkills: TopSkill[]
  challengePerformance: ChallengePerf[]
  submissionsOverTime: WeeklySubmission[]
  degreeBreakdown: DegreeSlice[]
}

// ChallengePerf enriched with id+status for client-side filtering.
// challengePerformance[i] is always built from challenges[i] in the server
// function, so the index-based join is safe without title collision risk.
type EnrichedChallengePerf = ChallengePerf & { _id: string; _status: string }

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_STATUSES: { value: string; label: string }[] = [
  { value: "draft",            label: "Draft"            },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved",         label: "Approved"         },
  { value: "in_progress",      label: "In Progress"      },
  { value: "under_review",     label: "Under Review"     },
  { value: "completed",        label: "Completed"        },
  { value: "cancelled",        label: "Cancelled"        },
]

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse week-bucket labels produced by
 *   d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
 * back to a Date. Adjusts year if the result is more than 7 days in the
 * future — handles year-boundary labels (e.g. "Dec 27" in early January).
 */
function parseWeekLabel(label: string): Date | null {
  const now = new Date()
  const d   = parse(label, "MMM d", now)
  if (!isValid(d)) return null
  if (d.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) {
    const adjusted = new Date(d)
    adjusted.setFullYear(adjusted.getFullYear() - 1)
    return adjusted
  }
  return d
}

/** Format an ISO date string (yyyy-MM-dd) for display in filter chips. */
function formatDateDisplay(iso: string): string {
  if (!iso) return ""
  // Append time so the Date is parsed in local time, not UTC midnight
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {

  // ── Filter state ────────────────────────────────────────────────────────

  const [dateFrom,             setDateFrom]             = useState<string>("")
  const [dateTo,               setDateTo]               = useState<string>("")
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([])
  const [selectedStatuses,     setSelectedStatuses]     = useState<string[]>([])
  const [filterPanelOpen,      setFilterPanelOpen]      = useState(false)
  const [exporting,            setExporting]            = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)

  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportAnalyticsPDF({
        orgName: data.orgName,
        filters: {
          dateFrom: dateFrom ? new Date(dateFrom + "T00:00:00") : null,
          dateTo:   dateTo   ? new Date(dateTo   + "T00:00:00") : null,
          selectedChallengeIds,
          selectedStatuses,
        },
        overview: displayOverview,
        challengePerformance: filteredChallengePerformance,
        topSchools: data.topSchools,
        topSkills: data.topSkills.map(s => ({
          name:         s.skill,
          beginner:     s.beginner,
          intermediate: s.intermediate,
          advanced:     s.advanced,
        })),
        submissionsOverTime: filteredSubmissionsOverTime,
      })
    } finally {
      setExporting(false)
    }
  }

  // Escape key closes the panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterPanelOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  // ── Enrich challengePerformance with id + status ─────────────────────────
  // getAnalyticsData builds challengePerformance via challenges.map(...),
  // so index i in challengePerformance always corresponds to index i in
  // challenges. No title-collision risk.
  const enrichedChallengePerformance = useMemo<EnrichedChallengePerf[]>(() => {
    return data.challengePerformance.map((perf, i) => ({
      ...perf,
      _id:     data.challenges[i]?.id     ?? "",
      _status: data.challenges[i]?.status ?? "",
    }))
  }, [data.challengePerformance, data.challenges])

  // ── Active filter count (for badge + button style) ───────────────────────

  const activeFilterCount =
    (dateFrom ? 1 : 0) +
    (dateTo   ? 1 : 0) +
    selectedChallengeIds.length +
    selectedStatuses.length

  // ── Filter: challengePerformance by challenge + status ───────────────────

  const filteredEnrichedPerf = useMemo<EnrichedChallengePerf[]>(() => {
    let list = enrichedChallengePerformance

    if (selectedChallengeIds.length > 0) {
      list = list.filter(c => selectedChallengeIds.includes(c._id))
    }
    if (selectedStatuses.length > 0) {
      list = list.filter(c => selectedStatuses.includes(c._status))
    }
    return list
  }, [enrichedChallengePerformance, selectedChallengeIds, selectedStatuses])

  // Strip the internal _id/_status before passing to chart/table components
  const filteredChallengePerformance = useMemo<ChallengePerf[]>(() => {
    return filteredEnrichedPerf.map(
      ({ title, participants, submissions, avgScore, completionRate }): ChallengePerf => ({
        title, participants, submissions, avgScore, completionRate,
      })
    )
  }, [filteredEnrichedPerf])

  // ── Recompute overview, switching to server value when no filter active ────
  // Uses filteredEnrichedPerf directly so deps are precise per spec.
  // When no challenge/status filter is active, returns the server-computed
  // overview (exact participant deduplication; client can only approximate).
  const displayOverview = useMemo(() => {
    if (selectedChallengeIds.length === 0 && selectedStatuses.length === 0) {
      return data.overview
    }
    const list = filteredEnrichedPerf
    if (list.length === 0) {
      return { totalParticipants: 0, totalSubmissions: 0, avgScore: null as number | null, completionRate: 0 }
    }
    const totalParticipants = list.reduce((s, c) => s + c.participants, 0)
    const totalSubmissions  = list.reduce((s, c) => s + c.submissions,  0)
    const scored = list.filter(c => c.avgScore !== null)
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, c) => s + (c.avgScore ?? 0), 0) / scored.length)
      : null
    // Weighted completion rate: Σ(rate × participants) / Σparticipants
    const completionRate = totalParticipants > 0
      ? Math.round(list.reduce((s, c) => s + c.completionRate * c.participants, 0) / totalParticipants)
      : 0
    return { totalParticipants, totalSubmissions, avgScore, completionRate }
  }, [filteredEnrichedPerf, data.overview, selectedChallengeIds, selectedStatuses])

  // ── Filter: submissionsOverTime by date range ────────────────────────────
  // Buckets outside the range have their count zeroed (preserving the x-axis
  // shape) rather than being removed, so the time axis stays consistent.
  // Note: submission activity is not filtered by challenge selection because
  // the server aggregated it across all challenges without per-challenge keys.
  const filteredSubmissionsOverTime = useMemo<WeeklySubmission[]>(() => {
    if (!dateFrom && !dateTo) return data.submissionsOverTime

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null
    const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null

    return data.submissionsOverTime.map(item => {
      const d = parseWeekLabel(item.week)
      if (!d) return item                         // unparseable label — keep as-is
      if (from && d < from) return { ...item, count: 0 }
      if (to   && d > to  ) return { ...item, count: 0 }
      return item
    })
  }, [data.submissionsOverTime, dateFrom, dateTo])

  // ── Toggle helpers ───────────────────────────────────────────────────────

  const toggleChallengeId = (id: string) => {
    setSelectedChallengeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(x => x !== status) : [...prev, status]
    )
  }

  const clearAllFilters = () => {
    setDateFrom("")
    setDateTo("")
    setSelectedChallengeIds([])
    setSelectedStatuses([])
  }

  // ── Stat cards ───────────────────────────────────────────────────────────

  const statCards = [
    { label: "Unique Participants", value: String(displayOverview.totalParticipants), icon: Users2 },
    { label: "Total Submissions",   value: String(displayOverview.totalSubmissions),   icon: FileCheck2 },
    { label: "Avg Score",           value: displayOverview.avgScore !== null ? String(displayOverview.avgScore) : "N/A", icon: Star },
    { label: "Completion Rate",     value: `${displayOverview.completionRate}%`, icon: TrendingUp },
  ]

  // ── Derived subtitle helpers ─────────────────────────────────────────────

  const challengeFilterActive = selectedChallengeIds.length > 0 || selectedStatuses.length > 0
  const comparisonSubtitle = challengeFilterActive
    ? `Filtered · ${filteredChallengePerformance.length} challenge${filteredChallengePerformance.length !== 1 ? "s" : ""}`
    : "Participants vs submissions per challenge"
  const activitySubtitle = (dateFrom || dateTo)
    ? "Weekly submissions · filtered by date range"
    : "Weekly submissions over the last 8 weeks"
  // topSchools / topSkills / degreeBreakdown are always full-org (server
  // aggregated without per-challenge breakdown), so note when a challenge
  // filter is active so the user isn't confused.
  const demographicSubtitleNote = challengeFilterActive ? " · all challenges" : ""

  // ── Empty state ──────────────────────────────────────────────────────────

  if (data.challenges.length === 0) {
    return (
      <div className="cp-page">
        <div className="cp-analytics-empty">
          <BarChart3 className="cp-analytics-empty-icon" style={{ width: "3rem", height: "3rem" }} />
          <p className="cp-analytics-empty-title">No analytics data yet</p>
          <p className="cp-analytics-empty-text">
            Create and activate challenges to start seeing analytics here.
          </p>
          <Link href="/company/challenges" className="cp-btn cp-btn-primary">
            Go to Challenges
          </Link>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Backdrop — closes panel on outside click ── */}
      {filterPanelOpen && (
        <div
          aria-hidden="true"
          className="cp-filter-backdrop"
          onClick={() => setFilterPanelOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--cp-backdrop)",
            zIndex: 40,
          }}
        />
      )}

      {/* ── Filter drawer ── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Analytics filters"
        aria-modal="true"
        className="cp-filter-drawer"
        style={{
          position:    "fixed",
          top:         0,
          right:       0,
          bottom:      0,
          width:       340,
          background:  "var(--cp-white)",
          borderLeft:  "1px solid var(--cp-border)",
          borderRadius:"var(--cp-radius-xl) 0 0 var(--cp-radius-xl)",
          boxShadow:   "var(--cp-shadow-lg)",
          zIndex:      50,
          transform:   filterPanelOpen ? "translateX(0)" : "translateX(100%)",
          transition:  "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          display:     "flex",
          flexDirection: "column",
          overflow:    "hidden",
        }}
      >
        {/* Panel — header */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "1.25rem 1.5rem",
          borderBottom:   "1px solid var(--cp-border)",
          flexShrink:     0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <SlidersHorizontal style={{ width: 18, height: 18, color: "var(--cp-coral)" }} />
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--cp-navy)" }}>
              Filters
            </span>
            {activeFilterCount > 0 && (
              <span style={{
                display:         "inline-flex",
                alignItems:      "center",
                justifyContent:  "center",
                width:           20,
                height:          20,
                borderRadius:    99,
                background:      "var(--cp-coral)",
                color:           "var(--cp-white)",
                fontSize:        "0.6875rem",
                fontWeight:      700,
              }}>
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setFilterPanelOpen(false)}
            aria-label="Close filters"
            style={{
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              width:           32,
              height:          32,
              borderRadius:    "var(--cp-radius-md)",
              border:          "1.5px solid var(--cp-border)",
              background:      "var(--cp-white)",
              cursor:          "pointer",
              color:           "var(--cp-text-muted)",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Panel — scrollable body */}
        <div
          className="cp-scrollable"
          style={{
            flex:          1,
            overflowY:     "auto",
            padding:       "1.25rem 1.5rem",
            display:       "flex",
            flexDirection: "column",
            gap:           "1.75rem",
          }}
        >

          {/* ── Date Range ── */}
          <section>
            <p style={{
              fontSize:      "0.75rem",
              fontWeight:    700,
              color:         "var(--cp-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom:  "0.75rem",
            }}>
              Date Range
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <div>
                <label style={{
                  display:      "block",
                  fontSize:     "0.8125rem",
                  fontWeight:   600,
                  color:        "var(--cp-navy)",
                  marginBottom: "0.25rem",
                }}>
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{
                    width:        "100%",
                    padding:      "0.5rem 0.75rem",
                    borderRadius: "var(--cp-radius-md)",
                    border:       "1.5px solid var(--cp-border-strong)",
                    background:   "var(--cp-white)",
                    fontSize:     "0.875rem",
                    color:        "var(--cp-text-primary)",
                    outline:      "none",
                    cursor:       "pointer",
                    boxSizing:    "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{
                  display:      "block",
                  fontSize:     "0.8125rem",
                  fontWeight:   600,
                  color:        "var(--cp-navy)",
                  marginBottom: "0.25rem",
                }}>
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    width:        "100%",
                    padding:      "0.5rem 0.75rem",
                    borderRadius: "var(--cp-radius-md)",
                    border:       "1.5px solid var(--cp-border-strong)",
                    background:   "var(--cp-white)",
                    fontSize:     "0.875rem",
                    color:        "var(--cp-text-primary)",
                    outline:      "none",
                    cursor:       "pointer",
                    boxSizing:    "border-box",
                  }}
                />
              </div>
            </div>
          </section>

          {/* ── Challenges checklist ── */}
          {data.challenges.length > 0 && (
            <section>
              <div style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                marginBottom:   "0.75rem",
              }}>
                <p style={{
                  fontSize:      "0.75rem",
                  fontWeight:    700,
                  color:         "var(--cp-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}>
                  Challenges
                </p>
                {selectedChallengeIds.length > 0 && (
                  <button
                    onClick={() => setSelectedChallengeIds([])}
                    style={{
                      fontSize:   "0.75rem",
                      color:      "var(--cp-coral-dark)",
                      background: "none",
                      border:     "none",
                      cursor:     "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div
                className="cp-scrollable"
                style={{
                  maxHeight:     200,
                  overflowY:     "auto",
                  display:       "flex",
                  flexDirection: "column",
                  gap:           "0.25rem",
                  paddingRight:  "0.25rem",
                }}
              >
                {data.challenges.map(ch => {
                  const checked = selectedChallengeIds.includes(ch.id)
                  return (
                    <label
                      key={ch.id}
                      style={{
                        display:    "flex",
                        alignItems: "center",
                        gap:        "0.625rem",
                        padding:    "0.5rem 0.625rem",
                        borderRadius: "var(--cp-radius-md)",
                        cursor:     "pointer",
                        background: checked ? "var(--cp-coral-muted)" : "transparent",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChallengeId(ch.id)}
                        style={{
                          width:       15,
                          height:      15,
                          cursor:      "pointer",
                          accentColor: "var(--cp-coral)",
                          flexShrink:  0,
                        }}
                      />
                      <span style={{
                        fontSize:      "0.8125rem",
                        color:         checked ? "var(--cp-coral-dark)" : "var(--cp-text-secondary)",
                        fontWeight:    checked ? 600 : 400,
                        overflow:      "hidden",
                        textOverflow:  "ellipsis",
                        whiteSpace:    "nowrap",
                        flex:          1,
                      }}>
                        {ch.title}
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Status checkboxes ── */}
          <section>
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              marginBottom:   "0.75rem",
            }}>
              <p style={{
                fontSize:      "0.75rem",
                fontWeight:    700,
                color:         "var(--cp-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}>
                Status
              </p>
              {selectedStatuses.length > 0 && (
                <button
                  onClick={() => setSelectedStatuses([])}
                  style={{
                    fontSize:   "0.75rem",
                    color:      "var(--cp-coral-dark)",
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    fontWeight: 600,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {ALL_STATUSES.map(s => {
                const checked = selectedStatuses.includes(s.value)
                return (
                  <label
                    key={s.value}
                    style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        "0.625rem",
                      padding:    "0.5rem 0.625rem",
                      borderRadius: "var(--cp-radius-md)",
                      cursor:     "pointer",
                      background: checked ? "var(--cp-coral-muted)" : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStatus(s.value)}
                      style={{
                        width:       15,
                        height:      15,
                        cursor:      "pointer",
                        accentColor: "var(--cp-coral)",
                        flexShrink:  0,
                      }}
                    />
                    <span style={{
                      fontSize:   "0.8125rem",
                      color:      checked ? "var(--cp-coral-dark)" : "var(--cp-text-secondary)",
                      fontWeight: checked ? 600 : 400,
                    }}>
                      {s.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

        </div>

        {/* Panel — footer actions */}
        <div style={{
          padding:       "1rem 1.5rem",
          borderTop:     "1px solid var(--cp-border)",
          display:       "flex",
          gap:           "0.625rem",
          flexShrink:    0,
        }}>
          <button
            onClick={clearAllFilters}
            style={{
              flex:         1,
              padding:      "0.625rem",
              borderRadius: "var(--cp-radius-md)",
              border:       "1.5px solid var(--cp-border-strong)",
              background:   "var(--cp-white)",
              color:        "var(--cp-text-secondary)",
              fontSize:     "0.875rem",
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            Clear All
          </button>
          <button
            onClick={() => setFilterPanelOpen(false)}
            style={{
              flex:         1,
              padding:      "0.625rem",
              borderRadius: "var(--cp-radius-md)",
              border:       "none",
              background:   "var(--cp-grad-coral)",
              color:        "var(--cp-white)",
              fontSize:     "0.875rem",
              fontWeight:   600,
              cursor:       "pointer",
              boxShadow:    "var(--cp-shadow-coral)",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ── Main page ── */}
      <div className="cp-page space-y-8">

        {/* ── Page header row ── */}
        <div style={{
          display:        "flex",
          alignItems:     "flex-start",
          justifyContent: "space-between",
          gap:            "1rem",
          flexWrap:       "wrap",
          marginBottom:   "1.5rem",
        }}>
          {/* Title block */}
          <div className="cp-page-header" style={{ marginBottom: 0 }}>
            <h1 className="cp-page-title">
              Analytics <span className="cp-title-accent">Overview</span>
            </h1>
            <p className="cp-page-subtitle">
              {data.orgName || "Your Company"} · {activeFilterCount > 0
                ? `${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`
                : "Showing all data"}
            </p>
          </div>

          {/* Action buttons */}
          <div className="cp-action-bar" style={{
            display:    "flex",
            alignItems: "center",
            gap:        "0.75rem",
            flexShrink: 0,
            paddingTop: "0.25rem",
          }}>
            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              data-pdf-export="true"
              title="Download analytics as PDF"
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          "0.4rem",
                padding:      "0.5rem 1rem",
                borderRadius: "var(--cp-radius-md)",
                border:       "1.5px solid var(--cp-border-strong)",
                background:   exporting ? "var(--cp-surface-2)" : "var(--cp-white)",
                color:        exporting ? "var(--cp-text-muted)" : "var(--cp-text-secondary)",
                fontSize:     "0.875rem",
                fontWeight:   600,
                cursor:       exporting ? "not-allowed" : "pointer",
                opacity:      exporting ? 0.7 : 1,
                transition:   "all 0.2s ease",
              }}
            >
              <Download style={{ width: 15, height: 15 }} />
              {exporting ? "Generating…" : "Export PDF"}
            </button>

            {/* Filters toggle */}
            <button
              onClick={() => setFilterPanelOpen(v => !v)}
              aria-expanded={filterPanelOpen}
              aria-controls="analytics-filter-panel"
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          "0.4rem",
                padding:      "0.5rem 1rem",
                borderRadius: "var(--cp-radius-md)",
                border:       activeFilterCount > 0
                  ? "1.5px solid var(--cp-coral)"
                  : "1.5px solid var(--cp-border-strong)",
                background:   activeFilterCount > 0
                  ? "var(--cp-coral-muted)"
                  : "var(--cp-white)",
                color:        activeFilterCount > 0
                  ? "var(--cp-coral-dark)"
                  : "var(--cp-text-secondary)",
                fontSize:     "0.875rem",
                fontWeight:   600,
                cursor:       "pointer",
                transition:   "all 0.2s ease",
              }}
            >
              <SlidersHorizontal style={{ width: 15, height: 15 }} />
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  display:        "inline-flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  width:          18,
                  height:         18,
                  borderRadius:   99,
                  background:     "var(--cp-coral)",
                  color:          "var(--cp-white)",
                  fontSize:       "0.6875rem",
                  fontWeight:     700,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Active filter chips ── */}
        {activeFilterCount > 0 && (
          <div style={{
            display:    "flex",
            alignItems: "center",
            flexWrap:   "wrap",
            gap:        "0.5rem",
          }}>
            <span style={{
              fontSize:   "0.8125rem",
              color:      "var(--cp-text-muted)",
              fontWeight: 500,
            }}>
              Active filters:
            </span>

            {dateFrom && (
              <FilterChip
                label={`From: ${formatDateDisplay(dateFrom)}`}
                onRemove={() => setDateFrom("")}
              />
            )}
            {dateTo && (
              <FilterChip
                label={`To: ${formatDateDisplay(dateTo)}`}
                onRemove={() => setDateTo("")}
              />
            )}
            {selectedChallengeIds.map(id => {
              const ch = data.challenges.find(c => c.id === id)
              if (!ch) return null
              const label = ch.title.length > 28 ? ch.title.slice(0, 28) + "…" : ch.title
              return (
                <FilterChip
                  key={id}
                  label={label}
                  onRemove={() => toggleChallengeId(id)}
                />
              )
            })}
            {selectedStatuses.map(sv => {
              const def = ALL_STATUSES.find(x => x.value === sv)
              if (!def) return null
              return (
                <FilterChip
                  key={sv}
                  label={def.label}
                  onRemove={() => toggleStatus(sv)}
                />
              )
            })}

            <button
              onClick={clearAllFilters}
              style={{
                fontSize:        "0.8125rem",
                fontWeight:      600,
                color:           "var(--cp-coral-dark)",
                background:      "none",
                border:          "none",
                cursor:          "pointer",
                padding:         "0.125rem 0.25rem",
                textDecoration:  "underline",
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Overview stat cards ── */}
        <div style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap:                 "1rem",
        }}>
          {statCards.map(s => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="cp-stat-card"
                style={{
                  background:   "var(--cp-white)",
                  border:       "1px solid var(--cp-border)",
                  borderRadius: "var(--cp-radius-xl)",
                  padding:      "1.25rem",
                  boxShadow:    "var(--cp-shadow-sm)",
                }}
              >
                <div className="cp-kpi-icon-box">
                  <Icon style={{ width: 20, height: 20 }} />
                </div>
                <div style={{
                  fontSize:      "2rem",
                  fontWeight:    800,
                  color:         "var(--cp-navy)",
                  letterSpacing: "-0.04em",
                  lineHeight:    1,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontSize:   "0.8125rem",
                  color:      "var(--cp-text-muted)",
                  fontWeight: 500,
                  marginTop:  "0.25rem",
                }}>
                  {s.label}
                </div>
                <span className="cp-kpi-badge">vs all time</span>
              </div>
            )
          })}
        </div>

        {/* ── Row 1: Top Schools + Degree Breakdown ── */}
        {/* These charts always show full-org data — the server aggregated them
            without per-challenge keys, so they cannot be filtered on the client. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <Section
            title="Top Schools"
            subtitle={`Universities most represented across your challenges${demographicSubtitleNote}`}
          >
            <TopSchoolsChart data={data.topSchools} />
          </Section>
          <Section
            title="Degree Breakdown"
            subtitle={`Academic backgrounds of your participants${demographicSubtitleNote}`}
          >
            <DegreeBreakdownChart data={data.degreeBreakdown} />
          </Section>
        </div>

        {/* ── Row 2: Skills (full width) ── */}
        <Section
          title="Participant Skills"
          subtitle={`Top skills across all participants, stacked by proficiency level${demographicSubtitleNote}`}
        >
          <TopSkillsChart data={data.topSkills} />
        </Section>

        {/* ── Row 3: Challenge comparison + Submissions over time ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <Section title="Challenge Comparison" subtitle={comparisonSubtitle}>
            <ChallengeComparisonChart data={filteredChallengePerformance} />
          </Section>
          <Section title="Submission Activity" subtitle={activitySubtitle}>
            <SubmissionsOverTimeChart data={filteredSubmissionsOverTime} />
          </Section>
        </div>

        {/* ── Row 4: Challenge performance table ── */}
        <Section title="Challenge Performance" subtitle="Detailed stats per challenge">
          {filteredChallengePerformance.length === 0 ? (
            <p style={{
              color:     "var(--cp-text-muted)",
              fontSize:  "0.875rem",
              padding:   "2rem 0",
              textAlign: "center",
            }}>
              {activeFilterCount > 0
                ? "No challenges match the active filters."
                : "No challenge data yet."}
            </p>
          ) : (
            <ChallengePerformanceTable data={filteredChallengePerformance} />
          )}
        </Section>

        {/* ── Footer timestamp ── */}
        <p style={{
          textAlign:   "center",
          fontSize:    "0.8125rem",
          color:       "var(--cp-text-muted)",
          padding:     "1rem 0 0.5rem",
          borderTop:   "1px solid var(--cp-border)",
          marginTop:   "1rem",
        }}>
          Data refreshes on page load · Last loaded {new Date().toLocaleTimeString()}
        </p>

      </div>
    </>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title:    string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="cp-section-card" style={{
      background:   "var(--cp-white)",
      border:       "1px solid var(--cp-border)",
      borderRadius: "var(--cp-radius-xl)",
      padding:      "1.5rem",
      boxShadow:    "var(--cp-shadow-sm)",
    }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 style={{
          fontSize:      "1rem",
          fontWeight:    700,
          color:         "var(--cp-navy)",
          letterSpacing: "-0.01em",
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", marginTop: 2 }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Filter chip ────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="cp-filter-chip" style={{
      display:     "inline-flex",
      alignItems:  "center",
      gap:         "0.375rem",
      background:  "var(--cp-coral-muted)",
      color:       "var(--cp-coral-dark)",
      borderRadius: 99,
      padding:     "0.25rem 0.5rem 0.25rem 0.75rem",
      fontSize:    "0.8125rem",
      fontWeight:  600,
      border:      "1px solid var(--cp-coral-alpha-30)",
    }}>
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          16,
          height:         16,
          borderRadius:   99,
          background:     "var(--cp-coral-alpha-20)",
          border:         "none",
          cursor:         "pointer",
          color:          "var(--cp-coral-dark)",
          padding:        0,
          flexShrink:     0,
        }}
      >
        <X style={{ width: 10, height: 10 }} />
      </button>
    </span>
  )
}
