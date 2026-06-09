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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["announcement_audience"]
          author_id: string
          body: string
          class_id: string | null
          created_at: string
          id: string
          school_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          author_id: string
          body: string
          class_id?: string | null
          created_at?: string
          id?: string
          school_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          author_id?: string
          body?: string
          class_id?: string | null
          created_at?: string
          id?: string
          school_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          external_id: string | null
          id: string
          present: boolean | null
          recorded_by: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          external_id?: string | null
          id?: string
          present?: boolean | null
          recorded_by: string
          school_id: string
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          external_id?: string | null
          id?: string
          present?: boolean | null
          recorded_by?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          end_time: string
          id: string
          school_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          end_time: string
          id?: string
          school_id: string
          start_time: string
          weekday: number
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          end_time?: string
          id?: string
          school_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string
          id: string
          school_id: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          school_id: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          created_by: string
          grade_level: string | null
          id: string
          name: string
          school_id: string
          teacher_uid: string | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          grade_level?: string | null
          id?: string
          name: string
          school_id: string
          teacher_uid?: string | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          grade_level?: string | null
          id?: string
          name?: string
          school_id?: string
          teacher_uid?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          recorded_by: string
          school_id: string
          severity: string
          student_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          recorded_by: string
          school_id: string
          severity?: string
          student_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          recorded_by?: string
          school_id?: string
          severity?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          class_id: string
          created_at: string
          external_id: string | null
          id: string
          recorded_by: string
          school_id: string
          student_id: string
          subject: string
          trimester: number
          value: number
        }
        Insert: {
          class_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          recorded_by: string
          school_id: string
          student_id: string
          subject?: string
          trimester: number
          value: number
        }
        Update: {
          class_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          recorded_by?: string
          school_id?: string
          student_id?: string
          subject?: string
          trimester?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sources: {
        Row: {
          api_key_encrypted: string
          base_url: string
          class_id: string | null
          created_at: string
          created_by: string
          id: string
          label: string
          last_run_at: string | null
          last_status: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted: string
          base_url: string
          class_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          label: string
          last_run_at?: string | null
          last_status?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          base_url?: string
          class_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          last_run_at?: string | null
          last_status?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_sources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sources_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          parent_user_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          parent_user_id: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          parent_user_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          onboarding_complete: boolean
          photo_url: string | null
          profile_type: Database["public"]["Enums"]["profile_type"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          name?: string
          onboarding_complete?: boolean
          photo_url?: string | null
          profile_type?: Database["public"]["Enums"]["profile_type"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          onboarding_complete?: boolean
          photo_url?: string | null
          profile_type?: Database["public"]["Enums"]["profile_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      school_memberships: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          role_in_school: Database["public"]["Enums"]["role_in_school"]
          school_id: string
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          role_in_school: Database["public"]["Enums"]["role_in_school"]
          school_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          role_in_school?: Database["public"]["Enums"]["role_in_school"]
          school_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          id: string
          merged_into: string | null
          name: string
          normalized_name: string
          state: string | null
          status: Database["public"]["Enums"]["school_status"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          id?: string
          merged_into?: string | null
          name: string
          normalized_name: string
          state?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          id?: string
          merged_into?: string | null
          name?: string
          normalized_name?: string
          state?: string | null
          status?: Database["public"]["Enums"]["school_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string
          external_id: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          matricula: string | null
          name: string
          notes: string | null
          school_id: string
          special_needs: boolean
          special_needs_note: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by: string
          external_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          matricula?: string | null
          name: string
          notes?: string | null
          school_id: string
          special_needs?: boolean
          special_needs_note?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          external_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          matricula?: string | null
          name?: string
          notes?: string | null
          school_id?: string
          special_needs?: boolean
          special_needs_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["global_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["global_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["global_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["global_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      is_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_member: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      announcement_audience: "parents" | "teachers" | "all"
      global_role: "master" | "user"
      membership_status: "pending" | "approved" | "rejected" | "blocked"
      profile_type: "teacher" | "school_admin" | "parent"
      role_in_school: "school_admin" | "teacher" | "coordinator"
      school_status: "active" | "pending" | "blocked" | "merged_into"
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
      announcement_audience: ["parents", "teachers", "all"],
      global_role: ["master", "user"],
      membership_status: ["pending", "approved", "rejected", "blocked"],
      profile_type: ["teacher", "school_admin", "parent"],
      role_in_school: ["school_admin", "teacher", "coordinator"],
      school_status: ["active", "pending", "blocked", "merged_into"],
    },
  },
} as const
