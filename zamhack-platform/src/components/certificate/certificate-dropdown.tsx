"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Download, ChevronDown, Award, Trophy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import CompletionCertificate from "@/components/certificate/certificate-template"
import WinnerCertificate from "@/components/certificate/winner-certificate-template"

interface Props {
  studentName: string
  challengeTitle: string
  organizationName: string
  completionDate: string
  isTop3: boolean
  rank?: 1 | 2 | 3
  awardDate: string
  representativeName?: string | null
  signatureUrl?: string | null
  verifyUrl?: string | null
}

type CertType = "completion" | "winner"

const RANK_LABEL: Record<number, string> = {
  1: "1st Place",
  2: "2nd Place",
  3: "3rd Place",
}

/**
 * Fetches a cross-origin image and converts it to a base64 data URL so it can
 * be embedded inside the sandboxed about:blank iframe without CORS errors.
 */
async function toDataUrl(src: string): Promise<string> {
  const res = await fetch(src, { mode: "cors" })
  const blob = await res.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Clones a node and replaces every <img src="…"> with a base64 data URL so
 * that images load correctly inside the sandboxed iframe regardless of CORS.
 */
async function cloneWithInlinedImages(node: HTMLElement): Promise<HTMLElement> {
  const cloned = node.cloneNode(true) as HTMLElement
  const imgs = Array.from(cloned.querySelectorAll("img[src]")) as HTMLImageElement[]
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src")
      if (src && !src.startsWith("data:")) {
        try {
          img.src = await toDataUrl(src)
        } catch {
          // If preload fails leave the src as-is; html2canvas will try useCORS
        }
      }
    })
  )
  return cloned
}

/**
 * Renders the certificate node inside a sandboxed iframe to fully isolate it
 * from the page's shadcn CSS variables (which use oklch/lab colors that
 * html2canvas cannot parse). Returns a canvas of the rendered certificate.
 */
async function captureInIframe(node: HTMLElement): Promise<HTMLCanvasElement> {
  // Pre-convert cross-origin images (e.g. Supabase signed signature URL) to
  // data URLs on the main page where CORS is permitted. The about:blank iframe
  // has a null origin so it cannot load those URLs itself, causing html2canvas
  // to render a broken-image placeholder (the "swash" artefact).
  const cloned = await cloneWithInlinedImages(node)

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe")
    iframe.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1056px;height:748px;border:none;visibility:hidden;"
    document.body.appendChild(iframe)

    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument!
        // Reset all styles inside the iframe so no lab() variables bleed in
        doc.head.innerHTML = `<style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #ffffff; font-family: Georgia, serif; }
        </style>`
        doc.body.style.cssText = "background:#fff;margin:0;padding:0;"
        doc.body.appendChild(cloned)

        // Give the iframe a moment to paint
        await new Promise((r) => setTimeout(r, 150))

        const html2canvas = (await import("html2canvas")).default
        const canvas = await html2canvas(doc.body.firstChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 1056,
          windowHeight: 748,
        })
        resolve(canvas)
      } catch (err) {
        reject(err)
      } finally {
        document.body.removeChild(iframe)
      }
    }

    iframe.src = "about:blank"
  })
}

