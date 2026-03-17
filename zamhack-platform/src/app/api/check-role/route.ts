import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    userId: user.id,
    userEmail: user.email,
    profile: profile,
    error: error?.message || null,
    expectedRedirect: profile?.role === 'company_admin' || profile?.role === 'company_member'
      ? '/company/dashboard'
      : profile?.role === 'admin'
      ? '/admin/dashboard'
      : profile?.role === 'evaluator'
      ? '/evaluator/dashboard'
      : '/dashboard'
  })
}