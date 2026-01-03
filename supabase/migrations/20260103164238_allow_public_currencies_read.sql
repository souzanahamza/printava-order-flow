-- Allow unauthenticated users to read currencies (needed for signup page)
-- Currencies are reference data that should be publicly readable

CREATE POLICY "Public can view currencies"
ON public.currencies
FOR SELECT
TO anon, authenticated
USING (true);

