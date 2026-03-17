-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
--
-- See bottom of file for implementation notes.

CREATE TABLE public.challenge_evaluators (
  challenge_id uuid NOT NULL,
  evaluator_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_evaluators_pkey PRIMARY KEY (challenge_id, evaluator_id),
  CONSTRAINT challenge_evaluators_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id),
  CONSTRAINT challenge_evaluators_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.challenge_participants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid,
  user_id uuid,
  team_id uuid,
  status text DEFAULT 'active'::text,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_participants_pkey PRIMARY KEY (id),
  CONSTRAINT challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id),
  CONSTRAINT challenge_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT challenge_participants_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.challenge_skills (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid,
  skill_id uuid,
  CONSTRAINT challenge_skills_pkey PRIMARY KEY (id),
  CONSTRAINT challenge_skills_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id),
  CONSTRAINT challenge_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);
CREATE TABLE public.challenges (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid,
  created_by uuid,
  title text NOT NULL,
  description text,
  problem_brief text,
  industry text,
  difficulty USER-DEFINED,
  status USER-DEFINED DEFAULT 'draft'::challenge_status,
  participation_type text CHECK (participation_type = ANY (ARRAY['solo'::text, 'team'::text, 'both'::text])),
  max_participants integer DEFAULT 50,
  max_teams integer DEFAULT 20,
  max_team_size integer DEFAULT 4,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  registration_deadline timestamp with time zone,
  embedding USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  entry_fee_amount numeric DEFAULT 0,
  currency text DEFAULT 'PHP'::text,
  industries text[] DEFAULT '{}',
  location_type text CHECK (location_type IN ('online', 'onsite')),
  location_details text,
  is_perpetual boolean NOT NULL DEFAULT false,
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT challenges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, profile_id),
  CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT conversation_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid,
  type text CHECK (type = ANY (ARRAY['direct'::text, 'team'::text, 'support'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id)
);
CREATE TABLE public.evaluations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  submission_id uuid,
  reviewer_id uuid,
  score integer CHECK (score >= 0 AND score <= 100),
  feedback text,
  is_draft boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT evaluations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT evaluations_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid,
  sender_id uuid,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.milestones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid,
  sequence_order integer NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamp with time zone,
  requires_github boolean DEFAULT false,
  requires_url boolean DEFAULT false,
  requires_text boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT milestones_pkey PRIMARY KEY (id),
  CONSTRAINT milestones_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  industry text,
  website text,
  logo_url text,
  is_verified boolean DEFAULT false,
  verification_status text DEFAULT 'pending'::text,
  max_seats integer DEFAULT 5,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  avatar_url text,
  bio text,
  role USER-DEFINED DEFAULT 'student'::app_role,
  university text,
  degree text,
  graduation_year integer,
  resume_link text,
  linkedin_url text,
  github_url text,
  organization_id uuid,
  embedding USER-DEFINED,
  max_active_challenges integer DEFAULT 3,
  withdrawal_cooldown_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  middle_name text,
  address_house_no text,
  address_street text,
  address_barangay text,
  address_city text,
  address_zip text,
  address_country text,
  status text DEFAULT 'active'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.rubrics (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid NOT NULL,
  milestone_id uuid,
  criteria_name text NOT NULL,
  max_points integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rubrics_pkey PRIMARY KEY (id),
  CONSTRAINT rubrics_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id),
  CONSTRAINT rubrics_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id)
);
CREATE TABLE public.scores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  submission_id uuid NOT NULL,
  rubric_id uuid NOT NULL,
  points_awarded integer NOT NULL,
  feedback text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scores_pkey PRIMARY KEY (id),
  CONSTRAINT scores_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT scores_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubrics(id)
);
CREATE TABLE public.skills (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT skills_pkey PRIMARY KEY (id)
);
CREATE TABLE public.student_skills (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid,
  skill_id uuid,
  level USER-DEFINED NOT NULL,
  CONSTRAINT student_skills_pkey PRIMARY KEY (id),
  CONSTRAINT student_skills_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT student_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  milestone_id uuid,
  participant_id uuid,
  github_link text,
  demo_url text,
  written_response text,
  submitted_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id),
  CONSTRAINT submissions_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.challenge_participants(id)
);
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid,
  profile_id uuid UNIQUE,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  join_code text DEFAULT SUBSTRING(md5((random())::text) FROM 0 FOR 8) UNIQUE,
  leader_id uuid,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.winners (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  challenge_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  rank integer NOT NULL,
  prize text,
  announced_at timestamp with time zone DEFAULT now(),
  score integer,
  CONSTRAINT winners_pkey PRIMARY KEY (id),
  CONSTRAINT winners_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id),
  CONSTRAINT winners_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPLEMENTATION NOTES
-- ─────────────────────────────────────────────────────────────────────────────

-- evaluations.reviewer_id
--   NULL when the evaluation was written by the LLM auto-evaluator.
--   Non-null = a company_admin / company_member or evaluator profile.
--   The auto-evaluator always writes is_draft = true so companies review before publishing.

-- scores.feedback
--   Populated with per-criterion feedback by the LLM auto-evaluator.
--   Human reviewers currently leave this null (only evaluations.feedback is used).

-- scores table in TypeScript
--   The `scores` table is missing from some versions of the auto-generated
--   supabase.ts types. Workaround already in place: cast as `"scores" as any`
--   in grading-actions.ts and auto-evaluate.ts.

-- rubrics.milestone_id
--   NULL = challenge-level rubric (legacy / Scoring Tab additions without a milestone context).
--   Non-null = criterion is scoped to that specific milestone.
--   Both challenge_id and milestone_id are stored so rubrics can be queried either way.
--   Migration: ALTER TABLE public.rubrics ADD COLUMN milestone_id uuid REFERENCES public.milestones(id);

-- Auto-evaluation flow
--   submissions → (after Next.js after()) → src/lib/auto-evaluate.ts
--     1. Fetches rubrics for the submission's milestone (milestone_id = milestoneId)
--        Falls back to challenge-level rubrics (milestone_id IS NULL) if none found.
--     2. Fetches GitHub README if github_link is present
--     3. Calls Claude Haiku API with structured prompt
--     4. Writes evaluations row (reviewer_id=null, is_draft=true)
--     5. Writes scores rows (one per rubric criterion)
--   Trigger: submitMilestone server action in submission-actions.ts
--   Uses service-role Supabase client (bypasses RLS).

-- challenge_leaderboard (VIEW)
--   Aggregates total evaluation scores and milestone completion count per
--   participant per challenge. Used for leaderboard display and winners calculation.
--   Only non-draft evaluations (is_draft = false) count toward totals.

-- winners
--   Populated when a challenge is closed (closeChallenge action).
--   Top 3 participants ranked by total score from challenge_leaderboard view.
--   Perpetual challenges (is_perpetual = true) skip winner calculation entirely.

-- platform_settings
--   Single-row table. id column is boolean (always true) acting as a singleton key.