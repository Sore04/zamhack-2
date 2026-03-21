# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZamHack is a hackathon platform where companies post challenges for students to solve and gain real-world experience. Companies manage challenges and review submissions; students browse challenges, form teams, and submit work across milestones.

Live deployment: https://zamhack.vercel.app/

The codebase is a Next.js 14 full-stack app with three distinct portals: **Student**, **Company**, and **Admin**. The actual app code lives in `zamhack-platform/`.

## Commands

All commands run from `zamhack-platform/`:

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
npm start        # Start production server
```

No test suite is configured.

## Architecture

### Portal Structure

Three route groups with separate layouts and CSS:

- `src/app/(student)/` — student dashboard, challenges, teams, profile
- `src/app/(company)/` — company dashboard, challenge creation/management, analytics
- `src/app/(admin)/` — platform analytics, user management, challenge approval

Landing page at `src/app/page.tsx` redirects authenticated users to their role-specific portal.

### Auth & Roles

Supabase Auth with cookie-based SSR sessions. Roles stored in the `profiles` table:
`student` | `company_admin` | `company_member` | `admin`

Supabase clients:
- `src/utils/supabase/server.ts` — server components and actions
- `src/utils/supabase/client.ts` — client components

### Data Layer

- **Server state**: React Query (fetch + cache in client components)
- **Global state**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Types**: Auto-generated Supabase types at `src/types/supabase.ts` — always reference these

### Key Database Tables

`profiles`, `organizations`, `challenges`, `milestones`, `challenge_participants`, `submissions`, `evaluations`, `teams`, `challenge_evaluators`, `support_tickets`, `student_earned_skills`, `challenge_skills`, `skills`, `student_skills`, `rubrics`, `scores`, `winners`, `payments`, `platform_settings`, `challenge_pending_edits`

### Component Conventions

- UI primitives from `src/components/ui/` (shadcn/ui — do not add other component libraries)
- Portal layouts in `src/components/layouts/`
- Portal-specific global CSS: `student.css`, `company-portal.css`, `admin.css`
- Icons via `lucide-react` only
- Use arrow functions for components
- No `any` types — use generated Supabase types

### Server Actions

Form submissions use Next.js server actions (`src/actions/`). Pages are server components by default; add `"use client"` only for interactive UI.

### LLM Auto-Evaluation

When a student submits a milestone, `submitMilestone` in `src/app/challenges/submission-actions.ts` fires a non-blocking `after()` call to `autoEvaluateSubmission` in `src/lib/auto-evaluate.ts`.

**Trigger condition — text-only milestones only.** Auto-evaluation is skipped unless the milestone has `requires_text = true` AND both `requires_github` and `requires_url` are `false`. GitHub/URL submissions are not auto-evaluated because the evaluator can only read written text; the GitHub README fetch is an optional supplement, not the primary input.

The evaluator:
1. Fetches rubrics scoped to the submission's milestone (`milestone_id = milestoneId`). Falls back to challenge-level rubrics (`milestone_id IS NULL`) if none exist — for backward compatibility with challenges created before per-milestone criteria were introduced.
2. Fetches the GitHub README (if a `github_link` was submitted) via the raw GitHub URL — used as supplemental context only
3. Builds a structured prompt and calls the **Claude Haiku** API (`claude-haiku-4-5-20251001`)
4. Parses the JSON response and clamps scores to rubric `max_points`
5. Writes an `evaluations` row with `is_draft = true` and `reviewer_id = null`, plus per-criterion `scores` rows

Uses the **service-role Supabase client** (bypasses RLS) since there is no authenticated user context in the background task. Companies then review and finalize the draft in the grading UI.

Supports two modes:
- **With rubrics**: scores each `criteria_name` criterion individually; total = sum of points
- **Without rubrics**: returns a single 0–100 score

### Per-Milestone Scoring Criteria

Rubrics are now scoped per milestone via a `milestone_id` column on the `rubrics` table (nullable for backward compat).

**Database migration required** (run once in Supabase SQL editor before deploying):
```sql
ALTER TABLE public.rubrics ADD COLUMN milestone_id uuid REFERENCES public.milestones(id);
```
After running the migration, regenerate TypeScript types: `supabase gen types typescript --project-id <id> > src/types/supabase.ts`

**Where criteria are defined:**
- **Challenge creation** (`create-challenge-form.tsx`, Step 3 — Milestones): each milestone card has an inline "Scoring Criteria" section with name + max points inputs.
- **Challenge editing** (`edit-challenge-form.tsx`, Milestones section): same inline criteria UI; pre-populated from existing rubrics fetched via `milestones(*, rubrics(*))` in `getChallengeForEdit`.
- **Scoring Tab** (`rubric-manager.tsx`): post-creation management; rubrics are now grouped by milestone. Each milestone section has its own "+ Add Criterion" button. Rubrics without a `milestone_id` (legacy challenge-level rubrics) appear under "Other Criteria".

**Data flow for criteria:**
- Create: `create-actions.ts` inserts milestones with `.select("id, sequence_order")`, then inserts rubrics rows with the returned `milestone_id`.
- Edit: `edit-actions.ts` deletes existing milestone rubrics and re-inserts from form data on each save. New milestones get their rubrics inserted after the milestone row is created.
- Grading: `submissions/[submissionId]/page.tsx` filters rubrics by `milestone_id` (with challenge-level fallback) before passing to `GradingForm`.

**`any` casts:** Because the `milestone_id` column is not yet in the auto-generated `src/types/supabase.ts` until types are regenerated, Supabase insert/filter calls that reference `milestone_id` use `as any` casts. Remove these casts after type regeneration.

### Participation Gate System

Controls which students can join challenges based on difficulty. Implemented in `src/lib/participation-gate.ts`.

**Gate rules:**
- `beginner` challenges — open to everyone by default (cold-start rule), but subject to the Advanced Student Guardrail (see below)
- `intermediate` challenges — student must have at least one matching skill (from `challenge_skills`) earned at any tier in `student_earned_skills`
- `advanced` challenges — student must have at least one matching skill earned at `intermediate` or `advanced` tier

If a challenge has no rows in `challenge_skills`, the gate is skipped entirely.

**Where it's enforced:**
1. `joinChallenge()` in `src/app/challenges/actions.ts` — calls `checkParticipationGate()` before inserting the participant row
2. `src/app/(student)/challenges/[id]/page.tsx` — server-side pre-check; renders a locked button instead of Join if blocked

**Gate utility:** `src/lib/participation-gate.ts` — exports `checkParticipationGate(supabase, challengeId, profileId): Promise<GateResult>`. Returns `{ allowed: true }` or one of two failure shapes:
- `{ allowed: false, reason: "skill_gate", requiredTier, difficulty, missingSkillIds }` — missing required skill
- `{ allowed: false, reason: "advanced_limit", nextEligibleAt, effectiveLimit }` — weekly beginner limit reached

**Skill gate page:** `src/app/(student)/challenges/[id]/skill-gate/page.tsx` — shown when a student is blocked by `skill_gate`. Displays missing skills and lists beginner/intermediate challenges that award those skills as a progression path.

### Advanced Student Guardrail

Prevents advanced-tier students from repeatedly joining beginner challenges and crowding out newer students. Enforced inside `checkParticipationGate()` as part of the beginner branch.

**How the check works:**
1. Extract `challenge_skills` from the beginner challenge. If none exist → skip (can't determine overqualification).
2. Read `advanced_beginner_weekly_limit` from `platform_settings` (global setting, admin-configurable). If null → guardrail disabled.
3. Check if the student has any of the challenge's specific skills at `advanced` tier in `student_earned_skills`. If not → allow freely.
4. Find all challenge IDs that share those same advanced skills (via `challenge_skills` table).
5. Count how many of those beginner challenges the student joined in the past 7 days (rolling window). If count ≥ limit → block with `advanced_limit`.

**Key behaviour:**
- The counter is skill-scoped: joining a beginner Python challenge only counts toward the Python limit, not a C++ limit.
- A student with advanced Python trying to join a beginner C++ challenge (which they don't hold at advanced) is never affected.
- `nextEligibleAt` = earliest qualifying `joined_at` in the window + 7 days.

**Admin configuration:** `src/app/(admin)/admin/challenges/page.tsx` has a **Guardrails** tab. The form (`guardrails-form.tsx`) lets admins set `advanced_beginner_weekly_limit` via `updateGuardrailLimit()` in `src/app/admin/actions.ts`. Stored in the `platform_settings` singleton row.

**Database migration required:**
```sql
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS advanced_beginner_weekly_limit integer DEFAULT 1;

