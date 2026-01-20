# Database Migration: Add Stock Columns

## Important - Run This Migration!

You need to run the new migration to add stock tracking:

### Option 1: Supabase Dashboard (SQL Editor)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy the contents of `supabase/migrations/20260119040000_add_stock_to_items.sql`
5. Paste and click **Run**

### Option 2: Supabase CLI
```bash
supabase db push
```

This migration adds:
- `stock` column (default 0)
- `min_stock` column (default 10)
- Index for better performance

After running, the Items module will support stock management!
