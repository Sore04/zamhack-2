"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Define the shape manually since types might not be generated yet
interface PlatformSettingsUpdate {
  maintenance_mode: boolean
  allow_new_signups: boolean
  default_currency: string
}

export async function updatePlatformSettings(data: PlatformSettingsUpdate) {
  const supabase = await createClient()

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // 2. Admin Role Check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: "Unauthorized: Admin access required" }
  }

  // 3. Update the Singleton Row (ID is always true)
  const { error } = await supabase
    // FIX: Cast string to 'any' so TypeScript doesn't check against missing type definition
    .from("platform_settings" as any) 
    .update({
      maintenance_mode: data.maintenance_mode,
      allow_new_signups: data.allow_new_signups,
      default_currency: data.default_currency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)

  if (error) {
    console.error("Settings update failed:", error)
    return { error: "Failed to update settings" }
  }

  revalidatePath("/admin/settings")
  return { success: "Platform settings updated successfully" }
}