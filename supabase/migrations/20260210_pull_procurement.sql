-- Migration: Pull Procurement Schema Update
-- Add qty_backordered and qty_reserved columns to sales_order_items

-- Add qty_backordered - tracks shortage that needs to be procured
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS qty_backordered integer DEFAULT 0;

-- Add qty_reserved - tracks quantity reserved from existing stock
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS qty_reserved integer DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.sales_order_items.qty_backordered IS 'Quantity that could not be fulfilled from stock, needs procurement';
COMMENT ON COLUMN public.sales_order_items.qty_reserved IS 'Quantity successfully reserved from available stock';
