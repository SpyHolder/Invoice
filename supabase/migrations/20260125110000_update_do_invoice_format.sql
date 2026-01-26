/*
  # Update DO & Invoice Format and Add Grouping
  
  Changes:
  1. Update delivery_orders: Add terms, customer_po, requestor, billing_address
  2. Update delivery_order_items: Add uom, group_name
  3. Update invoices: Add terms, customer_po
  4. Update invoice_items: Add uom, discount_percent
*/

-- 1. Update Delivery Orders
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS terms text DEFAULT 'On-Site Delivery';
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS customer_po text DEFAULT '';
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS requestor text DEFAULT '';
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS billing_address text DEFAULT '';

-- 2. Update Delivery Order Items
ALTER TABLE delivery_order_items ADD COLUMN IF NOT EXISTS group_name text DEFAULT '';
ALTER TABLE delivery_order_items ADD COLUMN IF NOT EXISTS uom text DEFAULT 'EA';

-- 3. Update Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms text DEFAULT '30 Days';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_po text DEFAULT '';

-- 4. Update Invoice Items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS uom text DEFAULT 'EA';
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_percent decimal(5,2) DEFAULT 0;
