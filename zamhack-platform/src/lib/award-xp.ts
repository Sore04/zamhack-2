import { SupabaseClient } from "@supabase/supabase-js"

type XpRank = "beginner" | "intermediate" | "advanced"

const MULTIPLIER: Record<XpRank, Record<string, number>> = {
  beginner:     { beginner: 1.0, intermediate: 1.5, advanced: 2.0 },
  intermediate: { beginner: 0.5, intermediate: 1.0, advanced: 1.5 },
  advanced:     { beginner: 0.2, intermediate: 0.5, advanced: 1.0 },
}

function deriveRank(xp: number): XpRank {
  if (xp >= 5001) return "advanced"
  if (xp >= 2001) return "intermediate"
  return "beginner"
}


export type XpAwardResult = {
  xpDelta: number
  newXp: number
  previousRank: XpRank
  newRank: XpRank
  promoted: boolean
  penaltyApplied: boolean
}

export interface XpFormulaOptions {
  xpMultiplier?: number   // per-challenge bonus multiplier (default 1.0)
  scoreThreshold?: number // score below this earns a penalty (default 70)
  penalty?: number        // XP deducted when score < threshold (default 50)
  baseMin?: number        // min XP for a passing score (default 50)
  baseMax?: number        // max XP for a perfect score (default 400)
}

export async function awardXp(
  supabase: SupabaseClient,
  profileId: string,
  challengeDifficulty: string,
  finalScore: number, // 0–100
  options?: XpFormulaOptions
): Promise<XpAwardResult> {
  const fallback: XpAwardResult = {
    xpDelta: 0,
    newXp: 0,
    previousRank: "beginner",
    newRank: "beginner",
    promoted: false,
    penaltyApplied: false,
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("xp_points, xp_rank")
    .eq("id", profileId)
    .single()

  if (error || !profile) {
    console.error("[award-xp] Failed to fetch profile:", error?.message)
    return fallback
  }

  const currentXp: number = (profile as any).xp_points ?? 0
  const currentRank: XpRank = ((profile as any).xp_rank ?? "beginner") as XpRank

  const {
    xpMultiplier = 1.0,
    scoreThreshold = 70,
    penalty = 50,
    baseMin = 50,
    baseMax = 400,
  } = options ?? {}

  const baseXp = (() => {
    if (finalScore < scoreThreshold) return -penalty
    return Math.round(baseMin + ((finalScore - scoreThreshold) / (100 - scoreThreshold)) * (baseMax - baseMin))
  })()

  const rankMultiplier = MULTIPLIER[currentRank]?.[challengeDifficulty] ?? 1.0
  let xpDelta: number
  if (baseXp < 0) {
    xpDelta = baseXp
  } else {
    xpDelta = Math.round(baseXp * rankMultiplier * xpMultiplier)
  }

  // Penalty only applies to Advanced rank students.
  // Beginner and Intermediate: clamp any negative delta to 0.
  const penaltyApplied = xpDelta < 0 && currentRank === "advanced"
  if (xpDelta < 0 && currentRank !== "advanced") {
    xpDelta = 0
  }

  const newXp = Math.max(0, currentXp + xpDelta)
  const newRank = deriveRank(newXp)

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ xp_points: newXp, xp_rank: newRank } as any)
    .eq("id", profileId)

  if (updateError) {
    console.error("[award-xp] Failed to update profile XP:", updateError.message)
  }

  return {
    xpDelta,
    newXp,
    previousRank: currentRank,
    newRank,
    promoted: newRank !== currentRank && newXp > currentXp,
    penaltyApplied,
  }
}
