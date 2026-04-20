"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateOrganization } from "./actions"
import { Database } from "@/types/supabase"
import {
  Building2,
  Globe,
  Layers,
  FileText,
  Save,
  CheckCircle2,
  Image as ImageIcon,
  PenLine,
  Upload,
} from "lucide-react"

type Organization = Database["public"]["Tables"]["organizations"]["Row"]

interface OrgFormProps {
  organization: Organization
}

function parseRepName(fullName: string | null) {
  if (!fullName) return { first: "", middle: "", last: "" }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" }
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] }
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] }
}

const INDUSTRIES = [
  "Technology", "Fintech", "EdTech", "Healthcare", "E-commerce",
  "Media & Entertainment", "Logistics", "Agriculture", "Manufacturing",
  "Retail", "Finance", "Real Estate", "Non-profit", "Other",
]

export function OrgForm({ organization }: OrgFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sigPreview, setSigPreview] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setSaved(false)

    const formData = new FormData(e.currentTarget)
    try {
      const result = await updateOrganization(organization.id, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* ── Section: Company Identity ── */}
      <div className="cp-card">
        <div className="cp-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
              background: "var(--cp-coral-muted)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Building2 style={{ width: "1rem", height: "1rem", color: "var(--cp-coral-dark)" }} />
            </div>
            <p className="cp-card-title">Company Identity</p>
          </div>
        </div>
        <div className="cp-card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

            {/* Company Name */}
            <div className="cp-form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="name" className="cp-label">
                Company Name <span style={{ color: "var(--cp-coral)" }}>*</span>
              </label>
              <input
                id="name"
                name="name"
                className="cp-input"
                defaultValue={organization.name}
                placeholder="e.g. Acme Corp"
                required
              />
              <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                This is the name students will see on your challenges.
              </p>
            </div>

            {/* Industry */}
            <div className="cp-form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="industry" className="cp-label">Industry</label>
              <select
                id="industry"
                name="industry"
                className="cp-input"
                defaultValue={organization.industry || ""}
                style={{ appearance: "auto" }}
              >
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

          </div>
        </div>
      </div>

      {/* ── Section: Online Presence ── */}
      <div className="cp-card">
        <div className="cp-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
              background: "var(--cp-navy-muted)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Globe style={{ width: "1rem", height: "1rem", color: "var(--cp-navy)" }} />
            </div>
            <p className="cp-card-title">Online Presence</p>
          </div>
        </div>
        <div className="cp-card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

            {/* Website */}
            <div className="cp-form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="website" className="cp-label">Website</label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                  fontSize: "0.8125rem", color: "var(--cp-text-muted)", pointerEvents: "none",
                  userSelect: "none",
                }}>
                  https://
                </span>
                <input
                  id="website"
                  name="website"
                  type="text"
                  className="cp-input"
                  defaultValue={organization.website || ""}
                  placeholder="yourcompany.com"
                  style={{ paddingLeft: "4.25rem" }}
                />
              </div>
            </div>

            {/* Logo URL */}
            <div className="cp-form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="logo_url" className="cp-label">
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <ImageIcon style={{ width: "0.875rem", height: "0.875rem" }} />
                  Logo URL
                </span>
              </label>
              <input
                id="logo_url"
                name="logo_url"
                type="text"
                className="cp-input"
                defaultValue={(organization as any).logo_url || ""}
                placeholder="https://yourcompany.com/logo.png"
              />
              {(organization as any).logo_url && (
                <div style={{ marginTop: "0.625rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <img
                    src={(organization as any).logo_url}
                    alt="Logo preview"
                    style={{
                      width: "2.5rem", height: "2.5rem", borderRadius: "var(--cp-radius-md, 12px)",
                      objectFit: "cover", border: "1px solid var(--cp-border)",
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)" }}>Current logo</span>
                </div>
              )}
              <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                Enter a public URL to your company logo (PNG, JPG, SVG). Shown on challenge cards.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Section: About ── */}
      <div className="cp-card">
        <div className="cp-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
              background: "var(--cp-coral-muted)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FileText style={{ width: "1rem", height: "1rem", color: "var(--cp-coral-dark)" }} />
            </div>
            <p className="cp-card-title">About Your Company</p>
          </div>
        </div>
        <div className="cp-card-body">
          <div className="cp-form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="description" className="cp-label">Description</label>
            <textarea
              id="description"
              name="description"
              className="cp-textarea"
              defaultValue={organization.description || ""}
              placeholder="Tell students what your company does, your mission, culture, and what kind of talent you're looking for…"
              rows={5}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
              Shown on your challenge pages. A compelling description attracts better talent.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section: Certificate Representative ── */}
      <div className="cp-card">
        <div className="cp-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: "2rem", height: "2rem", borderRadius: "var(--cp-radius-md, 12px)",
              background: "var(--cp-navy-muted)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <PenLine style={{ width: "1rem", height: "1rem", color: "var(--cp-navy)" }} />
            </div>
            <p className="cp-card-title">Certificate Representative</p>
          </div>
        </div>
        <div className="cp-card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

            {/* Representative Name */}
            <div className="cp-form-group" style={{ marginBottom: 0 }}>
              <label className="cp-label">Representative Name</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <input
                    id="rep_first_name"
                    name="rep_first_name"
                    className="cp-input"
                    defaultValue={parseRepName((organization as any).representative_name).first}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <input
                    id="rep_middle_name"
                    name="rep_middle_name"
                    className="cp-input"
                    defaultValue={parseRepName((organization as any).representative_name).middle}
                    placeholder="Middle name (optional)"
                  />
                </div>
                <div>
                  <input
                    id="rep_last_name"
                    name="rep_last_name"
                    className="cp-input"
                    defaultValue={parseRepName((organization as any).representative_name).last}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                The name printed on certificates issued for your challenges.
              </p>
            </div>

            {/* Signature Upload */}
            <div className="cp-form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="signature_file" className="cp-label">
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Upload style={{ width: "0.875rem", height: "0.875rem" }} />
                  Signature Image
                </span>
              </label>
              <input
                id="signature_file"
                name="signature_file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="cp-input"
                style={{ paddingTop: "0.4rem" }}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => setSigPreview(ev.target?.result as string)
                    reader.readAsDataURL(file)
                  } else {
                    setSigPreview(null)
                  }
                }}
              />
              {sigPreview ? (
                <div style={{ marginTop: "0.625rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <img
                    src={sigPreview}
                    alt="Signature preview"
                    style={{
                      height: "2.5rem", maxWidth: "10rem",
                      objectFit: "contain",
                      border: "1px solid var(--cp-border)",
                      borderRadius: "var(--cp-radius-sm, 6px)",
                      background: "white",
                      padding: "0.25rem",
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)" }}>New signature preview</span>
                </div>
              ) : (organization as any).signature_url ? (
                <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                  A signature is already on file. Upload a new image to replace it.
                </p>
              ) : null}
              <p style={{ fontSize: "0.75rem", color: "var(--cp-text-muted)", marginTop: "0.375rem" }}>
                PNG or JPEG with transparent or white background. Appears on all certificates from your organization.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Save Button ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", alignItems: "center" }}>
        {saved && (
          <span style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.8125rem", fontWeight: 600, color: "#166534",
            animation: "fadeIn 0.2s ease",
          }}>
            <CheckCircle2 style={{ width: "1rem", height: "1rem" }} />
            Saved successfully
          </span>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="cp-btn cp-btn-primary"
          style={{
            opacity: isSaving ? 0.7 : 1,
            cursor: isSaving ? "not-allowed" : "pointer",
            minWidth: "140px",
          }}
        >
          {isSaving ? (
            <>
              <span style={{
                width: "1rem", height: "1rem", borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "white",
                animation: "cp-spin 0.7s linear infinite",
                display: "inline-block",
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

      <style>{`
        @keyframes cp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .org-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  )
}