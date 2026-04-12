"use client"

import { forwardRef } from "react"

interface CompletionCertificateProps {
  studentName: string
  challengeTitle: string
  organizationName: string
  completionDate: string
  totalScore?: number | null
  representativeName?: string | null
  signatureUrl?: string | null
  verifyUrl?: string | null
}

const CompletionCertificate = forwardRef<HTMLDivElement, CompletionCertificateProps>(
  ({ studentName, challengeTitle, organizationName, completionDate, totalScore, representativeName, signatureUrl, verifyUrl }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: "1056px",
          height: "748px",
          position: "relative",
          background: "#FAFAF8",
          fontFamily: "Georgia, 'Times New Roman', serif",
          overflow: "hidden",
          boxSizing: "border-box",
          // True center of the whole certificate
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div style={{ flexShrink: 0, height: "8px",
          background: "linear-gradient(90deg, #2C3E50 0%, #FF9B87 60%, #E8836F 100%)" }} />

        {/* Left accent — absolutely positioned so it doesn't affect flex */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "6px", height: "100%",
          background: "linear-gradient(180deg, #FF9B87 0%, #E8836F 100%)" }} />

        {/* Bottom bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "5px",
          background: "linear-gradient(90deg, #E8836F 0%, #FF9B87 50%, #3B82F6 100%)" }} />

        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "200px", height: "200px",
          borderRadius: "50%", background: "rgba(255,155,135,0.12)", border: "2px solid rgba(255,155,135,0.2)" }} />
        <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "120px", height: "120px",
          borderRadius: "50%", background: "rgba(255,155,135,0.18)" }} />
        <div style={{ position: "absolute", bottom: "-60px", left: "30px", width: "180px", height: "180px",
          borderRadius: "50%", background: "rgba(44,62,80,0.06)", border: "2px solid rgba(44,62,80,0.08)" }} />

        {/* ── CENTER BODY: grows to fill space between top bar and footer ── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "60px",
          paddingRight: "60px",
          paddingBottom: "100px", // offset for footer height so content looks visually centered
          gap: "0px",
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            gap: "10px", marginBottom: "6px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
              background: "linear-gradient(135deg, #FF9B87 0%, #E8836F 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(255,155,135,0.40)" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: "22px", fontWeight: "700", color: "#2C3E50", letterSpacing: "0.05em" }}>
              ZamHack
            </span>
          </div>

          {/* Label */}
          <div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "0.25em",
            color: "#FF9B87", textTransform: "uppercase", marginBottom: "4px",
            textAlign: "center" }}>
            Certificate of Completion
          </div>

          {/* Divider */}
          <div style={{ width: "80px", height: "2px", marginBottom: "18px",
            background: "linear-gradient(90deg, transparent, #FF9B87, transparent)" }} />

          <p style={{ fontSize: "13px", color: "#7A909E", fontStyle: "italic",
            margin: "0 0 6px 0", textAlign: "center" }}>
            This is to certify that
          </p>

          {/* Student name */}
          <div style={{ fontSize: "48px", fontWeight: "700", color: "#2C3E50",
            letterSpacing: "-0.02em", textAlign: "center", lineHeight: "1.15",
            fontFamily: "Georgia, serif", margin: "0" }}>
            {studentName}
          </div>

          {/* Name underline */}
          <div style={{ width: "320px", height: "3px", borderRadius: "2px",
            marginTop: "8px", marginBottom: "18px",
            background: "linear-gradient(90deg, transparent, #FF9B87 40%, #E8836F 60%, transparent)" }} />

          <p style={{ fontSize: "13px", color: "#7A909E", fontStyle: "italic",
            margin: "0 0 10px 0", textAlign: "center" }}>
            has successfully completed all milestones in
          </p>

          {/* Challenge box — auto width, centered, expands with text */}
          <div style={{
            display: "inline-block",
            background: "linear-gradient(135deg, rgba(44,62,80,0.06) 0%, rgba(255,155,135,0.10) 100%)",
            border: "1px solid rgba(255,155,135,0.30)",
            borderRadius: "10px",
            padding: "12px 36px",
            marginBottom: "8px",
            maxWidth: "800px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#1A252F",
              letterSpacing: "-0.01em", fontFamily: "Georgia, serif", textAlign: "center" }}>
              {challengeTitle}
            </div>
          </div>

          <p style={{ fontSize: "13px", color: "#4A6072", margin: "0", textAlign: "center" }}>
            presented by{" "}
            <span style={{ fontWeight: "700", color: "#2C3E50" }}>{organizationName}</span>
          </p>

          {totalScore !== null && totalScore !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px",
              background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)",
              borderRadius: "999px", padding: "4px 16px" }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="#F59E0B">
                <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" />
              </svg>
              <span style={{ fontSize: "13px", color: "#92400E", fontWeight: "600" }}>
                Total Score: {totalScore} pts
              </span>
            </div>
          )}
        </div>

        {/* ── FOOTER: pinned to bottom absolutely ── */}
        <div style={{
          position: "absolute", left: "54px", right: "48px", bottom: "14px", height: "82px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          borderTop: "1px solid rgba(44,62,80,0.12)", paddingTop: "14px",
        }}>

          {/* LEFT: Company representative signature block */}
          <div style={{ minWidth: "180px" }}>
            {signatureUrl && (
              <img
                src={signatureUrl}
                alt="Signature"
                crossOrigin="anonymous"
                style={{
                  height: "36px", maxWidth: "160px", objectFit: "contain",
                  marginBottom: "2px", display: "block",
                }}
              />
            )}
            <div style={{ width: "160px", height: "1px", background: "#2C3E50", marginBottom: "4px" }} />
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#2C3E50" }}>
              {representativeName ?? "ZamHack Platform"}
            </div>
            {representativeName && (
              <div style={{ fontSize: "10px", color: "#7A909E", marginTop: "1px" }}>
                {organizationName}
              </div>
            )}
            {representativeName && (
              <div style={{ fontSize: "9px", color: "#7A909E", textTransform: "uppercase",
                letterSpacing: "0.08em", marginTop: "1px" }}>
                Representative
              </div>
            )}
          </div>

          {/* CENTER: spacer */}
          <div />

          {/* RIGHT: Date issued + verification URL */}
          <div style={{ textAlign: "right", minWidth: "180px" }}>
            <div style={{ fontSize: "10px", color: "#7A909E", letterSpacing: "0.08em",
              textTransform: "uppercase" }}>Date Issued</div>
            <div style={{ fontSize: "14px", color: "#2C3E50", fontWeight: "600", marginTop: "2px" }}>
              {completionDate}
            </div>
            {verifyUrl && (
              <div style={{ fontSize: "8px", color: "#A0B0BC", marginTop: "8px", letterSpacing: "0.02em" }}>
                To verify, go to:
                <br />
                {verifyUrl}
              </div>
            )}
          </div>

        </div>
      </div>
    )
  }
)

CompletionCertificate.displayName = "CompletionCertificate"
export default CompletionCertificate