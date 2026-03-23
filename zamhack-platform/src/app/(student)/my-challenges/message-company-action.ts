"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function getOrCreateCompanyConversation(
  challengeId: string
): Promise<{ conversationId?: string; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  // 1. Get the challenge's organization_id
  const { data: challenge } = await supabase
    .from("challenges")
    .select("organization_id")
    .eq("id", challengeId)
    .single()

  if (!challenge?.organization_id) {
    return { error: "Challenge or organization not found." }
  }

  // 2. Find the company admin profile for that org
  const { data: companyAdmin } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", challenge.organization_id)
    .eq("role", "company_admin")
    .limit(1)
    .single()

  if (!companyAdmin) {
    return { error: "Could not find a company contact for this challenge." }
  }

  const companyProfileId = companyAdmin.id

  // 3. Check if a direct conversation already exists between this student and the company
  const { data: myParticipations } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", user.id)

  const myConversationIds = (myParticipations ?? []).map((p) => p.conversation_id)

  if (myConversationIds.length > 0) {
    const { data: sharedParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", companyProfileId)
      .in("conversation_id", myConversationIds)

    if (sharedParticipations && sharedParticipations.length > 0) {
      const sharedIds = sharedParticipations.map((p) => p.conversation_id)

      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "direct")
        .in("id", sharedIds)
        .limit(1)
        .single()

      if (conv) return { conversationId: conv.id }
    }
  }

  // 4. No existing conversation — create one
  const { data: newConv, error: convError } = await supabase
    .from("conversations")
    .insert({ type: "direct" })
    .select()
    .single()

  if (convError || !newConv) {
    return { error: "Failed to create conversation. Please try again." }
  }

  const { error: participantsError } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: newConv.id, profile_id: user.id },
      { conversation_id: newConv.id, profile_id: companyProfileId },
    ])

  if (participantsError) {
    return { error: "Failed to set up conversation. Please try again." }
  }

  return { conversationId: newConv.id }
}
