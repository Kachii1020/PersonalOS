export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_audit_logs: {
        Row: {
          actor: string
          approval_request_id: string | null
          created_at: string
          detail: Json
          event: string
          id: number
        }
        Insert: {
          actor: string
          approval_request_id?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: number
        }
        Update: {
          actor?: string
          approval_request_id?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "action_audit_logs_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          attempts: number
          current_step: string
          error: string | null
          finished_at: string | null
          id: string
          locked_by: string | null
          locked_until: string | null
          output: Json | null
          run_type: string
          started_at: string
          state: Json
          status: string
          trigger_event_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          current_step?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          locked_by?: string | null
          locked_until?: string | null
          output?: Json | null
          run_type: string
          started_at?: string
          state?: Json
          status?: string
          trigger_event_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          current_step?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          locked_by?: string | null
          locked_until?: string | null
          output?: Json | null
          run_type?: string
          started_at?: string
          state?: Json
          status?: string
          trigger_event_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_trigger_event_id_fkey"
            columns: ["trigger_event_id"]
            isOneToOne: true
            referencedRelation: "system_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_usd: number
          id: number
          input_token: number
          model: string
          output_token: number
          purpose: string
          used_at: string
        }
        Insert: {
          cost_usd: number
          id?: number
          input_token: number
          model: string
          output_token: number
          purpose: string
          used_at?: string
        }
        Update: {
          cost_usd?: number
          id?: number
          input_token?: number
          model?: string
          output_token?: number
          purpose?: string
          used_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      application_cases: {
        Row: {
          contact: string
          created_at: string
          decision_reason: string
          documents: string
          due_at: string | null
          id: string
          interviews: string
          next_action: string
          opportunity_id: string
          result: string
          stage: string
          updated_at: string
        }
        Insert: {
          contact?: string
          created_at?: string
          decision_reason?: string
          documents?: string
          due_at?: string | null
          id?: string
          interviews?: string
          next_action: string
          opportunity_id: string
          result?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          contact?: string
          created_at?: string
          decision_reason?: string
          documents?: string
          due_at?: string | null
          id?: string
          interviews?: string
          next_action?: string
          opportunity_id?: string
          result?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_cases_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          action_type: string
          agent_run_id: string | null
          decided_at: string | null
          decision_note: string | null
          error: string | null
          executed_at: string | null
          expires_at: string | null
          explanation: string
          id: string
          idempotency_key: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          requested_at: string
          result: Json | null
          risk_level: string
          status: string
          title: string
        }
        Insert: {
          action_type: string
          agent_run_id?: string | null
          decided_at?: string | null
          decision_note?: string | null
          error?: string | null
          executed_at?: string | null
          expires_at?: string | null
          explanation: string
          id?: string
          idempotency_key: string
          locked_by?: string | null
          locked_until?: string | null
          payload: Json
          requested_at?: string
          result?: Json | null
          risk_level?: string
          status?: string
          title: string
        }
        Update: {
          action_type?: string
          agent_run_id?: string | null
          decided_at?: string | null
          decision_note?: string | null
          error?: string | null
          executed_at?: string | null
          expires_at?: string | null
          explanation?: string
          id?: string
          idempotency_key?: string
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          requested_at?: string
          result?: Json | null
          risk_level?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      attention_items: {
        Row: {
          acknowledged_at: string | null
          claim_count: number
          context_id: string
          created_at: string
          dedupe_key: string
          due_at: string
          first_claimed_at: string | null
          id: string
          is_measurement: boolean
          kind: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          measurement_finished_at: string | null
          measurement_slot: string | null
          next_attempt_at: string
          owner_id: string
          quota_reserved_at: string | null
          reason: string
          snoozed_until: string | null
          source_revision: number
          status: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          claim_count?: number
          context_id: string
          created_at?: string
          dedupe_key: string
          due_at: string
          first_claimed_at?: string | null
          id?: string
          is_measurement?: boolean
          kind: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          measurement_finished_at?: string | null
          measurement_slot?: string | null
          next_attempt_at?: string
          owner_id: string
          quota_reserved_at?: string | null
          reason: string
          snoozed_until?: string | null
          source_revision: number
          status?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          claim_count?: number
          context_id?: string
          created_at?: string
          dedupe_key?: string
          due_at?: string
          first_claimed_at?: string | null
          id?: string
          is_measurement?: boolean
          kind?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          measurement_finished_at?: string | null
          measurement_slot?: string | null
          next_attempt_at?: string
          owner_id?: string
          quota_reserved_at?: string | null
          reason?: string
          snoozed_until?: string | null
          source_revision?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_items_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "work_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attention_items_measurement_slot_fkey"
            columns: ["measurement_slot"]
            isOneToOne: false
            referencedRelation: "work_scheduler_probes"
            referencedColumns: ["slot"]
          },
        ]
      }
      briefing_sections: {
        Row: {
          briefing_id: string
          bullets: string[]
          headline: string
          id: string
          lang: string
          position: number
          sector: string
          source_urls: string[]
          why_it_matters: string
        }
        Insert: {
          briefing_id: string
          bullets: string[]
          headline: string
          id?: string
          lang: string
          position: number
          sector: string
          source_urls: string[]
          why_it_matters: string
        }
        Update: {
          briefing_id?: string
          bullets?: string[]
          headline?: string
          id?: string
          lang?: string
          position?: number
          sector?: string
          source_urls?: string[]
          why_it_matters?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_sections_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          briefing_date: string
          cost_usd: number | null
          generated_at: string | null
          id: string
          input_token: number | null
          output_token: number | null
          status: string
        }
        Insert: {
          briefing_date: string
          cost_usd?: number | null
          generated_at?: string | null
          id?: string
          input_token?: number | null
          output_token?: number | null
          status?: string
        }
        Update: {
          briefing_date?: string
          cost_usd?: number | null
          generated_at?: string | null
          id?: string
          input_token?: number | null
          output_token?: number | null
          status?: string
        }
        Relationships: []
      }
      calendar_execution_receipts: {
        Row: {
          action_type: string
          approval_id: string
          attempted_at: string | null
          calendar_id: string
          calendar_source_url: string
          claim_mode: string | null
          claim_token: string | null
          created_at: string
          draft_id: string
          href: string
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          mirror_event_id: string | null
          owner_id: string
          payload: Json
          payload_hash: string
          remote_etag: string | null
          state: string
          uid: string
          updated_at: string
          verified_at: string | null
          write_attempts: number
        }
        Insert: {
          action_type: string
          approval_id: string
          attempted_at?: string | null
          calendar_id: string
          calendar_source_url: string
          claim_mode?: string | null
          claim_token?: string | null
          created_at?: string
          draft_id: string
          href: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          mirror_event_id?: string | null
          owner_id: string
          payload: Json
          payload_hash: string
          remote_etag?: string | null
          state?: string
          uid: string
          updated_at?: string
          verified_at?: string | null
          write_attempts?: number
        }
        Update: {
          action_type?: string
          approval_id?: string
          attempted_at?: string | null
          calendar_id?: string
          calendar_source_url?: string
          claim_mode?: string | null
          claim_token?: string | null
          created_at?: string
          draft_id?: string
          href?: string
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          mirror_event_id?: string | null
          owner_id?: string
          payload?: Json
          payload_hash?: string
          remote_etag?: string | null
          state?: string
          uid?: string
          updated_at?: string
          verified_at?: string | null
          write_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_execution_receipts_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: true
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_execution_receipts_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_execution_receipts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "dialogue_action_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          color: string | null
          content_hash: string | null
          ctag: string | null
          display_name: string
          id: string
          is_writable: boolean
          kind: string
          last_synced_at: string | null
          source_url: string
        }
        Insert: {
          color?: string | null
          content_hash?: string | null
          ctag?: string | null
          display_name: string
          id?: string
          is_writable?: boolean
          kind?: string
          last_synced_at?: string | null
          source_url: string
        }
        Update: {
          color?: string | null
          content_hash?: string | null
          ctag?: string | null
          display_name?: string
          id?: string
          is_writable?: boolean
          kind?: string
          last_synced_at?: string | null
          source_url?: string
        }
        Relationships: []
      }
      career_profile: {
        Row: {
          facts: Json
          revision: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          facts?: Json
          revision?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          facts?: Json
          revision?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      command_briefs: {
        Row: {
          brief_date: string
          generated_at: string
          headline: string
          id: string
          postponed_items: Json
          prepared_items: Json
          source_snapshot: Json
          top_actions: Json
          warnings: Json
        }
        Insert: {
          brief_date: string
          generated_at?: string
          headline: string
          id?: string
          postponed_items?: Json
          prepared_items?: Json
          source_snapshot?: Json
          top_actions?: Json
          warnings?: Json
        }
        Update: {
          brief_date?: string
          generated_at?: string
          headline?: string
          id?: string
          postponed_items?: Json
          prepared_items?: Json
          source_snapshot?: Json
          top_actions?: Json
          warnings?: Json
        }
        Relationships: []
      }
      company_watchlist: {
        Row: {
          enabled: boolean
          id: string
          name: string
          official_prefixes: Json
          reason: string
          tier: number
          verified_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          name: string
          official_prefixes: Json
          reason?: string
          tier?: number
          verified_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          name?: string
          official_prefixes?: Json
          reason?: string
          tier?: number
          verified_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      course_materials: {
        Row: {
          course_id: string
          extracted_text: string | null
          filename: string
          id: string
          keywords: string[] | null
          mime_type: string
          storage_path: string
          summary: string | null
          uploaded_at: string
        }
        Insert: {
          course_id: string
          extracted_text?: string | null
          filename: string
          id?: string
          keywords?: string[] | null
          mime_type: string
          storage_path: string
          summary?: string | null
          uploaded_at?: string
        }
        Update: {
          course_id?: string
          extracted_text?: string | null
          filename?: string
          id?: string
          keywords?: string[] | null
          mime_type?: string
          storage_path?: string
          summary?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          credits: number
          grade: string | null
          grade_point: number | null
          id: string
          name: string
          notion_page_id: string | null
          semester_id: string
        }
        Insert: {
          code?: string | null
          credits: number
          grade?: string | null
          grade_point?: number | null
          id?: string
          name: string
          notion_page_id?: string | null
          semester_id: string
        }
        Update: {
          code?: string | null
          credits?: number
          grade?: string | null
          grade_point?: number | null
          id?: string
          name?: string
          notion_page_id?: string | null
          semester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      dialogue_action_drafts: {
        Row: {
          action_type: string
          approval_request_id: string | null
          created_at: string
          executable: boolean
          expires_at: string
          explanation: string
          id: string
          owner_id: string
          payload: Json
          source_snapshot: Json
          title: string
        }
        Insert: {
          action_type: string
          approval_request_id?: string | null
          created_at?: string
          executable?: boolean
          expires_at?: string
          explanation: string
          id?: string
          owner_id: string
          payload: Json
          source_snapshot?: Json
          title: string
        }
        Update: {
          action_type?: string
          approval_request_id?: string | null
          created_at?: string
          executable?: boolean
          expires_at?: string
          explanation?: string
          id?: string
          owner_id?: string
          payload?: Json
          source_snapshot?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dialogue_action_drafts_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: true
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          caldav_href: string
          caldav_uid: string
          calendar_id: string
          course_id: string | null
          description: string | null
          ends_at: string
          etag: string | null
          exdates: string[]
          id: string
          is_all_day: boolean
          location: string | null
          rrule: string | null
          source: string
          starts_at: string
          summary: string
          updated_at: string
        }
        Insert: {
          caldav_href: string
          caldav_uid: string
          calendar_id: string
          course_id?: string | null
          description?: string | null
          ends_at: string
          etag?: string | null
          exdates?: string[]
          id?: string
          is_all_day?: boolean
          location?: string | null
          rrule?: string | null
          source?: string
          starts_at: string
          summary: string
          updated_at?: string
        }
        Update: {
          caldav_href?: string
          caldav_uid?: string
          calendar_id?: string
          course_id?: string | null
          description?: string | null
          ends_at?: string
          etag?: string | null
          exdates?: string[]
          id?: string
          is_all_day?: boolean
          location?: string | null
          rrule?: string | null
          source?: string
          starts_at?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          as_of: string
          base: string
          id: number
          quote: string
          rate: number
        }
        Insert: {
          as_of: string
          base: string
          id?: number
          quote: string
          rate: number
        }
        Update: {
          as_of?: string
          base?: string
          id?: number
          quote?: string
          rate?: number
        }
        Relationships: []
      }
      github_daily_commits: {
        Row: {
          as_of: string
          commit_count: number
          id: number
        }
        Insert: {
          as_of: string
          commit_count: number
          id?: number
        }
        Update: {
          as_of?: string
          commit_count?: number
          id?: number
        }
        Relationships: []
      }
      github_repos: {
        Row: {
          description: string | null
          full_name: string
          html_url: string
          id: string
          language: string | null
          pushed_at: string | null
          stars: number
        }
        Insert: {
          description?: string | null
          full_name: string
          html_url: string
          id?: string
          language?: string | null
          pushed_at?: string | null
          stars?: number
        }
        Update: {
          description?: string | null
          full_name?: string
          html_url?: string
          id?: string
          language?: string | null
          pushed_at?: string | null
          stars?: number
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          attachment_path: string | null
          classification_reason: string | null
          created_at: string
          id: string
          kind: string
          processed_at: string | null
          raw_text: string | null
          source_url: string | null
          status: string
          summary: string | null
        }
        Insert: {
          attachment_path?: string | null
          classification_reason?: string | null
          created_at?: string
          id?: string
          kind?: string
          processed_at?: string | null
          raw_text?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          attachment_path?: string | null
          classification_reason?: string | null
          created_at?: string
          id?: string
          kind?: string
          processed_at?: string | null
          raw_text?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          job_name: string
          meta: Json | null
          started_at: string
          status: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: number
          job_name: string
          meta?: Json | null
          started_at?: string
          status?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: number
          job_name?: string
          meta?: Json | null
          started_at?: string
          status?: string | null
        }
        Relationships: []
      }
      lab_completions: {
        Row: {
          completed_at: string
          exercise_id: string
          id: string
          module_slug: string
        }
        Insert: {
          completed_at?: string
          exercise_id: string
          id?: string
          module_slug: string
        }
        Update: {
          completed_at?: string
          exercise_id?: string
          id?: string
          module_slug?: string
        }
        Relationships: []
      }
      learn_modules: {
        Row: {
          concepts: string[]
          id: string
          phase_id: string
          position: number
          slug: string
          title: string
        }
        Insert: {
          concepts?: string[]
          id?: string
          phase_id: string
          position?: number
          slug: string
          title: string
        }
        Update: {
          concepts?: string[]
          id?: string
          phase_id?: string
          position?: number
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_modules_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "learn_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_phases: {
        Row: {
          description: string | null
          id: string
          phase_number: number
          position: number
          title: string
          track_id: string
          weeks_label: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          phase_number: number
          position?: number
          title: string
          track_id: string
          weeks_label?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          phase_number?: number
          position?: number
          title?: string
          track_id?: string
          weeks_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learn_phases_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learn_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_progress: {
        Row: {
          completed_at: string | null
          id: string
          module_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          module_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          module_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
            referencedRelation: "learn_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_tracks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          slug?: string
          title?: string
        }
        Relationships: []
      }
      macro_snapshots: {
        Row: {
          as_of: string
          display_name: string
          id: number
          series_id: string
          source: string
          unit: string | null
          value: number
        }
        Insert: {
          as_of: string
          display_name: string
          id?: number
          series_id: string
          source: string
          unit?: string | null
          value: number
        }
        Update: {
          as_of?: string
          display_name?: string
          id?: number
          series_id?: string
          source?: string
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      news_items: {
        Row: {
          fetched_at: string
          id: string
          lang: string
          published_at: string | null
          raw_summary: string | null
          sector: string
          source_key: string
          title: string
          url: string
        }
        Insert: {
          fetched_at?: string
          id?: string
          lang: string
          published_at?: string | null
          raw_summary?: string | null
          sector: string
          source_key: string
          title: string
          url: string
        }
        Update: {
          fetched_at?: string
          id?: string
          lang?: string
          published_at?: string | null
          raw_summary?: string | null
          sector?: string
          source_key?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          attempt: number
          attempt_token: string
          attempted_at: string
          attention_id: string
          error: string | null
          finished_at: string | null
          id: string
          observation_expires_at: string | null
          observation_token_hash: string | null
          opened_at: string | null
          owner_id: string
          provider_state: string
          received_at: string | null
          retry_after: string | null
          subscription_id: string
          worker_id: string
        }
        Insert: {
          attempt: number
          attempt_token: string
          attempted_at: string
          attention_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          observation_expires_at?: string | null
          observation_token_hash?: string | null
          opened_at?: string | null
          owner_id: string
          provider_state: string
          received_at?: string | null
          retry_after?: string | null
          subscription_id: string
          worker_id: string
        }
        Update: {
          attempt?: number
          attempt_token?: string
          attempted_at?: string
          attention_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          observation_expires_at?: string | null
          observation_token_hash?: string | null
          opened_at?: string | null
          owner_id?: string
          provider_state?: string
          received_at?: string | null
          retry_after?: string | null
          subscription_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_attention_id_fkey"
            columns: ["attention_id"]
            isOneToOne: false
            referencedRelation: "attention_items"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          canonical_url: string
          company_id: string
          created_at: string
          current_source_id: string | null
          deadline: string | null
          decision: string
          decision_history: Json
          decision_reason: string | null
          defer_until: string | null
          deliverable_key: string | null
          effort: number
          etag: string | null
          extracted_source_id: string | null
          fit: number
          id: string
          last_checked_at: string | null
          last_error: string | null
          last_meaningful_change_at: string | null
          last_modified: string | null
          lifecycle: string
          location: string | null
          next_check_at: string
          opportunity_type: string
          requirements_complete: boolean
          revision: number
          source_available: boolean
          source_class: string
          source_reviewed: boolean
          title: string
          value: number
          work_mode: string | null
        }
        Insert: {
          canonical_url: string
          company_id: string
          created_at?: string
          current_source_id?: string | null
          deadline?: string | null
          decision?: string
          decision_history?: Json
          decision_reason?: string | null
          defer_until?: string | null
          deliverable_key?: string | null
          effort?: number
          etag?: string | null
          extracted_source_id?: string | null
          fit?: number
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_meaningful_change_at?: string | null
          last_modified?: string | null
          lifecycle?: string
          location?: string | null
          next_check_at?: string
          opportunity_type?: string
          requirements_complete?: boolean
          revision?: number
          source_available?: boolean
          source_class?: string
          source_reviewed?: boolean
          title: string
          value?: number
          work_mode?: string | null
        }
        Update: {
          canonical_url?: string
          company_id?: string
          created_at?: string
          current_source_id?: string | null
          deadline?: string | null
          decision?: string
          decision_history?: Json
          decision_reason?: string | null
          defer_until?: string | null
          deliverable_key?: string | null
          effort?: number
          etag?: string | null
          extracted_source_id?: string | null
          fit?: number
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_meaningful_change_at?: string | null
          last_modified?: string | null
          lifecycle?: string
          location?: string | null
          next_check_at?: string
          opportunity_type?: string
          requirements_complete?: boolean
          revision?: number
          source_available?: boolean
          source_class?: string
          source_reviewed?: boolean
          title?: string
          value?: number
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_watchlist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_source_fk"
            columns: ["id", "current_source_id"]
            isOneToOne: false
            referencedRelation: "opportunity_sources"
            referencedColumns: ["opportunity_id", "id"]
          },
        ]
      }
      opportunity_requirements: {
        Row: {
          expected: Json
          field: string
          hard: boolean
          id: string
          operator: string
          opportunity_id: string
          quote: string
          reviewed: boolean
          source_id: string
        }
        Insert: {
          expected?: Json
          field: string
          hard?: boolean
          id?: string
          operator: string
          opportunity_id: string
          quote: string
          reviewed?: boolean
          source_id: string
        }
        Update: {
          expected?: Json
          field?: string
          hard?: boolean
          id?: string
          operator?: string
          opportunity_id?: string
          quote?: string
          reviewed?: boolean
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_requirements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_requirements_opportunity_id_source_id_fkey"
            columns: ["opportunity_id", "source_id"]
            isOneToOne: false
            referencedRelation: "opportunity_sources"
            referencedColumns: ["opportunity_id", "id"]
          },
        ]
      }
      opportunity_sources: {
        Row: {
          content_hash: string
          content_text: string
          etag: string | null
          http_status: number
          id: string
          last_modified: string | null
          opportunity_id: string
          retrieved_at: string
          source_class: string
          source_url: string
          supersedes_source_id: string | null
          title: string
        }
        Insert: {
          content_hash: string
          content_text: string
          etag?: string | null
          http_status?: number
          id?: string
          last_modified?: string | null
          opportunity_id: string
          retrieved_at?: string
          source_class: string
          source_url: string
          supersedes_source_id?: string | null
          title: string
        }
        Update: {
          content_hash?: string
          content_text?: string
          etag?: string | null
          http_status?: number
          id?: string
          last_modified?: string | null
          opportunity_id?: string
          retrieved_at?: string
          source_class?: string
          source_url?: string
          supersedes_source_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_sources_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_sources_opportunity_id_supersedes_source_id_fkey"
            columns: ["opportunity_id", "supersedes_source_id"]
            isOneToOne: false
            referencedRelation: "opportunity_sources"
            referencedColumns: ["opportunity_id", "id"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          as_of: string
          change_pct: number | null
          close: number
          id: number
          ticker_id: string
        }
        Insert: {
          as_of: string
          change_pct?: number | null
          close: number
          id?: number
          ticker_id: string
        }
        Update: {
          as_of?: string
          change_pct?: number | null
          close?: number
          id?: number
          ticker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          attempted_at: string
          chosen_index: number
          id: string
          is_correct: boolean
          question_id: string
        }
        Insert: {
          attempted_at?: string
          chosen_index: number
          id?: string
          is_correct: boolean
          question_id: string
        }
        Update: {
          attempted_at?: string
          chosen_index?: number
          id?: string
          is_correct?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_domain_lessons: {
        Row: {
          content: string
          domain: string
          generated_at: string
          key_terms: string[]
          title: string
        }
        Insert: {
          content: string
          domain: string
          generated_at?: string
          key_terms: string[]
          title: string
        }
        Update: {
          content?: string
          domain?: string
          generated_at?: string
          key_terms?: string[]
          title?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          answer_index: number
          choices: string[]
          concept_hint: string | null
          created_at: string
          difficulty: number
          domain: string
          explanation: string
          id: string
          module_slug: string | null
          question: string
        }
        Insert: {
          answer_index: number
          choices: string[]
          concept_hint?: string | null
          created_at?: string
          difficulty?: number
          domain: string
          explanation: string
          id?: string
          module_slug?: string | null
          question: string
        }
        Update: {
          answer_index?: number
          choices?: string[]
          concept_hint?: string | null
          created_at?: string
          difficulty?: number
          domain?: string
          explanation?: string
          id?: string
          module_slug?: string | null
          question?: string
        }
        Relationships: []
      }
      quiz_review_queue: {
        Row: {
          due_on: string
          id: string
          question_id: string
          stage: number
        }
        Insert: {
          due_on: string
          id?: string
          question_id: string
          stage: number
        }
        Update: {
          due_on?: string
          id?: string
          question_id?: string
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_review_queue_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      sec_filings: {
        Row: {
          cik: string
          eps: number | null
          equity: number | null
          filed_at: string | null
          fiscal_end: string
          form_type: string
          id: number
          net_income: number | null
          revenue: number | null
          ticker_id: string
          total_assets: number | null
        }
        Insert: {
          cik: string
          eps?: number | null
          equity?: number | null
          filed_at?: string | null
          fiscal_end: string
          form_type: string
          id?: number
          net_income?: number | null
          revenue?: number | null
          ticker_id: string
          total_assets?: number | null
        }
        Update: {
          cik?: string
          eps?: number | null
          equity?: number | null
          filed_at?: string | null
          fiscal_end?: string
          form_type?: string
          id?: number
          net_income?: number | null
          revenue?: number | null
          ticker_id?: string
          total_assets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sec_filings_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "tickers"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          ends_on: string
          id: string
          is_current: boolean
          label: string
          starts_on: string
        }
        Insert: {
          ends_on: string
          id?: string
          is_current?: boolean
          label: string
          starts_on: string
        }
        Update: {
          ends_on?: string
          id?: string
          is_current?: boolean
          label?: string
          starts_on?: string
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          cursor: Json | null
          key: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
        }
        Insert: {
          cursor?: Json | null
          key: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
        }
        Update: {
          cursor?: Json | null
          key?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
        }
        Relationships: []
      }
      system_events: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string
          error: string | null
          event_type: string
          id: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          processed_at: string | null
          source_id: string | null
          source_type: string
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key: string
          error?: string | null
          event_type: string
          id?: string
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          processed_at?: string | null
          source_id?: string | null
          source_type: string
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string
          error?: string | null
          event_type?: string
          id?: string
          locked_by?: string | null
          locked_until?: string | null
          payload?: Json
          processed_at?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          approval_request_id: string | null
          category: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string
          defer_until: string | null
          due_at: string | null
          estimated_minutes: number | null
          generated_by: string | null
          id: string
          last_reviewed_at: string | null
          notes: string | null
          priority: number | null
          priority_reason: string | null
          source_id: string | null
          source_type: string | null
          status: string
          title: string
        }
        Insert: {
          approval_request_id?: string | null
          category?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          defer_until?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          generated_by?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          priority?: number | null
          priority_reason?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
        }
        Update: {
          approval_request_id?: string | null
          category?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          defer_until?: string | null
          due_at?: string | null
          estimated_minutes?: number | null
          generated_by?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          priority?: number | null
          priority_reason?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tickers: {
        Row: {
          currency: string
          display_name: string
          id: string
          is_index: boolean
          notion_page_id: string | null
          position: number
          symbol: string
        }
        Insert: {
          currency: string
          display_name: string
          id?: string
          is_index?: boolean
          notion_page_id?: string | null
          position?: number
          symbol: string
        }
        Update: {
          currency?: string
          display_name?: string
          id?: string
          is_index?: boolean
          notion_page_id?: string | null
          position?: number
          symbol?: string
        }
        Relationships: []
      }
      user_prefs: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      voice_sessions: {
        Row: {
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          last_activity_at: string
          mode: string
          owner_id: string
          started_at: string
          status: string
          stt_reserved_usd: number
          transcription_model: string
        }
        Insert: {
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          last_activity_at?: string
          mode: string
          owner_id: string
          started_at?: string
          status?: string
          stt_reserved_usd?: number
          transcription_model: string
        }
        Update: {
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          last_activity_at?: string
          mode?: string
          owner_id?: string
          started_at?: string
          status?: string
          stt_reserved_usd?: number
          transcription_model?: string
        }
        Relationships: []
      }
      voice_turns: {
        Row: {
          completed_at: string | null
          context_id: string | null
          error_code: string | null
          id: string
          outcome: string | null
          owner_id: string
          provider_item_hash: string
          reply_hash: string | null
          request_id: string
          session_id: string
          started_at: string
          status: string
          transcript_hash: string
          tts_attempts: number
          tts_reserved_usd: number
        }
        Insert: {
          completed_at?: string | null
          context_id?: string | null
          error_code?: string | null
          id?: string
          outcome?: string | null
          owner_id: string
          provider_item_hash: string
          reply_hash?: string | null
          request_id: string
          session_id: string
          started_at?: string
          status?: string
          transcript_hash: string
          tts_attempts?: number
          tts_reserved_usd?: number
        }
        Update: {
          completed_at?: string | null
          context_id?: string | null
          error_code?: string | null
          id?: string
          outcome?: string | null
          owner_id?: string
          provider_item_hash?: string
          reply_hash?: string | null
          request_id?: string
          session_id?: string
          started_at?: string
          status?: string
          transcript_hash?: string
          tts_attempts?: number
          tts_reserved_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "voice_turns_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "work_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          status: string
          week_start: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          status?: string
          week_start: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          status?: string
          week_start?: string
        }
        Relationships: []
      }
      work_attention_canary_state: {
        Row: {
          context_id: string | null
          enabled: boolean
          first_due_at: string | null
          measurement_started_at: string | null
          planned_through: string | null
          singleton: boolean
        }
        Insert: {
          context_id?: string | null
          enabled?: boolean
          first_due_at?: string | null
          measurement_started_at?: string | null
          planned_through?: string | null
          singleton?: boolean
        }
        Update: {
          context_id?: string | null
          enabled?: boolean
          first_due_at?: string | null
          measurement_started_at?: string | null
          planned_through?: string | null
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "work_attention_canary_state_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "work_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_context_actions: {
        Row: {
          approval_id: string | null
          context_id: string
          context_revision: number
          created_at: string
          draft_id: string
          id: string
          ordinal: number
          owner_id: string
          request_id: string
        }
        Insert: {
          approval_id?: string | null
          context_id: string
          context_revision: number
          created_at?: string
          draft_id: string
          id?: string
          ordinal: number
          owner_id: string
          request_id: string
        }
        Update: {
          approval_id?: string | null
          context_id?: string
          context_revision?: number
          created_at?: string
          draft_id?: string
          id?: string
          ordinal?: number
          owner_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_context_actions_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_context_actions_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "work_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_context_actions_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "dialogue_action_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_context_requests: {
        Row: {
          context_id: string | null
          created_at: string
          input_hash: string
          lease_token: string | null
          lease_until: string | null
          operation: string
          owner_id: string
          request_hash: string
          request_id: string
          response: Json | null
          response_expires_at: string | null
          result_ids: string[]
          result_revision: number | null
        }
        Insert: {
          context_id?: string | null
          created_at?: string
          input_hash: string
          lease_token?: string | null
          lease_until?: string | null
          operation: string
          owner_id: string
          request_hash: string
          request_id: string
          response?: Json | null
          response_expires_at?: string | null
          result_ids?: string[]
          result_revision?: number | null
        }
        Update: {
          context_id?: string | null
          created_at?: string
          input_hash?: string
          lease_token?: string | null
          lease_until?: string | null
          operation?: string
          owner_id?: string
          request_hash?: string
          request_id?: string
          response?: Json | null
          response_expires_at?: string | null
          result_ids?: string[]
          result_revision?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_context_requests_context_id_fkey"
            columns: ["context_id"]
            isOneToOne: false
            referencedRelation: "work_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_contexts: {
        Row: {
          created_at: string
          deadline_at: string | null
          deadline_reminder: boolean
          expires_at: string | null
          forgotten_at: string | null
          goal: string
          id: string
          is_measurement: boolean
          last_progress_at: string
          missing_fields: string[]
          next_step: string
          owner_id: string
          progress: string
          reminder_at: string | null
          resume_reminder: boolean
          revision: number
          source_refs: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_at?: string | null
          deadline_reminder?: boolean
          expires_at?: string | null
          forgotten_at?: string | null
          goal: string
          id?: string
          is_measurement?: boolean
          last_progress_at?: string
          missing_fields?: string[]
          next_step?: string
          owner_id: string
          progress?: string
          reminder_at?: string | null
          resume_reminder?: boolean
          revision?: number
          source_refs?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_at?: string | null
          deadline_reminder?: boolean
          expires_at?: string | null
          forgotten_at?: string | null
          goal?: string
          id?: string
          is_measurement?: boolean
          last_progress_at?: string
          missing_fields?: string[]
          next_step?: string
          owner_id?: string
          progress?: string
          reminder_at?: string | null
          resume_reminder?: boolean
          revision?: number
          source_refs?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_scheduler_probes: {
        Row: {
          dispatched_at: string
          request_id: number | null
          slot: string
          worker_finished_at: string | null
          worker_started_at: string | null
        }
        Insert: {
          dispatched_at?: string
          request_id?: number | null
          slot: string
          worker_finished_at?: string | null
          worker_started_at?: string | null
        }
        Update: {
          dispatched_at?: string
          request_id?: number | null
          slot?: string
          worker_finished_at?: string | null
          worker_started_at?: string | null
        }
        Relationships: []
      }
      work_scheduler_state: {
        Row: {
          enabled: boolean
          measurement_started_at: string | null
          singleton: boolean
          vault_secret_name: string | null
          worker_url: string | null
        }
        Insert: {
          enabled?: boolean
          measurement_started_at?: string | null
          singleton?: boolean
          vault_secret_name?: string | null
          worker_url?: string | null
        }
        Update: {
          enabled?: boolean
          measurement_started_at?: string | null
          singleton?: boolean
          vault_secret_name?: string | null
          worker_url?: string | null
        }
        Relationships: []
      }
      workbook_submissions: {
        Row: {
          id: string
          results: Json
          status: string
          storage_path: string
          submitted_at: string
          task_id: string
        }
        Insert: {
          id?: string
          results?: Json
          status: string
          storage_path: string
          submitted_at?: string
          task_id: string
        }
        Update: {
          id?: string
          results?: Json
          status?: string
          storage_path?: string
          submitted_at?: string
          task_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_work_delivery: {
        Args: { p_delivery_id: string; p_event: string }
        Returns: undefined
      }
      ack_work_tick: {
        Args: { p_finished: boolean; p_slot: string }
        Returns: undefined
      }
      assert_work_draft_current: {
        Args: { p_draft_id: string }
        Returns: undefined
      }
      before_calendar_write: {
        Args: {
          p_approval_id: string
          p_claim_token: string
          p_worker_id: string
        }
        Returns: undefined
      }
      begin_calendar_execution: {
        Args: { p_approval_id: string; p_worker_id: string }
        Returns: Json
      }
      begin_user_work_delivery: {
        Args: {
          p_attention_id: string
          p_subscription_id: string
          p_worker_id: string
        }
        Returns: Json
      }
      begin_voice_session: {
        Args: {
          p_budget: number
          p_mode: string
          p_model: string
          p_owner_id: string
        }
        Returns: {
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          last_activity_at: string
          mode: string
          owner_id: string
          started_at: string
          status: string
          stt_reserved_usd: number
          transcription_model: string
        }
        SetofOptions: {
          from: "*"
          to: "voice_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      begin_work_delivery: {
        Args: {
          p_attention_id: string
          p_subscription_id: string
          p_worker_id: string
        }
        Returns: Json
      }
      bind_work_preview: {
        Args: { p_context_id: string; p_owner_id: string; p_request_id: string }
        Returns: undefined
      }
      career_mutate: {
        Args: { p_action: string; p_id?: string; p_input?: Json }
        Returns: string
      }
      check_calendar_receipt: {
        Args: {
          p_before_write: boolean
          r: Database["public"]["Tables"]["calendar_execution_receipts"]["Row"]
        }
        Returns: undefined
      }
      claim_approved_action_by_id: {
        Args: {
          p_approval_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          action_type: string
          agent_run_id: string | null
          decided_at: string | null
          decision_note: string | null
          error: string | null
          executed_at: string | null
          expires_at: string | null
          explanation: string
          id: string
          idempotency_key: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          requested_at: string
          result: Json | null
          risk_level: string
          status: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "approval_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_calendar_reconciliation: {
        Args: { p_approval_id: string; p_owner_id: string; p_worker_id: string }
        Returns: Json
      }
      claim_measured_work_attention: {
        Args: {
          p_allow_automatic?: boolean
          p_slot: string
          p_worker_id: string
        }
        Returns: Json
      }
      claim_next_agent_run: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          attempts: number
          current_step: string
          error: string | null
          finished_at: string | null
          id: string
          locked_by: string | null
          locked_until: string | null
          output: Json | null
          run_type: string
          started_at: string
          state: Json
          status: string
          trigger_event_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_approved_action: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          action_type: string
          agent_run_id: string | null
          decided_at: string | null
          decision_note: string | null
          error: string | null
          executed_at: string | null
          expires_at: string | null
          explanation: string
          id: string
          idempotency_key: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          requested_at: string
          result: Json | null
          risk_level: string
          status: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "approval_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_next_system_event: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string
          error: string | null
          event_type: string
          id: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          processed_at: string | null
          source_id: string | null
          source_type: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "system_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_work_attention: {
        Args: { p_allow_automatic?: boolean; p_worker_id: string }
        Returns: Json
      }
      commit_career_step: {
        Args: {
          p_data: Json
          p_kind: string
          p_opportunity_id: string
          p_revision: number
          p_run_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_approval_execution: {
        Args: { p_approval_id: string; p_result: Json; p_worker_id: string }
        Returns: undefined
      }
      configure_work_attention_canary: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      configure_work_scheduler: {
        Args: { p_enabled: boolean; p_secret_name: string; p_url: string }
        Returns: undefined
      }
      decide_approval: {
        Args: { p_approval_id: string; p_decision: string; p_note?: string }
        Returns: {
          action_type: string
          agent_run_id: string | null
          decided_at: string | null
          decision_note: string | null
          error: string | null
          executed_at: string | null
          expires_at: string | null
          explanation: string
          id: string
          idempotency_key: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          requested_at: string
          result: Json | null
          risk_level: string
          status: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "approval_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dispatch_work_tick: { Args: never; Returns: undefined }
      execute_approved_task: {
        Args: { p_approval_id: string; p_worker_id: string }
        Returns: {
          id: string
          title: string
        }[]
      }
      fail_approval_execution: {
        Args: { p_approval_id: string; p_error: string; p_worker_id: string }
        Returns: undefined
      }
      fail_calendar_execution: {
        Args: {
          p_approval_id: string
          p_claim_token: string
          p_error: string
          p_state: string
          p_worker_id: string
        }
        Returns: undefined
      }
      finish_calendar_execution: {
        Args: {
          p_approval_id: string
          p_claim_token: string
          p_proof: Json
          p_worker_id: string
        }
        Returns: Json
      }
      finish_voice_session: {
        Args: { p_owner_id: string; p_reason: string; p_session_id: string }
        Returns: undefined
      }
      finish_voice_turn: {
        Args: {
          p_context_id: string
          p_outcome: string
          p_owner_id: string
          p_reply_hash: string
          p_turn_id: string
        }
        Returns: {
          completed_at: string | null
          context_id: string | null
          error_code: string | null
          id: string
          outcome: string | null
          owner_id: string
          provider_item_hash: string
          reply_hash: string | null
          request_id: string
          session_id: string
          started_at: string
          status: string
          transcript_hash: string
          tts_attempts: number
          tts_reserved_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "voice_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_work_attention: {
        Args: {
          p_attention_id: string
          p_error?: string
          p_status: string
          p_worker_id: string
        }
        Returns: undefined
      }
      finish_work_chat: {
        Args: {
          p_owner_id: string
          p_request_id: string
          p_response: Json
          p_token: string
        }
        Returns: undefined
      }
      finish_work_delivery: {
        Args: {
          p_attempt_token: string
          p_delivery_id: string
          p_error?: string
          p_status: string
          p_worker_id: string
        }
        Returns: undefined
      }
      get_claimed_user_work_subscriptions: {
        Args: { p_attention_id: string }
        Returns: Json
      }
      get_claimed_work_subscriptions: {
        Args: { p_attention_id: string }
        Returns: Json
      }
      get_voice_turn_for_owner: {
        Args: { p_owner_id: string; p_session_id: string; p_turn_id: string }
        Returns: {
          completed_at: string | null
          context_id: string | null
          error_code: string | null
          id: string
          outcome: string | null
          owner_id: string
          provider_item_hash: string
          reply_hash: string | null
          request_id: string
          session_id: string
          started_at: string
          status: string
          transcript_hash: string
          tts_attempts: number
          tts_reserved_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "voice_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_work_snapshot: { Args: { p_context_id: string }; Returns: Json }
      is_allowed_user: { Args: never; Returns: boolean }
      link_work_drafts: {
        Args: {
          p_context_id: string
          p_draft_ids: string[]
          p_request_hash: string
          p_request_id: string
          p_revision: number
        }
        Returns: string
      }
      list_work_attention: { Args: never; Returns: Json }
      list_work_contexts: { Args: never; Returns: Json }
      mutate_work_attention: {
        Args: { p_attention_id: string; p_operation: string }
        Returns: undefined
      }
      mutate_work_context: {
        Args: {
          p_context_id: string
          p_expected_revision: number
          p_input: Json
          p_operation: string
          p_request_hash: string
          p_request_id: string
        }
        Returns: string
      }
      observe_work_delivery: {
        Args: { p_delivery_id: string; p_event: string; p_token: string }
        Returns: boolean
      }
      prepare_jarvis_approval: {
        Args: { p_proposal: Json; p_run_id: string; p_worker_id: string }
        Returns: {
          action_type: string
          agent_run_id: string | null
          decided_at: string | null
          decision_note: string | null
          error: string | null
          executed_at: string | null
          expires_at: string | null
          explanation: string
          id: string
          idempotency_key: string
          locked_by: string | null
          locked_until: string | null
          payload: Json
          requested_at: string
          result: Json | null
          risk_level: string
          status: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "approval_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      prune_dialogue_drafts: { Args: never; Returns: number }
      prune_voice_metadata: { Args: never; Returns: number }
      prune_work_chat: { Args: never; Returns: number }
      prune_work_contexts: { Args: never; Returns: number }
      queue_due_career_sources: { Args: { p_limit?: number }; Returns: number }
      release_work_chat: {
        Args: { p_owner_id: string; p_request_id: string; p_token: string }
        Returns: undefined
      }
      request_dialogue_approval: {
        Args: { p_draft_id: string }
        Returns: string
      }
      reserve_voice_speech: {
        Args: {
          p_attempt: number
          p_budget: number
          p_owner_id: string
          p_reply_hash: string
          p_turn_id: string
        }
        Returns: {
          completed_at: string | null
          context_id: string | null
          error_code: string | null
          id: string
          outcome: string | null
          owner_id: string
          provider_item_hash: string
          reply_hash: string | null
          request_id: string
          session_id: string
          started_at: string
          status: string
          transcript_hash: string
          tts_attempts: number
          tts_reserved_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "voice_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_voice_turn: {
        Args: {
          p_context_id: string
          p_owner_id: string
          p_provider_hash: string
          p_request_id: string
          p_session_id: string
          p_transcript_hash: string
        }
        Returns: {
          completed_at: string | null
          context_id: string | null
          error_code: string | null
          id: string
          outcome: string | null
          owner_id: string
          provider_item_hash: string
          reply_hash: string | null
          request_id: string
          session_id: string
          started_at: string
          status: string
          transcript_hash: string
          tts_attempts: number
          tts_reserved_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "voice_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_work_chat: {
        Args: {
          p_context_id?: string
          p_hash: string
          p_owner_id: string
          p_request_id: string
        }
        Returns: Json
      }
      seed_work_attention_canary: { Args: never; Returns: number }
      touch_voice_session: {
        Args: { p_owner_id: string; p_session_id: string }
        Returns: {
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          last_activity_at: string
          mode: string
          owner_id: string
          started_at: string
          status: string
          stt_reserved_usd: number
          transcription_model: string
        }
        SetofOptions: {
          from: "*"
          to: "voice_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      work_attention_valid: {
        Args: {
          a: Database["public"]["Tables"]["attention_items"]["Row"]
          w: Database["public"]["Tables"]["work_contexts"]["Row"]
        }
        Returns: boolean
      }
      work_refresh_attention: {
        Args: { p_context_id: string }
        Returns: undefined
      }
      work_scheduler_health: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
