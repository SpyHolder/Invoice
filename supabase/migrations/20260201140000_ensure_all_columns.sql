-- Comprehensive Column Fix for Quotations and Purchase Orders
-- Ensures all required columns exist via ALTER TABLE IF NOT EXISTS logic.

DO $$
BEGIN

    -- ==========================================
    -- 1. QUOTATIONS TABLE
    -- ==========================================
    
    -- quote_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'quote_number') THEN
        ALTER TABLE public.quotations ADD COLUMN quote_number text UNIQUE;
    END IF;

    -- customer_id (should be there, but check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'customer_id') THEN
        ALTER TABLE public.quotations ADD COLUMN customer_id uuid REFERENCES public.partners(id);
    END IF;

    -- validity_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'validity_date') THEN
        ALTER TABLE public.quotations ADD COLUMN validity_date date;
    END IF;
    
    -- subtotal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'subtotal') THEN
        ALTER TABLE public.quotations ADD COLUMN subtotal numeric DEFAULT 0;
    END IF;

    -- discount_amount (Good Will Discount)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.quotations ADD COLUMN discount_amount numeric DEFAULT 0;
    END IF;

    -- gst_rate
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'gst_rate') THEN
        ALTER TABLE public.quotations ADD COLUMN gst_rate numeric DEFAULT 0;
    END IF;

    -- total_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'total_amount') THEN
        ALTER TABLE public.quotations ADD COLUMN total_amount numeric DEFAULT 0;
    END IF;

    -- subject
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotations' AND column_name = 'subject') THEN
        ALTER TABLE public.quotations ADD COLUMN subject text;
    END IF;


    -- ==========================================
    -- 2. PURCHASE ORDERS TABLE
    -- ==========================================

    -- vendor_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'vendor_id') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN vendor_id uuid REFERENCES public.partners(id);
    END IF;

    -- po_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'po_number') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN po_number text UNIQUE;
    END IF;

    -- quote_ref
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'quote_ref') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN quote_ref text;
    END IF;

    -- shipping_info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'shipping_info') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN shipping_info text;
    END IF;

    -- delivery_address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'delivery_address') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN delivery_address text;
    END IF;
    
    -- total 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'total') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN total numeric DEFAULT 0;
    END IF;
    
    -- notes (seen in PurchaseOrderForm but maybe generic?) - Add just in case
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'notes') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN notes text;
    END IF;


    -- ==========================================
    -- 3. PURCHASE ORDER ITEMS TABLE
    -- ==========================================
    -- item_code
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'item_code') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN item_code text;
    END IF;
    
    -- total
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'total') THEN
        ALTER TABLE public.purchase_order_items ADD COLUMN total numeric DEFAULT 0;
    END IF;

END $$;

-- Force Schema Cache Reload (Critical for PostgREST)
NOTIFY pgrst, 'reload config';
