import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./settings-form"

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check Admin Role
  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (currentUserProfile?.role !== "admin") {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  // Fetch settings
  const { data: settings, error } = await supabase
    // FIX: Cast string to 'any' to bypass TS error for the new table
    .from("platform_settings" as any)
    .select("*")
    .eq("id", true)
    .single()

  if (error || !settings) {
    // Fallback if DB table is empty or error occurs
    console.error("Error fetching settings:", error)
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Error</h1>
        <p>Could not load platform settings. Please ensure the database is initialized.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">
          Manage global configuration and system status.
        </p>
      </div>

      <SettingsForm initialSettings={settings as any} />
    </div>
  )
}