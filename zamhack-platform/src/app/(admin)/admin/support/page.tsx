import { createClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { createClient as createSessionClient } from "@/utils/supabase/server"
import Link from "next/link"
import { MessageSquare, Clock } from "lucide-react"
import "@/app/(admin)/admin.css"

export default async function AdminSupportInboxPage() {
  // Verify the requester is an admin via session client
  const sessionClient = await createSessionClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect("/dashboard")

  // Use service-role client to bypass RLS and see all support tickets
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rawTickets } = await (serviceClient as any)
    .from("conversations")
    .select(`
      id,
      created_at,
      source,
      messages (
        content,
        created_at,
        sender_id
      )
    `)
    .eq("type", "support")
    .order("created_at", { ascending: false })

  const tickets: any[] = rawTickets ?? []

  // Collect unique sender IDs from each ticket's first message
  const senderIds = Array.from(new Set(
    tickets
      .map((t) => {
        const sorted = [...(t.messages ?? [])].sort(
          (a: any, b: any) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
        )
        return sorted[0]?.sender_id
      })
      .filter(Boolean)
  )) as string[]

  const profileMap: Record<string, { first_name: string | null; last_name: string | null; role: string | null }> = {}
  if (senderIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, first_name, last_name, role")
      .in("id", senderIds)
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  return (
    <div className="space-y-6" data-layout="admin">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Support <span>Inbox</span></h1>
        <p className="admin-page-subtitle">All support tickets from students and companies.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {tickets.length === 0 ? (
          <div className="admin-card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <MessageSquare style={{ margin: "0 auto 0.75rem", opacity: 0.2, width: 40, height: 40 }} />
            <p style={{ color: "var(--admin-text-muted)", margin: 0 }}>No support tickets yet.</p>
          </div>
        ) : (
          tickets.map((ticket) => {
            const sortedMessages = [...(ticket.messages ?? [])].sort(
              (a: any, b: any) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
            )
            const firstMsg: any = sortedMessages[0]
            const content: string = firstMsg?.content ?? ""
            const subjectMatch = content.match(/^Subject: (.*?)(\n|$)/)
            const subject = subjectMatch ? subjectMatch[1] : content.slice(0, 60) || "No subject"
            const preview = content.replace(/^Subject: .*?\n\n/, "").slice(0, 100)

            const sender = firstMsg?.sender_id ? profileMap[firstMsg.sender_id] : null
            const senderName = sender
              ? `${sender.first_name ?? ""} ${sender.last_name ?? ""}`.trim() || "Unknown"
              : "Unknown"

            const source: string = ticket.source ?? "unknown"
            const date = ticket.created_at
              ? new Date(ticket.created_at).toLocaleDateString()
              : "—"

            const sourceBadgeStyle: React.CSSProperties = {
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: source === "student"
                ? "rgba(99,102,241,0.1)"
                : source === "company"
                ? "rgba(234,88,12,0.1)"
                : "rgba(107,114,128,0.1)",
              color: source === "student"
                ? "#4f46e5"
                : source === "company"
                ? "#c2410c"
                : "#6b7280",
            }

            const roleBadgeStyle: React.CSSProperties = {
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "rgba(107,114,128,0.08)",
              color: "#6b7280",
            }

            return (
              <div key={ticket.id} className="admin-card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={sourceBadgeStyle}>
                        {source === "student" ? "Student" : source === "company" ? "Company" : "Unknown"}
                      </span>
                      <span style={roleBadgeStyle}>{senderName}</span>
                    </div>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: "0.9375rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {subject}
                    </p>
                    {preview && (
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--admin-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {preview}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                      <Clock style={{ width: 12, height: 12 }} />
                      {date}
                    </div>
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="admin-btn admin-btn-outline admin-btn-sm"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
