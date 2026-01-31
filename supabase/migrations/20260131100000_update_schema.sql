-- 1. MASTER DATA: COMPANIES & BANKING (Untuk Header & Footer Invoice)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL, -- Nama Perusahaan Kamu
  address text,
  phone text,
  uen_number text, -- Co. UEN (Singapura)
  logo_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  bank_name text, -- e.g. UOB Serangoon Central
  bank_address text,
  account_number text,
  swift_code text,
  branch_code text,
  paynow_uen text, -- Field khusus sesuai Image 2
  is_primary boolean DEFAULT false
);

-- 2. MASTER DATA: PARTNERS (Customers & Vendors)
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL, -- 'customer' or 'vendor'
  company_name text NOT NULL, -- PT Jaya Subakti Perkasa / Soemaercon Jaya
  attn_name text, -- Ms. Kelly Teo / Maria
  address text, -- Billing Address
  shipping_address text, -- Untuk Site Delivery (Image 3,4,5)
  phone text,
  email text,
  created_at timestamptz DEFAULT now()
);

-- 3. ITEMS LIBRARY
CREATE TABLE IF NOT EXISTS public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_code text, -- e.g. QNO-6012R (Penting buat Image 5)
  name text NOT NULL,
  description text,
  uom text DEFAULT 'pcs', -- EA, Lot, Nos (Sesuai Image 1)
  price numeric DEFAULT 0
);

-- 4. QUOTATIONS (Image 1)
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number text NOT NULL UNIQUE, -- CNK-Q25-30180-R1
  customer_id uuid REFERENCES public.partners(id),
  date date DEFAULT CURRENT_DATE,
  validity_date date,
  subject text, -- "To Supply Labor and Material..." (Image 1)
  
  -- Financials
  subtotal numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0, -- "Good Will Discount" (Image 1)
  total_amount numeric DEFAULT 0,
  gst_rate numeric DEFAULT 0, -- "NO GST" note
  
  status text DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE CASCADE,
  item_description text, -- Bisa panjang
  quantity numeric DEFAULT 1,
  uom text,
  unit_price numeric DEFAULT 0,
  disc_percent numeric DEFAULT 0,
  disc_amount numeric DEFAULT 0,
  total_price numeric DEFAULT 0
);

-- 5. SALES ORDERS (Internal Control & Grouping)
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  so_number text UNIQUE,
  quotation_id uuid REFERENCES public.quotations(id),
  customer_po_number text, -- "4504642120" (Dari Image 2/3/4)
  project_schedule_date date,
  status text DEFAULT 'confirmed'
);

-- Item SO menyimpan relasi "Phase" untuk DO
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  so_id uuid REFERENCES public.sales_orders(id),
  description text,
  quantity numeric,
  uom text,
  
  -- FIELD PENTING UNTUK GROUPING DO
  phase_name text -- e.g. "01 Phase", "02 Phase"
);

-- 6. DELIVERY ORDERS (Image 3 & 4)
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  do_number text NOT NULL UNIQUE, -- CNK-DO-35258030
  so_id uuid REFERENCES public.sales_orders(id),
  date date DEFAULT CURRENT_DATE,
  
  subject text, -- "01 Phase - Upon Project Schedule..." (Image 3)
  terms text, -- "On-Site Delivery"
  requestor_name text, -- "Sammy"
  
  shipping_address_snapshot text -- Alamat kirim specific saat itu
);

CREATE TABLE IF NOT EXISTS public.delivery_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  do_id uuid REFERENCES public.delivery_orders(id),
  item_code text, -- "00010", "00020"
  description text,
  quantity numeric,
  uom text
);

-- 7. INVOICES (Image 2 - Progressive Billing)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE, -- CNK-INV-35258030
  so_id uuid REFERENCES public.sales_orders(id),
  do_number_ref text, -- Referensi DO (Image 2)
  
  date date DEFAULT CURRENT_DATE,
  due_date date,
  terms text, -- "60 Days"
  subject text, -- "01- 50% Upon Project..."
  
  subtotal numeric,
  discount numeric,
  grand_total numeric,
  
  -- Progressive Payment Tracking
  payment_status text DEFAULT 'unpaid' -- unpaid, partial, paid
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id),
  item_code text, -- "00010"
  description text, -- "01 - 50% Upon..."
  quantity numeric,
  uom text,
  unit_price numeric,
  total_price numeric
);

-- Tabel Pembayaran (Agar 1 Invoice bisa dicicil)
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id),
  date date DEFAULT CURRENT_DATE,
  amount numeric,
  method text,
  notes text
);

-- 8. PURCHASE ORDERS (VENDOR) (Image 5)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number text NOT NULL UNIQUE, -- CNK-P25-30040
  vendor_id uuid REFERENCES public.partners(id), -- Link ke Vendor
  date date,
  quote_ref text, -- Ref Quote Vendor
  
  shipping_info text, -- "Ship Via: FCA..."
  delivery_address text, -- "Working Site Address"
  
  status text DEFAULT 'issued'
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id uuid REFERENCES public.purchase_orders(id),
  item_code text, -- HW-QNO...
  description text,
  quantity numeric,
  unit_price numeric,
  total numeric
);

-- Enable RLS for all tables (Standard security practice)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Create basic policies to allow access (Modify as strictly needed later)
-- For now, allowing public access as per previous pattern for ease of development, 
-- BUT ideally should be authenticated. Using 'true' for simplicity to match user's prior ease of access patterns if needed.
-- Or better, stick to the previous file's pattern: 'Public access...'

DO $$
BEGIN
    EXECUTE 'CREATE POLICY "Public access companies" ON public.companies FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access bank_accounts" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access partners" ON public.partners FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access items" ON public.items FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access quotation_items" ON public.quotation_items FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access sales_orders" ON public.sales_orders FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access sales_order_items" ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access delivery_orders" ON public.delivery_orders FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access delivery_order_items" ON public.delivery_order_items FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access invoice_payments" ON public.invoice_payments FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "Public access purchase_order_items" ON public.purchase_order_items FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN NULL; -- Ignore if policies already exist
END $$;
