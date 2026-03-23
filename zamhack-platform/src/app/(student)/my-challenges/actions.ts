"use server"

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function withdrawFromChallenge(
  challengeId: string
): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")

  // 1. Find the participant record
  const { data: participant, error: participantError } = await supabase
    .from("challenge_participants")
    .select("id, challenge_id")
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (participantError || !participant) {
    return { error: "You are not a participant in this challenge." }
  }

  // 2. Guard — only allow withdrawal from active challenges
  const { data: challenge } = await supabase
    .from("challenges")
    .select("status, title")
    .eq("id", challengeId)
    .single()

  const withdrawableStatuses = ["approved", "in_progress"]
  if (!challenge || !withdrawableStatuses.includes(challenge.status ?? "")) {
    return { error: "You can only withdraw from active challenges." }
  }

  // 3. Delete the participant row
  const { error: deleteError } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("id", participant.id)

  if (deleteError) {
    console.error("Withdraw error:", deleteError)
    return { error: "Something went wrong. Please try again." }
  }

  revalidatePath("/my-challenges")
  revalidatePath("/dashboard")
  redirect("/my-challenges")
}
