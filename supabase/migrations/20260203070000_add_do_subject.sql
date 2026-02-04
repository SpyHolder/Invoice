-- Add subject column to delivery_orders table
ALTER TABLE delivery_orders 
ADD COLUMN IF NOT EXISTS subject TEXT;

COMMENT ON COLUMN delivery_orders.subject IS 'Subject/description for this delivery order';
