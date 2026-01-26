/*
  # Fix Purchase Orders Schema
  
  ## Changes
  - Add user_id column to purchase_orders if it's missing
  - Reload schema cache to ensure API picks up the change
*/

-- 1. Add user_id column explicitly if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'purchase_orders'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE purchase_orders 
        ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Force schema cache reload
NOTIFY pgrst, 'reload schema';
