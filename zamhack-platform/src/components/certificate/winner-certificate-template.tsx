"use client"

import { forwardRef } from "react"

interface WinnerCertificateProps {
  studentName: string
  challengeTitle: string
  organizationName: string
  rank: 1 | 2 | 3
  score?: number | null
  awardDate: string
  representativeName?: string | null
  signatureUrl?: string | null
  verifyUrl?: string | null
}

const RANK_CONFIG = {
  1: {
    label: "1st Place", accent: "#D97706", accentLight: "#F59E0B",
    accentBg: "rgba(245,158,11,0.10)", accentBorder: "rgba(245,158,11,0.35)",
    gradient: "linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #FDE68A 100%)",
    gradientBg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
    title: "Gold Award",
    medallionBg: "linear-gradient(135deg, #B45309 0%, #D97706 40%, #F59E0B 70%, #FDE68A 100%)",
  },
  2: {
    label: "2nd Place", accent: "#64748B", accentLight: "#94A3B8",
    accentBg: "rgba(100,116,139,0.08)", accentBorder: "rgba(100,116,139,0.30)",
    gradient: "linear-gradient(135deg, #475569 0%, #64748B 50%, #CBD5E1 100%)",
    gradientBg: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
    title: "Silver Award",
    medallionBg: "linear-gradient(135deg, #334155 0%, #64748B 40%, #94A3B8 70%, #CBD5E1 100%)",
  },
  3: {
    label: "3rd Place", accent: "#B45309", accentLight: "#CD7C3A",
    accentBg: "rgba(180,83,9,0.08)", accentBorder: "rgba(180,83,9,0.28)",
    gradient: "linear-gradient(135deg, #92400E 0%, #B45309 50%, #D97706 100%)",
    gradientBg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 80%, #FDE68A 100%)",
    title: "Bronze Award",
    medallionBg: "linear-gradient(135deg, #78350F 0%, #92400E 40%, #B45309 70%, #D97706 100%)",
  },
}

