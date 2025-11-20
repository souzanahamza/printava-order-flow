-- Add UPDATE policy for order_attachments
CREATE POLICY "Users can update company attachments"
ON order_attachments
FOR UPDATE
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());