-- Required so students can read the limit during join checks (RLS)
CREATE POLICY "authenticated users can read platform settings"
ON public.platform_settings FOR SELECT TO authenticated USING (true);
```

**Student UI:** `src/app/(student)/challenges/[id]/page.tsx` renders a disabled "Weekly limit reached" button with the next eligible date when `gateStatus.reason === "advanced_limit"`.

### Skill Award System

Students earn skills from `challenge_skills` into `student_earned_skills` upon challenge completion. Tier is determined by the challenge's `difficulty` column. Implemented in `src/lib/award-skills.ts`.

**Upgrade-only rule:** A student's tier for a skill can only increase (`beginner → intermediate → advanced`), never decrease. The utility fetches the existing row and skips the write if `TIER_RANK[new] <= TIER_RANK[existing]`.

**When skills are awarded:**
- **Normal challenges:** `closeChallenge()` in `src/app/challenges/actions.ts` loops over all `active` participants and calls `awardChallengeSkills()` for each.
- **Perpetual challenges:** `submitMilestone()` in `src/app/challenges/submission-actions.ts` checks after each submission whether all milestones are now submitted. If so, calls `awardChallengeSkills()` immediately — no close event needed.
- **Admin grant:** Admin user management panel can manually grant skills (sets `source = 'admin'`).

**Skill award utility:** `src/lib/award-skills.ts` — exports `awardChallengeSkills(supabase, challengeId, profileId)`. Handles per-skill upgrade logic with individual fetches and updates.

**`student_earned_skills` vs `student_skills`:**
- `student_skills` — self-reported portfolio skills (student adds manually, max 15 total)
- `student_earned_skills` — earned via challenges, unique `(profile_id, skill_id)` with an upgradeable `tier`

**Profile display:** Earned skills are shown on the student profile page (`src/app/(student)/profile/page.tsx`) via `src/components/profile/skills-section.tsx`, grouped by tier.

**Admin grant UI:** `src/app/(admin)/admin/users/grant-skill-button.tsx` — rendered per student card in the User Management page. Calls `grantEarnedSkill(profileId, skillId, tier)` in `src/app/admin/actions.ts`. Sets `source = 'admin'` on the inserted row.

### Scoring Mode

`challenges.scoring_mode` determines which evaluations count toward winner calculation:
- `company_only` — only company reviewer scores
- `evaluator_only` — only external evaluator scores
- `average` — average of both

Logic in `src/lib/scoring-utils.ts` (`getFinalScore`). Used in `closeChallenge()` and `recalculateWinners()`.

## Environment Variables

Required in `zamhack-platform/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # used by auto-evaluator to bypass RLS
ANTHROPIC_API_KEY=                # used by auto-evaluator (Claude Haiku)
```
