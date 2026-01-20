/*
  # Add Authentication System

  ## Changes
  1. Create users table linked to auth.users
  2. Update RLS policies to use authenticated users
  3. Add user_id to main tables for multi-tenancy
  4. Create helper functions

  ## Security
  - Enable RLS on all tables
  - Policies based on authenticated user
*/

-- Create users profile table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Add user_id to existing tables for multi-tenancy
ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add stock and min_stock to items table if not exists
ALTER TABLE items ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS min_stock integer DEFAULT 5;

-- Create purchase_orders table if not exists
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  vendor_id uuid REFERENCES customers(id),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  expected_delivery date,
  subtotal decimal(15,2) DEFAULT 0,
  tax decimal(15,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0,
  notes text DEFAULT '',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text DEFAULT '',
  quantity integer DEFAULT 1,
  unit_price decimal(15,2) DEFAULT 0,
  total decimal(15,2) DEFAULT 0
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Drop old public policies
DROP POLICY IF EXISTS "Public access companies" ON companies;
DROP POLICY IF EXISTS "Public access customers" ON customers;
DROP POLICY IF EXISTS "Public access items" ON items;
DROP POLICY IF EXISTS "Public access invoices" ON invoices;
DROP POLICY IF EXISTS "Public access invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Public access quotations" ON quotations;
DROP POLICY IF EXISTS "Public access quotation_items" ON quotation_items;

-- Create new authenticated user policies for companies
CREATE POLICY "Users can view own companies" ON companies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companies" ON companies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own companies" ON companies
  FOR DELETE USING (auth.uid() = user_id);

-- Create new authenticated user policies for customers
CREATE POLICY "Users can view own customers" ON customers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers" ON customers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers" ON customers
  FOR DELETE USING (auth.uid() = user_id);

-- Create new authenticated user policies for items
CREATE POLICY "Users can view own items" ON items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items" ON items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items" ON items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items" ON items
  FOR DELETE USING (auth.uid() = user_id);

-- Create new authenticated user policies for invoices
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" ON invoices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices" ON invoices
  FOR DELETE USING (auth.uid() = user_id);

-- Create new authenticated user policies for invoice_items
CREATE POLICY "Users can view own invoice_items" ON invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own invoice_items" ON invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own invoice_items" ON invoice_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own invoice_items" ON invoice_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

-- Create new authenticated user policies for quotations
CREATE POLICY "Users can view own quotations" ON quotations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quotations" ON quotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotations" ON quotations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotations" ON quotations
  FOR DELETE USING (auth.uid() = user_id);

-- Create new authenticated user policies for quotation_items
CREATE POLICY "Users can view own quotation_items" ON quotation_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quotations 
      WHERE quotations.id = quotation_items.quotation_id 
      AND quotations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own quotation_items" ON quotation_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotations 
      WHERE quotations.id = quotation_items.quotation_id 
      AND quotations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own quotation_items" ON quotation_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quotations 
      WHERE quotations.id = quotation_items.quotation_id 
      AND quotations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own quotation_items" ON quotation_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quotations 
      WHERE quotations.id = quotation_items.quotation_id 
      AND quotations.user_id = auth.uid()
    )
  );

-- Create new authenticated user policies for purchase_orders
CREATE POLICY "Users can view own purchase_orders" ON purchase_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase_orders" ON purchase_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchase_orders" ON purchase_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchase_orders" ON purchase_orders
  FOR DELETE USING (auth.uid() = user_id);

-- Create new authenticated user policies for purchase_order_items
CREATE POLICY "Users can view own purchase_order_items" ON purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = purchase_order_items.po_id 
      AND purchase_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own purchase_order_items" ON purchase_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = purchase_order_items.po_id 
      AND purchase_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own purchase_order_items" ON purchase_order_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = purchase_order_items.po_id 
      AND purchase_orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own purchase_order_items" ON purchase_order_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders 
      WHERE purchase_orders.id = purchase_order_items.po_id 
      AND purchase_orders.user_id = auth.uid()
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
