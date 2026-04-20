"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: "Not authenticated" }

  const file = formData.get("avatar") as File | null
  if (!file || file.size === 0) return { error: "No file provided" }

  // Validate type
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowed.includes(file.type)) {
    return { error: "Only JPG, PNG, WebP or GIF images are allowed" }
  }

  // Validate size (2 MB)
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Image must be under 2 MB" }
  }

  const ext = file.name.split(".").pop() ?? "jpg"
  const storagePath = `${user.id}/avatar.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error("Avatar upload error:", uploadError)
    return { error: `Upload failed: ${uploadError.message}` }
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(storagePath)

  // Add a cache-buster so the browser fetches the new image immediately
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  // Save to profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  if (updateError) {
    return { error: `Failed to save avatar: ${updateError.message}` }
  }

  revalidatePath("/profile")
  return { success: true, avatarUrl }
}