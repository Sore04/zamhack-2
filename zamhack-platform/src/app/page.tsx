import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
// We import the new component that holds your beautiful design
import { LandingPage } from "@/components/landingpage"

export default async function Home() {
  const supabase = await createClient()

  // 1. Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. If logged in, check their role and redirect intelligently
  // (This logic remains exactly the same as before)
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = profile?.role

    if (role === "admin") {
      redirect("/admin/dashboard")
    } else if (role === "company_admin" || role === "company_member") {
      redirect("/company/dashboard")
    } else if (role === "evaluator") {
      redirect("/evaluator/dashboard")
    } else {
      // Default to student dashboard
      redirect("/dashboard")
    }
  }

  // 3. If NOT logged in, show the NEW Landing Page component
  return <LandingPage />
}