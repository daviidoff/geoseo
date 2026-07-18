/**
 * TypeScript types for Supabase database schema
 * hyperniche-ai: Agency tool for managing client content
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          website: string | null
          industry: string | null
          brand_voice: string | null
          target_audience: string | null
          competitors: string | null
          products: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          website?: string | null
          industry?: string | null
          brand_voice?: string | null
          target_audience?: string | null
          competitors?: string | null
          products?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          website?: string | null
          industry?: string | null
          brand_voice?: string | null
          target_audience?: string | null
          competitors?: string | null
          products?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          user_id: string
          client_id: string | null
          name: string
          type: 'image' | 'document' | null
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          ai_labels: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id?: string | null
          name: string
          type?: 'image' | 'document' | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          ai_labels?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string | null
          name?: string
          type?: 'image' | 'document' | null
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          ai_labels?: Json
          created_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          user_id: string
          client_id: string
          keyword: string
          intent: string | null
          is_question: boolean
          search_volume: number | null
          difficulty: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          keyword: string
          intent?: string | null
          is_question?: boolean
          search_volume?: number | null
          difficulty?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          keyword?: string
          intent?: string | null
          is_question?: boolean
          search_volume?: number | null
          difficulty?: number | null
          created_at?: string
        }
      }
      blogs: {
        Row: {
          id: string
          user_id: string
          client_id: string
          title: string
          keyword: string | null
          slug: string | null
          content: string | null
          html_content: string | null
          status: 'draft' | 'published'
          word_count: number | null
          meta_description: string | null
          created_at: string
          updated_at: string
          published_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          title: string
          keyword?: string | null
          slug?: string | null
          content?: string | null
          html_content?: string | null
          status?: 'draft' | 'published'
          word_count?: number | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          title?: string
          keyword?: string | null
          slug?: string | null
          content?: string | null
          html_content?: string | null
          status?: 'draft' | 'published'
          word_count?: number | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
          published_at?: string | null
        }
      }
      analyses: {
        Row: {
          id: string
          user_id: string
          client_id: string
          type: 'aeo_mentions' | 'health_check'
          score: number | null
          results: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          type: 'aeo_mentions' | 'health_check'
          score?: number | null
          results?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string
          type?: 'aeo_mentions' | 'health_check'
          score?: number | null
          results?: Json
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          organization: string | null
          user_type: 'self_service' | 'enterprise' | 'admin'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
          plan_type: 'free' | 'pro' | 'business'
          current_period_end: string | null
          credits_remaining: number
          credits_total: number
          onboarding_link: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          organization?: string | null
          user_type?: 'self_service' | 'enterprise' | 'admin'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
          plan_type?: 'free' | 'pro' | 'business'
          current_period_end?: string | null
          credits_remaining?: number
          credits_total?: number
          onboarding_link?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          organization?: string | null
          user_type?: 'self_service' | 'enterprise' | 'admin'
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing'
          plan_type?: 'free' | 'pro' | 'business'
          current_period_end?: string | null
          credits_remaining?: number
          credits_total?: number
          onboarding_link?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: 'purchase' | 'usage' | 'refund' | 'bonus' | 'subscription' | 'subscription_renewal'
          description: string | null
          metadata: Json
          balance_after: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: 'purchase' | 'usage' | 'refund' | 'bonus' | 'subscription' | 'subscription_renewal'
          description?: string | null
          metadata?: Json
          balance_after?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: 'purchase' | 'usage' | 'refund' | 'bonus' | 'subscription' | 'subscription_renewal'
          description?: string | null
          metadata?: Json
          balance_after?: number | null
          created_at?: string
        }
      }
      user_credits: {
        Row: {
          id: string
          user_id: string
          credits_remaining: number
          credits_total: number
          last_credited_at: string | null
          last_deducted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          credits_remaining?: number
          credits_total?: number
          last_credited_at?: string | null
          last_deducted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          credits_remaining?: number
          credits_total?: number
          last_credited_at?: string | null
          last_deducted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      scheduled_runs: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          cron_expression: string
          timezone: string
          job_type: 'keyword_generation' | 'blog_generation' | 'aeo_check'
          job_config: Json
          client_id: string | null
          status: 'active' | 'paused' | 'disabled'
          is_enabled: boolean
          next_run_at: string | null
          last_run_at: string | null
          last_run_status: string | null
          last_error_message: string | null
          error_count: number
          run_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          cron_expression: string
          timezone?: string
          job_type: 'keyword_generation' | 'blog_generation' | 'aeo_check'
          job_config?: Json
          client_id?: string | null
          status?: 'active' | 'paused' | 'disabled'
          is_enabled?: boolean
          next_run_at?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          last_error_message?: string | null
          error_count?: number
          run_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          cron_expression?: string
          timezone?: string
          job_type?: 'keyword_generation' | 'blog_generation' | 'aeo_check'
          job_config?: Json
          client_id?: string | null
          status?: 'active' | 'paused' | 'disabled'
          is_enabled?: boolean
          next_run_at?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          last_error_message?: string | null
          error_count?: number
          run_count?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_credits: {
        Args: {
          p_user_id: string
          p_amount: number
          p_description?: string
        }
        Returns: boolean
      }
      add_credits: {
        Args: {
          p_user_id: string
          p_amount: number
          p_type: string
          p_description?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience exports
export type UserProfile = Tables<'user_profiles'>
export type User = UserProfile  // Alias for backward compatibility
export type Client = Tables<'clients'>
export type Asset = Tables<'assets'>
export type Keyword = Tables<'keywords'>
export type Blog = Tables<'blogs'>
export type Analysis = Tables<'analyses'>
export type CreditTransaction = Tables<'credit_transactions'>
export type ScheduledRun = Tables<'scheduled_runs'>
