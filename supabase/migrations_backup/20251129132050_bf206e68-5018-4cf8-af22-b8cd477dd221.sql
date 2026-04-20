-- Add tax_rate column to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 5.00 CHECK (tax_rate >= 0 AND tax_rate <= 100);

COMMENT ON COLUMN public.companies.tax_rate IS 'Tax/VAT rate percentage applied to invoices (e.g., 5.00 for 5%)';