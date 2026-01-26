/*
  # Update Quotation Format to Match PDF Template
  
  Changes:
  1. Add company_settings table for logo and header info
  2. Update customers table with attn field
  3. Update quotations table with new fields
  4. Update quotation_items table with UOM and discount fields
*/

-- 1. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Company Name',
  address_line1 text DEFAULT '',
  address_line2 text DEFAULT '',
  address_line3 text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  gst_note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default company settings
INSERT INTO company_settings (name, address_line1, address_line2, address_line3, gst_note)
VALUES (
  'Your Company Name',
  '60 PAYA LEBAR ROAD',
  '#08-45A',
  'PAYA LEBAR SQUARE',
  'NO GST as Company is NOT a GST Registered Company Yet'
) ON CONFLICT DO NOTHING;

-- 2. Update Customers Table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS attn text DEFAULT '';

-- 3. Update Quotations Table
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS contact text DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS rfq_ref_no text DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subject text DEFAULT '';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS goodwill_discount decimal(15,2) DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'SGD';

-- 4. Update Quotation Items Table
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS uom text DEFAULT 'EA';
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS bef_disc decimal(15,2) DEFAULT 0;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS disc_percent decimal(5,2) DEFAULT 0;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS disc_amt decimal(15,2) DEFAULT 0;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_no integer DEFAULT 1;
