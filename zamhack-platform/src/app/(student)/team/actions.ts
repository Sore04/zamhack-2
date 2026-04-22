"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/types/supabase"

type TeamInsert = Database["public"]["Tables"]["teams"]["Insert"]
type TeamMemberInsert = Database["public"]["Tables"]["team_members"]["Insert"]

const MAX_TEAM_SIZE = 4

// Generate a random join code (6 characters, alphanumeric)
function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function createTeam(name: string) {
  return { error: "Team features are currently unavailable." }

  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user

  if (!user) {
    return { error: "You must be logged in to create a team" }
  }

  const { data: existingTeamMember } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", user!.id)
    .maybeSingle()

  if (existingTeamMember) {
    return { error: "You are already in a team. Leave your current team to create a new one." }
  }

  const joinCode = generateJoinCode()
  const teamData: TeamInsert = {
    name,
    leader_id: user!.id,
    join_code: joinCode,
  }

  const { data: newTeam, error: createError } = await supabase
    .from("teams")
    .insert(teamData)
    .select()
    .single()

  if (createError) {
    return { error: createError.message || "Failed to create team" }
  }

  const memberData: TeamMemberInsert = {
    team_id: newTeam.id,
    profile_id: user!.id,
    joined_at: new Date().toISOString(),
  }

  const { error: memberError } = await supabase
    .from("team_members")
    .insert(memberData)

  if (memberError) {
    await supabase.from("teams").delete().eq("id", newTeam.id)
    return { error: "Failed to join created team" }
  }

  revalidatePath("/team")
  return { success: true }
}

export async function joinTeam(code: string) {
  return { error: "Team features are currently unavailable." }

  const supabase = await createClient()

  const { data: authData } = await supabase.auth.getUser()
  const user = authData.user

  if (!user) {
    return { error: "You must be logged in to join a team" }
  }

  const { data: existingTeamMember } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", user!.id)
    .maybeSingle()

  if (existingTeamMember) {
    return { error: "You are already in a team. Leave your current team to join another." }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("join_code", code)
    .single()

  if (teamError || !team) {
    return { error: "Invalid invite code" }
  }

  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", team.id)

  if (count && count >= MAX_TEAM_SIZE) {
    return { error: "This team is full (max 4 members)" }
  }

  const memberData: TeamMemberInsert = {
    team_id: team.id,
    profile_id: user!.id,
    joined_at: new Date().toISOString(),
  }

  const { error: joinError } = await supabase
    .from("team_members")
    .insert(memberData)

  if (joinError) {
    return { error: joinError.message || "Failed to join team" }
  }

  revalidatePath("/team")
  return { success: true }
}

export async function leaveTeam() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be logged in" }
  }

  const { data: teamMember, error: memberError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", user.id)
    .single()

  // FIX: Extract ID to variable and check explicitly
  const teamId = teamMember?.team_id

  if (memberError || !teamMember || !teamId) {
    return { error: "You are not in a team" }
  }

  const { data: team } = await supabase
    .from("teams")
    .select("leader_id")
    .eq("id", teamId) // Now safe to use
    .single()

  if (team && team.leader_id === user.id) {
    return { error: "Team leaders cannot leave. You must delete the team or transfer leadership." }
  }

  const { error: leaveError } = await supabase
    .from("team_members")
    .delete()
    .eq("profile_id", user.id)

  if (leaveError) {
    return { error: leaveError.message || "Failed to leave team" }
  }

  revalidatePath("/team")
  return { success: true }
}

export async function deleteTeam() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be logged in" }
  }

  const { data: teamMember, error: memberError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", user.id)
    .single()

  // FIX: Extract ID to variable and check explicitly
  const teamId = teamMember?.team_id

  if (memberError || !teamMember || !teamId) {
    return { error: "You are not in a team" }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, leader_id")
    .eq("id", teamId) // Now safe to use
    .single()

  if (teamError || !team) {
    return { error: "Team not found" }
  }

  if (team.leader_id !== user.id) {
    return { error: "Only the team leader can delete the team" }
  }

  const { error: membersError } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", team.id)

  if (membersError) {
    return { error: "Failed to remove team members" }
  }

  const { error: deleteError } = await supabase
    .from("teams")
    .delete()
    .eq("id", team.id)

  if (deleteError) {
    return { error: deleteError.message || "Failed to delete team" }
  }

  revalidatePath("/team")
  return { success: true }
}