/*
  # Fix RLS Policies untuk Schema Tanpa user_id
  
  Schema ini tidak menggunakan user_id untuk multi-tenancy.
  Update policies untuk menggunakan public access.
*/

-- Drop old RLS policies jika ada
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.customers;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.items;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.invoices;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.quotations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.quotations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.quotations;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.quotations;

-- Enable RLS (jika belum)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- Create new public access policies
-- CATATAN: Ini memberikan akses publik ke semua data
-- Untuk production, sebaiknya gunakan user_id atau auth.uid() untuk data isolation

CREATE POLICY "Public access customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access items" ON items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access invoice_items" ON invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access quotation_items" ON quotation_items FOR ALL USING (true) WITH CHECK (true);
