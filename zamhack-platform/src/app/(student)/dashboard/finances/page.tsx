import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Receipt } from "lucide-react"

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function StudentFinancesPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")
  if (profile.role !== "student") redirect("/dashboard")

  const { data: rawPayments } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      currency,
      status,
      payment_type,
      paid_at,
      created_at,
      challenge_id,
      challenges (
        id,
        title
      )
    `)
    .eq("user_id", user.id)
    .eq("payment_type", "student_entry")
    .order("created_at", { ascending: false })

  const payments = rawPayments ?? []

  const totalSpent = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount / 100, 0)

  const paidCount = payments.filter((p) => p.status === "paid").length
  const pendingCount = payments.filter((p) => p.status === "pending").length
  const isEmpty = payments.length === 0

  return (
    <div className="student-portal space-y-4 md:space-y-6">

      {/* ── Header Banner ── */}
      <div
        className="flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between md:p-7"
        style={{ background: "linear-gradient(135deg, #2c3e50 0%, #1a252f 100%)" }}
      >
        <div>
          <p className="text-lg font-bold text-white md:text-xl">
            Payment History
          </p>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Your entry fee payments for joined challenges.
          </p>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">

        <div
          className="stat-card flex flex-col gap-2 rounded-2xl border p-4"
          style={{ background: "#ffffff" }}
        >
          <p
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "#9ca3af",
            }}
          >
            Total Spent
          </p>
          <p
            className="stat-value"
            style={{ fontSize: "1.5rem", color: "#e8836f", fontWeight: 700 }}
          >
            PHP {totalSpent.toFixed(2)}
          </p>
        </div>

        <div
          className="stat-card flex flex-col gap-2 rounded-2xl border p-4"
          style={{ background: "#ffffff" }}
        >
          <p
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "#9ca3af",
            }}
          >
            Challenges Joined
          </p>
          <p
            className="stat-value"
            style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2c3e50" }}
          >
            {paidCount}
          </p>
        </div>

        <div
          className="stat-card flex flex-col gap-2 rounded-2xl border p-4"
          style={{ background: "#ffffff" }}
        >
          <p
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "#9ca3af",
            }}
          >
            Pending
          </p>
          <p
            className="stat-value"
            style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2c3e50" }}
          >
            {pendingCount}
          </p>
        </div>

      </div>

      {/* ── Payment Table ── */}
      <div
        className="stat-card rounded-2xl border"
        style={{ background: "#ffffff", overflow: "hidden" }}
      >
        <div className="p-4 md:p-5">
          <p className="font-bold" style={{ color: "#2c3e50" }}>
            Transactions
          </p>
        </div>

        {isEmpty ? (
          <div
            className="flex flex-col items-center gap-3 py-12 text-center"
            style={{ color: "#9ca3af" }}
          >
            <Receipt className="h-8 w-8 opacity-40" />
            <div>
              <p className="text-sm font-semibold">No payments yet</p>
              <p className="mt-1 text-xs">
                Challenges you pay to join will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: "#fafafa",
                  }}
                >
                  {["Challenge", "Amount", "Status", "Date"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.625rem 1rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "#9ca3af",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const title =
                    (payment.challenges as any)?.title ?? "Unknown Challenge"
                  const amountDisplay = `${payment.currency ?? "PHP"} ${(payment.amount / 100).toFixed(2)}`

                  let badgeStyle: React.CSSProperties
                  if (payment.status === "paid") {
                    badgeStyle = {
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }
                  } else if (payment.status === "pending") {
                    badgeStyle = {
                      background: "#fef9c3",
                      color: "#854d0e",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }
                  } else {
                    badgeStyle = {
                      background: "#f3f4f6",
                      color: "#374151",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }
                  }

                  const badgeLabel =
                    payment.status.charAt(0).toUpperCase() +
                    payment.status.slice(1)

                  const dateDisplay =
                    payment.status === "paid"
                      ? formatDate(payment.paid_at)
                      : formatDate(payment.created_at)

                  return (
                    <tr
                      key={payment.id}
                      style={{ borderBottom: "1px solid #f3f4f6" }}
                    >
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontWeight: 500,
                          color: "#2c3e50",
                          maxWidth: "220px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontWeight: 600,
                          color: "#2c3e50",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {amountDisplay}
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span style={badgeStyle}>{badgeLabel}</span>
                      </td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          color: "#9ca3af",
                          fontSize: "0.8125rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {dateDisplay}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
