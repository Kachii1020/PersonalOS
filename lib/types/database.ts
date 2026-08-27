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
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string
          due_at: string | null
          id: string
          notes: string | null
          status: string
          title: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          title: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          title?: string
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_allowed_user: { Args: never; Returns: boolean }
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

