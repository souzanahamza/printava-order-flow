-- Enable RLS on existing tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Create policies for orders table (allow all operations for now - add auth later)
CREATE POLICY "Allow all operations on orders" ON public.orders
  FOR ALL USING (true) WITH CHECK (true);

-- Create policies for products table (allow read for all, modify for admins later)
CREATE POLICY "Allow read access to products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Allow insert on products" ON public.products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on products" ON public.products
  FOR UPDATE USING (true) WITH CHECK (true);

-- Create policies for pricing_tiers table
CREATE POLICY "Allow read access to pricing_tiers" ON public.pricing_tiers
  FOR SELECT USING (true);

CREATE POLICY "Allow insert on pricing_tiers" ON public.pricing_tiers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on pricing_tiers" ON public.pricing_tiers
  FOR UPDATE USING (true) WITH CHECK (true);

-- Create policies for order_items table
CREATE POLICY "Allow all operations on order_items" ON public.order_items
  FOR ALL USING (true) WITH CHECK (true);