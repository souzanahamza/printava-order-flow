-- Refresh RLS policies for the order-files bucket to authorize by company membership
-- Path format: company_id/order_id/filename

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their company order files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their company order files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company order files" ON storage.objects;

-- Allow users to view files when their profile.company_id matches the first folder
CREATE POLICY "Users can view their company order files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL
  )
);

-- Allow users to upload files into their company folder
CREATE POLICY "Users can upload their company order files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL
  )
);

-- Allow users to delete files from their company folder
CREATE POLICY "Users can delete their company order files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'order-files'
  AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL
  )
);

