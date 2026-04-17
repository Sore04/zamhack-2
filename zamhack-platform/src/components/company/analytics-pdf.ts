import jsPDF from "jspdf"

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsPDFPayload {
  orgName: string
  filters: {
    dateFrom: Date | null
    dateTo: Date | null
    selectedChallengeIds: string[]
    selectedStatuses: string[]
  }
  overview: {
    totalParticipants: number
    totalSubmissions: number
    avgScore: number | null
    completionRate: number
  }
  challengePerformance: Array<{
    title: string
    participants: number
    submissions: number
    avgScore: number | null
    completionRate: number
  }>
  topSchools: Array<{ university: string; count: number }>
  topSkills: Array<{ name: string; beginner: number; intermediate: number; advanced: number }>
  submissionsOverTime: Array<{ week: string; count: number }>
}

// ── Color constants (non-React utility file — hardcoding is correct here) ──

const CORAL      = "#FF9B87"
const CORAL_DARK = "#E8836F"
const NAVY       = "#2C3E50"
const WHITE      = "#FFFFFF"
const SURFACE    = "#F8F9FB"
const MUTED      = "#7A909E"
const BORDER     = "#E0E4E8"

// ── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function setFill(doc: jsPDF, hex: string) {
  doc.setFillColor(...hexToRgb(hex))
}

function setTextColor(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex))
}

function setDrawColor(doc: jsPDF, hex: string) {
  doc.setDrawColor(...hexToRgb(hex))
}

function addPageFooter(doc: jsPDF, dateStr: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount = (doc as any).internal.getNumberOfPages() as number
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    setTextColor(doc, MUTED)
    doc.setFontSize(8)
    doc.text(
      `ZamHack Platform · Confidential · Generated ${dateStr}`,
      148.5,
      287,
      { align: "center" }
    )
    doc.text(`Page ${i} of ${pageCount}`, 190, 287, { align: "right" })
  }
}

function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  setTextColor(doc, NAVY)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(title, 15, y)
  setDrawColor(doc, CORAL)
  doc.setLineWidth(0.5)
  doc.line(15, y + 2, 195, y + 2)
  return y + 10
}

// ── Main export function ───────────────────────────────────────────────────

