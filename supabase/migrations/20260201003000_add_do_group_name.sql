-- Add group_name column to delivery_order_items for dynamic grouping
-- This allows organizing items into multiple groups within a single DO

ALTER TABLE delivery_order_items 
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Update existing records to have a default group
UPDATE delivery_order_items 
SET group_name = 'Default Group' 
WHERE group_name IS NULL;

COMMENT ON COLUMN delivery_order_items.group_name IS 'Dynamic group name for organizing items within a delivery order (e.g., "Equipment", "Materials")';
