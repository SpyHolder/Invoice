-- Migration: Create quotation_terms tables
-- This migration creates the master data table for terms/conditions
-- and a junction table for linking quotations to selected terms

-- ============================================
-- 1. Create quotation_terms (master data table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.quotation_terms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL,
    title text,
    content text NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.quotation_terms IS 'Master data for quotation terms and conditions';
COMMENT ON COLUMN public.quotation_terms.category IS 'Category name: Remarks, Warranty, Cancellation, Payment Plan, General Terms';
COMMENT ON COLUMN public.quotation_terms.title IS 'Optional title for the term (e.g., "Payment Plan: Progressive")';
COMMENT ON COLUMN public.quotation_terms.content IS 'The actual term content text';
COMMENT ON COLUMN public.quotation_terms.sort_order IS 'Order for displaying terms within a category';

-- ============================================
-- 2. Create quotation_selected_terms (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.quotation_selected_terms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    term_id uuid NOT NULL REFERENCES public.quotation_terms(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(quotation_id, term_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotation_selected_terms_quotation 
    ON public.quotation_selected_terms(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_selected_terms_term 
    ON public.quotation_selected_terms(term_id);

-- ============================================
-- 3. Enable RLS and create policies
-- ============================================
ALTER TABLE public.quotation_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_selected_terms ENABLE ROW LEVEL SECURITY;

-- Policies for quotation_terms (master data - all authenticated users can read)
CREATE POLICY "quotation_terms_select" ON public.quotation_terms
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "quotation_terms_insert" ON public.quotation_terms
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "quotation_terms_update" ON public.quotation_terms
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "quotation_terms_delete" ON public.quotation_terms
    FOR DELETE TO authenticated USING (true);

-- Policies for quotation_selected_terms
CREATE POLICY "quotation_selected_terms_select" ON public.quotation_selected_terms
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "quotation_selected_terms_insert" ON public.quotation_selected_terms
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "quotation_selected_terms_update" ON public.quotation_selected_terms
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "quotation_selected_terms_delete" ON public.quotation_selected_terms
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 4. Insert sample terms data based on image
-- ============================================

-- Remarks
INSERT INTO public.quotation_terms (category, title, content, sort_order) VALUES
('Remarks', NULL, 'Commissioning & handling over will be carried out upon delivery & installation of equipment.', 1),
('Remarks', NULL, 'CNK Tan Pte Ltd shall not be liable for:', 2),
('Remarks', NULL, 'Any loss of life, monetary loss and damage claims in the event of an equipment failure.', 3),
('Remarks', NULL, 'Goods sold are non-returnable and non-refundable.', 4);

-- Warranty
INSERT INTO public.quotation_terms (category, title, content, sort_order) VALUES
('Warranty', 'THIS QUOTATION DOES NOT INCLUDE', '1) IF ANY OTHERS WORK WILL QUOTE YOU SEPARATELY', 1),
('Warranty', 'WARRANTY : 1 Years (SUBJECT TO MANUFACTURING DEFECT)', '*Price includes off site limited warranty against manufacturing defect from date of completion work. We will, at our discretion, replace with the same or similar product that is found to be defective in material or workmanship within warranty period. Our sole liability being limited to supply of a replacement unit. We shall be under no obligation to replace units which are found to be defective in any way due to unreasonable use or neglect, improper storage, if not used in accordance with its user manual, or if the product has been tampered with or found to be dismantle', 2);

-- Cancellation
INSERT INTO public.quotation_terms (category, title, content, sort_order) VALUES
('Cancellation', NULL, 'Any cancellation of orders after confirmation or receiving of an official Purchase Order are subjected to a cancellation charge of 50% of the total contract amount.', 1);

-- Payment Plan
INSERT INTO public.quotation_terms (category, title, content, sort_order) VALUES
('Payment Plan', 'Payment Plan: Progressive', '1st – 50% Upon Project Schedule Submission\n2nd – 30% Upon Goods Delivered\n3rd – 20% Upon Work Completion', 1);

-- General Terms
INSERT INTO public.quotation_terms (category, title, content, sort_order) VALUES
('General Terms', NULL, 'All items are billed in Singapore Dollars, unless otherwise stated and without GST.', 1),
('General Terms', NULL, 'Full or Partial Deposit payment will not be refunded upon the confirmation of this quotation / invoice.', 2),
('General Terms', NULL, 'All equipment as listed in this quotation remains as the property of CNK Tan Pte Ltd until the full payment has been received.', 3),
('General Terms', NULL, 'Late payments are subjected to a 5% interest monthly.', 4),
('General Terms', NULL, 'CNK Tan Pte Ltd reserves the full right to replace or exchange items with equivalent value, in case of stock shortage with immediate payment terms', 5);
