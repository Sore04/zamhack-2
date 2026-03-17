import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"

type RubricRow = Database["public"]["Tables"]["rubrics"]["Row"]

interface LLMCriterionScore {
  rubric_id: string
  points_awarded: number
  feedback: string
}

// Service-role client bypasses RLS so the system can write evaluations
function getAdminSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function fetchGitHubReadme(githubLink: string): Promise<string | null> {
  try {
    const url = new URL(githubLink)
    const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean)
    if (parts.length < 2) return null
    const [owner, repo] = parts

    for (const branch of ["HEAD", "main", "master"]) {
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`
        )
        if (res.ok) {
          const text = await res.text()
          return text.slice(0, 4000)
        }
      } catch {
        // try next branch
      }
    }
    return null
  } catch {
    return null
  }
}

function buildPrompt(params: {
  challengeTitle: string
  challengeDescription: string | null
  rubrics: RubricRow[]
  writtenResponse: string | null
  readmeContent: string | null
}): string {
  const { challengeTitle, challengeDescription, rubrics, writtenResponse, readmeContent } = params

  const submissionSection = [
    writtenResponse
      ? `### Written Response\n${writtenResponse}`
      : "No written response provided.",
    readmeContent
      ? `### GitHub README\n${readmeContent}`
      : "No GitHub README available.",
  ].join("\n\n")

  if (rubrics.length > 0) {
    const criteriaList = rubrics
      .map((r) => `- ${r.criteria_name} (max ${r.max_points} points)`)
      .join("\n")
    const rubricIdList = rubrics.map((r) => `- "${r.id}" = ${r.criteria_name}`).join("\n")

    return `You are an expert evaluator for a hackathon platform.
Evaluate the following submission and return ONLY valid JSON matching the exact schema below. Do not include any explanation, markdown, or text outside the JSON.

## Challenge
Title: ${challengeTitle}
Description: ${challengeDescription ?? "Not provided"}

## Scoring Rubric
${criteriaList}

## Submission Content
${submissionSection}

## Required JSON Output Schema
{
  "criteria": [
    {
      "rubric_id": "<exact rubric ID from the list below>",
      "points_awarded": <integer between 0 and the criterion max>,
      "feedback": "<1-2 sentence specific feedback>"
    }
  ],
  "overall_feedback": "<2-4 sentence overall assessment>"
}

Rubric IDs (use these exact values):
${rubricIdList}`
  }

  return `You are an expert evaluator for a hackathon platform.
Evaluate the following submission and return ONLY valid JSON. Do not include any explanation, markdown, or text outside the JSON.

## Challenge
Title: ${challengeTitle}
Description: ${challengeDescription ?? "Not provided"}

## Submission Content
${submissionSection}

## Required JSON Output Schema
{
  "score": <integer between 0 and 100>,
  "overall_feedback": "<2-4 sentence overall assessment>"
}`
}

export async function autoEvaluateSubmission(
  submissionId: string,
  challengeId: string,
  milestoneId?: string
): Promise<void> {
  const supabase = getAdminSupabase()

  // Guard: skip if a finalized evaluation already exists
  const { data: existingEval } = await supabase
    .from("evaluations")
    .select("id, is_draft")
    .eq("submission_id", submissionId)
    .maybeSingle()

  if (existingEval && existingEval.is_draft === false) {
    return
  }

  // Fetch submission and challenge in parallel; rubrics depend on milestoneId
  const [submissionResult, challengeResult] = await Promise.all([
    supabase
      .from("submissions")
      .select("github_link, written_response")
      .eq("id", submissionId)
      .single(),
    supabase
      .from("challenges")
      .select("title, description")
      .eq("id", challengeId)
      .single(),
  ])

  const submission = submissionResult.data
  const challenge = challengeResult.data

  // Fetch milestone-scoped rubrics; fall back to challenge-level (milestone_id IS NULL)
  let rubrics: RubricRow[] = []
  if (milestoneId) {
    const { data: milestoneRubrics } = await (supabase
      .from("rubrics")
      .select("id, criteria_name, max_points")
      .eq("challenge_id", challengeId) as any)
      .eq("milestone_id", milestoneId)
    rubrics = (milestoneRubrics as RubricRow[]) ?? []
  }
  if (rubrics.length === 0) {
    const { data: challengeRubrics } = await (supabase
      .from("rubrics")
      .select("id, criteria_name, max_points")
      .eq("challenge_id", challengeId) as any)
      .is("milestone_id", null)
    rubrics = (challengeRubrics as RubricRow[]) ?? []
  }

  if (!submission || !challenge) {
    console.error("[auto-eval] Could not fetch submission or challenge", { submissionId, challengeId })
    return
  }

  // Nothing to evaluate
  if (!submission.written_response && !submission.github_link) {
    return
  }

  const readmeContent = submission.github_link
    ? await fetchGitHubReadme(submission.github_link)
    : null

  const prompt = buildPrompt({
    challengeTitle: challenge.title,
    challengeDescription: challenge.description ?? null,
    rubrics,
    writtenResponse: submission.written_response ?? null,
    readmeContent,
  })

  // Call Claude API
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  })

  const rawText = message.content[0].type === "text" ? message.content[0].text : ""

  // Parse JSON — strip accidental code fences
  let parsed: any
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error("[auto-eval] Failed to parse LLM JSON response:", rawText)
    return
  }

  // Validate, clamp, and build score rows
  let totalScore: number
  let scoresToInsert: {
    submission_id: string
    rubric_id: string
    points_awarded: number
    feedback: string
  }[] = []

  if (rubrics.length > 0) {
    const llmCriteria: LLMCriterionScore[] = Array.isArray(parsed.criteria) ? parsed.criteria : []
    const llmByRubricId = new Map(llmCriteria.map((c) => [c.rubric_id, c]))

    scoresToInsert = rubrics.map((r) => {
      const llmScore = llmByRubricId.get(r.id)
      const rawPoints = llmScore?.points_awarded ?? 0
      const clamped = Math.max(0, Math.min(r.max_points ?? 0, Math.round(rawPoints)))
      return {
        submission_id: submissionId,
        rubric_id: r.id,
        points_awarded: clamped,
        feedback: llmScore?.feedback ?? "Not scored by AI.",
      }
    })

    totalScore = scoresToInsert.reduce((sum, s) => sum + s.points_awarded, 0)
  } else {
    const rawScore = typeof parsed.score === "number" ? parsed.score : 0
    totalScore = Math.max(0, Math.min(100, Math.round(rawScore)))
  }

  // Write evaluation to DB (mirrors grading-actions.ts pattern)
  const evalPayload = {
    submission_id: submissionId,
    reviewer_id: null as string | null,
    score: totalScore,
    feedback:
      typeof parsed.overall_feedback === "string"
        ? parsed.overall_feedback
        : "Auto-evaluated by AI.",
    is_draft: true,
    updated_at: new Date().toISOString(),
  }

  if (existingEval) {
    await supabase.from("evaluations").update(evalPayload).eq("id", existingEval.id)
  } else {
    await supabase.from("evaluations").insert(evalPayload)
  }

  if (rubrics.length > 0 && scoresToInsert.length > 0) {
    await supabase.from("scores" as any).delete().eq("submission_id", submissionId)
    await supabase.from("scores" as any).insert(scoresToInsert)
  }
}
