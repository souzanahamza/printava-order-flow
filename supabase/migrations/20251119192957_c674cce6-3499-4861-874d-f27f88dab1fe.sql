-- Create storage bucket for order files
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for order-files bucket
CREATE POLICY "Users can view their company order files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'order-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM companies WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload their company order files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'order-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM companies WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company order files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'order-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM companies WHERE id = auth.uid()
  )
);