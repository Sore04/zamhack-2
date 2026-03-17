import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function EvaluatorSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "evaluator") redirect("/login")

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Evaluator"

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="page-title">Account <span>Settings</span></h1>
        <p className="page-subtitle">Manage your evaluator account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Name</p>
            <p className="mt-0.5 text-slate-700">{fullName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Email</p>
            <p className="mt-0.5 text-slate-700">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Role</p>
            <p className="mt-0.5 text-slate-700 capitalize">Evaluator</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            To change your password, use the "Forgot password" flow on the login page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}