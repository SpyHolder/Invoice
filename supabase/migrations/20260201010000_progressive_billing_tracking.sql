-- Phase 3: Progressive Billing Tracking - Part 1
-- Add total_amount to sales_orders and link invoices to SO

-- 1. Add total_amount to sales_orders for billing tracking
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);

COMMENT ON COLUMN sales_orders.total_amount IS 'Total SO value for billing tracking. Can be manually entered or calculated from linked quotation.';

-- 2. Add SO link and billing type to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS so_id UUID REFERENCES sales_orders(id),
ADD COLUMN IF NOT EXISTS billing_type TEXT CHECK (billing_type IN ('itemized', 'milestone', 'final')) DEFAULT 'itemized';

COMMENT ON COLUMN invoices.so_id IS 'Link to source Sales Order for billing tracking';
COMMENT ON COLUMN invoices.billing_type IS 'Type of billing: itemized (from SO items), milestone (progressive percentage), or final (closing invoice)';

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_so_id ON invoices(so_id);

-- 4. Create billing summary view
CREATE OR REPLACE VIEW v_so_billing_summary AS
SELECT 
    so.id AS so_id,
    so.so_number,
    so.customer_po_number,
    so.total_amount AS so_total,
    COUNT(inv.id) AS invoice_count,
    COALESCE(SUM(inv.grand_total), 0) AS total_billed,
    so.total_amount - COALESCE(SUM(inv.grand_total), 0) AS remaining_to_bill,
    CASE 
        WHEN so.total_amount IS NULL THEN 'No Total Set'
        WHEN COALESCE(SUM(inv.grand_total), 0) >= so.total_amount THEN 'Fully Billed'
        WHEN COALESCE(SUM(inv.grand_total), 0) > 0 THEN 'Partially Billed'
        ELSE 'Not Billed'
    END AS billing_status,
    CASE 
        WHEN so.total_amount IS NOT NULL AND so.total_amount > 0 
        THEN ROUND((COALESCE(SUM(inv.grand_total), 0) / so.total_amount * 100), 2)
        ELSE 0
    END AS billed_percentage
FROM sales_orders so
LEFT JOIN invoices inv ON inv.so_id = so.id AND inv.payment_status != 'cancelled'
GROUP BY so.id, so.so_number, so.customer_po_number, so.total_amount;

COMMENT ON VIEW v_so_billing_summary IS 'Summary view of billing progress for each Sales Order';

-- 5. Function to calculate SO total from quotation (helper)
CREATE OR REPLACE FUNCTION calculate_so_total_from_quotation(p_so_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    v_quotation_id UUID;
    v_total DECIMAL(15,2);
BEGIN
    -- Get quotation_id from SO
    SELECT quotation_id INTO v_quotation_id
    FROM sales_orders
    WHERE id = p_so_id;
    
    IF v_quotation_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calculate total from quotation items
    SELECT COALESCE(SUM(quantity * unit_price - discount + tax_amount), 0)
    INTO v_total
    FROM quotation_items
    WHERE quotation_id = v_quotation_id;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_so_total_from_quotation IS 'Calculate SO total amount from linked quotation items';

-- 6. Optional: Auto-populate SO total from quotation on SO creation
-- This can be done in the app, but here's a trigger option:
CREATE OR REPLACE FUNCTION auto_set_so_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_amount IS NULL AND NEW.quotation_id IS NOT NULL THEN
        NEW.total_amount := calculate_so_total_from_quotation(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Uncomment to enable auto-calculation (optional)
-- CREATE TRIGGER trigger_auto_set_so_total
-- BEFORE INSERT OR UPDATE ON sales_orders
-- FOR EACH ROW
-- EXECUTE FUNCTION auto_set_so_total();
