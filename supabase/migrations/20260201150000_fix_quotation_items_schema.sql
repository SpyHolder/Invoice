-- Comprehensive fix for quotation_items schema mismatch
-- Add missing columns that frontend expects

DO $$
BEGIN
    -- 1. Add item_description to quotation_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'item_description'
    ) THEN
        ALTER TABLE public.quotation_items ADD COLUMN item_description text;
    END IF;

    -- 2. Add disc_percent to quotation_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'disc_percent'
    ) THEN
        ALTER TABLE public.quotation_items ADD COLUMN disc_percent numeric DEFAULT 0;
    END IF;

    -- 3. Add disc_amount to quotation_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'disc_amount'
    ) THEN
        ALTER TABLE public.quotation_items ADD COLUMN disc_amount numeric DEFAULT 0;
    END IF;

    -- 4. Add total_price to quotation_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'total_price'
    ) THEN
        ALTER TABLE public.quotation_items ADD COLUMN total_price numeric DEFAULT 0;
    END IF;

    -- 5. Add uom to quotation_items
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'uom'
    ) THEN
        ALTER TABLE public.quotation_items ADD COLUMN uom text;
    END IF;

    -- 6. Add purchase_order_id reference column (for future linking)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotation_items' AND column_name = 'purchase_order_id'
    ) THEN
        ALTER TABLE public.quotation_items ADD COLUMN purchase_order_id uuid;
    END IF;

END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
