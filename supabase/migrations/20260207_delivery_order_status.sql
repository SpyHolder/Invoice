-- ============================================================================
-- Add Status Column to Delivery Orders
-- Created: 2026-02-07
-- Purpose: Add status tracking for delivery orders
-- ============================================================================

-- Add status column to delivery_orders
ALTER TABLE public.delivery_orders 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' 
    CHECK (status IN ('pending', 'delivered', 'cancelled'));

-- Update existing records to have 'pending' status
UPDATE public.delivery_orders 
SET status = 'pending' 
WHERE status IS NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
