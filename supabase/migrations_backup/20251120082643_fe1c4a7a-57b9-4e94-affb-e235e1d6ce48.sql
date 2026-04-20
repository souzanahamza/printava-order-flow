-- Add color column to order_statuses table
ALTER TABLE public.order_statuses 
ADD COLUMN color TEXT DEFAULT '#6366f1';

-- Update existing statuses with meaningful colors
UPDATE public.order_statuses 
SET color = CASE 
  WHEN LOWER(name) LIKE '%new%' THEN '#3b82f6'
  WHEN LOWER(name) LIKE '%design%' THEN '#8b5cf6'
  WHEN LOWER(name) LIKE '%production%' THEN '#f59e0b'
  WHEN LOWER(name) LIKE '%shipping%' THEN '#10b981'
  WHEN LOWER(name) LIKE '%delivered%' THEN '#22c55e'
  WHEN LOWER(name) LIKE '%cancel%' THEN '#ef4444'
  ELSE '#6366f1'
END
WHERE color IS NULL OR color = '#6366f1';