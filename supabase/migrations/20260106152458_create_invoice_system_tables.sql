/*
  # Setup Sistem Invoice & Quotation untuk UMKM

  ## Tables Baru
  - companies: Data perusahaan
  - customers: Data customer
  - items: Master item/produk
  - invoices: Header invoice
  - invoice_items: Detail item invoice
  - quotations: Header quotation
  - quotation_items: Detail item quotation

  ## Security
  - Enable RLS pada semua tabel
  - Policy untuk akses publik (untuk testing)
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access companies" ON companies FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access customers" ON customers FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price decimal(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access items" ON items FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  date date DEFAULT CURRENT_DATE,
  due_date date,
  subtotal decimal(15,2) DEFAULT 0,
  discount decimal(15,2) DEFAULT 0,
  tax decimal(15,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0,
  notes text DEFAULT '',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text DEFAULT '',
  quantity integer DEFAULT 1,
  unit_price decimal(15,2) DEFAULT 0,
  discount decimal(15,2) DEFAULT 0,
  tax_rate decimal(5,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access invoice_items" ON invoice_items FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  date date DEFAULT CURRENT_DATE,
  valid_until date,
  subtotal decimal(15,2) DEFAULT 0,
  discount decimal(15,2) DEFAULT 0,
  tax decimal(15,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0,
  notes text DEFAULT '',
  payment_terms text DEFAULT '',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text DEFAULT '',
  quantity integer DEFAULT 1,
  unit_price decimal(15,2) DEFAULT 0,
  discount decimal(15,2) DEFAULT 0,
  tax_rate decimal(5,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0
);

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access quotation_items" ON quotation_items FOR ALL USING (true) WITH CHECK (true);