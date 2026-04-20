"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updatePassword } from "@/app/settings/actions"
import { AlertCircle, Shield, Bell, Trash2, CheckCircle2, Eye, EyeOff } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [isSubmitting,       setIsSubmitting]       = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [success,            setSuccess]            = useState<string | null>(null)

  // Show/hide password toggles
  const [showPassword,       setShowPassword]       = useState(false)
  const [showConfirm,        setShowConfirm]        = useState(false)

  // Notification preferences (visual only for MVP) — identical to original
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [newChallenges,      setNewChallenges]      = useState(true)
  const [marketing,          setMarketing]          = useState(false)

  // ── Handlers (logic identical to original) ────────────────────────────────
  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result   = await updatePassword(formData)

      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setSuccess("Password updated successfully!")
        setError(null)
        e.currentTarget.reset()
      }
    } catch (err: any) {
    
   }
    finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAccount = () => {
    alert("Please contact admin to delete account")
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="st-page">

      {/* Page header */}
      <div className="st-page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account security and preferences</p>
      </div>

      <div className="st-sections">

        {/* ── Section 1: Account Security ──────────────────────────────── */}
        <section className="st-section">
          <div className="st-section-label">
            <div className="st-section-icon st-section-icon-coral">
              <Shield size={16} />
            </div>
            <div>
              <h2 className="st-section-title">Account Security</h2>
              <p className="st-section-desc">Change your password to keep your account secure</p>
            </div>
          </div>

          <div className="st-card">
            <form onSubmit={handlePasswordUpdate} className="st-form">

              {/* New password */}
              <div className="st-field">
                <Label htmlFor="new_password">New Password</Label>
                <div className="st-input-wrap">
                  <Input
                    id="new_password"
                    name="new_password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="st-eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="st-field">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <div className="st-input-wrap">
                  <Input
                    id="confirm_password"
                    name="confirm_password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm new password"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="st-eye-btn"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error feedback */}
              {error && (
                <div className="st-alert st-alert-error">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              {/* Success feedback */}
              {success && (
                <div className="st-alert st-alert-success">
                  <CheckCircle2 size={14} />
                  <span>{success}</span>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="st-btn-primary">
                {isSubmitting ? "Updating..." : "Update Password"}
              </button>

            </form>
          </div>
        </section>

        {/* ── Section 2: Notifications ─────────────────────────────────── */}
        <section className="st-section">
          <div className="st-section-label">
            <div className="st-section-icon st-section-icon-navy">
              <Bell size={16} />
            </div>
            <div>
              <h2 className="st-section-title">Notifications</h2>
              <p className="st-section-desc">Manage your notification preferences</p>
            </div>
          </div>

          <div className="st-card">
            <div className="st-toggles">

              <div className="st-toggle-row">
                <div className="st-toggle-info">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="st-toggle-desc">Receive email updates about your account</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="st-toggle-divider" />

              <div className="st-toggle-row">
                <div className="st-toggle-info">
                  <Label htmlFor="new-challenges">New Challenges</Label>
                  <p className="st-toggle-desc">Get notified about new challenges matching your skills</p>
                </div>
                <Switch
                  id="new-challenges"
                  checked={newChallenges}
                  onCheckedChange={setNewChallenges}
                />
              </div>

              <div className="st-toggle-divider" />

              <div className="st-toggle-row">
                <div className="st-toggle-info">
                  <Label htmlFor="marketing">Marketing & Announcements</Label>
                  <p className="st-toggle-desc">Receive updates about new features and platform news</p>
                </div>
                <Switch
                  id="marketing"
                  checked={marketing}
                  onCheckedChange={setMarketing}
                />
              </div>

            </div>
          </div>
        </section>

        {/* ── Section 3: Danger Zone ───────────────────────────────────── */}
        <section className="st-section">
          <div className="st-section-label">
            <div className="st-section-icon st-section-icon-danger">
              <Trash2 size={16} />
            </div>
            <div>
              <h2 className="st-section-title">Danger Zone</h2>
              <p className="st-section-desc">Irreversible and destructive actions</p>
            </div>
          </div>

          <div className="st-card st-card-danger">
            <div className="st-danger-row">
              <div>
                <p className="st-danger-label">Delete Account</p>
                <p className="st-danger-desc">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <button onClick={handleDeleteAccount} className="st-btn-danger">
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}