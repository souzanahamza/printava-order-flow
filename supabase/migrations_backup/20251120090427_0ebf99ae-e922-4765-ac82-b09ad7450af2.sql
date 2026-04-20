-- Fix RLS policies to use get_my_company_id() instead of auth.uid()
-- This allows team members to access their company's data

-- ============================================================
-- PRODUCTS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view their company products" ON products;
CREATE POLICY "Users can view their company products"
ON products FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert their company products" ON products;
CREATE POLICY "Users can insert their company products"
ON products FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update their company products" ON products;
CREATE POLICY "Users can update their company products"
ON products FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can delete their company products" ON products;
CREATE POLICY "Users can delete their company products"
ON products FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ============================================================
-- ORDERS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view their company orders" ON orders;
CREATE POLICY "Users can view their company orders"
ON orders FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert their company orders" ON orders;
CREATE POLICY "Users can insert their company orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update their company orders" ON orders;
CREATE POLICY "Users can update their company orders"
ON orders FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can delete their company orders" ON orders;
CREATE POLICY "Users can delete their company orders"
ON orders FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ============================================================
-- ORDER ITEMS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view their company order items" ON order_items;
CREATE POLICY "Users can view their company order items"
ON order_items FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can insert their company order items" ON order_items;
CREATE POLICY "Users can insert their company order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update their company order items" ON order_items;
CREATE POLICY "Users can update their company order items"
ON order_items FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can delete their company order items" ON order_items;
CREATE POLICY "Users can delete their company order items"
ON order_items FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ============================================================
-- ORDER STATUSES TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select statuses" ON order_statuses;
CREATE POLICY "select statuses"
ON order_statuses FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_default = true);

DROP POLICY IF EXISTS "insert statuses" ON order_statuses;
CREATE POLICY "insert statuses"
ON order_statuses FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "update only own statuses" ON order_statuses;
CREATE POLICY "update only own statuses"
ON order_statuses FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "delete only own statuses" ON order_statuses;
CREATE POLICY "delete only own statuses"
ON order_statuses FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ============================================================
-- PRICING TIERS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "select tiers" ON pricing_tiers;
CREATE POLICY "select tiers"
ON pricing_tiers FOR SELECT
TO authenticated
USING (company_id = get_my_company_id() OR is_default = true);

DROP POLICY IF EXISTS "insert tiers" ON pricing_tiers;
CREATE POLICY "insert tiers"
ON pricing_tiers FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "update only own tiers" ON pricing_tiers;
CREATE POLICY "update only own tiers"
ON pricing_tiers FOR UPDATE
TO authenticated
USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "delete only own tiers" ON pricing_tiers;
CREATE POLICY "delete only own tiers"
ON pricing_tiers FOR DELETE
TO authenticated
USING (company_id = get_my_company_id());

-- ============================================================
-- COMPANIES TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own company" ON companies;
CREATE POLICY "Users can view their own company"
ON companies FOR SELECT
TO authenticated
USING (id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update their own company" ON companies;
CREATE POLICY "Users can update their own company"
ON companies FOR UPDATE
TO authenticated
USING (id = get_my_company_id())
WITH CHECK (id = get_my_company_id());