"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"
import { logActivity, ActivityAction, EntityType } from "@/lib/activity-log"

function getAdminSupabase() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function updateOrganization(orgId: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.organization_id !== orgId) {
    return { error: "Unauthorized access to this organization" }
  }

  if (profile.role !== "company_admin") {
    return { error: "Only admins can edit organization details" }
  }

  const name = formData.get("name") as string
  const industry = formData.get("industry") as string
  const description = formData.get("description") as string
  const website = formData.get("website") as string
  const logo_url = formData.get("logo_url") as string
  const repFirst = (formData.get("rep_first_name") as string || "").trim()
  const repMiddle = (formData.get("rep_middle_name") as string || "").trim()
  const repLast = (formData.get("rep_last_name") as string || "").trim()
  const representative_name = [repFirst, repMiddle, repLast].filter(Boolean).join(" ")
  const signatureFile = formData.get("signature_file")

  if (!name) return { error: "Company name is required" }

  // Handle signature image upload to Supabase Storage
  let newSignaturePath: string | undefined = undefined // undefined = don't touch existing

  if (signatureFile instanceof File && signatureFile.size > 0) {
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"]
    if (!allowedTypes.includes(signatureFile.type)) {
      return { error: "Signature must be a PNG, JPEG, or WebP image" }
    }
    if (signatureFile.size > 2 * 1024 * 1024) {
      return { error: "Signature image must be under 2 MB" }
    }

    const adminSupabase = getAdminSupabase()
    const storagePath = `org-${orgId}/signature`
    const bytes = await signatureFile.arrayBuffer()

    const { error: uploadError } = await adminSupabase.storage
      .from("signatures")
      .upload(storagePath, bytes, {
        contentType: signatureFile.type,
        upsert: true,
      })

    if (uploadError) return { error: `Signature upload failed: ${uploadError.message}` }
    newSignaturePath = storagePath
  }

  const updatePayload: Record<string, unknown> = {
    name,
    industry: industry || null,
    description: description || null,
    website: website || null,
    logo_url: logo_url || null,
    representative_name: representative_name || null,
    updated_at: new Date().toISOString(),
  }

  if (newSignaturePath !== undefined) {
    updatePayload.signature_url = newSignaturePath
  }

  const adminSupabase = getAdminSupabase()
  const { error } = await adminSupabase
    .from("organizations")
    .update(updatePayload)
    .eq("id", orgId)

  if (error) return { error: error.message }

  await logActivity({
    log_type: 'company',
    actor_id: user.id,
    organization_id: orgId,
    action: ActivityAction.ORG_PROFILE_UPDATED,
    entity_type: EntityType.ORGANIZATION,
    entity_id: orgId,
    entity_label: name,
    metadata: { updated_fields: Object.keys(updatePayload) },
  })

  revalidatePath("/company/organization")
  return { success: "Organization updated successfully!" }
}