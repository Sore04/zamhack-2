"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be logged in to update your profile" }
  }

  // Extract form data
  const firstName = formData.get("first_name") as string | null
  const lastName = formData.get("last_name") as string | null
  const bio = formData.get("bio") as string | null
  const university = formData.get("university") as string | null
  const degree = formData.get("degree") as string | null
  const graduationYearStr = formData.get("graduation_year") as string | null
  const githubUrl = formData.get("github_url") as string | null
  const linkedinUrl = formData.get("linkedin_url") as string | null
  const resumeLink = formData.get("resume_link") as string | null

  // --- LOGIC FIXED HERE ---
  let graduationYear: number | null = null

  if (graduationYearStr) {
    const parsedYear = parseInt(graduationYearStr, 10)
    
    // Check validity on the parsed number specifically
    if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
      return { error: "Graduation year must be a valid year" }
    }
    
    graduationYear = parsedYear
  }
  // -----------------------

  // Prepare update data
  const updateData: ProfileUpdate = {
    first_name: firstName || null,
    last_name: lastName || null,
    bio: bio || null,
    university: university || null,
    degree: degree || null,
    graduation_year: graduationYear,
    github_url: githubUrl || null,
    linkedin_url: linkedinUrl || null,
    resume_link: resumeLink || null,
    updated_at: new Date().toISOString(),
  }

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/profile")
  return { success: true }
}