-- ============================================================================
-- Update Invoice Section Labels to Use DO Subject
-- Created: 2026-02-07
-- Purpose: Change section_label from "Section X dari DO-..." to DO's subject
-- ============================================================================

-- Update the populate_invoice_from_dos function to use DO subject
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
    
    -- Create section record - USE DO SUBJECT as section_label
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
      COALESCE(v_do_record.subject, format('Delivery %s', v_section_num))
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

-- Also update add_do_to_invoice function
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
  
  -- Create section - USE DO SUBJECT as section_label
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
    COALESCE(v_do_record.subject, format('Delivery %s', v_next_section))
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