const WinnerCertificate = forwardRef<HTMLDivElement, WinnerCertificateProps>(
  ({ studentName, challengeTitle, organizationName, rank, score, awardDate, representativeName, signatureUrl, verifyUrl }, ref) => {
    const cfg = RANK_CONFIG[rank]

    return (
      <div
        ref={ref}
        style={{
          width: "1056px",
          height: "748px",
          position: "relative",
          background: cfg.gradientBg,
          fontFamily: "Georgia, 'Times New Roman', serif",
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar */}
        <div style={{ flexShrink: 0, height: "8px", background: cfg.gradient }} />

        {/* Left accent */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "6px", height: "100%",
          background: cfg.gradient }} />

        {/* Bottom bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "5px",
          background: cfg.gradient }} />

        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "260px", height: "260px",
          borderRadius: "50%", background: cfg.accentBg, border: `2px solid ${cfg.accentBorder}` }} />
        <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "160px", height: "160px",
          borderRadius: "50%", background: cfg.accentBg }} />
        <div style={{ position: "absolute", bottom: "-80px", left: "20px", width: "220px", height: "220px",
          borderRadius: "50%", background: "rgba(44,62,80,0.05)", border: "2px solid rgba(44,62,80,0.07)" }} />

        {/* Diagonal ribbon */}
        <div style={{ position: "absolute", top: "32px", right: "-28px", width: "160px", height: "30px",
          background: cfg.gradient, transform: "rotate(45deg)",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#fff",
            letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {cfg.label}
          </span>
        </div>

        {/* ── CENTER BODY ── */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "60px",
          paddingRight: "60px",
          paddingBottom: "100px", // visual offset for footer
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
            gap: "10px", marginBottom: "4px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
              background: "linear-gradient(135deg, #FF9B87 0%, #E8836F 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(255,155,135,0.40)" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: "20px", fontWeight: "700", color: "#2C3E50", letterSpacing: "0.05em" }}>
              ZamHack
            </span>
          </div>

          {/* Award title */}
          <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.22em",
            color: cfg.accent, textTransform: "uppercase", marginBottom: "4px", textAlign: "center" }}>
            {cfg.title}
          </div>

          {/* Divider */}
          <div style={{ width: "90px", height: "2px", background: cfg.gradient,
            borderRadius: "2px", marginBottom: "12px" }} />

          {/* Medallion — table/table-cell for guaranteed centering in html2canvas */}
          <div style={{
            width: "76px", height: "76px", borderRadius: "50%",
            background: cfg.medallionBg,
            boxShadow: `0 8px 32px ${cfg.accentBorder}, 0 2px 8px rgba(0,0,0,0.15)`,
            border: "4px solid rgba(255,255,255,0.6)",
            marginBottom: "10px", flexShrink: 0,
            display: "table",
          }}>
            <div style={{ display: "table-cell", textAlign: "center", verticalAlign: "middle",
              fontSize: "30px", color: "rgba(255,255,255,0.95)", fontWeight: "900",
              fontFamily: "Georgia, serif", lineHeight: "1" }}>
              {rank}
            </div>
          </div>

          <p style={{ fontSize: "13px", color: "#7A909E", fontStyle: "italic",
            margin: "0 0 4px 0", textAlign: "center" }}>
            Awarded to
          </p>

          {/* Student name */}
          <div style={{ fontSize: "44px", fontWeight: "700", color: "#1A252F",
            letterSpacing: "-0.02em", textAlign: "center", lineHeight: "1.15",
            fontFamily: "Georgia, serif", margin: "0" }}>
            {studentName}
          </div>

          {/* Name underline */}
          <div style={{ width: "280px", height: "3px", background: cfg.gradient,
            borderRadius: "2px", marginTop: "8px", marginBottom: "14px" }} />

          <p style={{ fontSize: "13px", color: "#7A909E", fontStyle: "italic",
            margin: "0 0 8px 0", textAlign: "center" }}>
            for achieving{" "}
            <span style={{ color: cfg.accent, fontWeight: "700", fontStyle: "normal" }}>{cfg.label}</span>{" "}in
          </p>

          {/* Challenge box — inline-block so it hugs text but stays centered */}
          <div style={{
            display: "inline-block",
            background: `linear-gradient(135deg, rgba(44,62,80,0.05) 0%, ${cfg.accentBg} 100%)`,
            border: `1px solid ${cfg.accentBorder}`,
            borderRadius: "10px",
            padding: "10px 32px",
            marginBottom: "6px",
            maxWidth: "800px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#1A252F",
              letterSpacing: "-0.01em", fontFamily: "Georgia, serif", textAlign: "center" }}>
              {challengeTitle}
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "#4A6072", margin: "0", textAlign: "center" }}>
            presented by{" "}
            <span style={{ fontWeight: "700", color: "#2C3E50" }}>{organizationName}</span>
          </p>

          {score !== null && score !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px",
              background: cfg.accentBg, border: `1px solid ${cfg.accentBorder}`,
              borderRadius: "999px", padding: "3px 14px" }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill={cfg.accent}>
                <path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" />
              </svg>
              <span style={{ fontSize: "12px", color: cfg.accent, fontWeight: "600" }}>
                Score: {score} pts
              </span>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          position: "absolute", left: "54px", right: "48px", bottom: "14px", height: "82px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          borderTop: "1px solid rgba(44,62,80,0.10)", paddingTop: "12px",
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
            <div style={{ width: "160px", height: "1px", background: cfg.accent, marginBottom: "4px" }} />
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1A252F" }}>
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

          {/* RIGHT: Date awarded + verification URL */}
          <div style={{ textAlign: "right", minWidth: "180px" }}>
            <div style={{ fontSize: "10px", color: "#7A909E", letterSpacing: "0.08em",
              textTransform: "uppercase" }}>Date Awarded</div>
            <div style={{ fontSize: "13px", color: "#2C3E50", fontWeight: "600", marginTop: "2px" }}>
              {awardDate}
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

WinnerCertificate.displayName = "WinnerCertificate"
export default WinnerCertificate