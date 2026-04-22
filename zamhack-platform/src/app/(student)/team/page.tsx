import Link from "next/link"
import { Users, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const TeamPage = () => {
  return (
    <div className="st-page">
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        gap: "1.5rem",
        maxWidth: "480px",
        margin: "0 auto",
        padding: "2rem 1rem",
      }}>
        <div style={{
          width: "72px",
          height: "72px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))",
          border: "1.5px solid rgba(245,158,11,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Users size={32} style={{ color: "#d97706" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
            Team Features Coming Soon
          </h1>
          <p style={{ fontSize: "0.9375rem", color: "var(--st-text-muted, #6b7280)", margin: 0, lineHeight: 1.6 }}>
            Team collaboration tools are currently under development. Check back soon.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default TeamPage
