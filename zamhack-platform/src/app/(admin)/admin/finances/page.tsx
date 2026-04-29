import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { DollarSign, Building2, Users, Clock } from "lucide-react"
import "@/app/(admin)/admin.css"

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function AdminFinancesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") redirect("/admin/dashboard")

  const [listingFeeResult, entryFeeResult, pendingResult, transactionsResult] =
    await Promise.all([
      supabase
        .from("payments")
        .select("amount.sum()")
        .eq("payment_type", "company_listing")
        .eq("status", "paid")
        .single(),
      supabase
        .from("payments")
        .select("amount.sum()")
        .eq("payment_type", "student_entry")
        .eq("status", "paid")
        .single(),
      supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("payment_type", "student_entry")
        .eq("status", "pending"),
      supabase
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          status,
          payment_type,
          paid_at,
          created_at,
          user_id,
          challenge_id,
          challenges ( id, title )
        `)
        .order("created_at", { ascending: false }),
    ])

  const listingFeeRevenue = ((listingFeeResult.data as any)?.sum ?? 0) / 100
  const studentEntryRevenue = ((entryFeeResult.data as any)?.sum ?? 0) / 100
  const totalRevenue = listingFeeRevenue + studentEntryRevenue
  const pendingCount = pendingResult.count ?? 0
  const transactions = transactionsResult.data ?? []
  const totalTransactions = transactions.length

  const stats = [
    {
      label: "Total Revenue",
      value: `PHP ${totalRevenue.toFixed(2)}`,
      description: "Combined listing fees and entry fees collected",
      icon: DollarSign,
      variant: "coral" as const,
    },
    {
      label: "Listing Fee Revenue",
      value: `PHP ${listingFeeRevenue.toFixed(2)}`,
      description: "Collected from company challenge listings",
      icon: Building2,
      variant: "blue" as const,
    },
    {
      label: "Entry Fee Revenue",
      value: `PHP ${studentEntryRevenue.toFixed(2)}`,
      description: "Collected from student challenge registrations",
      icon: Users,
      variant: "green" as const,
    },
    {
      label: "Pending Payments",
      value: String(pendingCount),
      description: "Student entry payments awaiting confirmation",
      icon: Clock,
      variant: "yellow" as const,
    },
  ]

  return (
    <div className="space-y-6" data-layout="admin">

      <div className="admin-page-header">
        <h1 className="admin-page-title">
          Finances <span>Overview</span>
        </h1>
        <p className="admin-page-subtitle">
          Platform revenue from listing fees and student entry payments.
        </p>
      </div>

      <div className="admin-stats-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className={`admin-stat-card ${stat.variant}`}>
              <div className="admin-stat-header">
                <span className="admin-stat-label">{stat.label}</span>
                <div className={`admin-stat-icon ${stat.variant}`}>
                  <Icon />
                </div>
              </div>
              <div
                className={`admin-stat-value ${
                  stat.variant === "coral"
                    ? "coral"
                    : stat.variant === "blue"
                    ? "blue"
                    : ""
                }`}
              >
                {stat.value}
              </div>
              <p className="admin-stat-description">{stat.description}</p>
            </div>
          )
        })}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <div className="admin-card-title">All Transactions</div>
          </div>
        </div>

        {totalTransactions === 0 ? (
          <div className="admin-empty" style={{ padding: "4rem 1.5rem" }}>
            <div className="admin-empty-title">No transactions recorded yet.</div>
          </div>
        ) : (
          <div className="cp-table-wrapper">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Challenge</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => {
                  const typLabel =
                    tx.payment_type === "company_listing"
                      ? "Listing Fee"
                      : "Entry Fee"

                  const challengeTitle =
                    (tx.challenges as any)?.title ?? "—"

                  const amountDisplay = `${tx.currency ?? "PHP"} ${(tx.amount / 100).toFixed(2)}`

                  let badgeStyle: React.CSSProperties
                  if (tx.status === "paid") {
                    badgeStyle = {
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }
                  } else if (tx.status === "pending") {
                    badgeStyle = {
                      background: "#fef9c3",
                      color: "#854d0e",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }
                  } else {
                    badgeStyle = {
                      background: "#f3f4f6",
                      color: "#374151",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }
                  }

                  const dateDisplay =
                    tx.status === "paid"
                      ? formatDate(tx.paid_at)
                      : formatDate(tx.created_at)

                  return (
                    <tr key={tx.id}>
                      <td>{typLabel}</td>
                      <td>{challengeTitle}</td>
                      <td style={{ fontWeight: 600 }}>{amountDisplay}</td>
                      <td>
                        <span style={badgeStyle}>
                          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                        </span>
                      </td>
                      <td>{dateDisplay}</td>
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
