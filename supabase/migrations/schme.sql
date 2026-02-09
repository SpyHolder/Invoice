-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  bank_name text,
  bank_address text,
  account_number text,
  swift_code text,
  branch_code text,
  paynow_uen text,
  is_primary boolean DEFAULT false,
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT bank_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  email text DEFAULT ''::text,
  uen_number text,
  logo_url text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.delivery_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  do_id uuid,
  item_code text,
  description text,
  quantity numeric,
  uom text,
  group_name text,
  CONSTRAINT delivery_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_order_items_do_id_fkey FOREIGN KEY (do_id) REFERENCES public.delivery_orders(id)
);
CREATE TABLE public.delivery_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  do_number text NOT NULL UNIQUE,
  so_id uuid,
  date date DEFAULT CURRENT_DATE,
  subject text,
  terms text,
  requestor_name text,
  shipping_address_snapshot text,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'delivered'::text, 'cancelled'::text])),
  CONSTRAINT delivery_orders_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_orders_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id)
);
CREATE TABLE public.invoice_delivery_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  do_id uuid NOT NULL,
  section_number integer NOT NULL,
  section_label text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoice_delivery_sections_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_delivery_sections_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT invoice_delivery_sections_do_id_fkey FOREIGN KEY (do_id) REFERENCES public.delivery_orders(id)
);
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid,
  item_code text,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  uom text,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  do_section_id uuid,
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_do_section_id_fkey FOREIGN KEY (do_section_id) REFERENCES public.invoice_delivery_sections(id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoice_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid,
  date date DEFAULT CURRENT_DATE,
  amount numeric,
  method text,
  notes text,
  CONSTRAINT invoice_payments_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  so_id uuid,
  do_number_ref text,
  customer_id uuid,
  date date DEFAULT CURRENT_DATE,
  due_date date,
  terms text,
  subject text,
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  payment_status text DEFAULT 'unpaid'::text,
  notes text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  billing_type text DEFAULT 'itemized'::text CHECK (billing_type = ANY (ARRAY['itemized'::text, 'milestone'::text, 'final'::text])),
  invoice_type text DEFAULT 'do_based'::text CHECK (invoice_type = ANY (ARRAY['legacy'::text, 'do_based'::text])),
  total_sections integer DEFAULT 0,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.partners(id),
  CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_code text,
  name text NOT NULL,
  description text DEFAULT ''::text,
  uom text DEFAULT 'pcs'::text,
  price numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  stock integer DEFAULT 0,
  min_stock integer DEFAULT 5,
  sku text,
  category text,
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['customer'::text, 'vendor'::text])),
  company_name text NOT NULL,
  attn_name text,
  address text,
  shipping_address text,
  phone text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT partners_pkey PRIMARY KEY (id)
);
CREATE TABLE public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_id uuid,
  item_code text,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  vendor_id uuid,
  user_id uuid,
  date date DEFAULT CURRENT_DATE,
  expected_delivery date,
  quote_ref text,
  shipping_info text,
  delivery_address text,
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  notes text DEFAULT ''::text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.partners(id),
  CONSTRAINT purchase_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.quotation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation_id uuid,
  item_description text NOT NULL,
  quantity numeric DEFAULT 1,
  uom text,
  unit_price numeric DEFAULT 0,
  disc_percent numeric DEFAULT 0,
  disc_amount numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  CONSTRAINT quotation_items_pkey PRIMARY KEY (id),
  CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id)
);
CREATE TABLE public.quotation_selected_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL,
  term_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quotation_selected_terms_pkey PRIMARY KEY (id),
  CONSTRAINT quotation_selected_terms_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id),
  CONSTRAINT quotation_selected_terms_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.quotation_terms(id)
);
CREATE TABLE public.quotation_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text,
  content text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quotation_terms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  customer_id uuid,
  date date DEFAULT CURRENT_DATE,
  validity_date date,
  subject text,
  subtotal numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  gst_rate numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  status text DEFAULT 'draft'::text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT quotations_pkey PRIMARY KEY (id),
  CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.partners(id),
  CONSTRAINT quotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.sales_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  so_id uuid,
  description text,
  quantity numeric,
  uom text,
  phase_name text,
  CONSTRAINT sales_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_order_items_so_id_fkey FOREIGN KEY (so_id) REFERENCES public.sales_orders(id)
);
CREATE TABLE public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  so_number text UNIQUE,
  quotation_id uuid,
  customer_po_number text,
  project_schedule_date date,
  status text DEFAULT 'confirmed'::text,
  created_at timestamp with time zone DEFAULT now(),
  total_amount numeric,
  CONSTRAINT sales_orders_pkey PRIMARY KEY (id),
  CONSTRAINT sales_orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  company_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);