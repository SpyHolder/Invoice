/*
  # Create Delivery Orders Tables
  
  Tabel untuk fitur Delivery Order yang memungkinkan pemilihan items dari Quotations.
  
  ## Tables
  - delivery_orders: Header delivery order
  - delivery_order_items: Detail items yang dikirim
  
  ## Features
  - Referensi ke quotation_items untuk tracking asal item
  - Status tracking (pending, delivered, cancelled)
  - Alamat pengiriman terpisah dari customer address
*/

-- Delivery Orders table
CREATE TABLE IF NOT EXISTS delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  do_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id),
  quotation_id uuid REFERENCES quotations(id),
  date date DEFAULT CURRENT_DATE,
  delivery_date date,
  status text DEFAULT 'pending',
  notes text DEFAULT '',
  delivery_address text DEFAULT '',
  total decimal(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access delivery_orders" ON delivery_orders FOR ALL USING (true) WITH CHECK (true);

-- Delivery Order Items table
CREATE TABLE IF NOT EXISTS delivery_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id uuid REFERENCES delivery_orders(id) ON DELETE CASCADE,
  quotation_item_id uuid REFERENCES quotation_items(id),
  item_id uuid REFERENCES items(id),
  item_name text NOT NULL,
  description text DEFAULT '',
  quantity integer DEFAULT 1,
  unit_price decimal(15,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0
);

ALTER TABLE delivery_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access delivery_order_items" ON delivery_order_items FOR ALL USING (true) WITH CHECK (true);
