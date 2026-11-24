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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_id: string | null
          client_id: string | null
          created_at: string
          engagement_id: string | null
          from_status: string | null
          id: number
          kind: string
          meta: Json
          source: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          engagement_id?: string | null
          from_status?: string | null
          id?: never
          kind: string
          meta?: Json
          source: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          engagement_id?: string | null
          from_status?: string | null
          id?: never
          kind?: string
          meta?: Json
          source?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "activity_log_from_status_fkey"
            columns: ["from_status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "activity_log_to_status_fkey"
            columns: ["to_status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      app_settings: {
        Row: {
          closed_leads_retention_years: number
          daily_digest_enabled: boolean
          email_retention_years: number
          email_test_mode: boolean
          follow_up_interval_days: number
          id: number
          m365_admin_consent: boolean
          m365_provider: string
          max_follow_ups: number
          open_tracking_retention_months: number
          renewal_windows_days: number[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_leads_retention_years?: number
          daily_digest_enabled?: boolean
          email_retention_years?: number
          email_test_mode?: boolean
          follow_up_interval_days?: number
          id?: number
          m365_admin_consent?: boolean
          m365_provider?: string
          max_follow_ups?: number
          open_tracking_retention_months?: number
          renewal_windows_days?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_leads_retention_years?: number
          daily_digest_enabled?: boolean
          email_retention_years?: number
          email_test_mode?: boolean
          follow_up_interval_days?: number
          id?: number
          m365_admin_consent?: boolean
          m365_provider?: string
          max_follow_ups?: number
          open_tracking_retention_months?: number
          renewal_windows_days?: number[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          recert_months: number | null
          sort_order: number
          surveillance_months: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          recert_months?: number | null
          sort_order?: number
          surveillance_months?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          recert_months?: number | null
          sort_order?: number
          surveillance_months?: number | null
        }
        Relationships: []
      }
      client_tags: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          tag_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          tag_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          archived_at: string | null
          city: string | null
          client_code: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          designation: string | null
          do_not_contact: boolean
          email: string | null
          id: string
          industry: string | null
          name: string
          phone: string | null
          priority: string | null
          state_country: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          city?: string | null
          client_code?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          do_not_contact?: boolean
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          phone?: string | null
          priority?: string | null
          state_country?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          city?: string | null
          client_code?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          do_not_contact?: boolean
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          phone?: string | null
          priority?: string | null
          state_country?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
        ]
      }
      delivery_items: {
        Row: {
          created_at: string
          created_by: string | null
          detail: string | null
          engagement_id: string
          id: string
          kind: string
          label: string
          sort_order: number
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          engagement_id: string
          id?: string
          kind: string
          label: string
          sort_order?: number
          state: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          engagement_id?: string
          id?: string
          kind?: string
          label?: string
          sort_order?: number
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      email_batches: {
        Row: {
          body_template: string
          created_at: string
          created_by: string | null
          failed_count: number
          filter_summary: string | null
          id: string
          sent_count: number
          skipped_count: number
          subject_template: string
          total: number
        }
        Insert: {
          body_template: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          filter_summary?: string | null
          id?: string
          sent_count?: number
          skipped_count?: number
          subject_template: string
          total?: number
        }
        Update: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          filter_summary?: string | null
          id?: string
          sent_count?: number
          skipped_count?: number
          subject_template?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          approved_by: string | null
          batch_id: string | null
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          engagement_id: string
          failure_reason: string | null
          id: string
          kind: string
          owner_id: string | null
          scheduled_for: string
          sent_at: string | null
          source: string
          status: string
          subject: string
          thread_id: string | null
          to_email: string | null
          trigger_reason: string | null
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          batch_id?: string | null
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          engagement_id: string
          failure_reason?: string | null
          id?: string
          kind: string
          owner_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          source?: string
          status?: string
          subject: string
          thread_id?: string | null
          to_email?: string | null
          trigger_reason?: string | null
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          batch_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          failure_reason?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          source?: string
          status?: string
          subject?: string
          thread_id?: string | null
          to_email?: string | null
          trigger_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "email_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "email_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_link_clicks: {
        Row: {
          clicked_at: string
          id: number
          message_id: string
          url: string
        }
        Insert: {
          clicked_at?: string
          id?: never
          message_id: string
          url: string
        }
        Update: {
          clicked_at?: string
          id?: never
          message_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_link_clicks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          approved_by: string | null
          body: string
          client_id: string
          direction: string
          draft_id: string | null
          engagement_id: string
          from_email: string
          id: string
          internet_message_id: string | null
          open_count: number
          opened_at: string | null
          provider: string
          provider_message_id: string | null
          sender_id: string | null
          sent_at: string
          subject: string
          thread_id: string
          to_email: string
          tracking_token: string
        }
        Insert: {
          approved_by?: string | null
          body: string
          client_id: string
          direction: string
          draft_id?: string | null
          engagement_id: string
          from_email: string
          id?: string
          internet_message_id?: string | null
          open_count?: number
          opened_at?: string | null
          provider: string
          provider_message_id?: string | null
          sender_id?: string | null
          sent_at?: string
          subject: string
          thread_id: string
          to_email: string
          tracking_token?: string
        }
        Update: {
          approved_by?: string | null
          body?: string
          client_id?: string
          direction?: string
          draft_id?: string | null
          engagement_id?: string
          from_email?: string
          id?: string
          internet_message_id?: string | null
          open_count?: number
          opened_at?: string | null
          provider?: string
          provider_message_id?: string | null
          sender_id?: string | null
          sent_at?: string
          subject?: string
          thread_id?: string
          to_email?: string
          tracking_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "email_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "email_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          client_id: string
          conversation_id: string | null
          created_at: string
          engagement_id: string
          id: string
          owner_id: string
          root_internet_message_id: string | null
          subject: string
        }
        Insert: {
          client_id: string
          conversation_id?: string | null
          created_at?: string
          engagement_id: string
          id?: string
          owner_id: string
          root_internet_message_id?: string | null
          subject: string
        }
        Update: {
          client_id?: string
          conversation_id?: string | null
          created_at?: string
          engagement_id?: string
          id?: string
          owner_id?: string
          root_internet_message_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "email_threads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_financials: {
        Row: {
          contract_value: number | null
          created_at: string
          engagement_id: string
          payment_status: string | null
          updated_at: string
        }
        Insert: {
          contract_value?: number | null
          created_at?: string
          engagement_id: string
          payment_status?: string | null
          updated_at?: string
        }
        Update: {
          contract_value?: number | null
          created_at?: string
          engagement_id?: string
          payment_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_financials_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_financials_payment_status_fkey"
            columns: ["payment_status"]
            isOneToOne: false
            referencedRelation: "payment_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      engagement_notes: {
        Row: {
          created_at: string
          created_by: string | null
          engagement_id: string
          held_by: string | null
          held_on: string
          id: string
          next_step: string | null
          source: string
          summary: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engagement_id: string
          held_by?: string | null
          held_on?: string
          id?: string
          next_step?: string | null
          source?: string
          summary: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engagement_id?: string
          held_by?: string | null
          held_on?: string
          id?: string
          next_step?: string | null
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_notes_held_by_fkey"
            columns: ["held_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_notes_held_by_fkey"
            columns: ["held_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          archived_at: string | null
          certificate_number: string | null
          certification_body: string | null
          certification_type: string | null
          client_id: string
          closed_reason: string | null
          completion_date: string | null
          created_at: string
          created_by: string | null
          date_is_estimated: boolean
          follow_up_count: number
          id: string
          initial_engagement_date: string | null
          last_audit_date: string | null
          last_contacted_on: string | null
          lead_source: string | null
          next_audit_date: string | null
          next_follow_up_on: string | null
          owner_id: string | null
          remarks: string | null
          replied_at: string | null
          scope: string | null
          standard_framework: string | null
          status: string | null
          surveillance_due_date: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          archived_at?: string | null
          certificate_number?: string | null
          certification_body?: string | null
          certification_type?: string | null
          client_id: string
          closed_reason?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          date_is_estimated?: boolean
          follow_up_count?: number
          id?: string
          initial_engagement_date?: string | null
          last_audit_date?: string | null
          last_contacted_on?: string | null
          lead_source?: string | null
          next_audit_date?: string | null
          next_follow_up_on?: string | null
          owner_id?: string | null
          remarks?: string | null
          replied_at?: string | null
          scope?: string | null
          standard_framework?: string | null
          status?: string | null
          surveillance_due_date?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          archived_at?: string | null
          certificate_number?: string | null
          certification_body?: string | null
          certification_type?: string | null
          client_id?: string
          closed_reason?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          date_is_estimated?: boolean
          follow_up_count?: number
          id?: string
          initial_engagement_date?: string | null
          last_audit_date?: string | null
          last_contacted_on?: string | null
          lead_source?: string | null
          next_audit_date?: string | null
          next_follow_up_on?: string | null
          owner_id?: string | null
          remarks?: string | null
          replied_at?: string | null
          scope?: string | null
          standard_framework?: string | null
          status?: string | null
          surveillance_due_date?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_lead_source_fkey"
            columns: ["lead_source"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      import_batches: {
        Row: {
          accepted_count: number
          duplicate_count: number
          file_name: string
          flagged_count: number
          flags: Json
          id: string
          imported_at: string
          imported_by: string | null
          rejected_count: number
          total_rows: number
        }
        Insert: {
          accepted_count?: number
          duplicate_count?: number
          file_name: string
          flagged_count?: number
          flags?: Json
          id?: string
          imported_at?: string
          imported_by?: string | null
          rejected_count?: number
          total_rows?: number
        }
        Update: {
          accepted_count?: number
          duplicate_count?: number
          file_name?: string
          flagged_count?: number
          flags?: Json
          id?: string
          imported_at?: string
          imported_by?: string | null
          rejected_count?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_on: string
          engagement_id: string
          gst_amount: number
          id: string
          invoice_no: string
          issued_on: string
          status: string
          sync_provider: string | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          due_on: string
          engagement_id: string
          gst_amount?: number
          id?: string
          invoice_no: string
          issued_on?: string
          status?: string
          sync_provider?: string | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_on?: string
          engagement_id?: string
          gst_amount?: number
          id?: string
          invoice_no?: string
          issued_on?: string
          status?: string
          sync_provider?: string | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          active: boolean
          code: string
          created_at: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: []
      }
      mailbox_connections: {
        Row: {
          access_token_expires_at: string | null
          connected_at: string
          mailbox_address: string
          ms_user_id: string | null
          profile_id: string
          provider: string
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token_expires_at?: string | null
          connected_at?: string
          mailbox_address: string
          ms_user_id?: string | null
          profile_id: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token_expires_at?: string | null
          connected_at?: string
          mailbox_address?: string
          ms_user_id?: string | null
          profile_id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mailbox_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_statuses: {
        Row: {
          active: boolean
          code: string
          created_at: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: []
      }
      priorities: {
        Row: {
          active: boolean
          code: string
          created_at: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          booking_link: string | null
          can_see_values: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          mailbox_connected: boolean
          role: Database["public"]["Enums"]["app_role"] | null
          theme_preference: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          booking_link?: string | null
          can_see_values?: boolean
          created_at?: string
          email: string
          full_name?: string
          id: string
          mailbox_connected?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          booking_link?: string | null
          can_see_values?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          mailbox_connected?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          theme_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      statuses: {
        Row: {
          code: string
          created_at: string
          sort_order: number
          status_group: Database["public"]["Enums"]["status_group"]
        }
        Insert: {
          code: string
          created_at?: string
          sort_order?: number
          status_group: Database["public"]["Enums"]["status_group"]
        }
        Update: {
          code?: string
          created_at?: string
          sort_order?: number
          status_group?: Database["public"]["Enums"]["status_group"]
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          tone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tone?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_calls: {
        Row: {
          booked_slot: string | null
          called_at: string
          client_id: string
          created_at: string
          created_by: string | null
          duration_sec: number | null
          engagement_id: string | null
          id: string
          outcome: string
          owner_id: string | null
          summary: string | null
        }
        Insert: {
          booked_slot?: string | null
          called_at?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          engagement_id?: string | null
          id?: string
          outcome: string
          owner_id?: string | null
          summary?: string | null
        }
        Update: {
          booked_slot?: string | null
          called_at?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          engagement_id?: string | null
          id?: string
          outcome?: string
          owner_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "voice_calls_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_calls_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          client_id: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          delivery_status: string
          direction: string
          engagement_id: string | null
          id: string
          template: string | null
        }
        Insert: {
          body: string
          client_id: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          direction?: string
          engagement_id?: string | null
          id?: string
          template?: string | null
        }
        Update: {
          body?: string
          client_id?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_status?: string
          direction?: string
          engagement_id?: string | null
          id?: string
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "closed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "delivery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "needs_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "v_renewals"
            referencedColumns: ["engagement_id"]
          },
        ]
      }
    }
    Views: {
      active_clients: {
        Row: {
          archived_at: string | null
          certificate_number: string | null
          certification_body: string | null
          certification_type: string | null
          client_address: string | null
          client_archived_at: string | null
          client_city: string | null
          client_code: string | null
          client_contact_person: string | null
          client_designation: string | null
          client_do_not_contact: boolean | null
          client_email: string | null
          client_id: string | null
          client_industry: string | null
          client_name: string | null
          client_phone: string | null
          client_priority: string | null
          client_state_country: string | null
          client_website: string | null
          completion_date: string | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          date_is_estimated: boolean | null
          id: string | null
          initial_engagement_date: string | null
          last_audit_date: string | null
          last_contacted_on: string | null
          lead_source: string | null
          next_audit_date: string | null
          next_follow_up_on: string | null
          owner_id: string | null
          payment_status: string | null
          remarks: string | null
          scope: string | null
          standard_framework: string | null
          status: string | null
          status_group: Database["public"]["Enums"]["status_group"] | null
          status_sort_order: number | null
          surveillance_due_date: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["client_priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagement_financials_payment_status_fkey"
            columns: ["payment_status"]
            isOneToOne: false
            referencedRelation: "payment_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_lead_source_fkey"
            columns: ["lead_source"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      closed: {
        Row: {
          archived_at: string | null
          certificate_number: string | null
          certification_body: string | null
          certification_type: string | null
          client_address: string | null
          client_archived_at: string | null
          client_city: string | null
          client_code: string | null
          client_contact_person: string | null
          client_designation: string | null
          client_do_not_contact: boolean | null
          client_email: string | null
          client_id: string | null
          client_industry: string | null
          client_name: string | null
          client_phone: string | null
          client_priority: string | null
          client_state_country: string | null
          client_website: string | null
          completion_date: string | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          date_is_estimated: boolean | null
          id: string | null
          initial_engagement_date: string | null
          last_audit_date: string | null
          last_contacted_on: string | null
          lead_source: string | null
          next_audit_date: string | null
          next_follow_up_on: string | null
          owner_id: string | null
          payment_status: string | null
          remarks: string | null
          scope: string | null
          standard_framework: string | null
          status: string | null
          status_group: Database["public"]["Enums"]["status_group"] | null
          status_sort_order: number | null
          surveillance_due_date: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["client_priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagement_financials_payment_status_fkey"
            columns: ["payment_status"]
            isOneToOne: false
            referencedRelation: "payment_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_lead_source_fkey"
            columns: ["lead_source"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      delivery: {
        Row: {
          archived_at: string | null
          certificate_number: string | null
          certification_body: string | null
          certification_type: string | null
          client_address: string | null
          client_archived_at: string | null
          client_city: string | null
          client_code: string | null
          client_contact_person: string | null
          client_designation: string | null
          client_do_not_contact: boolean | null
          client_email: string | null
          client_id: string | null
          client_industry: string | null
          client_name: string | null
          client_phone: string | null
          client_priority: string | null
          client_state_country: string | null
          client_website: string | null
          completion_date: string | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          date_is_estimated: boolean | null
          id: string | null
          initial_engagement_date: string | null
          last_audit_date: string | null
          last_contacted_on: string | null
          lead_source: string | null
          next_audit_date: string | null
          next_follow_up_on: string | null
          owner_id: string | null
          payment_status: string | null
          remarks: string | null
          scope: string | null
          standard_framework: string | null
          status: string | null
          status_group: Database["public"]["Enums"]["status_group"] | null
          status_sort_order: number | null
          surveillance_due_date: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["client_priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagement_financials_payment_status_fkey"
            columns: ["payment_status"]
            isOneToOne: false
            referencedRelation: "payment_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_lead_source_fkey"
            columns: ["lead_source"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      needs_review: {
        Row: {
          archived_at: string | null
          certificate_number: string | null
          certification_body: string | null
          certification_type: string | null
          client_address: string | null
          client_archived_at: string | null
          client_city: string | null
          client_code: string | null
          client_contact_person: string | null
          client_designation: string | null
          client_do_not_contact: boolean | null
          client_email: string | null
          client_id: string | null
          client_industry: string | null
          client_name: string | null
          client_phone: string | null
          client_priority: string | null
          client_state_country: string | null
          client_website: string | null
          completion_date: string | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          date_is_estimated: boolean | null
          id: string | null
          initial_engagement_date: string | null
          last_audit_date: string | null
          last_contacted_on: string | null
          lead_source: string | null
          next_audit_date: string | null
          next_follow_up_on: string | null
          owner_id: string | null
          payment_status: string | null
          remarks: string | null
          scope: string | null
          standard_framework: string | null
          status: string | null
          status_group: Database["public"]["Enums"]["status_group"] | null
          status_sort_order: number | null
          surveillance_due_date: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["client_priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagement_financials_payment_status_fkey"
            columns: ["payment_status"]
            isOneToOne: false
            referencedRelation: "payment_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_lead_source_fkey"
            columns: ["lead_source"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      pipeline: {
        Row: {
          archived_at: string | null
          certificate_number: string | null
          certification_body: string | null
          certification_type: string | null
          client_address: string | null
          client_archived_at: string | null
          client_city: string | null
          client_code: string | null
          client_contact_person: string | null
          client_designation: string | null
          client_do_not_contact: boolean | null
          client_email: string | null
          client_id: string | null
          client_industry: string | null
          client_name: string | null
          client_phone: string | null
          client_priority: string | null
          client_state_country: string | null
          client_website: string | null
          completion_date: string | null
          contract_value: number | null
          created_at: string | null
          created_by: string | null
          date_is_estimated: boolean | null
          id: string | null
          initial_engagement_date: string | null
          last_audit_date: string | null
          last_contacted_on: string | null
          lead_source: string | null
          next_audit_date: string | null
          next_follow_up_on: string | null
          owner_id: string | null
          payment_status: string | null
          remarks: string | null
          scope: string | null
          standard_framework: string | null
          status: string | null
          status_group: Database["public"]["Enums"]["status_group"] | null
          status_sort_order: number | null
          surveillance_due_date: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["client_priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagement_financials_payment_status_fkey"
            columns: ["payment_status"]
            isOneToOne: false
            referencedRelation: "payment_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_lead_source_fkey"
            columns: ["lead_source"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean | null
          booking_link: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          active?: boolean | null
          booking_link?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          active?: boolean | null
          booking_link?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      v_renewals: {
        Row: {
          bucket: string | null
          certification_type: string | null
          client_code: string | null
          client_id: string | null
          client_name: string | null
          days_until: number | null
          due_date: string | null
          engagement_id: string | null
          event_kind: string | null
          is_estimated: boolean | null
          next_surveillance_date: string | null
          owner_id: string | null
          priority: string | null
          recertification_date: string | null
          standard_framework: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_priority_fkey"
            columns: ["priority"]
            isOneToOne: false
            referencedRelation: "priorities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_certification_type_fkey"
            columns: ["certification_type"]
            isOneToOne: false
            referencedRelation: "certification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      apply_drishti_proposal: {
        Args: { p_changes: Json; p_engagement_id: string }
        Returns: undefined
      }
      change_engagement_status: {
        Args: { p_engagement_id: string; p_new_status: string }
        Returns: undefined
      }
      commit_import: {
        Args: {
          p_counts: Json
          p_file_name: string
          p_flags: Json
          p_rows: Json
        }
        Returns: string
      }
      renewal_due: {
        Args: { p_as_of: string; p_engagement_id: string }
        Returns: {
          bucket: string
          days_until: number
          due_date: string
          event_kind: string
          is_estimated: boolean
        }[]
      }
      run_reminder_engine: {
        Args: { p_as_of?: string }
        Returns: {
          follow_up_drafts: number
          renewal_drafts: number
        }[]
      }
      submit_web_lead: {
        Args: {
          p_city: string
          p_company: string
          p_contact: string
          p_email: string
          p_notes: string
          p_phone: string
          p_service: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "consultant" | "marketing"
      status_group: "pipeline" | "delivery" | "active" | "paused" | "ended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "consultant", "marketing"],
      status_group: ["pipeline", "delivery", "active", "paused", "ended"],
    },
  },
} as const
