import { createClient } from "@/utils/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { CompanyMessagesClient } from "./messages-client"

export default async function CompanyMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>
}) {
  const { conversation: activeConversationId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: participations } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", user.id)

  const conversationIds = (participations ?? []).map((p) => p.conversation_id)

  let conversations: any[] = []
  if (conversationIds.length > 0) {
    const { data } = await supabase
      .from("conversations")
      .select(`
        id, type, created_at,
        conversation_participants (
          profile_id,
          profiles (
            id, first_name, last_name, avatar_url, role,
            organization_id, organizations ( name )
          )
        ),
        messages ( id, content, created_at, sender_id, is_read )
      `)
      .in("id", conversationIds)
      .eq("type", "direct")
    conversations = (data ?? []).sort((a, b) => {
      const aLast = (a.messages as any[])?.reduce((max: string, m: any) => m.created_at > max ? m.created_at : max, "") ?? ""
      const bLast = (b.messages as any[])?.reduce((max: string, m: any) => m.created_at > max ? m.created_at : max, "") ?? ""
      return bLast.localeCompare(aLast)
    })
  }

  // Mark active conversation as read server-side (service role bypasses RLS)
  if (activeConversationId && conversationIds.includes(activeConversationId)) {
    const adminSupabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await adminSupabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", activeConversationId)
      .neq("sender_id", user.id)
  }

  const enriched = conversations.map((conv) => {
    const other = conv.conversation_participants?.find((p: any) => p.profile_id !== user.id)
    const sortedMsgs = [...(conv.messages ?? [])].sort(
      (a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )
    return {
      id: conv.id,
      otherProfile: other?.profiles ?? null,
      lastMessage: sortedMsgs[0] ?? null,
      unreadCount: conv.id === activeConversationId ? 0 :
        (conv.messages ?? []).filter((m: any) => !m.is_read && m.sender_id !== user.id).length,
    }
  })

  let activeMessages: any[] = []
  let activeOtherProfile: any = null
  if (activeConversationId && conversationIds.includes(activeConversationId)) {
    const { data: msgs } = await supabase
      .from("messages")
      .select(`
        id, conversation_id, sender_id, content, created_at, is_read,
        sender_profile:profiles!sender_id ( first_name, last_name, role, avatar_url )
      `)
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
    activeMessages = msgs ?? []
    activeOtherProfile = enriched.find((c) => c.id === activeConversationId)?.otherProfile ?? null
  }

  return (
    <CompanyMessagesClient
      conversations={enriched}
      activeConversationId={activeConversationId ?? null}
      activeMessages={activeMessages}
      activeOtherProfile={activeOtherProfile}
      currentUserId={user.id}
    />
  )
}