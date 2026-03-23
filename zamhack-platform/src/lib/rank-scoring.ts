export interface EvaluatorScore {
  evaluatorId: string
  participantId: string
  rawScore: number // 0–100
}

export interface RankedParticipant {
  participantId: string
  rankSum: number // Layer 1: sum of ranks across all evaluators
  normalizedScoreAvg: number // Layer 2: avg normalized score 0–1
  companyScore: number | null // Layer 3A input (raw, not used in ranking calc itself)
  finalRank: number // 1 = best
  isTied: boolean
  tiebreakerUsed: "none" | "normalized_score" | "company_score" | "chief_evaluator" | "manual"
}

function computeRankSums(scores: EvaluatorScore[]): Map<string, number> {
  const byEvaluator = new Map<string, EvaluatorScore[]>()
  for (const s of scores) {
    const group = byEvaluator.get(s.evaluatorId) ?? []
    group.push(s)
    byEvaluator.set(s.evaluatorId, group)
  }

  const rankSumMap = new Map<string, number>()

  for (const [, evalScores] of byEvaluator) {
    const sorted = [...evalScores].sort((a, b) => b.rawScore - a.rawScore)

    // Assign average ranks for ties
    let i = 0
    while (i < sorted.length) {
      let j = i
      while (j < sorted.length && sorted[j].rawScore === sorted[i].rawScore) {
        j++
      }
      // positions i..j-1 (1-indexed: i+1..j) are tied
      const avgRank = (i + 1 + j) / 2
      for (let k = i; k < j; k++) {
        const pid = sorted[k].participantId
        rankSumMap.set(pid, (rankSumMap.get(pid) ?? 0) + avgRank)
      }
      i = j
    }
  }

  return rankSumMap
}

function computeNormalizedScores(scores: EvaluatorScore[]): Map<string, number> {
  const byEvaluator = new Map<string, EvaluatorScore[]>()
  for (const s of scores) {
    const group = byEvaluator.get(s.evaluatorId) ?? []
    group.push(s)
    byEvaluator.set(s.evaluatorId, group)
  }

  // Map from participantId → list of normalized values across evaluators
  const normalizedValues = new Map<string, number[]>()

  for (const [, evalScores] of byEvaluator) {
    const rawScores = evalScores.map((s) => s.rawScore)
    const min = Math.min(...rawScores)
    const max = Math.max(...rawScores)

    for (const s of evalScores) {
      const normalized = max === min ? 1.0 : (s.rawScore - min) / (max - min)
      const existing = normalizedValues.get(s.participantId) ?? []
      existing.push(normalized)
      normalizedValues.set(s.participantId, existing)
    }
  }

  const result = new Map<string, number>()
  for (const [pid, values] of normalizedValues) {
    result.set(pid, values.reduce((a, b) => a + b, 0) / values.length)
  }
  return result
}

// Compute average-rank assignments for a single evaluator's scores (reused for chief evaluator tiebreak)
function rankWithinEvaluator(evalScores: EvaluatorScore[]): Map<string, number> {
  const sorted = [...evalScores].sort((a, b) => b.rawScore - a.rawScore)
  const rankMap = new Map<string, number>()

  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && sorted[j].rawScore === sorted[i].rawScore) {
      j++
    }
    const avgRank = (i + 1 + j) / 2
    for (let k = i; k < j; k++) {
      rankMap.set(sorted[k].participantId, avgRank)
    }
    i = j
  }
  return rankMap
}

