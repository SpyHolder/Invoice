/*
  # FIX: Schema Cache & Missing Column
  
  Script ini akan:
  1. Memastikan kolom 'total' ada di tabel 'purchase_orders'.
  2. Memaksa reload schema cache PostgREST.
*/

-- 1. Pastikan kolom 'total' ada. Jika hilang, buat ulang.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_orders' 
        AND column_name = 'total'
    ) THEN
        ALTER TABLE purchase_orders ADD COLUMN total decimal(15,2) DEFAULT 0;
    END IF;
END $$;

-- 2. Pastikan permission akses terbaca oleh API (Public)
-- Seringkali error cache muncul karena policy RLS yang membingungkan API
DROP POLICY IF EXISTS "Public access purchase_orders" ON purchase_orders;

CREATE POLICY "Public access purchase_orders" 
ON purchase_orders 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. PERINTAH KRUSIAL: Reload Schema Cache
-- Ini memberitahu Supabase API untuk membaca ulang struktur database
NOTIFY pgrst, 'reload schema';