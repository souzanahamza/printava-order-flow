


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'sales',
    'designer',
    'production',
    'accountant'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_company_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_company_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_company_id uuid;
  v_role text;
  v_company_name text;
BEGIN
  -- 1. Determine role (default to admin for new signups)
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'admin');
  
  -- 2. Check: is user an invited employee (has company_id) or new owner?
  IF (new.raw_user_meta_data->>'company_id') IS NOT NULL THEN
    -- Employee case: use existing company
    v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  ELSE
    -- New owner case (Sign Up): use their ID as company ID
    v_company_id := new.id;
    
    -- Get company name from metadata or use default
    v_company_name := COALESCE(new.raw_user_meta_data->>'company_name', 'My Print Shop');

    -- Create company first
    INSERT INTO public.companies (id, owner_id, name)
    VALUES (v_company_id, new.id, v_company_name)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. Create profile (without role - role is in user_roles now)
  INSERT INTO public.profiles (id, full_name, company_id, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    v_company_id,
    new.email
  );

  -- 4. Create user role entry
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (
    new.id,
    v_role::app_role,
    v_company_id
  );

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- الحالة A: عند إنشاء طلب جديد (INSERT)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.order_status_history (order_id, company_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, NEW.company_id, NULL, NEW.status, auth.uid());
    RETURN NEW;
  
  -- الحالة B: عند تعديل الحالة (UPDATE)
  ELSIF (TG_OP = 'UPDATE') THEN
    -- فقط إذا تغيرت الحالة فعلياً
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      INSERT INTO public.order_status_history (order_id, company_id, previous_status, new_status, changed_by)
      VALUES (NEW.id, NEW.company_id, OLD.status, NEW.status, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_order_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  short_id text := LEFT(NEW.id::text, 8);
  notif_title text;
  notif_msg text;
  target_roles public.app_role[]; -- ✅ مصفوفة من النوع الصحيح
  r public.app_role;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- الأدمن دائماً موجود
    target_roles := ARRAY['admin'::public.app_role]; 

    -- منطق الحالات
    IF NEW.status = 'Ready for Design' THEN
      notif_title := 'New Design Task';
      notif_msg := 'Order #' || short_id || ' is ready to start designing.';
      target_roles := array_append(target_roles, 'designer'::public.app_role);

    ELSIF NEW.status = 'Design Revision' THEN
      notif_title := 'Revision Requested';
      notif_msg := 'Changes requested for Order #' || short_id;
      target_roles := array_append(target_roles, 'designer'::public.app_role);

    ELSIF NEW.status = 'Design Approval' THEN
      notif_title := 'Design Ready for Review';
      notif_msg := 'Designer submitted proof for Order #' || short_id;
      target_roles := array_append(target_roles, 'sales'::public.app_role);

    ELSIF NEW.status = 'Waiting for Print File' THEN
      notif_title := 'Upload Print File';
      notif_msg := 'Design approved. Upload final files for Order #' || short_id;
      target_roles := array_append(target_roles, 'designer'::public.app_role);

    ELSIF NEW.status = 'Pending Payment' THEN
      notif_title := 'Payment Confirmation';
      notif_msg := 'Order #' || short_id || ' is waiting for payment.';
      target_roles := array_append(target_roles, 'accountant'::public.app_role);

    ELSIF NEW.status = 'Ready for Production' THEN
      notif_title := 'New Print Job';
      notif_msg := 'Order #' || short_id || ' is queued for printing.';
      target_roles := array_append(target_roles, 'production'::public.app_role);

    ELSIF NEW.status = 'In Production' THEN
      notif_title := 'Printing Started';
      notif_msg := 'Production started on Order #' || short_id;
      target_roles := array_append(target_roles, 'sales'::public.app_role);

    ELSIF NEW.status = 'Ready for Pickup' THEN
      notif_title := 'Order Ready';
      notif_msg := 'Order #' || short_id || ' is ready for handover.';
      target_roles := array_append(target_roles, 'sales'::public.app_role);      
      target_roles := array_append(target_roles, 'accountant'::public.app_role);

    ELSIF NEW.status = 'Delivered' THEN
      notif_title := 'Order Delivered';
      notif_msg := 'Order #' || short_id || ' has been delivered successfully.';
    
    ELSE
      RETURN NEW;
    END IF;

    -- الإرسال
    FOREACH r IN ARRAY (SELECT ARRAY(SELECT DISTINCT UNNEST(target_roles)))
    LOOP
      INSERT INTO public.notifications (company_id, target_role, title, message, link)
      VALUES (NEW.company_id, r, notif_title, notif_msg, '/orders');
    END LOOP;

  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_order_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_number INTEGER;
BEGIN
    -- نحاول تحديث العداد للشركة، وإذا لم يكن موجوداً ننشئه (Upsert)
    INSERT INTO public.company_sequences (company_id, last_order_number)
    VALUES (NEW.company_id, 1)
    ON CONFLICT (company_id)
    DO UPDATE SET last_order_number = company_sequences.last_order_number + 1
    RETURNING last_order_number INTO next_number;

    -- تعيين الرقم للطلب الجديد
    NEW.order_number := next_number;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "business_name" "text",
    "email" "text",
    "phone" "text",
    "secondary_phone" "text",
    "tax_number" "text",
    "address" "text",
    "city" "text",
    "default_pricing_tier_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "default_currency_id" "uuid",
    "client_type" "text" DEFAULT 'business'::"text",
    "salutation" "text",
    "first_name" "text",
    "last_name" "text",
    "billing_address_line1" "text",
    "billing_city" "text",
    "billing_state" "text",
    "billing_zip" "text",
    "billing_country" "text" DEFAULT 'UAE'::"text",
    "payment_terms" "text" DEFAULT 'Due on Receipt'::"text",
    "currency_id" "uuid",
    "shipping_address_line1" "text",
    "shipping_city" "text",
    "shipping_state" "text",
    "shipping_zip" "text",
    "shipping_country" "text" DEFAULT 'UAE'::"text",
    CONSTRAINT "clients_client_type_check" CHECK (("client_type" = ANY (ARRAY['business'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "tax_number" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "address" "text",
    "invoice_notes" "text" DEFAULT 'Thank you for your business.'::"text",
    "invoice_terms" "text" DEFAULT 'Payment is due within 15 days.'::"text",
    "tax_rate" numeric(5,2) DEFAULT 5.00,
    "currency_id" "uuid",
    "bank_name" "text",
    "account_holder_name" "text",
    "account_number" "text",
    "iban" "text",
    "swift_code" "text",
    CONSTRAINT "companies_tax_rate_check" CHECK ((("tax_rate" >= (0)::numeric) AND ("tax_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."companies"."tax_rate" IS 'Tax/VAT rate percentage applied to invoices (e.g., 5.00 for 5%)';



CREATE TABLE IF NOT EXISTS "public"."company_sequences" (
    "company_id" "uuid" NOT NULL,
    "last_order_number" integer DEFAULT 0
);


ALTER TABLE "public"."company_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."currencies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exchange_rates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "currency_id" "uuid" NOT NULL,
    "rate_to_company_currency" numeric NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exchange_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid",
    "title" "text" NOT NULL,
    "message" "text",
    "link" "text",
    "is_read" boolean DEFAULT false,
    "target_user_id" "uuid",
    "target_role" "public"."app_role"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_attachments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "uploader_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "external_link" "text",
    CONSTRAINT "order_attachments_file_type_check" CHECK (("file_type" = ANY (ARRAY['client_reference'::"text", 'design_mockup'::"text", 'print_file'::"text", 'invoice'::"text", 'delivery_note'::"text", 'archived_mockup'::"text"])))
);


ALTER TABLE "public"."order_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric NOT NULL,
    "item_total" numeric NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "company_id" "uuid",
    "description" "text",
    CONSTRAINT "order_items_item_total_check" CHECK (("item_total" >= (0)::numeric)),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "previous_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "action_details" "text"
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_statuses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "company_id" "uuid",
    "is_default" boolean DEFAULT false,
    "color" "text" DEFAULT '#6366f1'::"text"
);


ALTER TABLE "public"."order_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "client_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "delivery_date" timestamp with time zone NOT NULL,
    "delivery_method" "text",
    "pricing_tier_id" "uuid",
    "status" "text" DEFAULT 'New'::"text",
    "notes" "text",
    "total_price" numeric,
    "company_id" "uuid",
    "needs_design" boolean DEFAULT true NOT NULL,
    "client_id" "uuid",
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'pending'::"text",
    "paid_amount" numeric DEFAULT 0,
    "currency_id" "uuid",
    "exchange_rate" numeric DEFAULT 1.0 NOT NULL,
    "total_price_foreign" numeric DEFAULT 0,
    "total_price_company" numeric DEFAULT 0,
    "order_number" integer
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."needs_design" IS 'Indicates whether this order requires design work from the design team';



COMMENT ON COLUMN "public"."orders"."paid_amount" IS 'Amount paid by customer (for deposits/partial payments)';



CREATE TABLE IF NOT EXISTS "public"."pricing_tiers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text",
    "markup_percent" numeric NOT NULL,
    "company_id" "uuid",
    "is_default" boolean DEFAULT false
);


ALTER TABLE "public"."pricing_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "sku" "text" NOT NULL,
    "product_code" "text",
    "name_ar" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "category" "text" NOT NULL,
    "unit_price" numeric NOT NULL,
    "image_url" "text",
    "description" "text",
    "stock_quantity" numeric,
    "company_id" "uuid",
    "group_code" "text",
    "unit_type" "text" DEFAULT 'pcs'::"text",
    "cost_price" numeric DEFAULT 0
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."stock_quantity" IS 'stock_quantity';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "company_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "unit_price" numeric NOT NULL,
    "item_total" numeric NOT NULL,
    "company_id" "uuid",
    "description" "text",
    CONSTRAINT "quotation_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."quotation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "client_id" "uuid",
    "client_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "valid_until" "date",
    "status" "text" DEFAULT 'Draft'::"text",
    "notes" "text",
    "currency_id" "uuid",
    "exchange_rate" numeric DEFAULT 1.0 NOT NULL,
    "total_price" numeric,
    "total_price_foreign" numeric DEFAULT 0,
    "total_price_company" numeric DEFAULT 0,
    "pricing_tier_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "delivery_date" "date",
    CONSTRAINT "quotations_status_check" CHECK (("status" = ANY (ARRAY['Draft'::"text", 'Sent'::"text", 'Accepted'::"text", 'Rejected'::"text", 'Converted'::"text"])))
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_sequences"
    ADD CONSTRAINT "company_sequences_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_attachments"
    ADD CONSTRAINT "order_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_comments"
    ADD CONSTRAINT "order_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_statuses"
    ADD CONSTRAINT "order_statuses_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."order_statuses"
    ADD CONSTRAINT "order_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_tiers"
    ADD CONSTRAINT "pricing_tiers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."pricing_tiers"
    ADD CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "unique_client_phone_per_company" UNIQUE ("company_id", "phone");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "unique_sku_per_company" UNIQUE ("company_id", "sku");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");



CREATE OR REPLACE TRIGGER "assign_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "on_order_notification" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."notify_order_status_change"();



CREATE OR REPLACE TRIGGER "on_order_status_change" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."log_order_status_change"();



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_default_currency_id_fkey" FOREIGN KEY ("default_currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_default_pricing_tier_id_fkey" FOREIGN KEY ("default_pricing_tier_id") REFERENCES "public"."pricing_tiers"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_sequences"
    ADD CONSTRAINT "company_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."exchange_rates"
    ADD CONSTRAINT "exchange_rates_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_attachments"
    ADD CONSTRAINT "order_attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."order_attachments"
    ADD CONSTRAINT "order_attachments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_attachments"
    ADD CONSTRAINT "order_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_comments"
    ADD CONSTRAINT "order_comments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."order_comments"
    ADD CONSTRAINT "order_comments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_comments"
    ADD CONSTRAINT "order_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "public"."pricing_tiers"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "public"."pricing_tiers"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete roles" ON "public"."user_roles" FOR DELETE USING (("public"."is_admin"() AND ("company_id" = "public"."get_my_company_id"()) AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "Admins can delete team members" ON "public"."profiles" FOR DELETE USING (("public"."is_admin"() AND ("company_id" = "public"."get_my_company_id"()) AND ("id" <> "auth"."uid"())));



CREATE POLICY "Admins can insert roles" ON "public"."user_roles" FOR INSERT WITH CHECK (("public"."is_admin"() AND ("company_id" = "public"."get_my_company_id"())));



CREATE POLICY "Admins can update roles" ON "public"."user_roles" FOR UPDATE USING (("public"."is_admin"() AND ("company_id" = "public"."get_my_company_id"()) AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "Admins can update team members" ON "public"."profiles" FOR UPDATE USING (("public"."is_admin"() AND ("company_id" = "public"."get_my_company_id"())));



CREATE POLICY "Authenticated users can view currencies" ON "public"."currencies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public can view currencies" ON "public"."currencies" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "System can insert profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users access own quotation items" ON "public"."quotation_items" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users access own quotations" ON "public"."quotations" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can add comments" ON "public"."order_comments" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can create their own company" ON "public"."companies" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Users can delete their company clients" ON "public"."clients" FOR DELETE USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can delete their company order items" ON "public"."order_items" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can delete their company orders" ON "public"."orders" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can delete their company products" ON "public"."products" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can insert history of own company" ON "public"."order_status_history" FOR INSERT WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can insert their company clients" ON "public"."clients" FOR INSERT WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can insert their company order items" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can insert their company orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can insert their company products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can manage their company rates" ON "public"."exchange_rates" USING (("company_id" = "public"."get_my_company_id"())) WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update company attachments" ON "public"."order_attachments" FOR UPDATE USING (("company_id" = "public"."get_my_company_id"())) WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update history of own company" ON "public"."order_status_history" FOR UPDATE USING (("company_id" = "public"."get_my_company_id"())) WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update their company clients" ON "public"."clients" FOR UPDATE USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update their company order items" ON "public"."order_items" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"())) WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update their company orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"())) WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update their company products" ON "public"."products" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"())) WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can update their own company" ON "public"."companies" FOR UPDATE TO "authenticated" USING (("id" = "public"."get_my_company_id"())) WITH CHECK (("id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can upload to company" ON "public"."order_attachments" FOR INSERT WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view colleagues" ON "public"."profiles" FOR SELECT USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view company attachments" ON "public"."order_attachments" FOR SELECT USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view company comments" ON "public"."order_comments" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view company roles" ON "public"."user_roles" FOR SELECT USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view history of own company" ON "public"."order_status_history" FOR SELECT USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view their company clients" ON "public"."clients" FOR SELECT USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view their company order items" ON "public"."order_items" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view their company orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view their company products" ON "public"."products" FOR SELECT TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "Users can view their own company" ON "public"."companies" FOR SELECT TO "authenticated" USING (("id" = "public"."get_my_company_id"()));



CREATE POLICY "Users see their own notifications" ON "public"."notifications" FOR SELECT USING ((("target_user_id" = "auth"."uid"()) OR ("target_role" IN ( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users update their own notifications" ON "public"."notifications" FOR UPDATE USING ((("target_user_id" = "auth"."uid"()) OR ("target_role" IN ( SELECT "user_roles"."role"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete only own statuses" ON "public"."order_statuses" FOR DELETE USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "delete only own tiers" ON "public"."pricing_tiers" FOR DELETE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



ALTER TABLE "public"."exchange_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert statuses" ON "public"."order_statuses" FOR INSERT WITH CHECK (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "insert tiers" ON "public"."pricing_tiers" FOR INSERT TO "authenticated" WITH CHECK (("company_id" = "public"."get_my_company_id"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select statuses" ON "public"."order_statuses" FOR SELECT USING ((("company_id" = "public"."get_my_company_id"()) OR ("company_id" IS NULL)));



CREATE POLICY "select tiers" ON "public"."pricing_tiers" FOR SELECT TO "authenticated" USING ((("company_id" = "public"."get_my_company_id"()) OR ("is_default" = true)));



CREATE POLICY "update only own statuses" ON "public"."order_statuses" FOR UPDATE USING (("company_id" = "public"."get_my_company_id"()));



CREATE POLICY "update only own tiers" ON "public"."pricing_tiers" FOR UPDATE TO "authenticated" USING (("company_id" = "public"."get_my_company_id"()));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_my_company_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_company_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_company_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_order_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_order_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_order_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_order_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";


















GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_sequences" TO "anon";
GRANT ALL ON TABLE "public"."company_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."company_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."currencies" TO "anon";
GRANT ALL ON TABLE "public"."currencies" TO "authenticated";
GRANT ALL ON TABLE "public"."currencies" TO "service_role";



GRANT ALL ON TABLE "public"."exchange_rates" TO "anon";
GRANT ALL ON TABLE "public"."exchange_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."exchange_rates" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_attachments" TO "anon";
GRANT ALL ON TABLE "public"."order_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."order_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."order_comments" TO "anon";
GRANT ALL ON TABLE "public"."order_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."order_comments" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."order_statuses" TO "anon";
GRANT ALL ON TABLE "public"."order_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."order_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_tiers" TO "anon";
GRANT ALL ON TABLE "public"."pricing_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_items" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































