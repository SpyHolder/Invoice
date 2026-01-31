-- Add gst_rate to quotations
-- and force schema cache reload

DO $$
BEGIN
    -- 1. Add gst_rate to quotations if not exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'quotations'
        AND column_name = 'gst_rate'
    ) THEN
        ALTER TABLE public.quotations ADD COLUMN gst_rate numeric DEFAULT 0;
    END IF;

END $$;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
