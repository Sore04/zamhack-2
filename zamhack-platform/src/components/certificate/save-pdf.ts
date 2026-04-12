import type { jsPDF } from "jspdf"

export async function savePdfFile(pdf: jsPDF, filename: string): Promise<void> {
  const blob = pdf.output("blob")
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Small delay so the browser has time to initiate the download before the URL is freed
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
