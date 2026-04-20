"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const firstName = formData.get("firstName") as string
  const middleName = formData.get("middleName") as string
  const lastName = formData.get("lastName") as string
  const bio = formData.get("bio") as string

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName || null,
      middle_name: middleName || null,
      last_name: lastName || null,
      bio: bio || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    console.error("Profile update error:", error)
    return { error: "Failed to update profile." }
  }

  revalidatePath("/company/settings")
  return { success: "Profile updated successfully." }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const newPassword = formData.get("new_password") as string
  const confirmPassword = formData.get("confirm_password") as string

  if (!newPassword || !confirmPassword) {
    return { error: "Both password fields are required." }
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  if (newPassword.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) return { error: error.message }

  return { success: "Password updated successfully." }
}