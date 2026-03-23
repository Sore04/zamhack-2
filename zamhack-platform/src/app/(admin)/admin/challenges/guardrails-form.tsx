"use client"

import { useState } from "react"
import { ShieldCheck, Info } from "lucide-react"
import { toast } from "sonner"
import { updateGuardrailLimit } from "@/app/admin/actions"

interface GuardrailsFormProps {
  currentLimit: number | null
}

export function GuardrailsForm({ currentLimit }: GuardrailsFormProps) {
  const [value, setValue] = useState(currentLimit !== null ? String(currentLimit) : "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const parsed = value === "" ? null : parseInt(value, 10)
    if (value !== "" && (isNaN(parsed!) || parsed! < 0)) {
      toast.error("Limit must be a non-negative integer, or leave blank to disable")
      return
    }

    setSaving(true)
    const result = await updateGuardrailLimit(parsed ?? null)
    if (result.success) {
      toast.success("Guardrail settings saved")
    } else {
      toast.error(result.error ?? "Failed to save settings")
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          padding: "0.5rem",
          borderRadius: "0.5rem",
          background: "color-mix(in srgb, var(--admin-coral) 12%, transparent)",
          color: "var(--admin-coral)",
          display: "flex",
        }}>
          <ShieldCheck style={{ width: 22, height: 22 }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--admin-gray-800)" }}>
            Advanced Student Guardrails
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--admin-gray-400)" }}>
            Limit how many beginner challenges advanced-tier students can join per week
          </div>
        </div>
      </div>

      {/* Info callout */}
      <div style={{
        display: "flex",
        gap: "0.625rem",
        padding: "0.875rem 1rem",
        borderRadius: "0.5rem",
        border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
        background: "color-mix(in srgb, #f59e0b 6%, transparent)",
        fontSize: "0.82rem",
        color: "#92400e",
      }}>
        <Info style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2 }} />
        <span>
          Any student who holds <strong>any skill at the advanced tier</strong> is subject to this limit.
          They can join at most <strong>N beginner challenges per 7-day rolling window</strong>, regardless of
          which specific skills they have. Leave blank to disable the guardrail entirely.
        </span>
      </div>

      {/* Form card */}
      <div className="admin-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label
            htmlFor="weekly-limit"
            style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--admin-gray-700)", marginBottom: "0.375rem" }}
          >
            Max beginner challenge joins per week
          </label>
          <p style={{ fontSize: "0.78rem", color: "var(--admin-gray-400)", marginBottom: "0.625rem" }}>
            Applies to all students who have earned any advanced-tier skill. Leave blank for no limit.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              id="weekly-limit"
              type="number"
              min={0}
              step={1}
              placeholder="No limit"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="admin-input"
              style={{ width: 120 }}
              disabled={saving}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
            />
            <button
              className="admin-btn admin-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div style={{
          padding: "0.75rem",
          borderRadius: "0.375rem",
          background: "var(--admin-gray-50)",
          border: "1px solid var(--admin-gray-100)",
          fontSize: "0.78rem",
          color: "var(--admin-gray-500)",
        }}>
          <strong>Current setting:</strong>{" "}
          {currentLimit === null
            ? "No limit (guardrail disabled)"
            : `${currentLimit} beginner challenge${currentLimit === 1 ? "" : "s"} per week`}
        </div>
      </div>
    </div>
  )
}
