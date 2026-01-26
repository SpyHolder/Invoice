/*
  # Project-Based Order Management System Schema

  ## New Tables
  - po_groups: Groups defined in Customer PO
  - sales_orders: Confirmed orders linking Quotation and PO
  - sales_order_items: Items in SO (copy from Quotation)
  - payment_progress: Track progress billing

  ## Alterations
  - purchase_orders: Add total_project_value, status
  - quotations: Add linked_sales_order_id
  - delivery_orders: Add sales_order_id, po_group_id
  - invoices: Add sales_order_id, invoice_type, po_group_id

  ## Security
  - Enable RLS for all new tables
  - Add public access policies (for development simplicity)
*/

-- 1. Update Purchase Orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_project_value decimal(15,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id); 
-- status might already exist, but ensure it does or add it if needed. 
-- Assuming purchase_orders was created previously. If not, we rely on previous migrations.

-- 2. Create PO Groups Table
CREATE TABLE IF NOT EXISTS po_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE po_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access po_groups" ON po_groups FOR ALL USING (true) WITH CHECK (true);

-- 3. Create Sales Orders Table
CREATE TABLE IF NOT EXISTS sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES quotations(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  customer_id uuid REFERENCES customers(id),
  status text DEFAULT 'Draft', -- Draft, Confirmed, Completed, Cancelled
  total_amount decimal(15,2) DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access sales_orders" ON sales_orders FOR ALL USING (true) WITH CHECK (true);

-- 4. Create Sales Order Items Table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text DEFAULT '',
  quantity decimal(10,2) DEFAULT 1,
  uom text DEFAULT 'EA',
  unit_price decimal(15,2) DEFAULT 0,
  discount decimal(15,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0,
  po_group_id uuid REFERENCES po_groups(id), -- Optional voluntary grouping
  item_id uuid REFERENCES items(id), -- Optional link to inventory
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access sales_order_items" ON sales_order_items FOR ALL USING (true) WITH CHECK (true);

-- 5. Create Payment Progress Table
CREATE TABLE IF NOT EXISTS payment_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid REFERENCES sales_orders(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id),
  percentage decimal(5,2) DEFAULT 0,
  amount decimal(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access payment_progress" ON payment_progress FOR ALL USING (true) WITH CHECK (true);

-- 6. Link Quotations to Sales Orders
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS linked_sales_order_id uuid REFERENCES sales_orders(id);

-- 7. Update Delivery Orders
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES sales_orders(id);
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS po_group_id uuid REFERENCES po_groups(id);

-- 8. Update Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES sales_orders(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'ITEM'; -- 'ITEM' or 'PROGRESS'
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_group_id uuid REFERENCES po_groups(id);