export default function CertificateDropdown({
  studentName,
  challengeTitle,
  organizationName,
  completionDate,
  isTop3,
  rank,
  awardDate,
  representativeName,
  signatureUrl,
  verifyUrl,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<CertType | null>(null)
  const [mounted, setMounted] = useState(false)

  const completionRef = useRef<HTMLDivElement>(null)
  const winnerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const handleDownload = async (type: CertType) => {
    const ref = type === "completion" ? completionRef : winnerRef
    if (!ref.current) return

    setOpen(false)
    setLoading(type)

    try {
      const jsPDF = (await import("jspdf")).default

      const canvas = await captureInIframe(ref.current)

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      pdf.addImage(imgData, "PNG", 0, 0, 297, 210)

      // Add a clickable + selectable link annotation over the verify URL area in the footer.
      // The certificate is 1056×748px mapped to 297×210mm (A4 landscape).
      // Scale: 297/1056 ≈ 0.281 mm/px.
      // The verify URL sits in the bottom-right column, approximately:
      //   x: 828–1008px → 233–283mm  |  y: 718–736px → 202–207mm
      if (verifyUrl) {
        const taggedUrl = `${verifyUrl}?type=${type}`
        const fullUrl = taggedUrl.startsWith("http") ? taggedUrl : `https://${taggedUrl}`
        // Invisible clickable rectangle over the verify URL text already rendered in the canvas.
        // Do NOT add a pdf.text() overlay — the URL is already in the HTML-captured image and
        // a second text layer would misalign / blur the text.
        pdf.link(233, 200, 50, 8, { url: fullUrl })
      }

      const safeName = studentName.replace(/\s+/g, "_")
      const safeChallenge = challengeTitle.replace(/\s+/g, "_").slice(0, 30)
      const prefix =
        type === "winner" && rank
          ? `Winner_${RANK_LABEL[rank].replace(" ", "")}`
          : "Completion"
      const { savePdfFile } = await import("@/components/certificate/save-pdf")
      await savePdfFile(pdf, `ZamHack_${prefix}_${safeName}_${safeChallenge}.pdf`)
    } catch (err) {
      console.error("Certificate generation failed:", err)
    } finally {
      setLoading(null)
    }
  }

  const isLoading = loading !== null

  return (
    <>
      {/* Hidden certificate nodes — kept in DOM so refs are always populated */}
      {mounted && createPortal(
        <div
          style={{
            position: "fixed",
            top: "-9999px",
            left: "-9999px",
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          <div ref={completionRef}>
            <CompletionCertificate
              studentName={studentName}
              challengeTitle={challengeTitle}
              organizationName={organizationName}
              completionDate={completionDate}
              representativeName={representativeName}
              signatureUrl={signatureUrl}
              verifyUrl={verifyUrl ? `${verifyUrl}?type=completion` : null}
            />
          </div>

          {isTop3 && rank && (
            <div ref={winnerRef}>
              <WinnerCertificate
                studentName={studentName}
                challengeTitle={challengeTitle}
                organizationName={organizationName}
                rank={rank}
                awardDate={awardDate}
                representativeName={representativeName}
                signatureUrl={signatureUrl}
                verifyUrl={verifyUrl ? `${verifyUrl}?type=winner` : null}
              />
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Visible button + dropdown */}
      <div className="relative">
        <Button
          onClick={() => setOpen((v) => !v)}
          disabled={isLoading}
          className="bg-[#FF9B87] hover:bg-[#E8836F] text-white font-semibold gap-2 shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isLoading ? "Generating…" : "Download Certificate"}
          {!isLoading && <ChevronDown className="h-4 w-4 ml-1 opacity-70" />}
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

            <div className="absolute right-0 mt-2 w-72 z-20 bg-white rounded-xl border border-border shadow-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Choose Certificate
                </p>
              </div>

              <button
                onClick={() => handleDownload("completion")}
                className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left group"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-[#FF9B87]/15 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FF9B87]/25 transition-colors">
                  <Award className="h-4 w-4 text-[#E8836F]" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Certificate of Completion</p>
                  <p className="text-xs text-muted-foreground mt-0.5">For completing all challenge milestones</p>
                </div>
              </button>

              {isTop3 && rank && (
                <>
                  <div className="border-t" />
                  <button
                    onClick={() => handleDownload("winner")}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left group"
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                      <Trophy
                        className={`h-4 w-4 ${
                          rank === 1 ? "text-yellow-600" : rank === 2 ? "text-slate-500" : "text-amber-700"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        {RANK_LABEL[rank]} Winner Certificate
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        For placing {RANK_LABEL[rank].toLowerCase()} in this challenge
                      </p>
                    </div>
                  </button>
                </>
              )}

              <div className="px-4 py-2 bg-muted/20 border-t">
                <p className="text-[11px] text-muted-foreground">
                  Certificates are generated as PDF (A4 landscape)
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}