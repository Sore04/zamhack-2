"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateChallenge,
  type MilestoneInput,
  type UpdateChallengeInput,
} from "@/app/challenges/edit-actions";
import { Constants } from "@/types/supabase";

const STATUSES = Constants.public.Enums.challenge_status;
const DIFFICULTIES = Constants.public.Enums.proficiency_level;
const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Education", "E-commerce", "Other"] as const;
const PARTICIPATION_TYPES = ["solo"] as const;

export default function EditChallengeForm({
  challenge,
  isLiveEdit = false,
}: {
  challenge: any;
  isLiveEdit?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    challenge.banner_image ?? null
  );

  // Basic fields
  const [title, setTitle] = useState<string>(challenge.title ?? "");
  const [description, setDescription] = useState<string>(challenge.description ?? "");
  const [problemBrief, setProblemBrief] = useState<string>(challenge.problem_brief ?? "");

  // Industries: load from array, fall back to legacy single industry string
  const [industries, setIndustries] = useState<string[]>(() => {
    if (Array.isArray(challenge.industries) && challenge.industries.length > 0) {
      return challenge.industries;
    }
    if (challenge.industry) return [challenge.industry];
    return [];
  });

  function toggleIndustry(value: string) {
    setIndustries((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  }

  const [difficulty, setDifficulty] = useState<UpdateChallengeInput["difficulty"]>(
    challenge.difficulty ?? "beginner"
  );
  const [status, setStatus] = useState<UpdateChallengeInput["status"]>(
    challenge.status ?? "draft"
  );
  const [participationType, setParticipationType] = useState<UpdateChallengeInput["participation_type"]>(
    challenge.participation_type ?? "solo"
  );
  const [maxParticipants, setMaxParticipants] = useState<number>(challenge.max_participants ?? 50);
  const [maxTeams, setMaxTeams] = useState<number>(challenge.max_teams ?? 20);
  const [maxTeamSize, setMaxTeamSize] = useState<number>(challenge.max_team_size ?? 4);

  // Perpetual toggle
  const [isPerpetual, setIsPerpetual] = useState<boolean>(!!challenge.is_perpetual);

  // Dates
  const [startDate, setStartDate] = useState<string>(toDatetimeLocal(challenge.start_date));
  const [endDate, setEndDate] = useState<string>(toDatetimeLocal(challenge.end_date));
  const [registrationDeadline, setRegistrationDeadline] = useState<string>(
    toDatetimeLocal(challenge.registration_deadline)
  );

  // Location
  const [locationType, setLocationType] = useState<"online" | "onsite" | "">(
    challenge.location_type ?? ""
  );
  const [locationDetails, setLocationDetails] = useState<string>(
    challenge.location_details ?? ""
  );

  // Entry fee
  const [entryFee, setEntryFee] = useState<number>(challenge.entry_fee_amount ?? 0);
  const [currency, setCurrency] = useState<string>(challenge.currency ?? "PHP");

  // Scoring mode
  const [scoringMode, setScoringMode] = useState<"company_only" | "evaluator_only" | "average">(
    challenge.scoring_mode ?? "company_only"
  );

  // Milestones
  const [milestones, setMilestones] = useState<MilestoneInput[]>(
    (challenge.milestones ?? [])
      .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description ?? "",
        due_date: toDatetimeLocal(m.due_date),
        sequence_order: m.sequence_order,
        requires_github: m.requires_github ?? false,
        requires_url: m.requires_url ?? false,
        requires_text: m.requires_text ?? false,
        criteria: (m.rubrics ?? []).map((r: any) => ({
          criteriaName: r.criteria_name,
          maxPoints: r.max_points ?? 10,
        })),
      }))
  );

  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        due_date: "",
        sequence_order: prev.length + 1,
        requires_github: false,
        requires_url: false,
        requires_text: true,
      },
    ]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMilestone(index: number, field: keyof MilestoneInput, value: any) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function addCriterion(milestoneIndex: number) {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? { ...m, criteria: [...(m.criteria ?? []), { criteriaName: "", maxPoints: 10 }] }
          : m
      )
    );
  }

  function updateCriterion(milestoneIndex: number, cIdx: number, field: "criteriaName" | "maxPoints", value: any) {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? {
              ...m,
              criteria: (m.criteria ?? []).map((c, j) =>
                j === cIdx ? { ...c, [field]: value } : c
              ),
            }
          : m
      )
    );
  }

  function removeCriterion(milestoneIndex: number, cIdx: number) {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? { ...m, criteria: (m.criteria ?? []).filter((_, j) => j !== cIdx) }
          : m
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    for (const m of milestones) {
      if (!m.requires_github && !m.requires_url && !m.requires_text) {
        setError(`Milestone "${m.title}" must require at least one submission type.`);
        setLoading(false);
        return;
      }
      if (m.due_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(m.due_date) < today) {
          setError(`Milestone "${m.title || "Untitled"}" due date cannot be in the past.`);
          setLoading(false);
          return;
        }
      }
    }

    try {
      const bannerFormData = bannerFile ? new FormData() : null;
      if (bannerFormData && bannerFile) bannerFormData.append("banner", bannerFile);
      const result = await updateChallenge(challenge.id, {
        title,
        description,
        problem_brief: problemBrief,
        industries,
        difficulty,
        status,
        participation_type: participationType,
        max_participants: maxParticipants,
        max_teams: maxTeams,
        max_team_size: maxTeamSize,
        start_date: startDate,
        end_date: endDate,
        registration_deadline: registrationDeadline,
        entry_fee_amount: entryFee,
        currency,
        is_perpetual: isPerpetual,
        location_type: locationType || null,
        location_details: locationType === "onsite" ? locationDetails : null,
        scoring_mode: scoringMode,
        milestones,
      }, bannerFormData);

      if (result.type === "resubmitted") {
        toast.success("Challenge resubmitted for review");
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* ── Basic Info ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basic Info</h2>

        <Field label="Title">
          <input
            title="Title"
            placeholder="Title"
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </Field>

        <Field label="Description">
          <textarea
            title="Description"
            placeholder="Description"
            className={inputCls}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="Problem Brief">
          <textarea
            title="Problem Brief"
            placeholder="Problem Brief"
            className={inputCls}
            rows={5}
            value={problemBrief}
            onChange={(e) => setProblemBrief(e.target.value)}
          />
        </Field>

        <Field label="Challenge Banner Image">
          <p className="text-xs text-gray-500 mb-1">Recommended: 1200×400px. JPG, PNG or WebP.</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              if (file.size > 4 * 1024 * 1024) {
                toast.error("Banner image must be under 4 MB. Please choose a smaller file.");
                e.target.value = "";
                return;
              }

              const img = new Image();
              img.onload = () => {
                if (img.width < 1200 || img.height < 400) {
                  toast.warning(`Banner is ${img.width}×${img.height}px. Recommended size is 1200×400px or larger.`);
                }
                URL.revokeObjectURL(img.src);
              };
              img.src = URL.createObjectURL(file);

              setBannerFile(file);
              const reader = new FileReader();
              reader.onload = (ev) => setBannerPreview(ev.target?.result as string);
              reader.readAsDataURL(file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer"
          />
          {bannerPreview && (
            <div className="relative mt-2 rounded-lg overflow-hidden aspect-[3/1] w-full">
              <img
                src={bannerPreview}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => { setBannerFile(null); setBannerPreview(null); }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
              >
                ✕
              </button>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {/* Industries — multi-checkbox */}
          <Field label="Industries">
            <div className="flex flex-wrap gap-3 pt-1">
              {INDUSTRIES.map((ind) => (
                <label key={ind} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={industries.includes(ind)}
                    onChange={() => toggleIndustry(ind)}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="text-sm">{ind}</span>
                </label>
              ))}
            </div>
            {industries.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one industry.</p>
            )}
          </Field>

          <Field label="Difficulty">
            <select
              title="Difficulty"
              className={inputCls}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as UpdateChallengeInput["difficulty"])}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* ── Status & Participation ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Status &amp; Participation</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select
              title="Status"
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as UpdateChallengeInput["status"])}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="Participation Type">
            <select
              title="Participation Type"
              className={inputCls}
              value={participationType}
              onChange={(e) =>
                setParticipationType(e.target.value as UpdateChallengeInput["participation_type"])
              }
            >
              {PARTICIPATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Max Participants">
            <input
              title="Max Participants"
              placeholder="50"
              type="number"
              className={inputCls}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              min={1}
            />
          </Field>
          <Field label="Max Teams">
            <input
              title="Max Teams"
              placeholder="20"
              type="number"
              className={inputCls}
              value={maxTeams}
              onChange={(e) => setMaxTeams(Number(e.target.value))}
              min={1}
            />
          </Field>
          <Field label="Max Team Size">
            <input
              title="Max Team Size"
              placeholder="4"
              type="number"
              className={inputCls}
              value={maxTeamSize}
              onChange={(e) => setMaxTeamSize(Number(e.target.value))}
              min={1}
            />
          </Field>
        </div>
      </section>

      {/* ── Dates ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Dates</h2>

        {/* Perpetual toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => {
              setIsPerpetual((v) => {
                const next = !v;
                if (next) {
                  setMilestones((prev) => prev.map((m) => ({ ...m, due_date: "" })));
                }
                return next;
              });
            }}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${
              isPerpetual ? "bg-orange-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                isPerpetual ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">
            Perpetual challenge (no end date, open-ended)
          </span>
        </label>

        {isPerpetual && (
          <p className="text-sm text-orange-600">
            Perpetual challenges remain open until manually closed. No end date required.
          </p>
        )}

        <div className={`grid grid-cols-3 gap-4 ${isPerpetual ? "opacity-50 pointer-events-none" : ""}`}>
          <Field label="Start Date">
            <input
              title="Start Date"
              type="datetime-local"
              className={inputCls}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isPerpetual}
            />
          </Field>
          <Field label="End Date">
            <input
              title="End Date"
              type="datetime-local"
              className={inputCls}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isPerpetual}
            />
          </Field>
          <Field label="Registration Deadline">
            <input
              title="Registration Deadline"
              type="datetime-local"
              className={inputCls}
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              disabled={isPerpetual}
            />
          </Field>
        </div>
      </section>

      {/* ── Location ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Location</h2>

        <Field label="Challenge Format">
          <select
            title="Location Type"
            className={inputCls}
            value={locationType}
            onChange={(e) => setLocationType(e.target.value as "online" | "onsite" | "")}
          >
            <option value="">Not specified</option>
            <option value="online">Online</option>
            <option value="onsite">Onsite</option>
          </select>
        </Field>

        {locationType === "onsite" && (
          <Field label="Location Details">
            <input
              title="Location Details"
              placeholder="e.g. Ateneo de Davao University, Davao City"
              className={inputCls}
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the full venue address or name where the challenge will be held.
            </p>
          </Field>
        )}

        {locationType === "online" && (
          <p className="text-sm text-blue-600">
            Students can participate from anywhere. No physical attendance required.
          </p>
        )}
      </section>

      {/* ── Prize / Entry Fee ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Prize / Entry Fee</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Entry Fee Amount">
            <input
              title="Entry Fee Amount"
              placeholder="0"
              type="number"
              className={inputCls}
              value={entryFee}
              onChange={(e) => setEntryFee(Number(e.target.value))}
              min={0}
            />
          </Field>
          <Field label="Currency">
            <select
              title="Currency"
              className={inputCls}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="PHP">PHP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Entry Fee Policy</p>
          <p>
            ZamHack retains a <span className="font-semibold">15% platform fee</span> on
            all student entry payments. The remaining 85% will be disbursed to your
            organization within 7 days after the challenge registration period closes.
          </p>
          <p>
            In the event of a challenge cancellation, refund eligibility will be
            determined by ZamHack on a case-by-case basis.
          </p>
        </div>
      </section>

      {/* ── Milestones ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Milestones</h2>
          <button
            type="button"
            onClick={addMilestone}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            + Add Milestone
          </button>
        </div>

        {milestones.map((m, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Milestone {i + 1}</span>
              <button
                type="button"
                onClick={() => removeMilestone(i)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>

            <Field label="Title">
              <input
                title="Milestone Title"
                placeholder="e.g. Project Proposal"
                className={inputCls}
                value={m.title}
                onChange={(e) => updateMilestone(i, "title", e.target.value)}
              />
            </Field>

            <Field label="Description">
              <textarea
                title="Milestone Description"
                placeholder="Describe what students need to submit"
                className={inputCls}
                rows={2}
                value={m.description}
                onChange={(e) => updateMilestone(i, "description", e.target.value)}
              />
            </Field>

            {isPerpetual ? (
              <p className="text-xs text-gray-500">Due dates are not applicable for perpetual challenges.</p>
            ) : (
              <Field label="Due Date">
                <input
                  title="Due Date"
                  type="datetime-local"
                  className={inputCls}
                  value={m.due_date}
                  onChange={(e) => updateMilestone(i, "due_date", e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </Field>
            )}

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.requires_github}
                  onChange={(e) => updateMilestone(i, "requires_github", e.target.checked)}
                />
                Requires GitHub
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.requires_url}
                  onChange={(e) => updateMilestone(i, "requires_url", e.target.checked)}
                />
                Requires URL
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={m.requires_text}
                  onChange={(e) => updateMilestone(i, "requires_text", e.target.checked)}
                />
                Requires Text
              </label>
            </div>

            {/* Scoring Criteria */}
            <div className="space-y-2 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Scoring Criteria (optional)</span>
                <button
                  type="button"
                  onClick={() => addCriterion(i)}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  + Add Criterion
                </button>
              </div>
              {(m.criteria ?? []).length === 0 && (
                <p className="text-xs text-gray-400">No scoring criteria defined for this milestone.</p>
              )}
              {(m.criteria ?? []).map((c, cIdx) => (
                <div key={cIdx} className="flex items-center gap-2">
                  <input
                    title="Criterion Name"
                    placeholder="e.g. Code Quality"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                    value={c.criteriaName}
                    onChange={(e) => updateCriterion(i, cIdx, "criteriaName", e.target.value)}
                  />
                  <input
                    title="Max Points"
                    type="number"
                    min={1}
                    max={1000}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                    value={c.maxPoints}
                    onChange={(e) => updateCriterion(i, cIdx, "maxPoints", Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-500 shrink-0">pts</span>
                  <button
                    type="button"
                    onClick={() => removeCriterion(i, cIdx)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50"
        >
          {loading
            ? isLiveEdit ? "Submitting..." : "Saving..."
            : isLiveEdit ? "Submit for Review" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border px-6 py-2 rounded-md font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Helpers ──

const inputCls =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function toDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return new Date(isoString).toISOString().slice(0, 16);
}