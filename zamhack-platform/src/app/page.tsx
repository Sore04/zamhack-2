import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { LandingPage } from "@/components/landingpage"
import { AuthRedirectHandler } from "./auth-redirect"

export default async function Home() {
  const supabase = await createClient()

  // 1. Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. If logged in, check their role and redirect intelligently
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
      redirect("/dashboard")
    }
  }

  // 3. If NOT logged in, show landing page + detect invite tokens in URL hash
  return (
    <>
      <AuthRedirectHandler />
      <LandingPage />
    </>
  )
}