import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Database } from "@/types/supabase"
import Link from "next/link"
import {
  Trophy,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Layers,
  Ban,
  ShieldCheck,
} from "lucide-react"
import "@/app/(admin)/admin.css"
import { GuardrailsForm } from "./guardrails-form"

type Challenge = Database["public"]["Tables"]["challenges"]["Row"] & {
  organization?: { name: string | null } | null
}

const formatDate = (dateString: string | null) =>
  dateString ? new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"

const PER_PAGE = 10

// All possible challenge statuses
const ALL_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "in_progress",
  "under_review",
  "completed",
  "cancelled",
  "rejected",
]

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (currentUserProfile?.role !== "admin") redirect("/dashboard")

  // Fetch all challenges with org name
  const { data: challenges, error } = await supabase
    .from("challenges")
    .select(`*, organization:organizations(name)`)
    .order("created_at", { ascending: false })

  if (error) console.error(error)

  // Fetch platform settings for guardrails
  const { data: platformSettings } = await supabase
    .from("platform_settings")
    .select("advanced_beginner_weekly_limit")
    .eq("id", true)
    .single()

  const allChallenges = (challenges || []) as Challenge[]

  // --- Active filters ---
  const activeTab   = params.tab || "all"
  const searchQuery = (params.q || "").toLowerCase()

  // --- Filter ---
  const filtered = allChallenges.filter((c) => {
    const matchesTab =
      activeTab === "all" ||
      c.status === activeTab

    const matchesSearch =
      !searchQuery ||
      c.title?.toLowerCase().includes(searchQuery) ||
      c.organization?.name?.toLowerCase().includes(searchQuery) ||
      c.difficulty?.toLowerCase().includes(searchQuery)

    return matchesTab && matchesSearch
  })

  // --- Counts per status ---
  const counts: Record<string, number> = { all: allChallenges.length }
  ALL_STATUSES.forEach((s) => {
    counts[s] = allChallenges.filter((c) => c.status === s).length
  })

  // --- Pagination ---
  const currentPage = Math.max(1, parseInt(params.page || "1", 10))
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage    = Math.min(currentPage, totalPages)
  const paginated   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const base: Record<string, string> = {
      tab:  activeTab,
      page: String(safePage),
    }
    if (params.q) base.q = params.q

    const merged = {
      ...base,
      ...Object.fromEntries(
        Object.entries(overrides)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ),
    }
    Object.keys(merged).forEach((k) => { if (merged[k] === "") delete merged[k] })
    return `?${new URLSearchParams(merged).toString()}`
  }

  // --- Tabs config ---
  const tabs = [
    { key: "all",             label: "All",             icon: Layers,       count: counts.all },
    { key: "pending_approval",label: "Pending",         icon: Clock,        count: counts.pending_approval },
    { key: "approved",        label: "Approved",        icon: CheckCircle2, count: counts.approved },
    { key: "in_progress",     label: "In Progress",     icon: Trophy,       count: counts.in_progress },
    { key: "under_review",    label: "Under Review",    icon: FileText,     count: counts.under_review },
    { key: "completed",       label: "Completed",       icon: CheckCircle2, count: counts.completed },
    { key: "draft",           label: "Draft",           icon: FileText,     count: counts.draft },
    { key: "rejected",        label: "Rejected",        icon: XCircle,      count: counts.rejected },
    { key: "cancelled",       label: "Cancelled",       icon: Ban,          count: counts.cancelled },
    { key: "guardrails",      label: "Guardrails",      icon: ShieldCheck,  count: 0 },
  ]

  // --- Badge helpers ---
  const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case "approved":        return "green"
      case "in_progress":     return "blue"
      case "under_review":    return "coral"
      case "completed":       return "green"
      case "pending_approval":return "yellow"
      case "draft":           return "gray"
      case "rejected":        return "red"
      case "cancelled":       return "red"
      default:                return "gray"
    }
  }

  const getDifficultyBadgeClass = (difficulty: string | null) => {
    switch (difficulty?.toLowerCase()) {
      case "beginner":     return "green"
      case "intermediate": return "yellow"
      case "advanced":     return "coral"
      case "expert":       return "red"
      default:             return "gray"
    }
  }

  return (
    <div className="space-y-6" data-layout="admin">

      {/* Page Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">
          Challenge <span>Management</span>
        </h1>
        <p className="admin-page-subtitle">
          Review, approve, or reject challenges submitted by companies.
        </p>
      </div>

      {/* Stats Row */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="admin-stat-card coral">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Total Challenges</span>
            <div className="admin-stat-icon coral"><Trophy /></div>
          </div>
          <div className="admin-stat-value coral">{counts.all}</div>
          <p className="admin-stat-description">All challenges on the platform</p>
        </div>
        <div className="admin-stat-card yellow">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Pending Approval</span>
            <div className="admin-stat-icon yellow"><Clock /></div>
          </div>
          <div className="admin-stat-value">{counts.pending_approval}</div>
          <p className="admin-stat-description">Awaiting your review</p>
        </div>
        <div className="admin-stat-card blue">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Active</span>
            <div className="admin-stat-icon blue"><Trophy /></div>
          </div>
          <div className="admin-stat-value blue">{(counts.approved || 0) + (counts.in_progress || 0)}</div>
          <p className="admin-stat-description">Approved &amp; in progress</p>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Completed</span>
            <div className="admin-stat-icon green"><CheckCircle2 /></div>
          </div>
          <div className="admin-stat-value">{counts.completed}</div>
          <p className="admin-stat-description">Successfully completed</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="admin-card">

        {/* Tabs — scrollable on mobile */}
        <div style={{ padding: "0 1.5rem", borderBottom: "1px solid var(--admin-gray-200)", overflowX: "auto" }}>
          <div className="admin-tabs" style={{ marginBottom: 0, minWidth: "max-content" }}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              // Always show "all" and "guardrails" tabs; others only if they have items or are active
              if (tab.key !== "all" && tab.key !== "guardrails" && tab.count === 0 && activeTab !== tab.key) return null
              return (
                <a
                  key={tab.key}
                  href={buildUrl({ tab: tab.key, page: 1, q: "" })}
                  className={`admin-tab ${activeTab === tab.key ? "active" : ""}`}
                >
                  <Icon style={{ width: 13, height: 13 }} />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`admin-tab-count ${tab.key === "pending_approval" ? "" : ""}`}>
                      {tab.count}
                    </span>
                  )}
                </a>
              )
            })}
          </div>
        </div>

        {/* Guardrails tab content */}
        {activeTab === "guardrails" && (
          <div style={{ padding: "1.5rem" }}>
            <GuardrailsForm
              currentLimit={(platformSettings as any)?.advanced_beginner_weekly_limit ?? 1}
            />
          </div>
        )}

        {/* Challenge list (hidden when Guardrails tab is active) */}
        {activeTab !== "guardrails" && <>

        {/* Search row */}
        <div style={{
          padding: "0.875rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          borderBottom: "1px solid var(--admin-gray-100)",
          flexWrap: "wrap",
        }}>
          <form method="get" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1, maxWidth: 400 }}>
            <input type="hidden" name="tab" value={activeTab} />
            <input type="hidden" name="page" value="1" />
            <div className="admin-search" style={{ flex: 1 }}>
              <Search className="admin-search-icon" />
              <input
                className="admin-input"
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search by title or company..."
                style={{ paddingLeft: "2.25rem" }}
              />
            </div>
            <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm">
              Search
            </button>
            {params.q && (
              <a href={buildUrl({ q: "", page: 1 })} className="admin-btn admin-btn-outline admin-btn-sm">
                Clear
              </a>
            )}
          </form>

          <div style={{ color: "var(--admin-gray-400)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            {filtered.length === 0
              ? "No challenges found"
              : `${(safePage - 1) * PER_PAGE + 1}–${Math.min(safePage * PER_PAGE, filtered.length)} of ${filtered.length} challenges`}
          </div>
        </div>

        {/* Active search chip */}
        {params.q && (
          <div style={{
            padding: "0.625rem 1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            borderBottom: "1px solid var(--admin-gray-100)",
            background: "var(--admin-gray-50)",
          }}>
            <span style={{ fontSize: "0.75rem", color: "var(--admin-gray-400)" }}>Filters:</span>
            <a
              href={buildUrl({ q: "", page: 1 })}
              className="admin-badge coral"
              style={{ textDecoration: "none", cursor: "pointer", gap: "0.4rem" }}
            >
              Search: &quot;{params.q}&quot;
              <span style={{ fontWeight: 700, fontSize: "0.85em" }}>×</span>
            </a>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="admin-empty" style={{ padding: "4rem 1.5rem" }}>
            <div className="admin-empty-icon">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="admin-empty-title">No challenges found</div>
            <div className="admin-empty-text">
              {params.q
                ? `No results for &quot;${params.q}&quot;. Try a different search.`
                : "No challenges in this category yet."}
            </div>
          </div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th>Difficulty</th>
                    <th>Dates</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((challenge) => (
                    <tr key={challenge.id}>
                      {/* Challenge title + participation type */}
                      <td style={{ maxWidth: 280 }}>
                        <div>
                          <div style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "var(--admin-gray-800)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 260,
                          }}>
                            {challenge.title || "Untitled Challenge"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--admin-gray-400)", marginTop: 2 }}>
                            {(challenge as any).participation_type?.replace("_", " ") || "—"}
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td style={{ fontSize: "0.85rem", color: "var(--admin-gray-600)" }}>
                        {challenge.organization?.name || "—"}
                      </td>

                      {/* Status badge */}
                      <td>
                        <span className={`admin-badge ${getStatusBadgeClass(challenge.status)}`}>
                          <span className="admin-badge-dot" />
                          {challenge.status?.replace(/_/g, " ") || "unknown"}
                        </span>
                      </td>

                      {/* Difficulty */}
                      <td>
                        {challenge.difficulty ? (
                          <span className={`admin-badge ${getDifficultyBadgeClass(challenge.difficulty)}`}>
                            {challenge.difficulty}
                          </span>
                        ) : (
                          <span style={{ color: "var(--admin-gray-300)", fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>

                      {/* Date range */}
                      <td style={{ fontSize: "0.78rem", color: "var(--admin-gray-500)", whiteSpace: "nowrap" }}>
                        {formatDate((challenge as any).start_date)}
                        {(challenge as any).end_date && (
                          <>
                            <br />
                            <span style={{ color: "var(--admin-gray-400)" }}>
                              → {formatDate((challenge as any).end_date)}
                            </span>
                          </>
                        )}
                      </td>

                      {/* Created at */}
                      <td style={{ fontSize: "0.78rem", color: "var(--admin-gray-400)", whiteSpace: "nowrap" }}>
                        {formatDate(challenge.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/admin/challenges/${challenge.id}`}>
                          <button className="admin-btn admin-btn-outline admin-btn-sm" style={{ gap: "0.35rem" }}>
                            <Eye style={{ width: 13, height: 13 }} />
                            Review
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.5rem",
                borderTop: "1px solid var(--admin-gray-100)",
              }}>
                <span style={{ fontSize: "0.8rem", color: "var(--admin-gray-400)" }}>
                  Page {safePage} of {totalPages}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  {safePage > 1 ? (
                    <a href={buildUrl({ page: safePage - 1 })} className="admin-btn admin-btn-outline admin-btn-sm">← Prev</a>
                  ) : (
                    <span className="admin-btn admin-btn-outline admin-btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>← Prev</span>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...")
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`e-${idx}`} style={{ padding: "0 0.25rem", color: "var(--admin-gray-400)", fontSize: "0.8rem" }}>…</span>
                      ) : (
                        <a
                          key={item}
                          href={buildUrl({ page: item })}
                          className="admin-btn admin-btn-sm"
                          style={
                            item === safePage
                              ? { background: "var(--admin-coral)", color: "white", minWidth: 34, justifyContent: "center" }
                              : { background: "transparent", border: "1.5px solid var(--admin-gray-200)", color: "var(--admin-gray-600)", minWidth: 34, justifyContent: "center" }
                          }
                        >
                          {item}
                        </a>
                      )
                    )}

                  {safePage < totalPages ? (
                    <a href={buildUrl({ page: safePage + 1 })} className="admin-btn admin-btn-outline admin-btn-sm">Next →</a>
                  ) : (
                    <span className="admin-btn admin-btn-outline admin-btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>Next →</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* End challenge list */}
        </>}
      </div>
    </div>
  )
}