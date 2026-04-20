import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { closeChallengeInternal } from "@/app/challenges/actions"

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const isDev = process.env.NODE_ENV === "development"
  if (!isDev && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // 1. Activate approved challenges whose start_date has passed
  const { data: activatedRows } = await supabase
    .from("challenges")
    .update({ status: "in_progress" })
    .eq("status", "approved")
    .eq("is_perpetual", false)
    .lte("start_date", now)
    .select("id")

  const activated = activatedRows?.length ?? 0

  // 2. Find in_progress non-perpetual challenges past their end_date
  const { data: overdue } = await supabase
    .from("challenges")
    .select("id")
    .eq("status", "in_progress")
    .eq("is_perpetual", false)
    .lt("end_date", now)

  const closed: string[] = []
  const errors: { id: string; error: string }[] = []

  for (const challenge of overdue ?? []) {
    const result = await closeChallengeInternal(supabase as any, challenge.id, true)
    if (result.success) {
      closed.push(challenge.id)
    } else {
      errors.push({ id: challenge.id, error: result.error ?? "unknown error" })
    }
  }

  return NextResponse.json({
    activated: activated ?? 0,
    closed: closed.length,
    closedIds: closed,
    errors,
  })
}
