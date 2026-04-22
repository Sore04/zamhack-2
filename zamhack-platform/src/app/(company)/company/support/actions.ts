"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function submitSupportRequest(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const subject = formData.get("subject") as string
  const message = formData.get("message") as string

  if (!subject || !message) {
    return { error: "Please fill in all fields." }
  }

  // 1. Create a new support conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ type: "support", source: "company" } as any)
    .select("id")
    .single()

  if (convError || !conversation) {
    console.error("Error creating conversation:", convError)
    return { error: "Failed to start support ticket. Please try again." }
  }

  // 2. Add the current user to the conversation participants
  const { error: partError } = await supabase.from("conversation_participants").insert({
    conversation_id: conversation.id,
    profile_id: user.id,
  })

  if (partError) {
    console.error("Error adding participant:", partError)
    return { error: "Failed to link user to ticket." }
  }

  // 3. Insert the message content formatted as requested
  const formattedContent = `Subject: ${subject}\n\n${message}`

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: user.id,
    content: formattedContent,
  })

  if (msgError) {
    console.error("Error sending message:", msgError)
    return { error: "Failed to send message content." }
  }

  return { success: "Support request sent successfully. Admin will review it shortly." }
}