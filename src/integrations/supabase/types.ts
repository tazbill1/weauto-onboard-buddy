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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      daily_signoffs: {
        Row: {
          day_number: number
          id: string
          manager_id: string
          overall_notes: string | null
          program_id: string
          signed_off_at: string
        }
        Insert: {
          day_number: number
          id?: string
          manager_id: string
          overall_notes?: string | null
          program_id: string
          signed_off_at?: string
        }
        Update: {
          day_number?: number
          id?: string
          manager_id?: string
          overall_notes?: string | null
          program_id?: string
          signed_off_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_signoffs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "onboarding_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          phase: string
          store_id: string | null
          subtitle: string | null
          title: string
          week_number: number
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          phase: string
          store_id?: string | null
          subtitle?: string | null
          title: string
          week_number: number
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          phase?: string
          store_id?: string | null
          subtitle?: string | null
          title?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "days_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_emailed: boolean
          is_read: boolean
          related_day: number | null
          related_program_id: string | null
          related_task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_emailed?: boolean
          is_read?: boolean
          related_day?: number | null
          related_program_id?: string | null
          related_task_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_emailed?: boolean
          is_read?: boolean
          related_day?: number | null
          related_program_id?: string | null
          related_task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_program_id_fkey"
            columns: ["related_program_id"]
            isOneToOne: false
            referencedRelation: "onboarding_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_programs: {
        Row: {
          actual_end_date: string | null
          associate_id: string
          created_at: string
          current_day: number
          expected_end_date: string | null
          id: string
          manager_id: string
          start_date: string
          status: string
          store_id: string
        }
        Insert: {
          actual_end_date?: string | null
          associate_id: string
          created_at?: string
          current_day?: number
          expected_end_date?: string | null
          id?: string
          manager_id: string
          start_date?: string
          status?: string
          store_id: string
        }
        Update: {
          actual_end_date?: string | null
          associate_id?: string
          created_at?: string
          current_day?: number
          expected_end_date?: string | null
          id?: string
          manager_id?: string
          start_date?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_programs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_ratings: {
        Row: {
          id: string
          notes: string | null
          program_id: string
          rated_at: string
          rated_by: string
          rating: string
          task_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          program_id: string
          rated_at?: string
          rated_by: string
          rating: string
          task_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          program_id?: string
          rated_at?: string
          rated_by?: string
          rating?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_ratings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "onboarding_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_ratings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          hired_date: string | null
          id: string
          is_active: boolean
          onboarding_start_date: string | null
          role: Database["public"]["Enums"]["app_role"]
          store_id: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          hired_date?: string | null
          id?: string
          is_active?: boolean
          onboarding_start_date?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          hired_date?: string | null
          id?: string
          is_active?: boolean
          onboarding_start_date?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          brand: string
          created_at: string
          id: string
          is_active: boolean
          store_name: string
        }
        Insert: {
          address?: string | null
          brand: string
          created_at?: string
          id?: string
          is_active?: boolean
          store_name: string
        }
        Update: {
          address?: string | null
          brand?: string
          created_at?: string
          id?: string
          is_active?: boolean
          store_name?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          associate_id: string
          completed_at: string | null
          created_at: string
          id: string
          program_id: string
          status: string
          task_id: string
        }
        Insert: {
          associate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          program_id: string
          status?: string
          task_id: string
        }
        Update: {
          associate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          program_id?: string
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "onboarding_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          content_html: string | null
          created_at: string
          day_id: string
          description: string | null
          id: string
          requires_rating: boolean
          requires_upload: boolean
          section: string
          sort_order: number
          title: string
        }
        Insert: {
          content_html?: string | null
          created_at?: string
          day_id: string
          description?: string | null
          id?: string
          requires_rating?: boolean
          requires_upload?: boolean
          section: string
          sort_order?: number
          title: string
        }
        Update: {
          content_html?: string | null
          created_at?: string
          day_id?: string
          description?: string | null
          id?: string
          requires_rating?: boolean
          requires_upload?: boolean
          section?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "days"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          program_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          task_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_size?: number
          file_type: string
          file_url: string
          id?: string
          program_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          program_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          task_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "onboarding_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role:
        | "associate"
        | "sales_manager"
        | "gm"
        | "hr_admin"
        | "corporate_admin"
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
        "associate",
        "sales_manager",
        "gm",
        "hr_admin",
        "corporate_admin",
      ],
    },
  },
} as const
