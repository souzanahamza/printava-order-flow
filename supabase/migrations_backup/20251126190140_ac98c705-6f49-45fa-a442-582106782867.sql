-- Add payment fields to orders table
ALTER TABLE public.orders 
ADD COLUMN payment_method TEXT,
ADD COLUMN payment_status TEXT DEFAULT 'pending';