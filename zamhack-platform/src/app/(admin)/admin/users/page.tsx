import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Database } from "@/types/supabase"
import { UserActionsCell } from "./user-actions-cell"
import { Users, GraduationCap, Building2, ShieldCheck, Search, ClipboardList } from "lucide-react"
import "@/app/(admin)/admin.css"
import CreateEvaluatorButton from "./create-evaluator-button"

type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  organization?: { name: string | null } | null
}

const getInitials = (firstName: string | null, lastName: string | null) =>
  `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?"

const formatDate = (dateString: string | null) =>
  dateString ? new Date(dateString).toLocaleDateString() : "N/A"

const PER_PAGE = 10

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}) {
  // Next.js 15: searchParams must be awaited
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

  // Fetch all profiles with org name
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(`*, organization:organizations(name)`)
    .order("created_at", { ascending: false })

  if (error) console.error(error)

  const allProfiles = (profiles || []) as Profile[]

  // --- Active filter values ---
  const activeTab   = params.tab || "all"
  const searchQuery = (params.q || "").toLowerCase()

  // --- Filter ---
  const filtered = allProfiles.filter((p) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "students"   && p.role === "student") ||
      (activeTab === "companies"  && (p.role === "company_admin" || p.role === "company_member")) ||
      (activeTab === "admins"     && p.role === "admin") ||
      (activeTab === "evaluators" && p.role === "evaluator")

    const fullName = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase()
    const matchesSearch =
      !searchQuery ||
      fullName.includes(searchQuery) ||
      (p as any).email?.toLowerCase().includes(searchQuery) ||
      p.university?.toLowerCase().includes(searchQuery) ||
      p.organization?.name?.toLowerCase().includes(searchQuery)

    return matchesTab && matchesSearch
  })

  // --- Counts (always from allProfiles, ignoring filters) ---
  const counts = {
    all:        allProfiles.length,
    students:   allProfiles.filter((p) => p.role === "student").length,
    companies:  allProfiles.filter((p) => p.role === "company_admin" || p.role === "company_member").length,
    admins:     allProfiles.filter((p) => p.role === "admin").length,
    evaluators: allProfiles.filter((p) => p.role === "evaluator").length,
  }

  // --- Pagination ---
  const currentPage = Math.max(1, parseInt(params.page || "1", 10))
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage    = Math.min(currentPage, totalPages)
  const paginated   = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  // Build URL preserving all active params, with overrides
  const buildUrl = (overrides: Record<string, string | number | undefined>) => {
    const base: Record<string, string> = {
      tab:  activeTab,
      page: String(safePage),
    }
    if (params.q) base.q = params.q

    const merged = { ...base, ...Object.fromEntries(
      Object.entries(overrides)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )}

    Object.keys(merged).forEach((k) => { if (merged[k] === "") delete merged[k] })

    return `?${new URLSearchParams(merged).toString()}`
  }

  // --- Tabs ---
  const tabs = [
    { key: "all",        label: "All Users",   icon: Users,          count: counts.all },
    { key: "students",   label: "Students",    icon: GraduationCap,  count: counts.students },
    { key: "companies",  label: "Companies",   icon: Building2,      count: counts.companies },
    { key: "evaluators", label: "Evaluators",  icon: ClipboardList,  count: counts.evaluators },
    { key: "admins",     label: "Admins",      icon: ShieldCheck,    count: counts.admins },
  ]

  // --- Badge helpers ---
  const getRoleBadgeClass = (role: string | null) => {
    switch (role) {
      case "admin":          return "red"
      case "company_admin":  return "blue"
      case "company_member": return "coral"
      case "student":        return "gray"
      default:               return "gray"
    }
  }

  const getStatusBadgeClass = (status: string | null) => {
    if (!status || status === "active") return "green"
    if (status === "suspended")         return "yellow"
    if (status === "banned")            return "red"
    return "gray"
  }

  const getAffiliation = (profile: Profile) => {
    if (profile.role === "student") return profile.university || "—"
    return profile.organization?.name || "—"
  }

  return (
    <div className="space-y-6" data-layout="admin">

      {/* Page Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">
          User <span>Management</span>
        </h1>
        <p className="admin-page-subtitle">
          Manage students, company representatives, and admins across the platform.
        </p>
      </div>

      {/* Stats Row */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="admin-stat-card coral">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Total Users</span>
            <div className="admin-stat-icon coral"><Users /></div>
          </div>
          <div className="admin-stat-value coral">{counts.all}</div>
          <p className="admin-stat-description">All registered accounts</p>
        </div>
        <div className="admin-stat-card blue">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Students</span>
            <div className="admin-stat-icon blue"><GraduationCap /></div>
          </div>
          <div className="admin-stat-value blue">{counts.students}</div>
          <p className="admin-stat-description">Active student accounts</p>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Company Users</span>
            <div className="admin-stat-icon green"><Building2 /></div>
          </div>
          <div className="admin-stat-value">{counts.companies}</div>
          <p className="admin-stat-description">Company admins &amp; members</p>
        </div>
        <div className="admin-stat-card yellow">
          <div className="admin-stat-header">
            <span className="admin-stat-label">Admins</span>
            <div className="admin-stat-icon yellow"><ShieldCheck /></div>
          </div>
          <div className="admin-stat-value">{counts.admins}</div>
          <p className="admin-stat-description">Platform administrators</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="admin-card">

        {/* Tabs */}
        <div style={{ padding: "0 1.5rem", borderBottom: "1px solid var(--admin-gray-200)" }}>
          <div className="admin-tabs" style={{ marginBottom: 0 }}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <a
                  key={tab.key}
                  href={buildUrl({ tab: tab.key, role: "", page: 1 })}
                  className={`admin-tab ${activeTab === tab.key ? "active" : ""}`}
                >
                  <Icon style={{ width: 14, height: 14 }} />
                  {tab.label}
                  <span className="admin-tab-count">{tab.count}</span>
                </a>
              )
            })}
          </div>
        </div>

        {/* Search + Filter row */}
        <div style={{
          padding: "0.875rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          borderBottom: "1px solid var(--admin-gray-100)",
          flexWrap: "wrap",
        }}>
          <form
            method="get"
            style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", flex: 1 }}
          >
            <input type="hidden" name="tab" value={activeTab} />
            <input type="hidden" name="page" value="1" />

            <div className="admin-search" style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
              <Search className="admin-search-icon" />
              <input
                className="admin-input"
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search by name, email, university..."
                style={{ paddingLeft: "2.25rem" }}
              />
            </div>

            <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm">
              Apply
            </button>

            {params.q && (
              <a
                href={buildUrl({ q: "", page: 1 })}
                className="admin-btn admin-btn-outline admin-btn-sm"
              >
                Clear
              </a>
            )}
          </form>

          <div style={{ color: "var(--admin-gray-400)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            {filtered.length === 0
              ? "No users found"
              : `${(safePage - 1) * PER_PAGE + 1}–${Math.min(safePage * PER_PAGE, filtered.length)} of ${filtered.length} users`}
          </div>

          {activeTab === "evaluators" && <CreateEvaluatorButton />}
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
            <span style={{ fontSize: "0.75rem", color: "var(--admin-gray-400)", marginRight: "0.25rem" }}>
              Filters:
            </span>
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
              <Users className="w-6 h-6" />
            </div>
            <div className="admin-empty-title">No users found</div>
            <div className="admin-empty-text">
              {params.q
                ? "No results match your search. Try a different term."
                : "No users in this category yet."}
            </div>
          </div>
        ) : (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Affiliation</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((profile) => {
                    const userProfile = profile as any
                    const initials = getInitials(profile.first_name, profile.last_name)
                    const fullName =
                      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unnamed User"

                    return (
                      <tr key={profile.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <div className="admin-avatar">
                              {profile.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={profile.avatar_url}
                                  alt={fullName}
                                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                                />
                              ) : initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--admin-gray-800)" }}>
                                {fullName}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--admin-gray-400)" }}>
                                {userProfile.email || `ID: ${profile.id.slice(0, 8)}...`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`admin-badge ${getRoleBadgeClass(profile.role)}`}>
                            {profile.role?.replace(/_/g, " ") || "student"}
                          </span>
                        </td>

                        <td style={{ fontSize: "0.85rem", color: "var(--admin-gray-600)" }}>
                          {getAffiliation(profile)}
                        </td>

                        <td>
                          <span className={`admin-badge ${getStatusBadgeClass(userProfile.status)}`}>
                            <span className="admin-badge-dot" />
                            {userProfile.status || "active"}
                          </span>
                        </td>

                        <td style={{ fontSize: "0.8rem", color: "var(--admin-gray-400)" }}>
                          {formatDate(profile.created_at)}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <UserActionsCell userId={profile.id} status={userProfile.status} />
                        </td>
                      </tr>
                    )
                  })}
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
                  {/* Prev */}
                  {safePage > 1 ? (
                    <a href={buildUrl({ page: safePage - 1 })} className="admin-btn admin-btn-outline admin-btn-sm">
                      ← Prev
                    </a>
                  ) : (
                    <span className="admin-btn admin-btn-outline admin-btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>
                      ← Prev
                    </span>
                  )}

                  {/* Page number pills */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...")
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`ellipsis-${idx}`} style={{ padding: "0 0.25rem", color: "var(--admin-gray-400)", fontSize: "0.8rem" }}>
                          …
                        </span>
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

                  {/* Next */}
                  {safePage < totalPages ? (
                    <a href={buildUrl({ page: safePage + 1 })} className="admin-btn admin-btn-outline admin-btn-sm">
                      Next →
                    </a>
                  ) : (
                    <span className="admin-btn admin-btn-outline admin-btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>
                      Next →
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}