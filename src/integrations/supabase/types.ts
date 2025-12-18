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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          business_name: string | null
          city: string | null
          company_id: string
          created_at: string | null
          default_currency_id: string | null
          default_pricing_tier_id: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          secondary_phone: string | null
          tax_number: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          company_id: string
          created_at?: string | null
          default_currency_id?: string | null
          default_pricing_tier_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          secondary_phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          company_id?: string
          created_at?: string | null
          default_currency_id?: string | null
          default_pricing_tier_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          secondary_phone?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_default_currency_id_fkey"
            columns: ["default_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_default_pricing_tier_id_fkey"
            columns: ["default_pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          currency_id: string | null
          email: string | null
          id: string
          invoice_notes: string | null
          invoice_terms: string | null
          logo_url: string | null
          name: string | null
          owner_id: string | null
          phone: string | null
          tax_number: string | null
          tax_rate: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          currency_id?: string | null
          email?: string | null
          id: string
          invoice_notes?: string | null
          invoice_terms?: string | null
          logo_url?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          currency_id?: string | null
          email?: string | null
          id?: string
          invoice_notes?: string | null
          invoice_terms?: string | null
          logo_url?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          company_id: string
          created_at: string | null
          currency_id: string
          id: string
          is_active: boolean | null
          rate_to_company_currency: number
          valid_from: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          currency_id: string
          id?: string
          is_active?: boolean | null
          rate_to_company_currency: number
          valid_from?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          currency_id?: string
          id?: string
          is_active?: boolean | null
          rate_to_company_currency?: number
          valid_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rates_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          company_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          order_id: string
          uploader_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          order_id: string
          uploader_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          order_id?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          company_id: string
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          order_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          order_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          item_total: number
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          item_total: number
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          item_total?: number
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          action_details: string | null
          changed_by: string | null
          company_id: string
          created_at: string | null
          id: string
          new_status: string
          order_id: string
          previous_status: string | null
        }
        Insert: {
          action_details?: string | null
          changed_by?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          new_status: string
          order_id: string
          previous_status?: string | null
        }
        Update: {
          action_details?: string | null
          changed_by?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          new_status?: string
          order_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_statuses: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order: number
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          client_id: string | null
          client_name: string
          company_id: string | null
          created_at: string | null
          currency_id: string | null
          delivery_date: string | Date
          delivery_method: string | null
          email: string
          exchange_rate: number
          id: string
          needs_design: boolean
          notes: string | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          phone: string | null
          pricing_tier_id: string | null
          status: string | null
          total_price: number | null
          total_price_company: number | null
          total_price_foreign: number | null
        }
        Insert: {
          client_id?: string | null
          client_name: string
          company_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          delivery_date: string | Date
          delivery_method?: string | null
          email: string
          exchange_rate?: number
          id?: string
          needs_design?: boolean
          notes?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          pricing_tier_id?: string | null
          status?: string | null
          total_price?: number | null
          total_price_company?: number | null
          total_price_foreign?: number | null
        }
        Update: {
          client_id?: string | null
          client_name?: string
          company_id?: string | null
          created_at?: string | null
          currency_id?: string | null
          delivery_date?: string | Date
          delivery_method?: string | null
          email?: string
          exchange_rate?: number
          id?: string
          needs_design?: boolean
          notes?: string | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          pricing_tier_id?: string | null
          status?: string | null
          total_price?: number | null
          total_price_company?: number | null
          total_price_foreign?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          id: string
          client_id: string | null
          client_name: string
          email: string
          phone: string | null
          valid_until: string | Date | null
          pricing_tier_id: string | null
          notes: string | null
          created_at: string | null
          company_id: string | null
          currency_id: string | null
          exchange_rate: number
          total_price: number | null
          total_price_foreign: number | null
          total_price_company: number | null
          status: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          client_name: string
          email: string
          phone?: string | null
          valid_until?: string | Date | null
          pricing_tier_id?: string | null
          notes?: string | null
          created_at?: string | null
          company_id?: string | null
          currency_id?: string | null
          exchange_rate?: number
          total_price?: number | null
          total_price_foreign?: number | null
          total_price_company?: number | null
          status?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          client_name?: string
          email?: string
          phone?: string | null
          valid_until?: string | Date | null
          pricing_tier_id?: string | null
          notes?: string | null
          created_at?: string | null
          company_id?: string | null
          currency_id?: string | null
          exchange_rate?: number
          total_price?: number | null
          total_price_foreign?: number | null
          total_price_company?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          id: string
          quotation_id: string
          product_id: string
          quantity: number
          unit_price: number
          item_total: number
          company_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          quotation_id: string
          product_id: string
          quantity: number
          unit_price: number
          item_total: number
          company_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          quotation_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          item_total?: number
          company_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          company_id: string | null
          id: string
          is_default: boolean | null
          label: string | null
          markup_percent: number
          name: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          markup_percent: number
          name: string
        }
        Update: {
          company_id?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          markup_percent?: number
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name_ar: string
          name_en: string
          product_code: string | null
          sku: string
          stock_quantity: number | null
          unit_price: number
        }
        Insert: {
          category: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name_ar: string
          name_en: string
          product_code?: string | null
          sku: string
          stock_quantity?: number | null
          unit_price: number
        }
        Update: {
          category?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name_ar?: string
          name_en?: string
          product_code?: string | null
          sku?: string
          stock_quantity?: number | null
          unit_price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_company_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "sales" | "designer" | "production" | "accountant"
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
      app_role: ["admin", "sales", "designer", "production", "accountant"],
    },
  },
} as const
