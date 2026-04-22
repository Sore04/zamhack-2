"use client"

import { useState } from "react"
import { createTicket } from "@/app/actions/ticket-actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock } from "lucide-react"

const TOPIC_BUTTONS = [
  "Challenge Issue",
  "Submission Error",
  "Account Help",
  "Technical Issue",
  "Other",
]

export default function StudentSupportPage() {
  const [subject, setSubject]         = useState("")
  const [message, setMessage]         = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const handleTopicClick = (topic: string) => {
    setSubject(topic)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append("subject", subject)
    formData.append("message", message)

    const result = await createTicket(formData)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="st-page">

      {/* Page header */}
      <div className="st-page-header">
        <h1 className="page-title">Support</h1>
        <p className="page-subtitle">Get help from the ZamHack team</p>
      </div>

      <div style={{ maxWidth: "640px" }}>

        {success ? (
          <div className="st-card">
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
              padding: "2rem",
              textAlign: "center",
            }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(34,197,94,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle2 size={28} style={{ color: "#16a34a" }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: "1.0625rem", margin: "0 0 0.25rem" }}>
                  Message sent!
                </p>
                <p style={{ fontSize: "0.9rem", color: "var(--st-text-muted, #6b7280)", margin: 0 }}>
                  Your message has been sent. We'll get back to you shortly.
                </p>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                fontSize: "0.8125rem", color: "var(--st-text-muted, #6b7280)",
              }}>
                <Clock size={13} />
                We typically respond within 1–2 business days.
              </div>
              <Button
                variant="outline"
                onClick={() => { setSuccess(false); setSubject(""); setMessage("") }}
                style={{ marginTop: "0.25rem" }}
              >
                Send another message
              </Button>
            </div>
          </div>
        ) : (
          <div className="st-card">
            <div style={{ padding: "1.25rem 1.25rem 0.5rem", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <p style={{ fontWeight: 700, fontSize: "0.9375rem", margin: 0 }}>Contact Support</p>
              <div style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                fontSize: "0.8125rem", color: "var(--st-text-muted, #6b7280)",
              }}>
                <Clock size={13} />
                We typically respond within 1–2 business days.
              </div>
            </div>

            <div style={{ padding: "1.25rem" }}>
              {/* Topic quick-fill buttons */}
              <div style={{ marginBottom: "1.25rem" }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Quick topics
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {TOPIC_BUTTONS.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => handleTopicClick(topic)}
                      style={{
                        padding: "0.3rem 0.75rem",
                        borderRadius: "999px",
                        border: subject === topic
                          ? "1.5px solid var(--st-accent, #6366f1)"
                          : "1.5px solid rgba(0,0,0,0.1)",
                        background: subject === topic
                          ? "rgba(99,102,241,0.08)"
                          : "transparent",
                        color: subject === topic
                          ? "var(--st-accent, #6366f1)"
                          : "var(--st-text-muted, #6b7280)",
                        fontSize: "0.8125rem",
                        fontWeight: subject === topic ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Brief summary of your issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Describe your issue in detail..."
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p style={{ fontSize: "0.875rem", color: "#dc2626", margin: 0 }}>{error}</p>
                )}

                <button
                  type="submit"
                  className="st-btn-primary"
                  disabled={isSubmitting}
                  style={{ alignSelf: "flex-start" }}
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
