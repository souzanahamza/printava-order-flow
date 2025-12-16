-- Add action_details column to order_status_history table
ALTER TABLE public.order_status_history 
ADD COLUMN action_details text;