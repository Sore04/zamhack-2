"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, Plus, Trash2, ChevronRight, ChevronLeft, X, MapPin, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { createChallenge } from "@/app/challenges/create-actions"
import { toast } from "sonner"

// --- Schemas ---
const criterionSchema = z.object({
  criteriaName: z.string().min(1, "Criterion name is required"),
  maxPoints: z.number().min(1).max(1000).default(10),
})

const milestoneSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  requiresGithub: z.boolean().default(false),
  requiresUrl: z.boolean().default(false),
  requiresText: z.boolean().default(false),
  criteria: z.array(criterionSchema).default([]),
})

const formSchema = z.object({
  // Step 1: Basic Info
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),

  // ── CHANGED: industries is now an array (multi-select checkboxes) ──
  industries: z.array(z.string()).min(1, "Select at least one industry"),

  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  participationType: z.enum(["solo", "team", "both"]),
  maxParticipants: z.union([z.string(), z.number()]).optional(),
  maxTeams: z.union([z.string(), z.number()]).optional(),
  maxTeamSize: z.union([z.string(), z.number()]).optional(),
  requiresEntryFee: z.boolean().default(false),
  entryFeeAmount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().default("PHP"),

  // ── NEW: Location ──
  locationType: z.enum(["online", "onsite"]).default("online"),
  locationDetails: z.string().optional(),  // required when onsite

  // ── NEW: Perpetual ──
  isPerpetual: z.boolean().default(false),

  // Step 2: Timeline
  startDate: z.date({ required_error: "Start date is required" }),
  // endDate is optional when isPerpetual is true
  endDate: z.date().optional(),
  registrationDeadline: z.date().optional(),

  // Step 3: Milestones
  milestones: z.array(milestoneSchema).min(1, "At least one milestone is required"),

  // Step 4: Skills
  skills: z.array(z.string()).min(1, "Add at least one skill"),

  // Step 5: Scoring Mode
  scoringMode: z.enum(["company_only", "evaluator_only", "average"]).default("company_only"),
}).superRefine((data, ctx) => {
  // End date required unless perpetual
  if (!data.isPerpetual && !data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date is required for non-perpetual challenges",
      path: ["endDate"],
    })
  }
  // Location details required for onsite
  if (data.locationType === "onsite" && (!data.locationDetails || data.locationDetails.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please specify the onsite location (or enter TBA)",
      path: ["locationDetails"],
    })
  }
})

type FormValues = z.infer<typeof formSchema>

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "E-commerce",
  "Design",
  "Marketing",
  "Agriculture",
  "Manufacturing",
  "Social Impact",
  "Other",
]
const DIFFICULTIES = ["beginner", "intermediate", "advanced"]
const TYPES = ["solo", "team", "both"]
const CURRENCIES = ["PHP", "USD", "EUR", "GBP"]
const STEPS = ["Basic Info", "Timeline", "Milestones", "Skills", "Review"]

