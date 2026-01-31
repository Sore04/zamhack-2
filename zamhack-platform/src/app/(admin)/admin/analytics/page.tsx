import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building2, FileText, Trophy } from "lucide-react"

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check Admin Role
  const { data: currentUserProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (currentUserProfile?.role !== "admin") redirect("/dashboard")

  // Fetch metrics in parallel using 'count' option for efficiency
  const [students, companies, submissions, challenges] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("submissions").select("*", { count: "exact", head: true }),
    supabase.from("challenges").select("*", { count: "exact", head: true }),
  ])

  const stats = [
    {
      title: "Total Students",
      value: students.count || 0,
      icon: Users,
      description: "Registered student accounts",
    },
    {
      title: "Total Companies",
      value: companies.count || 0,
      icon: Building2,
      description: "Active organizations",
    },
    {
      title: "Total Submissions",
      value: submissions.count || 0,
      icon: FileText,
      description: "Project submissions across all challenges",
    },
    {
      title: "Total Challenges",
      value: challenges.count || 0,
      icon: Trophy,
      description: "Challenges created",
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Overview</h1>
        <p className="text-muted-foreground">Real-time metrics for the platform.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}