export async function exportAnalyticsPDF(payload: AnalyticsPDFPayload): Promise<void> {
  const {
    orgName,
    filters,
    overview,
    challengePerformance,
    topSchools,
    topSkills,
    submissionsOverTime,
  } = payload

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const fileDate = new Date().toISOString().slice(0, 10)

  // ── PAGE 1: Cover / Summary ──────────────────────────────────────────────

  // Header bar
  setFill(doc, CORAL)
  doc.rect(0, 0, 210, 28, "F")

  // Coral dark accent strip
  setFill(doc, CORAL_DARK)
  doc.rect(0, 24, 210, 4, "F")

  // Header text
  setTextColor(doc, WHITE)
  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("Analytics Report", 15, 16)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.text(orgName, 195, 10, { align: "right" })
  doc.text(dateStr, 195, 18, { align: "right" })

  let y = 38

  // Active filters block
  const hasFilters =
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.selectedChallengeIds.length > 0 ||
    filters.selectedStatuses.length > 0

  if (hasFilters) {
    setFill(doc, "#FFF0ED")
    doc.roundedRect(15, y, 180, 22, 3, 3, "F")
    setDrawColor(doc, CORAL)
    doc.setLineWidth(0.3)
    doc.roundedRect(15, y, 180, 22, 3, 3, "S")
    setTextColor(doc, CORAL_DARK)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("Active Filters:", 20, y + 7)
    doc.setFont("helvetica", "normal")
    const parts: string[] = []
    if (filters.dateFrom) parts.push(`From: ${filters.dateFrom.toLocaleDateString()}`)
    if (filters.dateTo)   parts.push(`To: ${filters.dateTo.toLocaleDateString()}`)
    if (filters.selectedStatuses.length > 0)
      parts.push(`Status: ${filters.selectedStatuses.join(", ")}`)
    if (filters.selectedChallengeIds.length > 0)
      parts.push(`${filters.selectedChallengeIds.length} challenge(s) selected`)
    doc.text(parts.join("  ·  "), 20, y + 14, { maxWidth: 170 })
    y += 30
  }

  // KPI 2×2 grid
  const kpis = [
    { label: "Unique Participants", value: String(overview.totalParticipants) },
    { label: "Total Submissions",   value: String(overview.totalSubmissions) },
    { label: "Avg Score",           value: overview.avgScore !== null ? String(overview.avgScore) : "—" },
    { label: "Completion Rate",     value: `${overview.completionRate}%` },
  ]

  const boxW = 85
  const boxH = 28
  const cols = [15, 110]
  const rows = [y, y + 34]

  kpis.forEach((kpi, i) => {
    const x    = cols[i % 2]
    const rowY = rows[Math.floor(i / 2)]
    setFill(doc, WHITE)
    setDrawColor(doc, BORDER)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, rowY, boxW, boxH, 3, 3, "FD")
    setFill(doc, NAVY)
    doc.roundedRect(x, rowY, 3, boxH, 1, 1, "F")
    setTextColor(doc, MUTED)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(kpi.label, x + 8, rowY + 9)
    setTextColor(doc, CORAL_DARK)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text(kpi.value, x + 8, rowY + 22)
  })

  y = rows[1] + boxH + 14

  // Submissions over time table
  y = addSectionHeader(doc, "Submissions Over Time", y)

  const timeColWidths = [120, 60]
  const timeHeaders   = ["Week", "Submissions"]

  setFill(doc, NAVY)
  doc.rect(15, y, 180, 8, "F")
  setTextColor(doc, WHITE)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  let cx = 18
  timeHeaders.forEach((h, i) => {
    doc.text(h, cx, y + 5.5)
    cx += timeColWidths[i]
  })
  y += 8

  submissionsOverTime.slice(0, 8).forEach((row, idx) => {
    setFill(doc, idx % 2 === 0 ? WHITE : SURFACE)
    doc.rect(15, y, 180, 7, "F")
    setTextColor(doc, NAVY)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(row.week, 18, y + 5)
    doc.text(String(row.count), 138, y + 5)
    y += 7
  })

  // ── PAGE 2: Challenge Performance ────────────────────────────────────────

  doc.addPage()
  y = 20
  y = addSectionHeader(doc, "Challenge Performance", y)

  const perfHeaders = ["Challenge", "Participants", "Submissions", "Avg Score", "Completion"]
  const perfWidths  = [70, 28, 28, 28, 26]

  function drawTableHeader(startY: number): number {
    setFill(doc, NAVY)
    doc.rect(15, startY, 180, 8, "F")
    setTextColor(doc, WHITE)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    let hx = 18
    perfHeaders.forEach((h, i) => {
      doc.text(h, hx, startY + 5.5)
      hx += perfWidths[i]
    })
    return startY + 8
  }

  y = drawTableHeader(y)

  challengePerformance.forEach((row, idx) => {
    if (y > 270) {
      doc.addPage()
      y = 20
      y = drawTableHeader(y)
    }
    setFill(doc, idx % 2 === 0 ? WHITE : SURFACE)
    doc.rect(15, y, 180, 7, "F")
    setTextColor(doc, NAVY)
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    const title = row.title.length > 32 ? row.title.slice(0, 29) + "…" : row.title
    doc.text(title, 18, y + 5)
    doc.text(String(row.participants), 92, y + 5)
    doc.text(String(row.submissions), 120, y + 5)
    doc.text(row.avgScore !== null ? String(row.avgScore) : "—", 148, y + 5)
    doc.text(`${row.completionRate}%`, 176, y + 5)
    y += 7
  })

  // ── PAGE 3: Talent Insights ───────────────────────────────────────────────

  doc.addPage()
  y = 20

  // Top Schools
  y = addSectionHeader(doc, "Top Schools", y)

  const schoolHeaders = ["University", "Participants"]
  const schoolWidths  = [140, 40]

  setFill(doc, NAVY)
  doc.rect(15, y, 180, 8, "F")
  setTextColor(doc, WHITE)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  let sx = 18
  schoolHeaders.forEach((h, i) => {
    doc.text(h, sx, y + 5.5)
    sx += schoolWidths[i]
  })
  y += 8

  topSchools.slice(0, 10).forEach((school, idx) => {
    setFill(doc, idx % 2 === 0 ? WHITE : SURFACE)
    doc.rect(15, y, 180, 7, "F")
    setTextColor(doc, NAVY)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    const uni =
      school.university.length > 50
        ? school.university.slice(0, 47) + "…"
        : school.university
    doc.text(uni, 18, y + 5)
    doc.text(String(school.count), 158, y + 5)
    y += 7
  })

  y += 12

  // Top Skills
  y = addSectionHeader(doc, "Top Skills", y)

  const skillHeaders = ["Skill", "Beginner", "Intermediate", "Advanced", "Total"]
  const skillWidths  = [70, 28, 32, 28, 22]

  setFill(doc, NAVY)
  doc.rect(15, y, 180, 8, "F")
  setTextColor(doc, WHITE)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  let skx = 18
  skillHeaders.forEach((h, i) => {
    doc.text(h, skx, y + 5.5)
    skx += skillWidths[i]
  })
  y += 8

  topSkills.slice(0, 10).forEach((skill, idx) => {
    setFill(doc, idx % 2 === 0 ? WHITE : SURFACE)
    doc.rect(15, y, 180, 7, "F")
    setTextColor(doc, NAVY)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    const total = skill.beginner + skill.intermediate + skill.advanced
    const name  = skill.name.length > 28 ? skill.name.slice(0, 25) + "…" : skill.name
    doc.text(name,                   18,  y + 5)
    doc.text(String(skill.beginner),  88,  y + 5)
    doc.text(String(skill.intermediate), 116, y + 5)
    doc.text(String(skill.advanced),  148, y + 5)
    doc.text(String(total),           176, y + 5)
    y += 7
  })

  // ── Footer on all pages ───────────────────────────────────────────────────

  addPageFooter(doc, dateStr)

  // ── Save ─────────────────────────────────────────────────────────────────

  doc.save(`zamhack-analytics-${fileDate}.pdf`)
}
