/**
 * scoring-utils.ts
 *
 * Shared utility for computing the final score of a submission
 * based on the challenge's scoring_mode.
 *
 * scoring_mode values:
 *   "company_only"    → only the company evaluation score counts
 *   "evaluator_only"  → only the evaluator evaluation score counts
 *   "average"         → average of both scores (if both exist)
 *
 * Fallback rule (applies to all modes):
 *   If the expected reviewer hasn't scored yet but the other has,
 *   show the available score rather than nothing.
 */

export type ScoringMode = "company_only" | "evaluator_only" | "average"

export interface ScoreInput {
  companyScore: number | null
  evaluatorScore: number | null
  scoringMode: ScoringMode
}

export interface FinalScoreResult {
  /** The computed final score to display and use for leaderboard ranking */
  finalScore: number | null

  /** Human-readable label for what this score represents */
  label: string

  /** True if both reviewers have submitted (no score is pending) */
  isComplete: boolean

  /** True if the score is a fallback (expected reviewer hasn't reviewed yet) */
  isFallback: boolean
}

export function computeFinalScore({
  companyScore,
  evaluatorScore,
  scoringMode,
}: ScoreInput): FinalScoreResult {
  switch (scoringMode) {
    case "company_only": {
      if (companyScore !== null) {
        return {
          finalScore: companyScore,
          label: "Company Score",
          isComplete: true,
          isFallback: false,
        }
      }
      // Fallback: evaluator reviewed but company hasn't yet
      if (evaluatorScore !== null) {
        return {
          finalScore: evaluatorScore,
          label: "Expert Score (interim)",
          isComplete: false,
          isFallback: true,
        }
      }
      return { finalScore: null, label: "Awaiting review", isComplete: false, isFallback: false }
    }

    case "evaluator_only": {
      if (evaluatorScore !== null) {
        return {
          finalScore: evaluatorScore,
          label: "Expert Score",
          isComplete: true,
          isFallback: false,
        }
      }
      // Fallback: company reviewed but evaluator hasn't yet
      if (companyScore !== null) {
        return {
          finalScore: companyScore,
          label: "Company Score (interim)",
          isComplete: false,
          isFallback: true,
        }
      }
      return { finalScore: null, label: "Awaiting expert review", isComplete: false, isFallback: false }
    }

    case "average": {
      if (companyScore !== null && evaluatorScore !== null) {
        const avg = Math.round((companyScore + evaluatorScore) / 2)
        return {
          finalScore: avg,
          label: "Final Score (avg)",
          isComplete: true,
          isFallback: false,
        }
      }
      // Only one score available — show it as interim
      if (companyScore !== null) {
        return {
          finalScore: companyScore,
          label: "Company Score (interim)",
          isComplete: false,
          isFallback: true,
        }
      }
      if (evaluatorScore !== null) {
        return {
          finalScore: evaluatorScore,
          label: "Expert Score (interim)",
          isComplete: false,
          isFallback: true,
        }
      }
      return { finalScore: null, label: "Awaiting reviews", isComplete: false, isFallback: false }
    }

    default: {
      // Safe fallback for unknown modes
      const score = companyScore ?? evaluatorScore ?? null
      return {
        finalScore: score,
        label: "Score",
        isComplete: score !== null,
        isFallback: false,
      }
    }
  }
}

/**
 * Convenience: returns just the numeric final score.
 * Useful for leaderboard queries where you only need the number.
 */
export function getFinalScore(input: ScoreInput): number | null {
  return computeFinalScore(input).finalScore
}

/**
 * Given a list of evaluations for a submission, splits them into
 * company evaluation and evaluator evaluation.
 *
 * Requires each evaluation to carry a reviewer_role field,
 * which should be joined from profiles when fetching evaluations.
 */
export function splitEvaluationsByRole<T extends {
  score: number | null
  feedback: string | null
  is_draft: boolean | null
  reviewer_role: string | null
}>(evaluations: T[]) {
  const published = evaluations.filter(e => !e.is_draft)

  const companyEval = published.find(
    e => e.reviewer_role === "company_admin" || e.reviewer_role === "company_member"
  ) ?? null

  const evaluatorEval = published.find(
    e => e.reviewer_role === "evaluator"
  ) ?? null

  return { companyEval, evaluatorEval }
}