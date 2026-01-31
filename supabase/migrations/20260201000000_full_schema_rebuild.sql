-- ============================================================================
-- FULL SCHEMA REBUILD - Project-Based ERP System
-- Generated: 2026-02-01
-- Purpose: Complete database restructure to match desired architecture
-- ============================================================================

-- Step 1: Drop existing tables (in correct dependency order)
DROP TABLE IF EXISTS public.invoice_payments CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.delivery_order_items CASCADE;
DROP TABLE IF EXISTS public.delivery_orders CASCADE;
DROP TABLE IF EXISTS public.sales_order_items CASCADE;
DROP TABLE IF EXISTS public.sales_orders CASCADE;
DROP TABLE IF EXISTS public.quotation_items CASCADE;
DROP TABLE IF EXISTS public.quotations CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.partners CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- ============================================================================
-- Step 2: Create Master Data Tables
-- ============================================================================

-- 2.1 USER PROFILES
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2.2 COMPANIES (For Header & Footer in PDFs)
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  email text DEFAULT ''::text,
  uen_number text, -- Singapore Company UEN
  logo_url text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 2.3 BANK ACCOUNTS (Payment Instructions for Invoices)
CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  bank_name text,
  bank_address text,
  account_number text,
  swift_code text,
  branch_code text,
  paynow_uen text, -- Singapore PayNow
  is_primary boolean DEFAULT false,
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT bank_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 2.4 PARTNERS (Unified Customers & Vendors)
CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'customer' or 'vendor'
  company_name text NOT NULL, -- PT Jaya Subakti Perkasa / Samsung
  attn_name text, -- Contact person: Ms. Kelly Teo / Maria
  address text, -- Billing Address
  shipping_address text, -- For Site Delivery
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT partners_pkey PRIMARY KEY (id),
  CONSTRAINT partners_type_check CHECK (type IN ('customer', 'vendor'))
);

-- 2.5 ITEMS LIBRARY
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_code text, -- QNO-6012R, HW-QNO...
  name text NOT NULL,
  description text DEFAULT ''::text,
  uom text DEFAULT 'pcs', -- EA, Lot, Nos, pcs
  price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  stock integer DEFAULT 0,
  min_stock integer DEFAULT 5,
  sku text,
  category text,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================================
-- Step 3: Sales Documents (Quotation → SO → DO → Invoice)
-- ============================================================================

-- 3.1 QUOTATIONS (Image 1)
CREATE TABLE public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE, -- CNK-Q25-30180-R1
  customer_id uuid, -- Reference to partners where type='customer'
  date date DEFAULT CURRENT_DATE,
  validity_date date,
  subject text, -- "To Supply Labor and Material..."
  
  -- Financials
  subtotal numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0, -- "Good Will Discount"
  gst_rate numeric DEFAULT 0, -- GST percentage (0 if NO GST)
  total_amount numeric DEFAULT 0,
  
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  
  CONSTRAINT quotations_pkey PRIMARY KEY (id),
  CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.partners(id),
  CONSTRAINT quotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.quotation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation_id uuid,
  item_description text NOT NULL, -- Full description
  quantity numeric DEFAULT 1,
  uom text,
  unit_price numeric DEFAULT 0,
  disc_percent numeric DEFAULT 0, -- Discount %
  disc_amount numeric DEFAULT 0, -- Calculated discount amount
  total_price numeric DEFAULT 0, -- Final line total
  
  CONSTRAINT quotation_items_pkey PRIMARY KEY (id),
  CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE
);

-- 3.2 SALES ORDERS (Internal Control & Phase Grouping)
CREATE TABLE public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  so_number text UNIQUE, -- Auto-generated
  quotation_id uuid,
  customer_po_number text, -- "4504642120" - Client's PO
  project_schedule_date date,
  status text DEFAULT 'confirmed',
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT sales_orders_pkey PRIMARY KEY (id),
  CONSTRAINT sales_orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id)
);

