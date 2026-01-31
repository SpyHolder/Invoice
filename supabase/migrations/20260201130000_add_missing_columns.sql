-- Add missing columns to support frontend requirements
-- and ensure schema cache is reloaded

DO $$
BEGIN
    -- 1. Add discount_amount to quotations if not exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quotations'
        AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE public.quotations ADD COLUMN discount_amount numeric DEFAULT 0;
    END IF;

    -- 2. Add delivery_address to purchase_orders if not exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'delivery_address'
    ) THEN
        ALTER TABLE public.purchase_orders ADD COLUMN delivery_address text;
    END IF;

    -- 3. Add shipping_info to purchase_orders if not exists (checked from previous sessions/usage)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'shipping_info'
    ) THEN
        ALTER TABLE public.purchase_orders ADD COLUMN shipping_info text;
    END IF;
    
    -- 4. Add quote_ref to purchase_orders if not exists
     IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'quote_ref'
    ) THEN
        ALTER TABLE public.purchase_orders ADD COLUMN quote_ref text;
    END IF;

END $$;

-- Force Schema Cache Reload (Important for Supabase/PostgREST)
NOTIFY pgrst, 'reload config';
