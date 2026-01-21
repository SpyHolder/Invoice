-- Comprehensive Database Schema Fixes for Business ERP
-- This migration adds missing columns to match frontend expectations

-- ============================================
-- 1. Fix Purchase Orders Table
-- ============================================
-- Add missing columns: vendor_name and total
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS total DECIMAL(10,2);

-- Update total column with existing subtotals
UPDATE purchase_orders SET total = subtotal WHERE total IS NULL;

-- ============================================
-- 2. Fix Quotation Items Table
-- ============================================
-- Add item_id column to link quotation items to inventory
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

-- Try to populate item_id by matching item_name to items table
UPDATE quotation_items qi
SET item_id = i.id
FROM items i
WHERE qi.item_name = i.name
AND qi.item_id IS NULL;

-- ============================================
-- 3. Fix Invoice Items Table (if needed)
-- ============================================
-- Add item_id column to link invoice items to inventory
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

-- Try to populate item_id by matching item_name to items table
UPDATE invoice_items ii
SET item_id = i.id
FROM items i
WHERE ii.item_name = i.name
AND ii.item_id IS NULL;

-- ============================================
-- 4. Create indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quotation_items_item_id ON quotation_items(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_id ON invoice_items(item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item_id ON purchase_order_items(item_id);

-- ============================================
-- 5. Verify the changes
-- ============================================
-- You can run these queries to verify:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_orders';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quotation_items';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoice_items';