export const CreateChallengeForm = ({ organizationId }: { organizationId: string }) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [skillsInput, setSkillsInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      participationType: "solo",
      difficulty: "beginner",
      milestones: [{ title: "Final Submission", requiresGithub: true, requiresUrl: true, requiresText: true, criteria: [] }],
      skills: [],
      requiresEntryFee: false,
      currency: "PHP",
      industries: [],
      locationType: "online",
      locationDetails: "",
      isPerpetual: false,
      scoringMode: "company_only" as const,
    },
    mode: "onChange",
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "milestones",
  })

  const watchedValues = form.watch()

  // --- Validation Logic ---
  const validateStep = async (step: number) => {
    let fieldsToValidate: (keyof FormValues)[] = []

    switch (step) {
      case 1:
        fieldsToValidate = ["title", "description", "industries", "difficulty", "participationType", "locationType"]
        if (watchedValues.locationType === "onsite") fieldsToValidate.push("locationDetails")
        if (watchedValues.requiresEntryFee) {
          const amount = Number(watchedValues.entryFeeAmount)
          if (!amount || amount <= 0) {
            form.setError("entryFeeAmount", { message: "Valid entry fee amount is required" })
            return false
          }
        }
        break
      case 2:
        fieldsToValidate = ["startDate"]
        if (!watchedValues.isPerpetual) fieldsToValidate.push("endDate")
        break
      case 3:
        fieldsToValidate = ["milestones"]
        break
      case 4:
        fieldsToValidate = ["skills"]
        break
    }

    const result = await form.trigger(fieldsToValidate as any)
    return result
  }

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault()
    const isValid = await validateStep(currentStep)
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
    }
  }

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault()
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  // --- Industry Multi-Checkbox Logic ---
  const toggleIndustry = (industry: string) => {
    const current = form.getValues("industries") || []
    const updated = current.includes(industry)
      ? current.filter((i) => i !== industry)
      : [...current, industry]
    form.setValue("industries", updated)
    form.trigger("industries")
  }

  // --- Skills Input Logic ---
  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(",")) {
      const newSkills = val.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      const currentSkills = form.getValues("skills") || []
      const uniqueSkills = Array.from(new Set([...currentSkills, ...newSkills]))
      form.setValue("skills", uniqueSkills)
      form.trigger("skills")
      setSkillsInput("")
    } else {
      setSkillsInput(val)
    }
  }

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      e.stopPropagation()
      const val = skillsInput.trim()
      if (val) {
        const currentSkills = form.getValues("skills") || []
        if (!currentSkills.includes(val)) {
          form.setValue("skills", [...currentSkills, val])
          form.trigger("skills")
        }
        setSkillsInput("")
      }
    }
  }

  const removeSkill = (skillToRemove: string) => {
    const currentSkills = form.getValues("skills")
    form.setValue("skills", currentSkills.filter((s) => s !== skillToRemove))
  }

  // --- Submission ---
  const onSubmit = async (data: FormValues) => {
    if (currentStep !== STEPS.length) return
    setIsSubmitting(true)
    try {
      const result = await createChallenge({
        ...data,
        // Pass both for backward compatibility
        industry: data.industries[0] || "",
        industries: data.industries,
        locationType: data.locationType,
        locationDetails: data.locationType === "onsite" ? (data.locationDetails || "TBA") : null,
        isPerpetual: data.isPerpetual,
        scoringMode: data.scoringMode,
        startDate: data.startDate.toISOString(),
        endDate: data.isPerpetual ? null : (data.endDate?.toISOString() || null),
        registrationDeadline: data.registrationDeadline?.toISOString(),
        maxParticipants: data.maxParticipants ? Number(data.maxParticipants) : undefined,
        maxTeams: data.maxTeams ? Number(data.maxTeams) : undefined,
        maxTeamSize: data.maxTeamSize ? Number(data.maxTeamSize) : undefined,
        entryFeeAmount: data.requiresEntryFee && data.entryFeeAmount ? Number(data.entryFeeAmount) : undefined,
        currency: data.requiresEntryFee ? (data.currency || "PHP") : undefined,
        milestones: data.milestones.map(m => ({
          ...m,
          dueDate: m.dueDate.toISOString()
        })),
        organizationId,
      })
      if (result.success) {
        toast.success("Challenge created successfully!")
        router.push("/company/dashboard")
      } else {
        console.error(result.error)
        toast.error("Failed to create challenge: " + result.error)
      }
    } catch (error) {
      console.error(error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Global Enter prevention
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault()
    }
  }

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <div className="flex justify-between items-center px-2">
        {STEPS.map((step, index) => {
          const stepNum = index + 1
          const isActive = stepNum === currentStep
          const isCompleted = stepNum < currentStep
          return (
            <div key={step} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" :
                  isCompleted ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {stepNum}
              </div>
              <span className={cn("text-xs hidden sm:block", isActive ? "font-medium" : "text-muted-foreground")}>
                {step}
              </span>
            </div>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1]}</CardTitle>
          <CardDescription>Step {currentStep} of {STEPS.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            onKeyDown={handleKeyDown}
            className="space-y-6"
          >

            {/* ─────────────────── STEP 1: BASIC INFO ─────────────────── */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Challenge Title</Label>
                  <Input
                    {...form.register("title")}
                    title="Challenge Title"
                    placeholder="e.g. AI Customer Support Bot"
                  />
                  {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    {...form.register("description")}
                    title="Description"
                    placeholder="Describe the challenge..."
                    rows={5}
                  />
                  {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
                </div>

                {/* ── MULTI-INDUSTRY CHECKBOXES ── */}
                <div className="space-y-2">
                  <Label>Industry <span className="text-muted-foreground text-xs">(select all that apply)</span></Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border p-3">
                    {INDUSTRIES.map((industry) => {
                      const isChecked = (watchedValues.industries || []).includes(industry)
                      return (
                        <div
                          key={industry}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                            isChecked && "bg-primary/10"
                          )}
                        >
                          <Checkbox
                            id={`industry-${industry}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleIndustry(industry)}
                          />
                          <label
                            htmlFor={`industry-${industry}`}
                            className="text-sm cursor-pointer select-none"
                          >
                            {industry}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                  {/* Selected tags */}
                  {(watchedValues.industries || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(watchedValues.industries || []).map((ind) => (
                        <span
                          key={ind}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                        >
                          {ind}
                          <button
                            type="button"
                            onClick={() => toggleIndustry(ind)}
                            aria-label={`Remove ${ind}`}
                            className="hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {form.formState.errors.industries && (
                    <p className="text-xs text-destructive">{form.formState.errors.industries.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select onValueChange={(val: any) => form.setValue("difficulty", val)} defaultValue={watchedValues.difficulty}>
                      <SelectTrigger title="Difficulty">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.difficulty && <p className="text-xs text-destructive">{form.formState.errors.difficulty.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Participation Type</Label>
                    <Select onValueChange={(val: any) => form.setValue("participationType", val)} defaultValue={watchedValues.participationType}>
                      <SelectTrigger title="Participation Type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.participationType && <p className="text-xs text-destructive">{form.formState.errors.participationType.message}</p>}
                  </div>
                </div>

                {/* Capacity fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Participants</Label>
                    <Input
                      {...form.register("maxParticipants")}
                      title="Max Participants"
                      type="number"
                      placeholder="50"
                      min={1}
                    />
                  </div>
                  {(watchedValues.participationType === "team" || watchedValues.participationType === "both") && (
                    <>
                      <div className="space-y-2">
                        <Label>Max Teams</Label>
                        <Input
                          {...form.register("maxTeams")}
                          title="Max Teams"
                          type="number"
                          placeholder="20"
                          min={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Team Size</Label>
                        <Input
                          {...form.register("maxTeamSize")}
                          title="Max Team Size"
                          type="number"
                          placeholder="4"
                          min={2}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* ── LOCATION ── */}
                <div className="space-y-3 rounded-md border p-4">
                  <Label className="text-sm font-semibold">Location</Label>
                  <RadioGroup
                    value={watchedValues.locationType}
                    onValueChange={(val: "online" | "onsite") => {
                      form.setValue("locationType", val, { shouldValidate: true })
                      if (val === "online") form.setValue("locationDetails", "")
                    }}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="online" id="loc-online" />
                      <label htmlFor="loc-online" className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        Online
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="onsite" id="loc-onsite" />
                      <label htmlFor="loc-onsite" className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Onsite
                      </label>
                    </div>
                  </RadioGroup>

                  {watchedValues.locationType === "onsite" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Specify location</Label>
                      <Input
                        {...form.register("locationDetails")}
                        title="Location Details"
                        placeholder='e.g. "Makati City" or "TBA"'
                      />
                      {form.formState.errors.locationDetails && (
                        <p className="text-xs text-destructive">{form.formState.errors.locationDetails.message}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Entry Fee */}
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div>
                    <Label className="text-sm font-semibold">Requires Entry Fee?</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Participants will be charged to join</p>
                  </div>
                  <Switch
                    checked={watchedValues.requiresEntryFee}
                    onCheckedChange={(val) => form.setValue("requiresEntryFee", val)}
                  />
                </div>

                {watchedValues.requiresEntryFee && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        {...form.register("entryFeeAmount")}
                        title="Entry Fee Amount"
                        type="number"
                        placeholder="100.00"
                        min={0}
                        step={0.01}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select onValueChange={(val) => form.setValue("currency", val)} defaultValue={watchedValues.currency}>
                        <SelectTrigger title="Currency">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────── STEP 2: TIMELINE ─────────────────── */}
            {currentStep === 2 && (
              <div className="space-y-6">

                {/* ── PERPETUAL TOGGLE ── */}
                <div className="flex items-center justify-between rounded-md border p-4 bg-muted/30">
                  <div>
                    <Label className="text-sm font-semibold">Perpetual Challenge</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No fixed end date — the challenge runs indefinitely
                    </p>
                  </div>
                  <Switch
                    checked={watchedValues.isPerpetual}
                    onCheckedChange={(val) => {
                      form.setValue("isPerpetual", val)
                      if (val) {
                        form.setValue("endDate", undefined)
                        form.clearErrors("endDate")
                      }
                    }}
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className={cn("w-full justify-start text-left font-normal", !watchedValues.startDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watchedValues.startDate ? format(watchedValues.startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={watchedValues.startDate}
                        onSelect={(date) => date && form.setValue("startDate", date, { shouldValidate: true })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.startDate && <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>}
                </div>

                {/* End Date — hidden when perpetual */}
                {!watchedValues.isPerpetual && (
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          type="button"
                          className={cn("w-full justify-start text-left font-normal", !watchedValues.endDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {watchedValues.endDate ? format(watchedValues.endDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={watchedValues.endDate}
                          onSelect={(date) => date && form.setValue("endDate", date, { shouldValidate: true })}
                          disabled={(date) => watchedValues.startDate ? date < watchedValues.startDate : false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {form.formState.errors.endDate && <p className="text-xs text-destructive">{form.formState.errors.endDate.message as string}</p>}
                  </div>
                )}

                {watchedValues.isPerpetual && (
                  <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-sm text-primary/70 text-center">
                    🔄 This challenge has no end date and will remain open indefinitely.
                  </div>
                )}

                {/* Registration Deadline */}
                <div className="space-y-2">
                  <Label>Registration Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className={cn("w-full justify-start text-left font-normal", !watchedValues.registrationDeadline && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watchedValues.registrationDeadline ? format(watchedValues.registrationDeadline, "PPP") : "Pick a date (optional)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={watchedValues.registrationDeadline}
                        onSelect={(date) => form.setValue("registrationDeadline", date || undefined)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* ─────────────────── STEP 3: MILESTONES ─────────────────── */}
            {currentStep === 3 && (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Milestone {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        {...form.register(`milestones.${index}.title`)}
                        title={`Milestone ${index + 1} Title`}
                        placeholder="e.g. Final Submission"
                      />
                      {form.formState.errors.milestones?.[index]?.title && (
                        <p className="text-xs text-destructive">{form.formState.errors.milestones[index]?.title?.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Textarea
                        {...form.register(`milestones.${index}.description`)}
                        title={`Milestone ${index + 1} Description`}
                        placeholder="What should participants submit?"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            type="button"
                            className={cn("w-full justify-start text-left font-normal", !watchedValues.milestones[index]?.dueDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {watchedValues.milestones[index]?.dueDate
                              ? format(watchedValues.milestones[index].dueDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={watchedValues.milestones[index]?.dueDate}
                            onSelect={(date) => date && form.setValue(`milestones.${index}.dueDate`, date, { shouldValidate: true })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {form.formState.errors.milestones?.[index]?.dueDate && (
                        <p className="text-xs text-destructive">{form.formState.errors.milestones[index]?.dueDate?.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Required Submission Types</Label>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`github-${index}`}
                            checked={watchedValues.milestones[index]?.requiresGithub || false}
                            onCheckedChange={(checked) => form.setValue(`milestones.${index}.requiresGithub`, checked as boolean)}
                          />
                          <Label htmlFor={`github-${index}`}>GitHub Link</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`url-${index}`}
                            checked={watchedValues.milestones[index]?.requiresUrl || false}
                            onCheckedChange={(checked) => form.setValue(`milestones.${index}.requiresUrl`, checked as boolean)}
                          />
                          <Label htmlFor={`url-${index}`}>Demo URL</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`text-${index}`}
                            checked={watchedValues.milestones[index]?.requiresText || false}
                            onCheckedChange={(checked) => form.setValue(`milestones.${index}.requiresText`, checked as boolean)}
                          />
                          <Label htmlFor={`text-${index}`}>Written Report</Label>
                        </div>
                      </div>
                    </div>

                    {/* Scoring Criteria */}
                    <div className="space-y-2 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Scoring Criteria <span className="text-muted-foreground">(optional)</span></Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const current = form.getValues(`milestones.${index}.criteria`) || []
                            form.setValue(`milestones.${index}.criteria`, [...current, { criteriaName: "", maxPoints: 10 }])
                          }}
                        >
                          <Plus className="h-3 w-3" /> Add Criterion
                        </Button>
                      </div>
                      {(watchedValues.milestones[index]?.criteria || []).length === 0 && (
                        <p className="text-xs text-muted-foreground">No scoring criteria yet.</p>
                      )}
                      {(watchedValues.milestones[index]?.criteria || []).map((_, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <Input
                            className="h-8 flex-1 text-xs"
                            {...form.register(`milestones.${index}.criteria.${cIdx}.criteriaName`)}
                            placeholder="e.g. Code Quality"
                          />
                          <Input
                            className="h-8 w-20 text-xs"
                            type="number"
                            min={1}
                            max={1000}
                            {...form.register(`milestones.${index}.criteria.${cIdx}.maxPoints`, { valueAsNumber: true })}
                          />
                          <span className="text-xs text-muted-foreground shrink-0">pts</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const current = form.getValues(`milestones.${index}.criteria`) || []
                              form.setValue(`milestones.${index}.criteria`, current.filter((_, i) => i !== cIdx))
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ title: "", description: "", dueDate: new Date(), requiresGithub: false, requiresUrl: false, requiresText: true, criteria: [] })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Milestone
                </Button>
              </div>
            )}

            {/* ─────────────────── STEP 4: SKILLS ─────────────────── */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Required Skills</Label>
                  <p className="text-sm text-muted-foreground">Type a skill and press Enter or Comma to add.</p>
                  <Input
                    title="Required Skills"
                    value={skillsInput}
                    onChange={handleSkillsChange}
                    onKeyDown={handleSkillKeyDown}
                    placeholder="e.g. React, Python, UI/UX"
                  />
                  {form.formState.errors.skills && <p className="text-xs text-destructive">{form.formState.errors.skills.message}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(watchedValues.skills || []).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-medium"
                      >
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                          <X className="h-3 w-3 hover:text-destructive" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── SCORING MODE ── */}
                <div className="space-y-3 rounded-md border p-4">
                  <div>
                    <Label className="text-sm font-semibold">Scoring Mode</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      How should submission scores be calculated when both a company member and an evaluator review the same submission?
                    </p>
                  </div>
                  <RadioGroup
                    value={watchedValues.scoringMode}
                    onValueChange={(val: "company_only" | "evaluator_only" | "average") =>
                      form.setValue("scoringMode", val)
                    }
                    className="space-y-2"
                  >
                    <div className={cn(
                      "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                      watchedValues.scoringMode === "company_only" && "border-primary bg-primary/5"
                    )}>
                      <RadioGroupItem value="company_only" id="score-company" className="mt-0.5" />
                      <label htmlFor="score-company" className="cursor-pointer">
                        <p className="text-sm font-medium">Company Only</p>
                        <p className="text-xs text-muted-foreground">Only your team's score counts. Evaluator feedback is shown as advisory.</p>
                      </label>
                    </div>
                    <div className={cn(
                      "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                      watchedValues.scoringMode === "evaluator_only" && "border-primary bg-primary/5"
                    )}>
                      <RadioGroupItem value="evaluator_only" id="score-evaluator" className="mt-0.5" />
                      <label htmlFor="score-evaluator" className="cursor-pointer">
                        <p className="text-sm font-medium">Evaluator Only</p>
                        <p className="text-xs text-muted-foreground">The assigned expert's score is the official result. Your feedback is shown as advisory.</p>
                      </label>
                    </div>
                    <div className={cn(
                      "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                      watchedValues.scoringMode === "average" && "border-primary bg-primary/5"
                    )}>
                      <RadioGroupItem value="average" id="score-average" className="mt-0.5" />
                      <label htmlFor="score-average" className="cursor-pointer">
                        <p className="text-sm font-medium">Average Both</p>
                        <p className="text-xs text-muted-foreground">Final score is the average of your score and the evaluator's score.</p>
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* ─────────────────── STEP 5: REVIEW ─────────────────── */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Title</h3>
                    <p>{watchedValues.title}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Difficulty</h3>
                    <p className="capitalize">{watchedValues.difficulty}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Industries</h3>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(watchedValues.industries || []).map(i => (
                        <span key={i} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">{i}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Location</h3>
                    <p className="flex items-center gap-1">
                      {watchedValues.locationType === "online"
                        ? <><Globe className="h-3.5 w-3.5" /> Online</>
                        : <><MapPin className="h-3.5 w-3.5" /> Onsite — {watchedValues.locationDetails || "TBA"}</>
                      }
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Timeline</h3>
                    <p>
                      {watchedValues.startDate ? format(watchedValues.startDate, "MMM d, yyyy") : "—"}
                      {" → "}
                      {watchedValues.isPerpetual
                        ? <span className="text-primary font-medium">Perpetual (No end date)</span>
                        : watchedValues.endDate ? format(watchedValues.endDate, "MMM d, yyyy") : "—"
                      }
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Participation</h3>
                    <p className="capitalize">{watchedValues.participationType}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Entry Fee</h3>
                    <p>
                      {watchedValues.requiresEntryFee && watchedValues.entryFeeAmount
                        ? `${watchedValues.currency || "PHP"} ${Number(watchedValues.entryFeeAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        : "Free"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Milestones</h3>
                    <div className="space-y-0.5 mt-0.5">
                      {watchedValues.milestones.map((m, i) => (
                        <p key={i} className="text-xs">
                          {i + 1}. {m.title || "(untitled)"}
                          {(m.criteria || []).length > 0 && (
                            <span className="text-muted-foreground"> — {(m.criteria || []).length} criteria</span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-muted-foreground text-sm">Scoring Mode</h3>
                    <p>
                      {watchedValues.scoringMode === "company_only" && "Company Only"}
                      {watchedValues.scoringMode === "evaluator_only" && "Evaluator Only"}
                      {watchedValues.scoringMode === "average" && "Average Both"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-sm">Skills</h3>
                  <div className="flex gap-2 flex-wrap">
                    {(watchedValues.skills || []).map(s => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              {currentStep < STEPS.length ? (
                <Button key="next-button" type="button" onClick={handleNext}>
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button key="submit-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Challenge"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper Badge Component
function Badge({ children, variant, className }: any) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
      className,
      variant === "secondary"
        ? "border-transparent bg-secondary text-secondary-foreground"
        : "text-foreground"
    )}>
      {children}
    </span>
  )
}