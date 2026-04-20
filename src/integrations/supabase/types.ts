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
          billing_address_line1: string | null
          billing_city: string | null
          billing_country: string | null
          billing_state: string | null
          billing_zip: string | null
          business_name: string | null
          city: string | null
          client_type: string | null
          company_id: string
          created_at: string | null
          currency_id: string | null
          default_currency_id: string | null
          default_pricing_tier_id: string | null
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          salutation: string | null
          secondary_phone: string | null
          shipping_address_line1: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          tax_number: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          billing_address_line1?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          business_name?: string | null
          city?: string | null
          client_type?: string | null
          company_id: string
          created_at?: string | null
          currency_id?: string | null
          default_currency_id?: string | null
          default_pricing_tier_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          salutation?: string | null
          secondary_phone?: string | null
          shipping_address_line1?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          billing_address_line1?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          business_name?: string | null
          city?: string | null
          client_type?: string | null
          company_id?: string
          created_at?: string | null
          currency_id?: string | null
          default_currency_id?: string | null
          default_pricing_tier_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          salutation?: string | null
          secondary_phone?: string | null
          shipping_address_line1?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
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
            foreignKeyName: "clients_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
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
          account_holder_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string | null
          currency_id: string | null
          email: string | null
          iban: string | null
          id: string
          invoice_notes: string | null
          invoice_terms: string | null
          logo_url: string | null
          name: string | null
          owner_id: string | null
          phone: string | null
          swift_code: string | null
          tax_number: string | null
          tax_rate: number | null
          website: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string | null
          currency_id?: string | null
          email?: string | null
          iban?: string | null
          id: string
          invoice_notes?: string | null
          invoice_terms?: string | null
          logo_url?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          swift_code?: string | null
          tax_number?: string | null
          tax_rate?: number | null
          website?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string | null
          currency_id?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          invoice_notes?: string | null
          invoice_terms?: string | null
          logo_url?: string | null
          name?: string | null
          owner_id?: string | null
          phone?: string | null
          swift_code?: string | null
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
      company_sequences: {
        Row: {
          company_id: string
          last_order_number: number | null
        }
        Insert: {
          company_id: string
          last_order_number?: number | null
        }
        Update: {
          company_id?: string
          last_order_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
          external_link: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          order_id: string
          order_item_id: string | null
          uploader_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          external_link?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          order_id: string
          order_item_id?: string | null
          uploader_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          external_link?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
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
          {
            foreignKeyName: "order_attachments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
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
          description: string | null
          id: string
          item_total: number
          needs_design: boolean
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          item_total: number
          needs_design?: boolean
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          item_total?: number
          needs_design?: boolean
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
      order_tasks: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string
          started_at: string | null
          status: string
          task_type: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id: string
          started_at?: string | null
          status: string
          task_type: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string
          started_at?: string | null
          status?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tasks_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tasks_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["name"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string | null
          client_name: string
          company_id: string | null
          created_at: string | null
          currency_id: string | null
          delivery_date: string
          delivery_method: string | null
          email: string | null
          exchange_rate: number
          id: string
          needs_design: boolean
          notes: string | null
          order_number: number | null
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
          delivery_date: string
          delivery_method?: string | null
          email?: string | null
          exchange_rate?: number
          id?: string
          needs_design?: boolean
          notes?: string | null
          order_number?: number | null
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
          delivery_date?: string
          delivery_method?: string | null
          email?: string | null
          exchange_rate?: number
          id?: string
          needs_design?: boolean
          notes?: string | null
          order_number?: number | null
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
          cost_price: number | null
          created_at: string | null
          description: string | null
          group_code: string | null
          id: string
          image_url: string | null
          name_ar: string
          name_en: string
          product_code: string | null
          sku: string
          stock_quantity: number | null
          unit_price: number
          unit_type: string | null
        }
        Insert: {
          category: string
          company_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          group_code?: string | null
          id?: string
          image_url?: string | null
          name_ar: string
          name_en: string
          product_code?: string | null
          sku: string
          stock_quantity?: number | null
          unit_price: number
          unit_type?: string | null
        }
        Update: {
          category?: string
          company_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          group_code?: string | null
          id?: string
          image_url?: string | null
          name_ar?: string
          name_en?: string
          product_code?: string | null
          sku?: string
          stock_quantity?: number | null
          unit_price?: number
          unit_type?: string | null
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
      quotation_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item_total: number
          product_id: string | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item_total: number
          product_id?: string | null
          quantity: number
          quotation_id: string
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item_total?: number
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_id: string | null
          client_name: string
          company_id: string
          created_at: string | null
          currency_id: string | null
          delivery_date: string | null
          email: string | null
          exchange_rate: number
          id: string
          notes: string | null
          phone: string | null
          pricing_tier_id: string | null
          status: string | null
          total_price: number | null
          total_price_company: number | null
          total_price_foreign: number | null
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          client_name: string
          company_id: string
          created_at?: string | null
          currency_id?: string | null
          delivery_date?: string | null
          email?: string | null
          exchange_rate?: number
          id?: string
          notes?: string | null
          phone?: string | null
          pricing_tier_id?: string | null
          status?: string | null
          total_price?: number | null
          total_price_company?: number | null
          total_price_foreign?: number | null
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string
          company_id?: string
          created_at?: string | null
          currency_id?: string | null
          delivery_date?: string | null
          email?: string | null
          exchange_rate?: number
          id?: string
          notes?: string | null
          phone?: string | null
          pricing_tier_id?: string | null
          status?: string | null
          total_price?: number | null
          total_price_company?: number | null
          total_price_foreign?: number | null
          valid_until?: string | null
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
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      task_status_history: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string | null
          id: string
          new_status: string
          notes: string | null
          previous_status: string | null
          task_id: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          new_status: string
          notes?: string | null
          previous_status?: string | null
          task_id: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          new_status?: string
          notes?: string | null
          previous_status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "order_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_statuses_company_id_fkey"
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
      set_order_task_status_with_notes: {
        Args: {
          p_new_status: string
          p_notes: string
          p_only_if_status?: string
          p_only_if_task_type?: string
          p_task_id: string
        }
        Returns: boolean
      }
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
