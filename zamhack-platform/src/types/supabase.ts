export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      challenge_evaluators: {
        Row: {
          assigned_at: string | null
          challenge_id: string
          evaluator_id: string
          is_chief: boolean
          review_deadline: string | null
        }
        Insert: {
          assigned_at?: string | null
          challenge_id: string
          evaluator_id: string
          is_chief?: boolean
          review_deadline?: string | null
        }
        Update: {
          assigned_at?: string | null
          challenge_id?: string
          evaluator_id?: string
          is_chief?: boolean
          review_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_evaluators_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_evaluators_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string | null
          id: string
          joined_at: string | null
          status: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          id?: string
          joined_at?: string | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          id?: string
          joined_at?: string | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_pending_edits: {
        Row: {
          admin_note: string | null
          challenge_id: string
          created_at: string | null
          id: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
        }
        Insert: {
          admin_note?: string | null
          challenge_id: string
          created_at?: string | null
          id?: string
          payload: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
        }
        Update: {
          admin_note?: string | null
          challenge_id?: string
          created_at?: string | null
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_pending_edits_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_pending_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_pending_edits_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_skills: {
        Row: {
          challenge_id: string | null
          id: string
          skill_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          id?: string
          skill_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          id?: string
          skill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_skills_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["proficiency_level"] | null
          embedding: string | null
          end_date: string | null
          entry_fee_amount: number | null
          id: string
          industries: string[] | null
          industry: string | null
          is_perpetual: boolean
          location_details: string | null
          location_type: string | null
          max_participants: number | null
          max_team_size: number | null
          max_teams: number | null
          organization_id: string | null
          participation_type: string | null
          problem_brief: string | null
          registration_deadline: string | null
          scoring_mode: string
          start_date: string | null
          status: Database["public"]["Enums"]["challenge_status"] | null
          title: string
          updated_at: string | null
          xp_multiplier: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["proficiency_level"] | null
          embedding?: string | null
          end_date?: string | null
          entry_fee_amount?: number | null
          id?: string
          industries?: string[] | null
          industry?: string | null
          is_perpetual?: boolean
          location_details?: string | null
          location_type?: string | null
          max_participants?: number | null
          max_team_size?: number | null
          max_teams?: number | null
          organization_id?: string | null
          participation_type?: string | null
          problem_brief?: string | null
          registration_deadline?: string | null
          scoring_mode?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["challenge_status"] | null
          title: string
          updated_at?: string | null
          xp_multiplier?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["proficiency_level"] | null
          embedding?: string | null
          end_date?: string | null
          entry_fee_amount?: number | null
          id?: string
          industries?: string[] | null
          industry?: string | null
          is_perpetual?: boolean
          location_details?: string | null
          location_type?: string | null
          max_participants?: number | null
          max_team_size?: number | null
          max_teams?: number | null
          organization_id?: string | null
          participation_type?: string | null
          problem_brief?: string | null
          registration_deadline?: string | null
          scoring_mode?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["challenge_status"] | null
          title?: string
          updated_at?: string | null
          xp_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          profile_id: string
        }
        Insert: {
          conversation_id: string
          profile_id: string
        }
        Update: {
          conversation_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          id: string
          type: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          type?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          is_draft: boolean | null
          reviewer_id: string | null
          score: number | null
          submission_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_draft?: boolean | null
          reviewer_id?: string | null
          score?: number | null
          submission_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_draft?: boolean | null
          reviewer_id?: string | null
          score?: number | null
          submission_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          requires_github: boolean | null
          requires_text: boolean | null
          requires_url: boolean | null
          sequence_order: number
          title: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          requires_github?: boolean | null
          requires_text?: boolean | null
          requires_url?: boolean | null
          sequence_order: number
          title: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          requires_github?: boolean | null
          requires_text?: boolean | null
          requires_url?: boolean | null
          sequence_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          is_verified: boolean | null
          logo_url: string | null
          max_seats: number | null
          name: string
          representative_name: string | null
          signature_url: string | null
          status: string | null
          updated_at: string | null
          verification_status: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_verified?: boolean | null
          logo_url?: string | null
          max_seats?: number | null
          name: string
          representative_name?: string | null
          signature_url?: string | null
          status?: string | null
          updated_at?: string | null
          verification_status?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_verified?: boolean | null
          logo_url?: string | null
          max_seats?: number | null
          name?: string
          representative_name?: string | null
          signature_url?: string | null
          status?: string | null
          updated_at?: string | null
          verification_status?: string | null
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          challenge_id: string
          checkout_session_id: string | null
          created_at: string | null
          currency: string
          id: string
          paid_at: string | null
          payment_intent_id: string | null
          provider: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          challenge_id: string
          checkout_session_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          provider?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          challenge_id?: string
          checkout_session_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          provider?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          advanced_beginner_weekly_limit: number | null
          allow_new_signups: boolean | null
          default_currency: string | null
          id: boolean
          maintenance_mode: boolean | null
          updated_at: string | null
          xp_base_max: number | null
          xp_base_min: number | null
          xp_penalty: number | null
          xp_score_threshold: number | null
        }
        Insert: {
          advanced_beginner_weekly_limit?: number | null
          allow_new_signups?: boolean | null
          default_currency?: string | null
          id?: boolean
          maintenance_mode?: boolean | null
          updated_at?: string | null
          xp_base_max?: number | null
          xp_base_min?: number | null
          xp_penalty?: number | null
          xp_score_threshold?: number | null
        }
        Update: {
          advanced_beginner_weekly_limit?: number | null
          allow_new_signups?: boolean | null
          default_currency?: string | null
          id?: boolean
          maintenance_mode?: boolean | null
          updated_at?: string | null
          xp_base_max?: number | null
          xp_base_min?: number | null
          xp_penalty?: number | null
          xp_score_threshold?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_barangay: string | null
          address_city: string | null
          address_country: string | null
          address_house_no: string | null
          address_street: string | null
          address_zip: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          degree: string | null
          embedding: string | null
          first_name: string | null
          github_url: string | null
          graduation_year: number | null
          id: string
          last_name: string | null
          linkedin_url: string | null
          max_active_challenges: number | null
          middle_name: string | null
          organization_id: string | null
          resume_link: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: string | null
          university: string | null
          updated_at: string | null
          withdrawal_cooldown_until: string | null
          xp_points: number
          xp_rank: string
        }
        Insert: {
          address_barangay?: string | null
          address_city?: string | null
          address_country?: string | null
          address_house_no?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          degree?: string | null
          embedding?: string | null
          first_name?: string | null
          github_url?: string | null
          graduation_year?: number | null
          id: string
          last_name?: string | null
          linkedin_url?: string | null
          max_active_challenges?: number | null
          middle_name?: string | null
          organization_id?: string | null
          resume_link?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          university?: string | null
          updated_at?: string | null
          withdrawal_cooldown_until?: string | null
          xp_points?: number | null
          xp_rank?: string | null
        }
        Update: {
          address_barangay?: string | null
          address_city?: string | null
          address_country?: string | null
          address_house_no?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          degree?: string | null
          embedding?: string | null
          first_name?: string | null
          github_url?: string | null
          graduation_year?: number | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          max_active_challenges?: number | null
          middle_name?: string | null
          organization_id?: string | null
          resume_link?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          status?: string | null
          university?: string | null
          updated_at?: string | null
          withdrawal_cooldown_until?: string | null
          xp_points?: number | null
          xp_rank?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          challenge_id: string
          created_at: string | null
          criteria_name: string
          id: string
          max_points: number | null
          milestone_id: string | null
        }
        Insert: {
          challenge_id: string
          created_at?: string | null
          criteria_name: string
          id?: string
          max_points?: number | null
          milestone_id?: string | null
        }
        Update: {
          challenge_id?: string
          created_at?: string | null
          criteria_name?: string
          id?: string
          max_points?: number | null
          milestone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubrics_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          points_awarded: number
          rubric_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          points_awarded: number
          rubric_id: string
          submission_id: string
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          points_awarded?: number
          rubric_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      student_earned_skills: {
        Row: {
          id: string
          profile_id: string
          skill_id: string
          tier: "beginner" | "intermediate" | "advanced"
          source: "challenge" | "admin"
          challenge_id: string | null
          awarded_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          skill_id: string
          tier: "beginner" | "intermediate" | "advanced"
          source?: "challenge" | "admin"
          challenge_id?: string | null
          awarded_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          skill_id?: string
          tier?: "beginner" | "intermediate" | "advanced"
          source?: "challenge" | "admin"
          challenge_id?: string | null
          awarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_earned_skills_profile_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_earned_skills_skill_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_earned_skills_challenge_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      student_skills: {
        Row: {
          id: string
          level: Database["public"]["Enums"]["proficiency_level"]
          profile_id: string | null
          skill_id: string | null
        }
        Insert: {
          id?: string
          level: Database["public"]["Enums"]["proficiency_level"]
          profile_id?: string | null
          skill_id?: string | null
        }
        Update: {
          id?: string
          level?: Database["public"]["Enums"]["proficiency_level"]
          profile_id?: string | null
          skill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          demo_url: string | null
          github_link: string | null
          id: string
          milestone_id: string | null
          participant_id: string | null
          submitted_at: string | null
          updated_at: string | null
          written_response: string | null
        }
        Insert: {
          demo_url?: string | null
          github_link?: string | null
          id?: string
          milestone_id?: string | null
          participant_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          written_response?: string | null
        }
        Update: {
          demo_url?: string | null
          github_link?: string | null
          id?: string
          milestone_id?: string | null
          participant_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          written_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "challenge_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          profile_id: string | null
          team_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          profile_id?: string | null
          team_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          profile_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          join_code: string | null
          leader_id: string | null
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          join_code?: string | null
          leader_id?: string | null
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          join_code?: string | null
          leader_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      winners: {
        Row: {
          announced_at: string | null
          challenge_id: string
          id: string
          is_tied: boolean
          prize: string | null
          profile_id: string
          rank: number
          score: number | null
          tie_resolved_by: string | null
        }
        Insert: {
          announced_at?: string | null
          challenge_id: string
          id?: string
          is_tied?: boolean
          prize?: string | null
          profile_id: string
          rank: number
          score?: number | null
          tie_resolved_by?: string | null
        }
        Update: {
          announced_at?: string | null
          challenge_id?: string
          id?: string
          is_tied?: boolean
          prize?: string | null
          profile_id?: string
          rank?: number
          score?: number | null
          tie_resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "winners_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      challenge_leaderboard: {
        Row: {
          avatar_url: string | null
          challenge_id: string | null
          first_name: string | null
          last_name: string | null
          milestones_completed: number | null
          total_score: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "student"
        | "company_admin"
        | "company_member"
        | "admin"
        | "evaluator"
      challenge_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "in_progress"
        | "under_review"
        | "completed"
        | "cancelled"
        | "closed"
        | "rejected"
      milestone_status: "locked" | "open" | "submitted" | "reviewed"
      proficiency_level: "beginner" | "intermediate" | "advanced"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "student",
        "company_admin",
        "company_member",
        "admin",
        "evaluator",
      ],
      challenge_status: [
        "draft",
        "pending_approval",
        "approved",
        "in_progress",
        "under_review",
        "completed",
        "cancelled",
        "closed",
        "rejected",
      ],
      milestone_status: ["locked", "open", "submitted", "reviewed"],
      proficiency_level: ["beginner", "intermediate", "advanced"],
    },
  },
} as const
