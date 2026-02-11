-- Add quote_number column and ensure quotation_number compatibility
-- This ensures compatibility between old and new column names

DO $$
BEGIN
    -- Make quotation_number nullable if it has NOT NULL constraint
    -- This allows us to migrate to quote_number gradually
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotations' 
        AND column_name = 'quotation_number'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.quotations 
        ALTER COLUMN quotation_number DROP NOT NULL;
    END IF;

    -- Check if quote_number column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quotations' 
        AND column_name = 'quote_number'
    ) THEN
        -- Add quote_number column
        ALTER TABLE public.quotations 
        ADD COLUMN quote_number text;
        
        -- Migrate existing data from quotation_number to quote_number
        UPDATE public.quotations 
        SET quote_number = quotation_number 
        WHERE quotation_number IS NOT NULL AND quote_number IS NULL;
        
        -- Add unique constraint
        ALTER TABLE public.quotations 
        ADD CONSTRAINT quotations_quote_number_unique UNIQUE (quote_number);
    END IF;

END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
