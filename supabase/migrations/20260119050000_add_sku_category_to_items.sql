-- Add missing SKU and Category columns to items table
-- This fixes the 400 Bad Request errors when adding/editing items

-- Add SKU column (nullable for flexible adoption)
ALTER TABLE items ADD COLUMN IF NOT EXISTS sku TEXT;

-- Add Category column (nullable)
ALTER TABLE items ADD COLUMN IF NOT EXISTS category TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

-- Update existing items to have empty strings instead of NULL for consistency
UPDATE items SET sku = '' WHERE sku IS NULL;
UPDATE items SET category = '' WHERE category IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN items.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN items.category IS 'Product category for filtering and organization';
