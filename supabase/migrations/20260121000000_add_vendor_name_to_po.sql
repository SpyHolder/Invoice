-- Add vendor_name column to purchase_orders table
-- This allows text input for vendor name instead of foreign key reference

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_name TEXT;

-- Set default value for existing records (if any)
UPDATE purchase_orders 
SET vendor_name = 'Unknown Vendor' 
WHERE vendor_name IS NULL OR vendor_name = '';

-- Add comment for documentation
COMMENT ON COLUMN purchase_orders.vendor_name IS 'Vendor/supplier name for this purchase order';
