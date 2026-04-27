"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

const companyReadIds = new Set<string>()

export function CompanyUnreadBadge() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeConversationId = pathname === "/company/messages"
    ? searchParams.get("conversation")
    : null

  useEffect(() => {
    if (activeConversationId) {
      companyReadIds.add(activeConversationId)
      setCount(0)
    }
  }, [activeConversationId])

  const fetchCount = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", user.id)

    const allIds = (participations ?? []).map((p) => p.conversation_id)
    if (allIds.length === 0) { setCount(0); return }

    const { data: directConvs } = await supabase
      .from("conversations")
      .select("id")
      .in("id", allIds)
      .eq("type", "direct")

    const ids = (directConvs ?? []).map((c) => c.id)
    if (ids.length === 0) { setCount(0); return }

    const { data: unread } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .eq("is_read", false)
      .neq("sender_id", user.id)

    const distinct = new Set(
      (unread ?? [])
        .map((m) => m.conversation_id)
        .filter((id): id is string => id !== null && !companyReadIds.has(id))
    )
    setCount(distinct.size)
  }

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 8_000)
    const onRead = () => fetchCount()
    window.addEventListener("messages-read", onRead)
    return () => {
      clearInterval(interval)
      window.removeEventListener("messages-read", onRead)
    }
  }, [])

  if (count === 0) return null

  return (
    <span style={{
      marginLeft: "auto",
      background: "var(--cp-coral-dark, #e8836f)",
      color: "#fff",
      borderRadius: 999,
      fontSize: "0.65rem",
      fontWeight: 700,
      padding: "1px 7px",
      minWidth: 18,
      textAlign: "center",
    }}>
      {count}
    </span>
  )
}