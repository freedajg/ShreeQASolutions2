
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"engagement_id": string | null,"from_status": string | null,"id": number,"kind": string,"source": string,"to_status": string | null
                  }
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"engagement_id"?: string | null,"from_status"?: string | null,"id"?: never,"kind": string,"source": string,"to_status"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"engagement_id"?: string | null,"from_status"?: string | null,"id"?: never,"kind"?: string,"source"?: string,"to_status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "active_clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "closed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "delivery"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "needs_review"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: false
      referencedRelation: "pipeline"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_from_status_fkey"
      columns: ["from_status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "activity_log_to_status_fkey"
      columns: ["to_status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"certification_types": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"recert_months": number | null,"sort_order": number,"surveillance_months": number | null
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"recert_months"?: number | null,"sort_order"?: number,"surveillance_months"?: number | null
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"recert_months"?: number | null,"sort_order"?: number,"surveillance_months"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"clients": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"city": string | null,"client_code": string | null,"contact_person": string | null,"created_at": string,"created_by": string | null,"designation": string | null,"do_not_contact": boolean,"email": string | null,"id": string,"industry": string | null,"name": string,"phone": string | null,"priority": string | null,"state_country": string | null,"updated_at": string,"website": string | null
                  }
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"city"?: string | null,"client_code"?: string | null,"contact_person"?: string | null,"created_at"?: string,"created_by"?: string | null,"designation"?: string | null,"do_not_contact"?: boolean,"email"?: string | null,"id"?: string,"industry"?: string | null,"name": string,"phone"?: string | null,"priority"?: string | null,"state_country"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"city"?: string | null,"client_code"?: string | null,"contact_person"?: string | null,"created_at"?: string,"created_by"?: string | null,"designation"?: string | null,"do_not_contact"?: boolean,"email"?: string | null,"id"?: string,"industry"?: string | null,"name"?: string,"phone"?: string | null,"priority"?: string | null,"state_country"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_priority_fkey"
      columns: ["priority"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    }
                  ]
                },"engagement_financials": {
                  Row: {
                    "contract_value": number | null,"created_at": string,"engagement_id": string,"payment_status": string | null,"updated_at": string
                  }
                  Insert: {
                    "contract_value"?: number | null,"created_at"?: string,"engagement_id": string,"payment_status"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "contract_value"?: number | null,"created_at"?: string,"engagement_id"?: string,"payment_status"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "engagement_financials_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "active_clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_financials_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "closed"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_financials_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "delivery"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_financials_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "engagements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_financials_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "needs_review"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_financials_engagement_id_fkey"
      columns: ["engagement_id"]
isOneToOne: true
      referencedRelation: "pipeline"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagement_financials_payment_status_fkey"
      columns: ["payment_status"]
isOneToOne: false
      referencedRelation: "payment_statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"engagements": {
                  Row: {
                    "archived_at": string | null,"certificate_number": string | null,"certification_body": string | null,"certification_type": string | null,"client_id": string,"completion_date": string | null,"created_at": string,"created_by": string | null,"date_is_estimated": boolean,"id": string,"initial_engagement_date": string | null,"last_audit_date": string | null,"last_contacted_on": string | null,"lead_source": string | null,"next_audit_date": string | null,"next_follow_up_on": string | null,"owner_id": string | null,"remarks": string | null,"scope": string | null,"standard_framework": string | null,"status": string | null,"surveillance_due_date": string | null,"updated_at": string,"valid_from": string | null,"valid_to": string | null
                  }
                  Insert: {
                    "archived_at"?: string | null,"certificate_number"?: string | null,"certification_body"?: string | null,"certification_type"?: string | null,"client_id": string,"completion_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_is_estimated"?: boolean,"id"?: string,"initial_engagement_date"?: string | null,"last_audit_date"?: string | null,"last_contacted_on"?: string | null,"lead_source"?: string | null,"next_audit_date"?: string | null,"next_follow_up_on"?: string | null,"owner_id"?: string | null,"remarks"?: string | null,"scope"?: string | null,"standard_framework"?: string | null,"status"?: string | null,"surveillance_due_date"?: string | null,"updated_at"?: string,"valid_from"?: string | null,"valid_to"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"certificate_number"?: string | null,"certification_body"?: string | null,"certification_type"?: string | null,"client_id"?: string,"completion_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"date_is_estimated"?: boolean,"id"?: string,"initial_engagement_date"?: string | null,"last_audit_date"?: string | null,"last_contacted_on"?: string | null,"lead_source"?: string | null,"next_audit_date"?: string | null,"next_follow_up_on"?: string | null,"owner_id"?: string | null,"remarks"?: string | null,"scope"?: string | null,"standard_framework"?: string | null,"status"?: string | null,"surveillance_due_date"?: string | null,"updated_at"?: string,"valid_from"?: string | null,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "engagements_certification_type_fkey"
      columns: ["certification_type"]
isOneToOne: false
      referencedRelation: "certification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_lead_source_fkey"
      columns: ["lead_source"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_status_fkey"
      columns: ["status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"lead_sources": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"payment_statuses": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"priorities": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"booking_link": string | null,"can_see_values": boolean,"created_at": string,"email": string,"full_name": string,"id": string,"mailbox_connected": boolean,"role": Database["public"]['Enums']["app_role"] | null,"theme_preference": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"booking_link"?: string | null,"can_see_values"?: boolean,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"mailbox_connected"?: boolean,"role"?: Database["public"]['Enums']["app_role"] | null,"theme_preference"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"booking_link"?: string | null,"can_see_values"?: boolean,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"mailbox_connected"?: boolean,"role"?: Database["public"]['Enums']["app_role"] | null,"theme_preference"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"statuses": {
                  Row: {
                    "code": string,"created_at": string,"sort_order": number,"status_group": Database["public"]['Enums']["status_group"]
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"sort_order"?: number,"status_group": Database["public"]['Enums']["status_group"]
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"sort_order"?: number,"status_group"?: Database["public"]['Enums']["status_group"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "active_clients": {
                  Row: {
                    "archived_at": string | null,"certificate_number": string | null,"certification_body": string | null,"certification_type": string | null,"client_address": string | null,"client_archived_at": string | null,"client_city": string | null,"client_code": string | null,"client_contact_person": string | null,"client_designation": string | null,"client_do_not_contact": boolean | null,"client_email": string | null,"client_id": string | null,"client_industry": string | null,"client_name": string | null,"client_phone": string | null,"client_priority": string | null,"client_state_country": string | null,"client_website": string | null,"completion_date": string | null,"contract_value": number | null,"created_at": string | null,"created_by": string | null,"date_is_estimated": boolean | null,"id": string | null,"initial_engagement_date": string | null,"last_audit_date": string | null,"last_contacted_on": string | null,"lead_source": string | null,"next_audit_date": string | null,"next_follow_up_on": string | null,"owner_id": string | null,"payment_status": string | null,"remarks": string | null,"scope": string | null,"standard_framework": string | null,"status": string | null,"status_group": Database["public"]['Enums']["status_group"] | null,"status_sort_order": number | null,"surveillance_due_date": string | null,"updated_at": string | null,"valid_from": string | null,"valid_to": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_priority_fkey"
      columns: ["client_priority"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagement_financials_payment_status_fkey"
      columns: ["payment_status"]
isOneToOne: false
      referencedRelation: "payment_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_certification_type_fkey"
      columns: ["certification_type"]
isOneToOne: false
      referencedRelation: "certification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_lead_source_fkey"
      columns: ["lead_source"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_status_fkey"
      columns: ["status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"closed": {
                  Row: {
                    "archived_at": string | null,"certificate_number": string | null,"certification_body": string | null,"certification_type": string | null,"client_address": string | null,"client_archived_at": string | null,"client_city": string | null,"client_code": string | null,"client_contact_person": string | null,"client_designation": string | null,"client_do_not_contact": boolean | null,"client_email": string | null,"client_id": string | null,"client_industry": string | null,"client_name": string | null,"client_phone": string | null,"client_priority": string | null,"client_state_country": string | null,"client_website": string | null,"completion_date": string | null,"contract_value": number | null,"created_at": string | null,"created_by": string | null,"date_is_estimated": boolean | null,"id": string | null,"initial_engagement_date": string | null,"last_audit_date": string | null,"last_contacted_on": string | null,"lead_source": string | null,"next_audit_date": string | null,"next_follow_up_on": string | null,"owner_id": string | null,"payment_status": string | null,"remarks": string | null,"scope": string | null,"standard_framework": string | null,"status": string | null,"status_group": Database["public"]['Enums']["status_group"] | null,"status_sort_order": number | null,"surveillance_due_date": string | null,"updated_at": string | null,"valid_from": string | null,"valid_to": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_priority_fkey"
      columns: ["client_priority"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagement_financials_payment_status_fkey"
      columns: ["payment_status"]
isOneToOne: false
      referencedRelation: "payment_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_certification_type_fkey"
      columns: ["certification_type"]
isOneToOne: false
      referencedRelation: "certification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_lead_source_fkey"
      columns: ["lead_source"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_status_fkey"
      columns: ["status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"delivery": {
                  Row: {
                    "archived_at": string | null,"certificate_number": string | null,"certification_body": string | null,"certification_type": string | null,"client_address": string | null,"client_archived_at": string | null,"client_city": string | null,"client_code": string | null,"client_contact_person": string | null,"client_designation": string | null,"client_do_not_contact": boolean | null,"client_email": string | null,"client_id": string | null,"client_industry": string | null,"client_name": string | null,"client_phone": string | null,"client_priority": string | null,"client_state_country": string | null,"client_website": string | null,"completion_date": string | null,"contract_value": number | null,"created_at": string | null,"created_by": string | null,"date_is_estimated": boolean | null,"id": string | null,"initial_engagement_date": string | null,"last_audit_date": string | null,"last_contacted_on": string | null,"lead_source": string | null,"next_audit_date": string | null,"next_follow_up_on": string | null,"owner_id": string | null,"payment_status": string | null,"remarks": string | null,"scope": string | null,"standard_framework": string | null,"status": string | null,"status_group": Database["public"]['Enums']["status_group"] | null,"status_sort_order": number | null,"surveillance_due_date": string | null,"updated_at": string | null,"valid_from": string | null,"valid_to": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_priority_fkey"
      columns: ["client_priority"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagement_financials_payment_status_fkey"
      columns: ["payment_status"]
isOneToOne: false
      referencedRelation: "payment_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_certification_type_fkey"
      columns: ["certification_type"]
isOneToOne: false
      referencedRelation: "certification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_lead_source_fkey"
      columns: ["lead_source"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_status_fkey"
      columns: ["status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"needs_review": {
                  Row: {
                    "archived_at": string | null,"certificate_number": string | null,"certification_body": string | null,"certification_type": string | null,"client_address": string | null,"client_archived_at": string | null,"client_city": string | null,"client_code": string | null,"client_contact_person": string | null,"client_designation": string | null,"client_do_not_contact": boolean | null,"client_email": string | null,"client_id": string | null,"client_industry": string | null,"client_name": string | null,"client_phone": string | null,"client_priority": string | null,"client_state_country": string | null,"client_website": string | null,"completion_date": string | null,"contract_value": number | null,"created_at": string | null,"created_by": string | null,"date_is_estimated": boolean | null,"id": string | null,"initial_engagement_date": string | null,"last_audit_date": string | null,"last_contacted_on": string | null,"lead_source": string | null,"next_audit_date": string | null,"next_follow_up_on": string | null,"owner_id": string | null,"payment_status": string | null,"remarks": string | null,"scope": string | null,"standard_framework": string | null,"status": string | null,"status_group": Database["public"]['Enums']["status_group"] | null,"status_sort_order": number | null,"surveillance_due_date": string | null,"updated_at": string | null,"valid_from": string | null,"valid_to": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_priority_fkey"
      columns: ["client_priority"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagement_financials_payment_status_fkey"
      columns: ["payment_status"]
isOneToOne: false
      referencedRelation: "payment_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_certification_type_fkey"
      columns: ["certification_type"]
isOneToOne: false
      referencedRelation: "certification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_lead_source_fkey"
      columns: ["lead_source"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_status_fkey"
      columns: ["status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"pipeline": {
                  Row: {
                    "archived_at": string | null,"certificate_number": string | null,"certification_body": string | null,"certification_type": string | null,"client_address": string | null,"client_archived_at": string | null,"client_city": string | null,"client_code": string | null,"client_contact_person": string | null,"client_designation": string | null,"client_do_not_contact": boolean | null,"client_email": string | null,"client_id": string | null,"client_industry": string | null,"client_name": string | null,"client_phone": string | null,"client_priority": string | null,"client_state_country": string | null,"client_website": string | null,"completion_date": string | null,"contract_value": number | null,"created_at": string | null,"created_by": string | null,"date_is_estimated": boolean | null,"id": string | null,"initial_engagement_date": string | null,"last_audit_date": string | null,"last_contacted_on": string | null,"lead_source": string | null,"next_audit_date": string | null,"next_follow_up_on": string | null,"owner_id": string | null,"payment_status": string | null,"remarks": string | null,"scope": string | null,"standard_framework": string | null,"status": string | null,"status_group": Database["public"]['Enums']["status_group"] | null,"status_sort_order": number | null,"surveillance_due_date": string | null,"updated_at": string | null,"valid_from": string | null,"valid_to": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_priority_fkey"
      columns: ["client_priority"]
isOneToOne: false
      referencedRelation: "priorities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagement_financials_payment_status_fkey"
      columns: ["payment_status"]
isOneToOne: false
      referencedRelation: "payment_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_certification_type_fkey"
      columns: ["certification_type"]
isOneToOne: false
      referencedRelation: "certification_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_lead_source_fkey"
      columns: ["lead_source"]
isOneToOne: false
      referencedRelation: "lead_sources"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "engagements_status_fkey"
      columns: ["status"]
isOneToOne: false
      referencedRelation: "statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "active": boolean | null,"booking_link": string | null,"email": string | null,"full_name": string | null,"id": string | null,"role": Database["public"]['Enums']["app_role"] | null
                  }
                  Insert: {
                           "active"?: boolean | null,"booking_link"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null
                         }
                        Update: {
                           "active"?: boolean | null,"booking_link"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "change_engagement_status":
{ Args: { "p_engagement_id": string,"p_new_status": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "owner"|"consultant"|"marketing","status_group": "pipeline"|"delivery"|"active"|"paused"|"ended"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["owner", "consultant", "marketing"],"status_group": ["pipeline", "delivery", "active", "paused", "ended"]
          }
        }
} as const
