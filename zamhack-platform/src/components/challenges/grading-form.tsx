"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { submitEvaluation, getNextUnreviewedSubmission } from "@/app/challenges/grading-actions"
import { Database } from "@/types/supabase"

type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"]
type Rubric = Database["public"]["Tables"]["rubrics"]["Row"]
type Score = Database["public"]["Tables"]["scores"]["Row"]

// --- Schema for rubric-based grading ---
const gradingSchema = z.object({
  rubricScores: z.array(
    z.object({
      rubric_id: z.string(),
      criteria_name: z.string(),
      max_points: z.number(),
      score: z.number().min(0, "Score cannot be negative"),
    })
  ).superRefine((data, ctx) => {
    data.forEach((item, index) => {
      if (item.score > item.max_points) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Score cannot exceed max points (${item.max_points})`,
          path: [index, "score"],
        })
      }
    })
  }),
  feedback: z.string().min(1, "Feedback is required"),
  isDraft: z.boolean().default(false),
})

// --- Schema for simple (no rubric) grading ---
const simpleGradingSchema = z.object({
  score: z.number().min(0, "Score cannot be negative").max(100, "Score cannot exceed 100"),
  feedback: z.string().min(1, "Feedback is required"),
  isDraft: z.boolean().default(false),
})

type GradingFormValues = z.infer<typeof gradingSchema>
type SimpleGradingFormValues = z.infer<typeof simpleGradingSchema>

interface GradingFormProps {
  submissionId: string
  rubrics: Rubric[]
  existingScores: Score[]
  initialEvaluation?: Evaluation | null
  readOnly?: boolean
  challengeId?: string
}

// --- Simple Score Form (no rubrics defined) ---
function SimpleGradingForm({
  submissionId,
  initialEvaluation,
  readOnly: initialReadOnly,
  challengeId,
}: {
  submissionId: string
  initialEvaluation?: Evaluation | null
  readOnly?: boolean
  challengeId?: string
}) {
  const router = useRouter()
  const [activeAction, setActiveAction] = useState<'draft' | 'submit' | null>(null)
  const isSubmitting = activeAction !== null
  const [readOnly, setReadOnly] = useState(initialReadOnly ?? false)
  const isSubmittingRef = useRef(false)

  const form = useForm<SimpleGradingFormValues>({
    resolver: zodResolver(simpleGradingSchema),
    defaultValues: {
      score: initialEvaluation?.score ?? 0,
      feedback: initialEvaluation?.feedback ?? "",
      isDraft: initialEvaluation?.is_draft ?? false,
    },
  })

  const onSubmit = async (data: SimpleGradingFormValues, isDraftOverride?: boolean) => {
    if (isSubmittingRef.current) return
    setActiveAction(isDraftOverride ? 'draft' : 'submit')
    try {
      const finalIsDraft = isDraftOverride !== undefined ? isDraftOverride : data.isDraft

      // Pass empty rubric scores array — grading-actions will use the direct score
      const result = await submitEvaluation(
        submissionId,
        [],
        data.feedback,
        finalIsDraft,
        data.score
      )

      if (result.success) {
        toast.success(finalIsDraft ? "Draft saved successfully" : "Evaluation submitted successfully")
        if (!finalIsDraft && challengeId) {
          const { nextSubmissionId } = await getNextUnreviewedSubmission(challengeId, submissionId)
          if (nextSubmissionId) {
            router.push(`/evaluator/assignments/${challengeId}/review/${nextSubmissionId}`)
          } else {
            router.push(`/evaluator/assignments/${challengeId}`)
          }
        } else {
          window.location.reload()
        }
      } else {
        toast.error(result.error || "Failed to submit evaluation")
      }
    } catch (error) {
      console.error(error)
      toast.error("An unexpected error occurred")
    } finally {
      isSubmittingRef.current = false
      setActiveAction(null)
    }
  }

  if (readOnly) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            Score <span className="text-muted-foreground font-normal">(out of 100)</span>
          </Label>
          <p className="text-2xl font-bold text-primary">
            {initialEvaluation?.score ?? 0} / 100
          </p>
        </div>
        <div className="space-y-2">
          <Label>Overall Feedback</Label>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {initialEvaluation?.feedback || "No feedback provided."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setReadOnly(false)}>
            Edit Submitted Review
          </Button>
          {challengeId && (
            <Button variant="ghost" asChild>
              <a href={`/evaluator/assignments/${challengeId}`}>Skip to list</a>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit((data) => onSubmit(data))} className="space-y-6">
      {/* Direct Score Input */}
      <div className="space-y-2">
        <Label htmlFor="score" className="text-base font-semibold">
          Score <span className="text-muted-foreground font-normal">(out of 100)</span>
        </Label>
        <div className="flex items-center gap-4">
          <Input
            id="score"
            type="number"
            min={0}
            max={100}
            className="w-28 text-lg font-bold"
            {...form.register("score", { valueAsNumber: true })}
          />
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/60 transition-all duration-300"
              style={{ width: `${Math.min(form.watch("score") || 0, 100)}%` }}
            />
          </div>
          <span className="text-muted-foreground text-sm w-12 text-right">
            {form.watch("score") || 0} / 100
          </span>
        </div>
        {form.formState.errors.score && (
          <p className="text-xs text-destructive">{form.formState.errors.score.message}</p>
        )}
      </div>

      {/* Feedback */}
      <div className="space-y-2">
        <Label htmlFor="feedback">Overall Feedback *</Label>
        <Textarea
          id="feedback"
          {...form.register("feedback")}
          placeholder="Provide detailed, constructive feedback..."
          rows={6}
        />
        {form.formState.errors.feedback && (
          <p className="text-xs text-destructive">{form.formState.errors.feedback.message}</p>
        )}
      </div>

      {/* Draft checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isDraft"
          checked={form.watch("isDraft")}
          onCheckedChange={(checked) => form.setValue("isDraft", checked as boolean)}
        />
        <Label htmlFor="isDraft" className="text-sm font-normal cursor-pointer">
          Save as Draft
        </Label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => form.handleSubmit((data) => onSubmit(data, true))()}
          className="flex-1"
        >
          {activeAction === 'draft' ?<Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => form.handleSubmit((data) => onSubmit(data, false))()}
          className="flex-1"
        >
          {activeAction === 'submit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Evaluation
        </Button>
      </div>
    </form>
  )
}

// --- Main Grading Form (rubric-based) ---
export const GradingForm = ({
  submissionId,
  rubrics,
  existingScores,
  initialEvaluation,
  readOnly: initialReadOnly,
  challengeId,
}: GradingFormProps) => {
  const router = useRouter()
  const [activeAction, setActiveAction] = useState<'draft' | 'submit' | null>(null)
  const isSubmitting = activeAction !== null
  const [readOnly, setReadOnly] = useState(initialReadOnly ?? false)
  const isSubmittingRef = useRef(false)

  const defaultRubricScores = rubrics.map(rubric => {
    const existing = existingScores.find(s => s.rubric_id === rubric.id)
    return {
      rubric_id: rubric.id,
      criteria_name: rubric.criteria_name,
      max_points: rubric.max_points || 10,
      score: existing ? existing.points_awarded : 0,
    }
  })

  const form = useForm<GradingFormValues>({
    resolver: zodResolver(gradingSchema),
    defaultValues: {
      rubricScores: defaultRubricScores,
      feedback: initialEvaluation?.feedback ?? "",
      isDraft: initialEvaluation?.is_draft ?? false,
    },
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: "rubricScores",
  })

  const watchedScores = form.watch("rubricScores")
  const currentTotal = watchedScores.reduce((sum, item) => sum + (Number(item.score) || 0), 0)
  const maxTotal = rubrics.reduce((sum, r) => sum + (r.max_points || 10), 0)

  const onSubmit = async (data: GradingFormValues, isDraftOverride?: boolean) => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setActiveAction(isDraftOverride ? 'draft' : 'submit')
    try {
      const finalIsDraft = isDraftOverride !== undefined ? isDraftOverride : data.isDraft

      const submissionScores = data.rubricScores.map(item => ({
        rubric_id: item.rubric_id,
        score: item.score,
      }))

      const result = await submitEvaluation(submissionId, submissionScores, data.feedback, finalIsDraft)

      if (result.success) {
        toast.success(finalIsDraft ? "Draft saved successfully" : "Evaluation submitted successfully")
        if (!finalIsDraft && challengeId) {
          const { nextSubmissionId } = await getNextUnreviewedSubmission(challengeId, submissionId)
          if (nextSubmissionId) {
            router.push(`/evaluator/assignments/${challengeId}/review/${nextSubmissionId}`)
          } else {
            router.push(`/evaluator/assignments/${challengeId}`)
          }
        } else {
          window.location.reload()
        }
      } else {
        toast.error(result.error || "Failed to submit evaluation")
      }
    } catch (error) {
      console.error(error)
      toast.error("An unexpected error occurred")
    } finally {
      isSubmittingRef.current = false
      setActiveAction(null)
    }
  }

  return (
    <Card className="border-t-4 border-t-primary shadow-md">
      <CardHeader>
        <CardTitle>Scorecard</CardTitle>
      </CardHeader>
      <CardContent>
        {/* --- NO RUBRICS: show simple score form --- */}
        {rubrics.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground pb-2 border-b">
              No rubrics have been defined for this challenge. Enter a direct score out of 100.
            </p>
            <SimpleGradingForm
              submissionId={submissionId}
              initialEvaluation={initialEvaluation}
              readOnly={readOnly}
              challengeId={challengeId}
            />
          </div>
        ) : readOnly ? (
          /* --- READ-ONLY: submitted evaluation display --- */
          <div className="space-y-6">
            <div className="space-y-4">
              {defaultRubricScores.map((item) => (
                <div key={item.rubric_id} className="flex justify-between items-center border-b pb-3 last:border-0">
                  <span className="text-sm font-medium">{item.criteria_name}</span>
                  <span className="text-sm font-bold">
                    {item.score} / {item.max_points}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border flex justify-between items-center">
              <span className="font-bold text-lg">Total Score</span>
              <div className="text-2xl font-bold">
                <span className="text-primary">{currentTotal}</span>
                <span className="text-muted-foreground text-lg font-normal"> / {maxTotal}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Overall Feedback</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {initialEvaluation?.feedback || "No feedback provided."}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setReadOnly(false)}>
                Edit Submitted Review
              </Button>
              {challengeId && (
                <Button variant="ghost" asChild>
                  <a href={`/evaluator/assignments/${challengeId}`}>Skip to list</a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* --- HAS RUBRICS: rubric-based form --- */
          <form onSubmit={form.handleSubmit((data) => onSubmit(data))} className="space-y-8">
            <div className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-2 border-b pb-4 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-base font-semibold">{field.criteria_name}</Label>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      Max: {field.max_points} pts
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-24 space-y-1">
                      <Input
                        type="number"
                        min={0}
                        max={field.max_points}
                        {...form.register(`rubricScores.${index}.score` as const, { valueAsNumber: true })}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          const clamped = Math.max(0, Math.min(field.max_points, isNaN(val) ? 0 : val))
                          form.setValue(`rubricScores.${index}.score`, clamped, { shouldValidate: true })
                        }}
                      />
                      {form.formState.errors.rubricScores?.[index]?.score && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.rubricScores[index]?.score?.message}
                        </p>
                      )}
                    </div>

                    <div className="flex-1 h-2 mt-4 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/50 transition-all duration-300"
                        style={{ width: `${Math.min((watchedScores[index]?.score || 0) / field.max_points * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border flex justify-between items-center">
              <span className="font-bold text-lg">Total Score</span>
              <div className="text-2xl font-bold">
                <span className="text-primary">{currentTotal}</span>
                <span className="text-muted-foreground text-lg font-normal"> / {maxTotal}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Overall Feedback *</Label>
              <Textarea
                id="feedback"
                {...form.register("feedback")}
                placeholder="Provide detailed, constructive feedback..."
                rows={6}
              />
              {form.formState.errors.feedback && (
                <p className="text-xs text-destructive">{form.formState.errors.feedback.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDraft"
                checked={form.watch("isDraft")}
                onCheckedChange={(checked) => form.setValue("isDraft", checked as boolean)}
              />
              <Label htmlFor="isDraft" className="text-sm font-normal cursor-pointer">
                Save as Draft
              </Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => form.handleSubmit((data) => onSubmit(data, true))()}
                className="flex-1"
              >
                {activeAction === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => form.handleSubmit((data) => onSubmit(data, false))()}
                className="flex-1"
              >
                {activeAction === 'submit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Evaluation
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
