-- Add stock and min_stock columns to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 10;

-- Add index for better performance on stock queries
CREATE INDEX IF NOT EXISTS idx_items_stock ON items(stock);

-- Update RLS policies to allow stock updates
-- (Public access already enabled in previous migration)
