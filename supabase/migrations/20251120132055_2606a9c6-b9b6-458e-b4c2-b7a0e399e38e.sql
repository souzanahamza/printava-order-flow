-- Add needs_design column to orders table
ALTER TABLE public.orders
ADD COLUMN needs_design BOOLEAN NOT NULL DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN public.orders.needs_design IS 'Indicates whether this order requires design work from the design team';