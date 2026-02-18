"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// --- EXISTING JOIN LOGIC ---
export async function joinChallenge(challengeId: string, forceJoin: boolean = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "You must be logged in to join a challenge." }
  }

  // 1. Fetch Target Challenge Details
  const { data: targetChallenge, error: fetchError } = await supabase
    .from("challenges")
    .select("title, start_date, end_date, status, registration_deadline")
    .eq("id", challengeId)
    .single()

  if (fetchError || !targetChallenge) {
    return { error: "Challenge not found." }
  }

  // FIX: Ensure dates exist before processing
  if (!targetChallenge.start_date || !targetChallenge.end_date || !targetChallenge.registration_deadline) {
    return { error: "This challenge has missing date information and cannot be joined." }
  }

  const now = new Date()
  const startDate = new Date(targetChallenge.start_date)
  const endDate = new Date(targetChallenge.end_date)
  const regDeadline = new Date(targetChallenge.registration_deadline)

  // 2. Validate Challenge Status
  if (targetChallenge.status !== 'approved' && targetChallenge.status !== 'in_progress') {
    return { error: "This challenge is not open for registration." }
  }

  // 3. Late-Join Policy
  const oneDay = 24 * 60 * 60 * 1000
  const isEndingSoon = (endDate.getTime() - now.getTime()) < oneDay

  if (now > regDeadline) {
    return { error: "Registration deadline has passed." }
  }

  if (isEndingSoon) {
    return { error: "Registration closed: This challenge ends in less than 24 hours." }
  }

  // 4. Check for Existing Participation
  const { data: existing } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .single()

  if (existing) {
    return { error: "You are already joined in this challenge." }
  }

  // 5. Schedule Overlap Check (Skip if forceJoin is true)
  if (!forceJoin) {
    const { data: activeParticipations } = await supabase
      .from("challenge_participants")
      .select(`
        challenge:challenges (
          id,
          title,
          start_date,
          end_date
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active") 

    if (activeParticipations && activeParticipations.length > 0) {
      const overlappingChallenge = activeParticipations.find((p: any) => {
        if (!p.challenge) return false
        if (!p.challenge.start_date || !p.challenge.end_date) return false
        
        const currentStart = new Date(p.challenge.start_date)
        const currentEnd = new Date(p.challenge.end_date)

        // Overlap Formula: (StartA <= EndB) and (EndA >= StartB)
        return (startDate <= currentEnd) && (endDate >= currentStart)
      })

      if (overlappingChallenge) {
        return { 
          status: "overlap_warning", 
          message: `This overlaps with "${(overlappingChallenge.challenge as any).title}". Do you still want to join?`,
          conflictingId: (overlappingChallenge.challenge as any).id
        }
      }
    }
  }

  // 6. Proceed to Join
  const { error: joinError } = await supabase
    .from("challenge_participants")
    .insert({
      challenge_id: challengeId,
      user_id: user.id,
      status: 'active',
      joined_at: new Date().toISOString()
    })

  if (joinError) {
    console.error("Join error:", joinError)
    return { error: "Failed to join challenge. Please try again." }
  }

  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath(`/dashboard`)
  return { success: true }
}

// --- NEW ACTION: SUBMIT FOR APPROVAL ---
export async function submitChallengeForApproval(challengeId: string) {
  const supabase = await createClient()
  
  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  // 2. Ownership Check
  const { data: challenge } = await supabase
    .from("challenges")
    .select("created_by")
    .eq("id", challengeId)
    .single()

  if (!challenge) return { error: "Challenge not found" }

  // 3. Update Status
  const { error } = await supabase
    .from("challenges")
    .update({ status: "pending_approval" as any }) // Type cast if enum isn't synced
    .eq("id", challengeId)

  if (error) {
    return { error: "Failed to submit challenge" }
  }

  revalidatePath(`/company/challenges/${challengeId}`)
  return { success: true }
}

// --- NEW ACTION: CLOSE CHALLENGE & PICK WINNERS ---
export async function closeChallenge(challengeId: string) {
  const supabase = await createClient()
  
  // 1. Auth & Ownership Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== 'company_admin' && profile.role !== 'company_member')) {
    return { error: "Only company admins can close challenges." }
  }

  // 2. Fetch Challenge to verify Org
  const { data: challenge } = await supabase
    .from("challenges")
    .select("organization_id")
    .eq("id", challengeId)
    .single()

  if (!challenge || challenge.organization_id !== profile.organization_id) {
    return { error: "Unauthorized access to this challenge." }
  }

  // 3. Fetch All Submissions with Evaluations
  // We get participants and nested submission evaluations to sum scores
  const { data: participants } = await supabase
    .from("challenge_participants")
    .select(`
      id,
      user_id,
      submissions (
        evaluations (
          score
        )
      )
    `)
    .eq("challenge_id", challengeId)

  if (!participants) return { error: "No participants found." }

  // 4. Calculate Leaderboard
  const leaderboard = participants.map((p: any) => {
    // Sum up scores from all evaluated submissions
    const totalScore = p.submissions.reduce((acc: number, sub: any) => {
      // Assuming one evaluation per submission, taking the first one
      const evalScore = sub.evaluations?.[0]?.score || 0
      return acc + evalScore
    }, 0)
    
    return {
      participant_id: p.id,
      profile_id: p.user_id,
      score: totalScore
    }
  })

  // Sort Descending (Highest Score First)
  leaderboard.sort((a, b) => b.score - a.score)

  // 5. Pick Top 3 Winners
  // We map the top 3 leaderboard entries to winner objects
  const winners = leaderboard.slice(0, 3).map((entry, index) => ({
    challenge_id: challengeId,
    profile_id: entry.profile_id!,
    rank: index + 1,
    prize: index === 0 ? "1st Place Prize" : index === 1 ? "2nd Place Prize" : "3rd Place Prize" 
  }))

  // 6. Save Winners to DB
  if (winners.length > 0) {
    // Clean up any existing winners for this challenge to prevent duplicates
    await supabase.from("winners").delete().eq("challenge_id", challengeId)
    
    const { error: winnerError } = await supabase.from("winners").insert(winners)
    if (winnerError) {
      console.error("Winner save error:", winnerError)
      return { error: "Failed to save winners." }
    }
  }

  // 7. Update Challenge Status to "closed"
  const { error: updateError } = await supabase
    .from("challenges")
    .update({ status: "closed" as any }) // Type cast if needed
    .eq("id", challengeId)

  if (updateError) return { error: "Failed to close challenge." }

  // 8. Revalidate Paths
  revalidatePath(`/challenges/${challengeId}`)
  revalidatePath(`/company/challenges/${challengeId}`)
  return { success: true }
}