"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateProfile, updatePassword } from "./actions"
import { Database } from "@/types/supabase"
import {
  User,
  Lock,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  AlertTriangle,
} from "lucide-react"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]

interface ProfileFormProps {
  profile: Profile
  email: string
}

export default function ProfileForm({ profile, email }: ProfileFormProps) {
  // Profile section state
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Password section state
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("")

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSavingProfile(true)
    setProfileSaved(false)

    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(result.success)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
    setIsSavingProfile(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSavingPassword(true)

    const formData = new FormData(e.currentTarget)
    const result = await updatePassword(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Password updated successfully!")
      e.currentTarget.reset()
      setNewPassword("")
      setConfirmPasswordVal("")
    }
    setIsSavingPassword(false)
  }

  const passwordsMatch = newPassword.length >= 6 && confirmPasswordVal === newPassword


  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" }}
      className="settings-layout"
    >
      {/* ── LEFT: Main Forms ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* ── Profile Information ── */}
        <div className="cp-card">
          <div className="cp-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div style={{
                width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
                background: "var(--cp-coral-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User style={{ width: "1rem", height: "1rem", color: "var(--cp-coral-dark)" }} />
              </div>
              <p className="cp-card-title">Profile Information</p>
            </div>
          </div>

          <div className="cp-card-body">
            <form onSubmit={handleProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

              {/* Email (read-only) */}
              <div className="cp-form-group" style={{ marginBottom: 0 }}>
                {/* FIX: added htmlFor="email" so the label is programmatically associated with the input */}
                <label htmlFor="email" className="cp-label">
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Mail style={{ width: "0.8125rem", height: "0.8125rem" }} />
                    Email Address
                  </span>
                </label>
                <div style={{ position: "relative" }}>
                  {/* FIX: added id="email" to match the label's htmlFor */}
                  <input
                    id="email"
                    className="cp-input"
                    value={email}
                    disabled
                    style={{
                      background: "var(--cp-surface-2)",
                      color: "var(--cp-text-muted)",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                  Contact support to change your email address.
                </p>
              </div>

              {/* Name row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
                <div className="cp-form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="firstName" className="cp-label">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    className="cp-input"
                    defaultValue={profile.first_name || ""}
                    placeholder="First name"
                  />
                </div>
                <div className="cp-form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="middleName" className="cp-label">
                    Middle Name <span style={{ fontWeight: 400, color: "var(--cp-text-muted)" }}>(optional)</span>
                  </label>
                  <input
                    id="middleName"
                    name="middleName"
                    className="cp-input"
                    defaultValue={profile.middle_name || ""}
                    placeholder="Middle name"
                  />
                </div>
                <div className="cp-form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="lastName" className="cp-label">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    className="cp-input"
                    defaultValue={profile.last_name || ""}
                    placeholder="Last name"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="cp-form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="bio" className="cp-label">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  className="cp-textarea"
                  defaultValue={profile.bio || ""}
                  placeholder="Tell students a little about yourself and your role…"
                  rows={3}
                />
              </div>

              {/* Save */}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem" }}>
                {profileSaved && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: "0.375rem",
                    fontSize: "0.8125rem", fontWeight: 600, color: "#166534",
                    animation: "cp-fadein 0.2s ease",
                  }}>
                    <CheckCircle2 style={{ width: "1rem", height: "1rem" }} />
                    Saved
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="cp-btn cp-btn-primary"
                  style={{ minWidth: "140px", opacity: isSavingProfile ? 0.7 : 1 }}
                >
                  {isSavingProfile ? (
                    <>
                      <span style={{
                        width: "1rem", height: "1rem", borderRadius: "50%",
                        border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "white",
                        animation: "cp-spin 0.7s linear infinite", display: "inline-block",
                      }} />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save style={{ width: "1rem", height: "1rem" }} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Password / Security ── */}
        <div className="cp-card">
          <div className="cp-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div style={{
                width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
                background: "var(--cp-navy-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Lock style={{ width: "1rem", height: "1rem", color: "var(--cp-navy)" }} />
              </div>
              <p className="cp-card-title">Account Security</p>
            </div>
          </div>

          <div className="cp-card-body">
            <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

              {/* New Password */}
              <div className="cp-form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="new_password" className="cp-label">New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new_password"
                    name="new_password"
                    type={showNewPw ? "text" : "password"}
                    className="cp-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{ paddingRight: "2.75rem" }}
                    required
                    minLength={6}
                  />
                  {/* FIX: added aria-label so screen readers can identify this icon-only toggle */}
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    aria-label={showNewPw ? "Hide new password" : "Show new password"}
                    style={{
                      position: "absolute", right: "0.75rem", top: "50%",
                      transform: "translateY(-50%)", background: "none", border: "none",
                      cursor: "pointer", color: "var(--cp-text-muted)", padding: "0.25rem",
                      display: "flex", alignItems: "center",
                    }}
                  >
                    {showNewPw
                      ? <EyeOff style={{ width: "1rem", height: "1rem" }} />
                      : <Eye style={{ width: "1rem", height: "1rem" }} />
                    }
                  </button>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                  Minimum 6 characters.
                </p>
              </div>

              {/* Confirm Password */}
              <div className="cp-form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="confirm_password" className="cp-label">Confirm New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type={showConfirmPw ? "text" : "password"}
                    className="cp-input"
                    placeholder="Re-enter new password"
                    style={{ paddingRight: "2.75rem" }}
                    value={confirmPasswordVal}
                    onChange={(e) => setConfirmPasswordVal(e.target.value)}
                    required
                  />
                  {/* FIX: added aria-label so screen readers can identify this icon-only toggle */}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    aria-label={showConfirmPw ? "Hide confirm password" : "Show confirm password"}
                    style={{
                      position: "absolute", right: "0.75rem", top: "50%",
                      transform: "translateY(-50%)", background: "none", border: "none",
                      cursor: "pointer", color: "var(--cp-text-muted)", padding: "0.25rem",
                      display: "flex", alignItems: "center",
                    }}
                  >
                    {showConfirmPw
                      ? <EyeOff style={{ width: "1rem", height: "1rem" }} />
                      : <Eye style={{ width: "1rem", height: "1rem" }} />
                    }
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={isSavingPassword || !passwordsMatch}
                  className="cp-btn cp-btn-outline"
                  style={{
                    minWidth: "160px",
                    opacity: isSavingPassword || !passwordsMatch ? 0.6 : 1,
                  }}
                >
                  {isSavingPassword ? (
                    <>
                      <span style={{
                        width: "1rem", height: "1rem", borderRadius: "50%",
                        border: "2px solid rgba(44,62,80,0.3)", borderTopColor: "var(--cp-navy)",
                        animation: "cp-spin 0.7s linear infinite", display: "inline-block",
                      }} />
                      Updating…
                    </>
                  ) : (
                    <>
                      <Lock style={{ width: "0.875rem", height: "0.875rem" }} />
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="cp-card" style={{ border: "1.5px solid rgba(239,68,68,0.2)" }}>
          <div className="cp-card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div style={{
                width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
                background: "rgba(239,68,68,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#B91C1C" }} />
              </div>
              <p className="cp-card-title" style={{ color: "#B91C1C" }}>Danger Zone</p>
            </div>
          </div>
          <div className="cp-card-body">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--cp-navy)" }}>Delete Account</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)", marginTop: "0.2rem" }}>
                  Permanently remove your account and all associated data.
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast.error("To delete your account, please contact support@zamhack.com")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--cp-radius-md, 12px)",
                  border: "1.5px solid rgba(239,68,68,0.4)",
                  background: "transparent",
                  color: "#B91C1C",
                  fontWeight: 700, fontSize: "0.8125rem",
                  cursor: "pointer", transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239,68,68,0.08)"
                  e.currentTarget.style.borderColor = "#B91C1C"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent"
                  e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── RIGHT: Sidebar ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Profile preview card */}
        <div className="cp-card">
          <div style={{
            height: "60px",
            background: "var(--cp-grad-hero)",
            borderRadius: "var(--cp-radius-xl, 20px) var(--cp-radius-xl, 20px) 0 0",
          }} />
          <div style={{ padding: "0 1.25rem 1.25rem", marginTop: "-1.75rem" }}>
            <div style={{
              width: "3.5rem", height: "3.5rem", borderRadius: "50%",
              background: "var(--cp-grad-coral)",
              border: "3px solid white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "1.125rem", color: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              marginBottom: "0.75rem",
              overflow: "hidden",
            }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                `${profile.first_name?.charAt(0) || ""}${profile.last_name?.charAt(0) || ""}`.toUpperCase() || "?"
              )}
            </div>
            <p style={{ fontWeight: 800, fontSize: "1rem", color: "var(--cp-navy)", letterSpacing: "-0.01em" }}>
              {[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "Your Name"}
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--cp-text-muted)", marginTop: "0.2rem" }}>
              {email}
            </p>
            {profile.bio && (
              <p style={{
                fontSize: "0.8rem", color: "var(--cp-text-secondary)", marginTop: "0.625rem",
                lineHeight: 1.5,
                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {profile.bio}
              </p>
            )}
          </div>
        </div>

        {/* Account info */}
        <div className="cp-card">
          <div className="cp-card-header">
            <p className="cp-card-title">Account Info</p>
          </div>
          <div className="cp-card-body" style={{ padding: "0.75rem 1.25rem 1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)" }}>Role</span>
                <span className="cp-badge active" style={{ textTransform: "capitalize" }}>
                  <span className="cp-badge-dot" />
                  {(profile.role || "").replace("_", " ")}
                </span>
              </div>
              <div style={{ height: "1px", background: "var(--cp-border)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)" }}>Member Since</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cp-text-secondary)" }}>
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                    : "—"}
                </span>
              </div>
              <div style={{ height: "1px", background: "var(--cp-border)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--cp-text-muted)" }}>Last Updated</span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cp-text-secondary)" }}>
                  {profile.updated_at
                    ? new Date(profile.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Never"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security tips */}
        <div className="cp-card">
          <div className="cp-card-header">
            <p className="cp-card-title">Security Tips</p>
          </div>
          <div className="cp-card-body" style={{ padding: "0.75rem 1.25rem 1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {[
                "Use a strong, unique password",
                "Never share your login credentials",
                "Contact support to change your email",
                "Log out on shared devices",
              ].map((tip, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                  <span style={{
                    width: "1.375rem", height: "1.375rem", borderRadius: "50%", flexShrink: 0,
                    background: "var(--cp-grad-navy)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.625rem", fontWeight: 800, color: "white", marginTop: "0.05rem",
                  }}>
                    {i + 1}
                  </span>
                  <p style={{ fontSize: "0.8125rem", color: "var(--cp-text-secondary)", lineHeight: 1.55 }}>
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes cp-spin { to { transform: rotate(360deg); } }
        @keyframes cp-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 900px) {
          .settings-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}