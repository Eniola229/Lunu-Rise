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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          is_active: boolean | null
          session_started_at: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          is_active?: boolean | null
          session_started_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          is_active?: boolean | null
          session_started_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversion_rates: {
        Row: {
          country_code: string
          currency: string
          currency_symbol: string
          id: string
          rate_to_usd: number
          updated_at: string | null
        }
        Insert: {
          country_code: string
          currency: string
          currency_symbol: string
          id?: string
          rate_to_usd: number
          updated_at?: string | null
        }
        Update: {
          country_code?: string
          currency?: string
          currency_symbol?: string
          id?: string
          rate_to_usd?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      crypto_deposits: {
        Row: {
          admin_id: string | null
          admin_note: string | null
          amount_crypto: number | null
          amount_usd_cents: number | null
          created_at: string | null
          currency: string
          id: string
          plan_id: string | null
          proof_path: string | null
          status: string
          tx_hash: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_note?: string | null
          amount_crypto?: number | null
          amount_usd_cents?: number | null
          created_at?: string | null
          currency?: string
          id?: string
          plan_id?: string | null
          proof_path?: string | null
          status?: string
          tx_hash: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string | null
          admin_note?: string | null
          amount_crypto?: number | null
          amount_usd_cents?: number | null
          created_at?: string | null
          currency?: string
          id?: string
          plan_id?: string | null
          proof_path?: string | null
          status?: string
          tx_hash?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crypto_deposits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount_usd_cents: number
          client_ref: string | null
          confirmed_at: string | null
          created_at: string | null
          currency: string | null
          fx_at: string | null
          fx_rate: number | null
          gateway: string | null
          gateway_ref: string | null
          id: string
          local_amount: number | null
          local_amount_cents: number | null
          local_currency: string | null
          mch_order_no: string | null
          method: string
          plan_id: string
          screenshot_url: string | null
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          amount_usd_cents: number
          client_ref?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          fx_at?: string | null
          fx_rate?: number | null
          gateway?: string | null
          gateway_ref?: string | null
          id?: string
          local_amount?: number | null
          local_amount_cents?: number | null
          local_currency?: string | null
          mch_order_no?: string | null
          method: string
          plan_id: string
          screenshot_url?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          amount_usd_cents?: number
          client_ref?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string | null
          fx_at?: string | null
          fx_rate?: number | null
          gateway?: string | null
          gateway_ref?: string | null
          id?: string
          local_amount?: number | null
          local_amount_cents?: number | null
          local_currency?: string | null
          mch_order_no?: string | null
          method?: string
          plan_id?: string
          screenshot_url?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          country_code: string
          currency: string
          currency_symbol: string
          id: string
          rate_to_usd: number
          updated_at: string
        }
        Insert: {
          country_code: string
          currency: string
          currency_symbol: string
          id?: string
          rate_to_usd: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          currency?: string
          currency_symbol?: string
          id?: string
          rate_to_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      gateway_logs: {
        Row: {
          created_at: string | null
          deposit_id: string | null
          id: string
          payload: Json | null
          type: string
          withdrawal_id: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          payload?: Json | null
          type: string
          withdrawal_id?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          payload?: Json | null
          type?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateway_logs_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_logs_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      income_events: {
        Row: {
          amount_cents: number
          created_at: string | null
          deposit_id: string
          drop_number: number
          due_at: string
          id: string
          processed_at: string | null
          processed_bool: boolean | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          deposit_id: string
          drop_number: number
          due_at: string
          id?: string
          processed_at?: string | null
          processed_bool?: boolean | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          deposit_id?: string
          drop_number?: number
          due_at?: string
          id?: string
          processed_at?: string | null
          processed_bool?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_events_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_log: {
        Row: {
          created_at: string | null
          error_count: number | null
          execution_time_ms: number | null
          id: string
          job: string
          payload: Json | null
          processed_count: number | null
          server_time_utc: string | null
          skipped_count: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          execution_time_ms?: number | null
          id?: string
          job: string
          payload?: Json | null
          processed_count?: number | null
          server_time_utc?: string | null
          skipped_count?: number | null
          started_at?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          execution_time_ms?: number | null
          id?: string
          job?: string
          payload?: Json | null
          processed_count?: number | null
          server_time_utc?: string | null
          skipped_count?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          id: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          config: Json
          country_code: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          country_code: string
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          country_code?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          type: string
          updated_at: string
          usdt_network: string | null
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          type: string
          updated_at?: string
          usdt_network?: string | null
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          type?: string
          updated_at?: string
          usdt_network?: string | null
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string | null
          deposit_usd: number
          drops_count: number
          id: string
          is_locked: boolean | null
          name: string
          payout_per_drop_usd: number
          sort_order: number | null
          total_return_usd: number
        }
        Insert: {
          created_at?: string | null
          deposit_usd: number
          drops_count: number
          id?: string
          is_locked?: boolean | null
          name: string
          payout_per_drop_usd: number
          sort_order?: number | null
          total_return_usd: number
        }
        Update: {
          created_at?: string | null
          deposit_usd?: number
          drops_count?: number
          id?: string
          is_locked?: boolean | null
          name?: string
          payout_per_drop_usd?: number
          sort_order?: number | null
          total_return_usd?: number
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_cents: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_cents: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_cents?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_withdraw_enabled: boolean | null
          avatar_url: string | null
          country: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          referral_code: string | null
          referrer_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_withdraw_enabled?: boolean | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_withdraw_enabled?: boolean | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          bonus_cents: number
          bonus_percentage: number | null
          created_at: string | null
          deposit_id: string | null
          id: string
          level: number
          referred_id: string
          referrer_id: string
          status: string | null
        }
        Insert: {
          bonus_cents: number
          bonus_percentage?: number | null
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          level: number
          referred_id: string
          referrer_id: string
          status?: string | null
        }
        Update: {
          bonus_cents?: number
          bonus_percentage?: number | null
          created_at?: string | null
          deposit_id?: string | null
          id?: string
          level?: number
          referred_id?: string
          referrer_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      usdt_rates: {
        Row: {
          currency: string
          id: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          currency: string
          id?: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          currency?: string
          id?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          country: string
          created_at: string | null
          email: string
          email_verified: boolean | null
          id: string
          is_admin: boolean | null
          name: string | null
          phone: string | null
          referrer_id: string | null
        }
        Insert: {
          country: string
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          id?: string
          is_admin?: boolean | null
          name?: string | null
          phone?: string | null
          referrer_id?: string | null
        }
        Update: {
          country?: string
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          id?: string
          is_admin?: boolean | null
          name?: string | null
          phone?: string | null
          referrer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number | null
          created_at: string | null
          id: string
          meta: Json | null
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents?: number | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_cents: number | null
          created_at: string | null
          id: string
          pending_cents: number | null
          total_earned_cents: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_cents?: number | null
          created_at?: string | null
          id?: string
          pending_cents?: number | null
          total_earned_cents?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_cents?: number | null
          created_at?: string | null
          id?: string
          pending_cents?: number | null
          total_earned_cents?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          gateway: string | null
          gateway_name: string
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string
          signature_ok: boolean | null
          source_ip: string | null
        }
        Insert: {
          event_id: string
          gateway?: string | null
          gateway_name: string
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string
          signature_ok?: boolean | null
          source_ip?: string | null
        }
        Update: {
          event_id?: string
          gateway?: string | null
          gateway_name?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string
          signature_ok?: boolean | null
          source_ip?: string | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount_cents: number
          created_at: string | null
          fee_cents: number
          fx_at: string | null
          fx_rate: number | null
          id: string
          local_amount: number | null
          local_currency: string | null
          net_cents: number
          next_attempt: string | null
          payment_ref: string | null
          processed_at: string | null
          retry_count: number | null
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          fee_cents: number
          fx_at?: string | null
          fx_rate?: number | null
          id?: string
          local_amount?: number | null
          local_currency?: string | null
          net_cents: number
          next_attempt?: string | null
          payment_ref?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          fee_cents?: number
          fx_at?: string | null
          fx_rate?: number | null
          id?: string
          local_amount?: number | null
          local_currency?: string | null
          net_cents?: number
          next_attempt?: string | null
          payment_ref?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_income_event_atomic: {
        Args: {
          amount_cents: number
          deposit_id: string
          drop_number: number
          event_id: string
          user_id: string
        }
        Returns: Json
      }
      reserve_withdrawal: {
        Args: { p_amount: number; p_fee: number; p_user_id: string }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const
