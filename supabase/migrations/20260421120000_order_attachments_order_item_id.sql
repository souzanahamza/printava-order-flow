-- Line-item scoped attachments (proofs / print files per order_items row).
-- Safe if applied after a manual ALTER (IF NOT EXISTS).

ALTER TABLE public.order_attachments
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_order_attachments_item_id ON public.order_attachments (order_item_id);
