-- Create order_statuses table
CREATE TABLE public.order_statuses (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read statuses
CREATE POLICY "Allow read access to order_statuses"
ON public.order_statuses
FOR SELECT
USING (true);

-- Create policy to allow all users to insert statuses
CREATE POLICY "Allow insert on order_statuses"
ON public.order_statuses
FOR INSERT
WITH CHECK (true);

-- Create policy to allow all users to update statuses
CREATE POLICY "Allow update on order_statuses"
ON public.order_statuses
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Insert default statuses
INSERT INTO public.order_statuses (name, sort_order) VALUES
  ('New', 1),
  ('In Design', 2),
  ('Design Approval', 3),
  ('In Production', 4),
  ('Shipping', 5),
  ('Delivered', 6),
  ('Canceled', 7);