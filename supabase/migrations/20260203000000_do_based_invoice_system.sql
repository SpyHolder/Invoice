-- ============================================================================
-- DO-Based Invoice System Migration
-- Created: 2026-02-03
-- Purpose: Rebuild invoice workflow to be based on Delivery Orders
-- ============================================================================

-- Step 1: Create invoice_delivery_sections junction table
CREATE TABLE IF NOT EXISTS public.invoice_delivery_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  do_id uuid NOT NULL REFERENCES public.delivery_orders(id) ON DELETE RESTRICT,
  section_number integer NOT NULL,
  section_label text,
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_invoice_do UNIQUE(invoice_id, do_id),
  CONSTRAINT unique_invoice_section UNIQUE(invoice_id, section_number)
);

-- Step 2: Add new columns to invoices table
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'do_based' 
    CHECK (invoice_type IN ('legacy', 'do_based')),
  ADD COLUMN IF NOT EXISTS total_sections integer DEFAULT 0;

-- Make so_id nullable for DO-based invoices
ALTER TABLE public.invoices 
  ALTER COLUMN so_id DROP NOT NULL;

-- Step 3: Add reference to invoice_items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS do_section_id uuid 
    REFERENCES public.invoice_delivery_sections(id) ON DELETE SET NULL;

-- Step 4: Mark existing invoices as legacy
UPDATE public.invoices 
SET invoice_type = 'legacy' 
WHERE invoice_type IS NULL OR invoice_type = 'do_based';

-- Step 5: Enable RLS on new table
ALTER TABLE public.invoice_delivery_sections ENABLE ROW LEVEL SECURITY;

