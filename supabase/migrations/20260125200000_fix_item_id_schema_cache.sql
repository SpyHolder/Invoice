/*
  # FIX: Ensure item_id column exists and reload schema cache
  
  This migration addresses the PGRST204 error:
  "Could not find the 'item_id' column ... in the schema cache"
  
  Actions:
  1. Re-add item_id column if missing (idempotent).
  2. Reload Supabase schema cache.
*/

-- 1. Ensure quotation_items has item_id
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

-- 2. Ensure invoice_items has item_id
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

-- 3. Ensure delivery_order_items has item_id
ALTER TABLE delivery_order_items
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE SET NULL;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