CREATE TABLE public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  so_id uuid,
  description text,
  quantity numeric,
  uom text,
  
  -- CRITICAL: Phase grouping for DO generation
  phase_name text, -- "01 Phase", "02 Phase", etc.
  
  CONSTRAINT sales_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_order_items_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE
);

-- 3.3 DELIVERY ORDERS (Image 3 & 4 - Per Phase)
CREATE TABLE public.delivery_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  do_number text NOT NULL UNIQUE, -- CNK-DO-35258030
  so_id uuid,
  date date DEFAULT CURRENT_DATE,
  
  subject text, -- "01 Phase – Upon Project Schedule Submissions"
  terms text, -- "On-Site Delivery"
  requestor_name text, -- "Sammy"
  
  shipping_address_snapshot text, -- Snapshot at time of creation
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT delivery_orders_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_orders_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id)
);

CREATE TABLE public.delivery_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  do_id uuid,
  item_code text, -- "00010", "00020"
  description text,
  quantity numeric,
  uom text,
  
  CONSTRAINT delivery_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_order_items_do_id_fkey FOREIGN KEY (do_id) REFERENCES public.delivery_orders(id) ON DELETE CASCADE
);

-- 3.4 INVOICES (Image 2 - Progressive Billing)
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE, -- CNK-INV-35258030
  so_id uuid, -- Link to Sales Order
  do_number_ref text, -- Reference DO number(s)
  customer_id uuid, -- For standalone invoices
  
  date date DEFAULT CURRENT_DATE,
  due_date date,
  terms text, -- "60 Days"
  subject text, -- "01 - 50% Upon Project Schedule..."
  
  -- Financials
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  
  -- Progressive Payment
  payment_status text DEFAULT 'unpaid', -- unpaid, partial, paid
  
  notes text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.partners(id),
  CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid,
  item_code text, -- "00010"
  description text NOT NULL, -- "01 - 50% Upon Project Schedule..." or item description
  quantity numeric DEFAULT 1,
  uom text,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE
);

-- 3.5 INVOICE PAYMENTS (Progressive Billing Tracking)
CREATE TABLE public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid,
  date date DEFAULT CURRENT_DATE,
  amount numeric,
  method text, -- "Bank Transfer", "PayNow", etc.
  notes text,
  
  CONSTRAINT invoice_payments_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE
);

-- ============================================================================
-- Step 4: Procurement (Purchase Orders to Vendors)
-- ============================================================================

CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE, -- CNK-P25-30040
  vendor_id uuid, -- Reference to partners where type='vendor'
  user_id uuid,
  date date DEFAULT CURRENT_DATE,
  expected_delivery date,
  
  quote_ref text, -- Vendor's quote reference
  shipping_info text, -- "Ship Via: FCA..."
  delivery_address text, -- "Working Site Address"
  
  -- Financials
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  
  notes text DEFAULT ''::text,
  status text DEFAULT 'pending', -- pending, received
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.partners(id),
  CONSTRAINT purchase_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_id uuid,
  item_code text, -- HW-QNO-6012R
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE
);

-- ============================================================================
-- Step 5: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
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

-- Create permissive policies for development (should be tightened in production)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'user_profiles', 'companies', 'bank_accounts', 'partners', 'items',
      'quotations', 'quotation_items', 'sales_orders', 'sales_order_items',
      'delivery_orders', 'delivery_order_items', 'invoices', 'invoice_items',
      'invoice_payments', 'purchase_orders', 'purchase_order_items'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Allow all for authenticated users" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- Step 6: Indexes for Performance
-- ============================================================================

CREATE INDEX idx_partners_type ON public.partners(type);
CREATE INDEX idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX idx_quotations_status ON public.quotations(status);
CREATE INDEX idx_sales_orders_quotation_id ON public.sales_orders(quotation_id);
CREATE INDEX idx_delivery_orders_so_id ON public.delivery_orders(so_id);
CREATE INDEX idx_invoices_so_id ON public.invoices(so_id);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Migration Complete
-- ============================================================================
