"use client"

import { useState } from "react"
import { createEvaluator } from "@/app/admin/actions"
import { UserPlus, X, Loader2 } from "lucide-react"

export default function CreateEvaluatorButton() {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName]   = useState("")
  const [email, setEmail]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail("")
    setError(null); setSuccess(false); setLoading(false)
  }

  const handleClose = () => { setOpen(false); reset() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !firstName.trim()) {
      setError("First name and email are required")
      return
    }
    setLoading(true); setError(null)

    const result = await createEvaluator(email.trim(), firstName.trim(), lastName.trim())
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? "Failed to create evaluator")
      return
    }

    setSuccess(true)
    setTimeout(() => { handleClose(); window.location.reload() }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="admin-btn admin-btn-primary admin-btn-sm"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
      >
        <UserPlus style={{ width: 14, height: 14 }} />
        Create Evaluator
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: "2rem",
            width: "100%", maxWidth: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--admin-gray-800)" }}>
                Create Evaluator Account
              </h2>
              <button onClick={handleClose} title="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-gray-400)" }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {success ? (
              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 10, padding: "1rem", textAlign: "center",
                color: "#166534", fontSize: "0.875rem", fontWeight: 500,
              }}>
                ✅ Invite sent to {email}. They'll receive an email to set their password.
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {error && (
                  <div style={{
                    background: "#fef2f2", border: "1px solid #fecaca",
                    borderRadius: 8, padding: "0.75rem",
                    color: "#991b1b", fontSize: "0.8125rem",
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--admin-gray-700)", marginBottom: 4 }}>
                      First Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      className="admin-input"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--admin-gray-700)", marginBottom: 4 }}>
                      Last Name
                    </label>
                    <input
                      className="admin-input"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Doe"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--admin-gray-700)", marginBottom: 4 }}>
                    Email Address <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    className="admin-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--admin-gray-400)", margin: 0 }}>
                  An invite email will be sent. They'll click the link to set their password and access the evaluator portal.
                </p>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
                  <button type="button" onClick={handleClose} className="admin-btn admin-btn-outline admin-btn-sm">
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={loading}>
                    {loading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <UserPlus style={{ width: 14, height: 14 }} />}
                    {loading ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}