-- Create policy for invoice_delivery_sections
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.invoice_delivery_sections;
CREATE POLICY "Allow all for authenticated users" 
  ON public.invoice_delivery_sections 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_sections_invoice 
  ON public.invoice_delivery_sections(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sections_do 
  ON public.invoice_delivery_sections(do_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_section 
  ON public.invoice_items(do_section_id);

-- Step 7: Helper function to get DO numbers for an invoice
CREATE OR REPLACE FUNCTION public.get_invoice_do_numbers(invoice_uuid uuid)
RETURNS text AS $$
  SELECT COALESCE(
    string_agg(delivery_order.do_number, ', ' ORDER BY ids.section_number),
    ''
  )
  FROM public.invoice_delivery_sections ids
  JOIN public.delivery_orders delivery_order ON delivery_order.id = ids.do_id
  WHERE ids.invoice_id = invoice_uuid;
$$ LANGUAGE sql STABLE;

-- Step 8: Function to populate invoice from DOs
CREATE OR REPLACE FUNCTION public.populate_invoice_from_dos(
  p_invoice_id uuid,
  p_do_ids uuid[]
) RETURNS void AS $$
DECLARE
  v_do_id uuid;
  v_section_num integer := 0;
  v_do_record record;
  v_item_record record;
  v_section_id uuid;
BEGIN
  -- Clear existing sections and items for this invoice
  DELETE FROM public.invoice_delivery_sections WHERE invoice_id = p_invoice_id;
  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  
  -- Loop through each DO
  FOREACH v_do_id IN ARRAY p_do_ids
  LOOP
    v_section_num := v_section_num + 1;
    
    -- Get DO details
    SELECT * INTO v_do_record FROM public.delivery_orders WHERE id = v_do_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Delivery Order with ID % not found', v_do_id;
    END IF;
    
    -- Create section record
    INSERT INTO public.invoice_delivery_sections (
      invoice_id, 
      do_id, 
      section_number, 
      section_label
    )
    VALUES (
      p_invoice_id, 
      v_do_id, 
      v_section_num,
      format('Section %s dari %s', v_section_num, v_do_record.do_number)
    )
    RETURNING id INTO v_section_id;
    
    -- Copy DO items to invoice items
    FOR v_item_record IN 
      SELECT * FROM public.delivery_order_items WHERE do_id = v_do_id
    LOOP
      INSERT INTO public.invoice_items (
        invoice_id, 
        do_section_id,
        item_code, 
        description, 
        quantity, 
        uom, 
        unit_price, 
        total_price
      )
      VALUES (
        p_invoice_id,
        v_section_id,
        v_item_record.item_code,
        v_item_record.description,
        v_item_record.quantity,
        v_item_record.uom,
        -- Try to get price from items table, otherwise default to 0
        COALESCE(
          (SELECT price FROM public.items 
           WHERE description = v_item_record.description 
           LIMIT 1),
          0
        ),
        v_item_record.quantity * COALESCE(
          (SELECT price FROM public.items 
           WHERE description = v_item_record.description 
           LIMIT 1),
          0
        )
      );
    END LOOP;
  END LOOP;
  
  -- Update invoice totals
  UPDATE public.invoices SET
    subtotal = (
      SELECT COALESCE(SUM(total_price), 0) 
      FROM public.invoice_items 
      WHERE invoice_id = p_invoice_id
    ),
    total_sections = v_section_num,
    grand_total = (
      SELECT COALESCE(SUM(total_price), 0) 
      FROM public.invoice_items 
      WHERE invoice_id = p_invoice_id
    ) - COALESCE(discount, 0) + COALESCE(tax, 0)
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Function to add DO to existing invoice
CREATE OR REPLACE FUNCTION public.add_do_to_invoice(
  p_invoice_id uuid,
  p_do_id uuid
) RETURNS void AS $$
DECLARE
  v_next_section integer;
  v_do_record record;
  v_section_id uuid;
  v_item_record record;
BEGIN
  -- Check if DO already in invoice
  IF EXISTS (
    SELECT 1 FROM public.invoice_delivery_sections 
    WHERE invoice_id = p_invoice_id AND do_id = p_do_id
  ) THEN
    RAISE EXCEPTION 'Delivery Order already exists in this invoice';
  END IF;
  
  -- Get next section number
  SELECT COALESCE(MAX(section_number), 0) + 1 
  INTO v_next_section
  FROM public.invoice_delivery_sections 
  WHERE invoice_id = p_invoice_id;
  
  -- Get DO details
  SELECT * INTO v_do_record FROM public.delivery_orders WHERE id = p_do_id;
  
  -- Create section
  INSERT INTO public.invoice_delivery_sections (
    invoice_id, 
    do_id, 
    section_number, 
    section_label
  )
  VALUES (
    p_invoice_id, 
    p_do_id, 
    v_next_section,
    format('Section %s dari %s', v_next_section, v_do_record.do_number)
  )
  RETURNING id INTO v_section_id;
  
  -- Copy DO items
  FOR v_item_record IN 
    SELECT * FROM public.delivery_order_items WHERE do_id = p_do_id
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, 
      do_section_id,
      item_code, 
      description, 
      quantity, 
      uom, 
      unit_price, 
      total_price
    )
    VALUES (
      p_invoice_id,
      v_section_id,
      v_item_record.item_code,
      v_item_record.description,
      v_item_record.quantity,
      v_item_record.uom,
      COALESCE(
        (SELECT price FROM public.items 
         WHERE description = v_item_record.description 
         LIMIT 1),
        0
      ),
      v_item_record.quantity * COALESCE(
        (SELECT price FROM public.items 
         WHERE description = v_item_record.description 
         LIMIT 1),
        0
      )
    );
  END LOOP;
  
  -- Update invoice totals
  UPDATE public.invoices SET
    subtotal = (
      SELECT COALESCE(SUM(total_price), 0) 
      FROM public.invoice_items 
      WHERE invoice_id = p_invoice_id
    ),
    total_sections = v_next_section,
    grand_total = (
      SELECT COALESCE(SUM(total_price), 0) 
      FROM public.invoice_items 
      WHERE invoice_id = p_invoice_id
    ) - COALESCE(discount, 0) + COALESCE(tax, 0)
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Migration Complete
-- ============================================================================
