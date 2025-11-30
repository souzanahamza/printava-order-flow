-- Add paid_amount column to orders table to track partial payments
ALTER TABLE orders 
ADD COLUMN paid_amount numeric DEFAULT 0;

COMMENT ON COLUMN orders.paid_amount IS 'Amount paid by customer (for deposits/partial payments)';
