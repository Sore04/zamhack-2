"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function createTicket(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated" }
  }

  const subject = formData.get("subject") as string
  const message = formData.get("message") as string

  if (!subject || !message) {
    return { error: "Subject and message are required" }
  }

  // 1. Create conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ type: "support", source: "student" })
    .select("id")
    .single()

  if (convError || !conversation) {
    return { error: "Failed to create ticket" }
  }

  // 2. Add participant
  const { error: partError } = await supabase.from("conversation_participants").insert({
    conversation_id: conversation.id,
    profile_id: user.id,
  })

  if (partError) {
    return { error: "Failed to join conversation" }
  }

  // 3. Send initial message
  // We format the first message to include the subject for context
  const content = `Subject: ${subject}\n\n${message}`
  
  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    content: content,
  })

  if (msgError) {
    return { error: "Failed to send initial message" }
  }

  revalidatePath("/company/support")
  revalidatePath("/admin/support")
  
  return { success: "Ticket created successfully" }
}

export async function sendMessage(conversationId: string, content: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  if (!content.trim()) return { error: "Message cannot be empty" }

  // Check permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isAdmin = profile?.role === "admin"

  if (!isAdmin) {
    // If not admin, verify they are a participant in this conversation
    const { data: participant } = await supabase
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", conversationId)
      .eq("profile_id", user.id)
      .single()

    if (!participant) {
      return { error: "Unauthorized: You are not a participant in this ticket" }
    }
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: content,
  })

  if (error) {
    return { error: "Failed to send message" }
  }

  revalidatePath(`/company/support/${conversationId}`)
  revalidatePath(`/admin/support/${conversationId}`)
  
  return { success: true }
}