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
      automation_logs: {
        Row: {
          automation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          status: string
          webhook_event_id: string | null
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status: string
          webhook_event_id?: string | null
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          status?: string
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action: string
          completed_count: number | null
          created_at: string
          delay: string | null
          enabled: boolean
          id: string
          name: string
          trigger: string
          triggered_count: number | null
          type: string
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          action: string
          completed_count?: number | null
          created_at?: string
          delay?: string | null
          enabled?: boolean
          id?: string
          name: string
          trigger: string
          triggered_count?: number | null
          type: string
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          action?: string
          completed_count?: number | null
          created_at?: string
          delay?: string | null
          enabled?: boolean
          id?: string
          name?: string
          trigger?: string
          triggered_count?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          company: string | null
          contact_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
        }
        Insert: {
          campaign_id: string
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Update: {
          campaign_id?: string
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          batch_delay: number | null
          batch_size: number | null
          content: string
          created_at: string
          id: string
          name: string
          schedule_type: string
          scheduled_at: string | null
          sender_email: string
          sender_name: string
          sent_count: number | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          timezone: string | null
          total_recipients: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_delay?: number | null
          batch_size?: number | null
          content: string
          created_at?: string
          id?: string
          name: string
          schedule_type?: string
          scheduled_at?: string | null
          sender_email: string
          sender_name: string
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject: string
          timezone?: string | null
          total_recipients?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_delay?: number | null
          batch_size?: number | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          schedule_type?: string
          scheduled_at?: string | null
          sender_email?: string
          sender_name?: string
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          timezone?: string | null
          total_recipients?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          bounce_reason: string | null
          bounce_type: string | null
          campaign_id: string | null
          complaint_type: string | null
          created_at: string
          email: string
          email_log_id: string | null
          event_type: string
          id: string
          payload: Json | null
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type?: string | null
          campaign_id?: string | null
          complaint_type?: string | null
          created_at?: string
          email: string
          email_log_id?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          provider?: string
          provider_event_id?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string | null
          campaign_id?: string | null
          complaint_type?: string | null
          created_at?: string
          email?: string
          email_log_id?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_email_log_id_fkey"
            columns: ["email_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bounce_type: string | null
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          complaint_at: string | null
          complaint_type: string | null
          created_at: string
          delivered_at: string | null
          email: string
          error_message: string | null
          id: string
          opened_at: string | null
          recipient_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
        }
        Insert: {
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          complaint_at?: string | null
          complaint_type?: string | null
          created_at?: string
          delivered_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
        }
        Update: {
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          complaint_at?: string | null
          complaint_type?: string | null
          created_at?: string
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          recipient_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          api_from_email: string | null
          api_from_name: string | null
          api_key: string | null
          api_provider: string | null
          created_at: string
          daily_warmup_limit: number | null
          enable_ip_warmup: boolean | null
          id: string
          ip_pool: string | null
          provider_type: string
          smtp_encryption: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          updated_at: string
          use_dedicated_ip: boolean | null
          user_id: string
        }
        Insert: {
          api_from_email?: string | null
          api_from_name?: string | null
          api_key?: string | null
          api_provider?: string | null
          created_at?: string
          daily_warmup_limit?: number | null
          enable_ip_warmup?: boolean | null
          id?: string
          ip_pool?: string | null
          provider_type?: string
          smtp_encryption?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string
          use_dedicated_ip?: boolean | null
          user_id: string
        }
        Update: {
          api_from_email?: string | null
          api_from_name?: string | null
          api_key?: string | null
          api_provider?: string | null
          created_at?: string
          daily_warmup_limit?: number | null
          enable_ip_warmup?: boolean | null
          id?: string
          ip_pool?: string | null
          provider_type?: string
          smtp_encryption?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          updated_at?: string
          use_dedicated_ip?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          campaign_id: string | null
          created_at: string
          email: string
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          recipient_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          email: string
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          recipient_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          email?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "paused"
        | "cancelled"
      email_status:
        | "pending"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
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
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "paused",
        "cancelled",
      ],
      email_status: [
        "pending",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
      ],
    },
  },
} as const
