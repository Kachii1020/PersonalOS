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
      events: {
        Row: {
          caldav_href: string
          caldav_uid: string
          calendar_id: string
          description: string | null
          ends_at: string
          etag: string | null
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
          description?: string | null
          ends_at: string
          etag?: string | null
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
          description?: string | null
          ends_at?: string
          etag?: string | null
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
        ]
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
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          title?: string
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