export function computeRankedResults(params: {
  evaluatorScores: EvaluatorScore[]
  companyScores: Map<string, number | null>
  chiefEvaluatorId: string | null
}): RankedParticipant[] {
  const { evaluatorScores, companyScores, chiefEvaluatorId } = params

  const rankSumMap = computeRankSums(evaluatorScores)
  const normalizedMap = computeNormalizedScores(evaluatorScores)

  // Collect unique participant IDs
  const participantIds = [...new Set(evaluatorScores.map((s) => s.participantId))]

  const participants: RankedParticipant[] = participantIds.map((pid) => ({
    participantId: pid,
    rankSum: rankSumMap.get(pid) ?? 0,
    normalizedScoreAvg: normalizedMap.get(pid) ?? 0,
    companyScore: companyScores.get(pid) ?? null,
    finalRank: 0,
    isTied: false,
    tiebreakerUsed: "none",
  }))

  // Pre-compute chief evaluator ranks if applicable
  const chiefRankMap = new Map<string, number>()
  if (chiefEvaluatorId !== null) {
    const chiefScores = evaluatorScores.filter((s) => s.evaluatorId === chiefEvaluatorId)
    if (chiefScores.length > 0) {
      const ranks = rankWithinEvaluator(chiefScores)
      for (const [pid, rank] of ranks) {
        chiefRankMap.set(pid, rank)
      }
    }
  }

  // Sort with full priority chain
  participants.sort((a, b) => {
    // Layer 1: rankSum ASC
    if (a.rankSum !== b.rankSum) return a.rankSum - b.rankSum

    // Layer 2: normalizedScoreAvg DESC
    if (a.normalizedScoreAvg !== b.normalizedScoreAvg) return b.normalizedScoreAvg - a.normalizedScoreAvg

    // Layer 3A: companyScore DESC (null → -Infinity)
    const aCompany = a.companyScore ?? -Infinity
    const bCompany = b.companyScore ?? -Infinity
    if (aCompany !== bCompany) return bCompany - aCompany

    // Layer 3B: chief evaluator rank ASC
    if (chiefEvaluatorId !== null) {
      const aChief = chiefRankMap.get(a.participantId) ?? Infinity
      const bChief = chiefRankMap.get(b.participantId) ?? Infinity
      if (aChief !== bChief) return aChief - bChief
    }

    // Layer 3C: still tied → manual
    return 0
  })

  // Determine which tiebreaker was used for each participant by comparing with neighbors
  // and assign finalRank
  const n = participants.length

  // For each pair that are still tied after all layers, mark both
  // We need to track why order was resolved between each consecutive pair
  type TiebreakerReason = "none" | "normalized_score" | "company_score" | "chief_evaluator" | "manual"

  function getTiebreakerBetween(a: RankedParticipant, b: RankedParticipant): TiebreakerReason {
    if (a.rankSum !== b.rankSum) return "none"
    if (a.normalizedScoreAvg !== b.normalizedScoreAvg) return "normalized_score"
    const aCompany = a.companyScore ?? -Infinity
    const bCompany = b.companyScore ?? -Infinity
    if (aCompany !== bCompany) return "company_score"
    if (chiefEvaluatorId !== null) {
      const aChief = chiefRankMap.get(a.participantId) ?? Infinity
      const bChief = chiefRankMap.get(b.participantId) ?? Infinity
      if (aChief !== bChief) return "chief_evaluator"
    }
    return "manual"
  }

  // Identify groups of participants that are fully tied (manual tiebreaker needed)
  // A group is tied if every consecutive pair within it has tiebreaker "manual"
  // First, set tiebreakerUsed based on what broke the tie with the participant just above them
  // (for the first participant, compare with the one below if tied)

  // We'll process groups
  let i = 0
  let rankCounter = 1
  while (i < n) {
    // Find the extent of the tied group starting at i
    let j = i
    while (j + 1 < n && getTiebreakerBetween(participants[j], participants[j + 1]) === "manual") {
      j++
    }

    if (j === i) {
      // No tie at this position
      participants[i].finalRank = rankCounter
      participants[i].isTied = false
      // Determine what layer placed this participant here.
      // Look forward first (participant below shares Layer 1 score → tiebreaker elevated us),
      // then backward (participant above shares Layer 1 score → tiebreaker separated us),
      // then default to "none" (rankSum alone determined position).
      if (i + 1 < n && participants[i + 1].rankSum === participants[i].rankSum) {
        participants[i].tiebreakerUsed = getTiebreakerBetween(participants[i], participants[i + 1])
      } else if (i > 0 && participants[i - 1].rankSum === participants[i].rankSum) {
        participants[i].tiebreakerUsed = getTiebreakerBetween(participants[i - 1], participants[i])
      } else {
        participants[i].tiebreakerUsed = "none"
      }
      rankCounter++
    } else {
      // Tied group from i to j (inclusive)
      const groupRank = rankCounter
      for (let k = i; k <= j; k++) {
        participants[k].finalRank = groupRank
        participants[k].isTied = true
        participants[k].tiebreakerUsed = "manual"
      }
      rankCounter += j - i + 1
    }

    i = j + 1
  }

  // Fix tiebreakerUsed for non-tied participants after rank 1:
  // The first in each non-tied run should reflect what broke the tie with the previous group
  // This is already handled above — tiebreakerUsed on a non-tied participant reflects
  // what differentiator separated it from its predecessor. The first overall gets "none".

  return participants
}

export function shouldUseRankedMode(params: {
  scoringMode: "company_only" | "evaluator_only" | "average"
  evaluatorCount: number
}): boolean {
  const { scoringMode, evaluatorCount } = params
  return evaluatorCount > 1 && (scoringMode === "evaluator_only" || scoringMode === "average")
}
