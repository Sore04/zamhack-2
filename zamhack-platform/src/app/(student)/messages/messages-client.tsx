"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Send, MessageCircle, Building2 } from "lucide-react"
import { sendDirectMessage, markConversationAsRead } from "@/app/actions/message-actions"
import { sessionReadIds } from "./session-read-ids"

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: string | null
  organization_id: string | null
  organizations?: { name: string } | null
}

interface ConversationItem {
  id: string
  otherProfile: Profile | null
  lastMessage: {
    content: string
    created_at: string | null
    sender_id: string | null
    is_read: boolean | null
  } | null
  unreadCount: number
}

interface Message {
  id: string
  conversation_id: string | null
  sender_id: string | null
  content: string
  created_at: string | null
  is_read: boolean | null
  sender_profile?: {
    first_name: string | null
    last_name: string | null
    role: string | null
    avatar_url: string | null
  }
}

interface MessagesClientProps {
  conversations: ConversationItem[]
  activeConversationId: string | null
  activeMessages: Message[]
  activeOtherProfile: Profile | null
  currentUserId: string
}

export function MessagesClient({
  conversations,
  activeConversationId,
  activeMessages,
  activeOtherProfile,
  currentUserId,
}: MessagesClientProps) {
  const [messages, setMessages] = useState<Message[]>(activeMessages)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingConvId, setPendingConvId] = useState<string | null>(null)

  const markedReadRef = useRef<Set<string>>(new Set())

  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(
    () => Object.fromEntries(
      conversations.map((c) => [c.id, sessionReadIds.has(c.id) ? 0 : c.unreadCount])
    )
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUnreadMap((prev) => {
      const next = { ...prev }
      for (const conv of conversations) {
        if (!markedReadRef.current.has(conv.id) && !sessionReadIds.has(conv.id)) {
          next[conv.id] = conv.unreadCount
        } else {
          next[conv.id] = 0
        }
      }
      return next
    })
  }, [conversations])

  useEffect(() => {
    setMessages(activeMessages)
  }, [activeMessages])

  useEffect(() => {
    if (!activeConversationId) return
    setPendingConvId(null)

    if (markedReadRef.current.has(activeConversationId)) return

    markedReadRef.current.add(activeConversationId)
    sessionReadIds.add(activeConversationId)

    setUnreadMap((prev) => ({ ...prev, [activeConversationId]: 0 }))

    markConversationAsRead(activeConversationId).then(() => {
      window.dispatchEvent(new Event('messages-read'))
    })
  }, [activeConversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSelectConversation = (id: string) => {
    setUnreadMap((prev) => ({ ...prev, [id]: 0 }))
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      router.push(`/messages/${id}`)
    } else {
      setPendingConvId(id)
      startTransition(() => { router.push(`/messages?conversation=${id}`) })
    }
  }

  const handleSend = async () => {
    if (!text.trim() || !activeConversationId) return
    setSending(true)
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: currentUserId,
      content: text.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
      sender_profile: { first_name: "Me", last_name: "", role: null, avatar_url: null },
    }
    setMessages((prev) => [...prev, optimistic])
    const sent = text
    setText("")
    const result = await sendDirectMessage(activeConversationId, sent)
    if (result.error) {
      toast.error(result.error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setText(sent)
    }
    setSending(false)
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ""
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  const getInitials = (p: Profile | null) => {
    if (!p) return "?"
    return `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "?"
  }

  const getName = (p: Profile | null) => {
    if (!p) return "Unknown"
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"
  }

  const getCompany = (p: Profile | null) => {
    return (p as any)?.organizations?.name ?? null
  }

  return (
    <>
      {/* Extend edge-to-edge on mobile, card view on desktop */}
      <style>{`
        @media (max-width: 767px) {
          .msg-shell {
            position: fixed !important;
            top: 64px !important;
            left: 0 !important; right: 0 !important; bottom: 0 !important;
            height: auto !important;
            border-radius: 0 !important; border: none !important; box-shadow: none !important;
            margin: 0 !important;
            z-index: 10;
          }
        }
        .msg-input-area { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
        @keyframes msg-progress {
          from { opacity: 0.4; transform: scaleX(0.3); transform-origin: left; }
          to   { opacity: 1;   transform: scaleX(1);   transform-origin: left; }
        }
      `}</style>

      <div
        className="msg-shell flex"
        style={{
          height: "calc(100vh - 128px)",
          background: "#fff",
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          gap: 0,
        }}
      >
        {/* ── Conversation List ── */}
        <div
          className="w-full md:w-[300px]"
          style={{
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "1.25rem 1.25rem 1rem", borderBottom: "1px solid #f3f4f6" }}>
            <h1 style={{ fontFamily: "var(--font-outfit, Outfit, sans-serif)", fontSize: "1.25rem", fontWeight: 700, color: "#2c3e50", margin: 0 }}>
              Messages
            </h1>
            <p style={{ fontSize: "0.775rem", color: "#9ca3af", marginTop: 2 }}>
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                <MessageCircle size={40} style={{ color: "#e5e7eb", margin: "0 auto 1rem" }} />
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: 500 }}>No messages yet</p>
                <p style={{ fontSize: "0.775rem", color: "#c4c9d4", marginTop: 4 }}>
                  Companies will appear here when they message you
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId
                const unread = unreadMap[conv.id] ?? 0
                const name = getName(conv.otherProfile)
                const company = getCompany(conv.otherProfile)
                const initials = getInitials(conv.otherProfile)

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    style={{
                      position: "relative",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem 1.25rem",
                      minHeight: 72,
                      background: isActive ? "rgba(255,155,135,0.08)" : "transparent",
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "1px solid #f9fafb",
                      borderLeft: isActive ? "3px solid #ff9b87" : "3px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s",
                      opacity: isPending && pendingConvId !== conv.id ? 0.6 : 1,
                    }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar style={{ width: 44, height: 44 }}>
                        <AvatarImage src={conv.otherProfile?.avatar_url ?? undefined} />
                        <AvatarFallback style={{ background: "linear-gradient(135deg,#ff9b87,#e8836f)", color: "#fff", fontSize: "0.8rem", fontWeight: 700 }}>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      {unread > 0 && (
                        <span style={{
                          position: "absolute", top: -2, right: -2,
                          background: "#e8836f", color: "#fff",
                          borderRadius: 999, fontSize: "0.6rem", fontWeight: 700,
                          minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                          padding: "0 3px",
                        }}>
                          {unread}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontWeight: unread > 0 ? 700 : 600, fontSize: "0.9rem", color: "#2c3e50", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>
                          {name}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "#9ca3af", flexShrink: 0, marginLeft: 4 }}>
                          {formatTime(conv.lastMessage?.created_at ?? null)}
                        </span>
                      </div>
                      {company && (
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                          <Building2 size={10} style={{ color: "#9ca3af" }} />
                          <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{company}</span>
                        </div>
                      )}
                      <p style={{
                        fontSize: "0.8rem",
                        color: unread > 0 ? "#4b5563" : "#9ca3af",
                        fontWeight: unread > 0 ? 500 : 400,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        marginTop: 2,
                      }}>
                        {conv.lastMessage
                          ? (conv.lastMessage.sender_id === currentUserId ? "You: " : "") + conv.lastMessage.content
                          : "No messages yet"}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span style={{
                        flexShrink: 0, background: "#e8836f", color: "#fff",
                        borderRadius: 999, fontSize: "0.65rem", fontWeight: 700,
                        padding: "2px 7px", marginLeft: 4,
                      }}>
                        {unread}
                      </span>
                    )}
                    {pendingConvId === conv.id && (
                      <span style={{
                        position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                        background: "linear-gradient(90deg, #ff9b87, #e8836f)",
                        animation: "msg-progress 0.8s ease-in-out infinite alternate",
                      }} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Chat Panel — hidden on mobile (separate page), shown on desktop ── */}
        <div
          className="hidden md:flex"
          style={{ flex: 1, flexDirection: "column", minWidth: 0 }}
        >
          {!activeConversationId ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", color: "#9ca3af" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(255,155,135,0.15),rgba(255,155,135,0.05))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle size={28} style={{ color: "#ff9b87" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontWeight: 600, color: "#4b5563", fontSize: "0.95rem" }}>Select a conversation</p>
                <p style={{ fontSize: "0.825rem", marginTop: 4 }}>Choose from your messages on the left</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "0.875rem", background: "#fff", flexShrink: 0 }}>
                <Avatar style={{ width: 40, height: 40 }}>
                  <AvatarImage src={activeOtherProfile?.avatar_url ?? undefined} />
                  <AvatarFallback style={{ background: "linear-gradient(135deg,#ff9b87,#e8836f)", color: "#fff", fontSize: "0.8rem", fontWeight: 700 }}>
                    {getInitials(activeOtherProfile)}
                  </AvatarFallback>
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#2c3e50", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {getName(activeOtherProfile)}
                  </p>
                  {getCompany(activeOtherProfile) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Building2 size={11} style={{ color: "#9ca3af" }} />
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{getCompany(activeOtherProfile)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages thread */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", marginTop: "2rem", color: "#9ca3af", fontSize: "0.875rem" }}>
                    No messages yet. Say hello! 👋
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.sender_id === currentUserId
                  const prevMsg = messages[i - 1]
                  const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {!isMe && isFirstInGroup && (
                        <span style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 3, marginLeft: 8 }}>
                          {msg.sender_profile?.first_name} {msg.sender_profile?.last_name}
                        </span>
                      )}
                      <div style={{
                        maxWidth: "75%",
                        padding: "0.625rem 0.875rem",
                        borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: isMe ? "linear-gradient(135deg,#ff9b87,#e8836f)" : "#f3f4f6",
                        color: isMe ? "#fff" : "#2c3e50",
                        fontSize: "0.9rem",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {msg.content}
                      </div>
                      <span style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 3, marginLeft: 4, marginRight: 4 }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )
                })}
                <div ref={scrollRef} />
              </div>

              {/* Input area — safe-area-aware for Capacitor */}
              <div
                className="msg-input-area"
                style={{ padding: "0.875rem 1.25rem 1rem", borderTop: "1px solid #f3f4f6", background: "#fff", display: "flex", gap: "0.75rem", alignItems: "flex-end", flexShrink: 0 }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  style={{
                    flex: 1, resize: "none", border: "1px solid #e5e7eb", borderRadius: 12,
                    padding: "0.75rem 1rem", fontSize: "1rem", fontFamily: "inherit",
                    outline: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
                    transition: "border-color 0.15s", WebkitAppearance: "none",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#ff9b87")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  style={{
                    width: 46, height: 46, borderRadius: 12, border: "none", cursor: "pointer",
                    background: text.trim() && !sending ? "linear-gradient(135deg,#ff9b87,#e8836f)" : "#f3f4f6",
                    color: text.trim() && !sending ? "#fff" : "#9ca3af",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.15s",
                  }}
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}