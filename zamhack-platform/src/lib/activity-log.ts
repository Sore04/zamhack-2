import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/supabase'

export const ActivityAction = {
  // Admin actions
  ORG_APPROVED:           'org.approved',
  ORG_REJECTED:           'org.rejected',
  CHALLENGE_APPROVED:     'challenge.approved',
  CHALLENGE_REJECTED:     'challenge.rejected',
  PENDING_EDIT_APPROVED:  'pending_edit.approved',
  PENDING_EDIT_REJECTED:  'pending_edit.rejected',
  USER_SUSPENDED:         'user.suspended',
  USER_UNSUSPENDED:       'user.unsuspended',
  USER_ROLE_CHANGED:      'user.role_changed',
  SETTINGS_UPDATED:       'settings.updated',
  EVALUATOR_ASSIGNED:     'evaluator.assigned',
  EVALUATOR_REMOVED:      'evaluator.removed',

  // Evaluation actions
  EVALUATION_EDITED:      'evaluation.edited',

  // Company actions
  CHALLENGE_CREATED:      'challenge.created',
  CHALLENGE_EDITED:       'challenge.edited',
  CHALLENGE_SUBMITTED:    'challenge.submitted',
  CHALLENGE_CANCELLED:    'challenge.cancelled',
  ORG_PROFILE_UPDATED:    'org.profile_updated',
  MEMBER_INVITED:         'member.invited',
  MEMBER_REMOVED:         'member.removed',
} as const

export type ActivityActionType = typeof ActivityAction[keyof typeof ActivityAction]

export const EntityType = {
  CHALLENGE:     'challenge',
  ORGANIZATION:  'organization',
  USER:          'user',
  SETTINGS:      'settings',
  PENDING_EDIT:  'pending_edit',
  EVALUATOR:     'evaluator',
  MEMBER:        'member',
} as const

export async function logActivity(payload: {
  log_type: 'admin' | 'company'
  actor_id: string
  organization_id?: string | null
  action: ActivityActionType
  entity_type?: string
  entity_id?: string
  entity_label?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('activity_logs').insert({
    ...payload,
    metadata: payload.metadata as Json | undefined,
  })

  if (error) {
    console.error('[logActivity] Failed to insert activity log:', error)
  }
}
