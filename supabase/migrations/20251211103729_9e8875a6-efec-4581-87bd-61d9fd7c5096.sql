-- Enable Row Level Security on currencies table
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Add policy allowing authenticated users to read currencies (reference data)
CREATE POLICY "Authenticated users can view currencies"
ON public.currencies
FOR SELECT
TO authenticated
USING (true);