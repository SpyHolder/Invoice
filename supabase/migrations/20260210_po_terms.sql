-- Create table for PO selected terms (links purchase_orders to quotation_terms)
CREATE TABLE IF NOT EXISTS po_selected_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    term_id UUID NOT NULL REFERENCES quotation_terms(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(po_id, term_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_po_selected_terms_po_id ON po_selected_terms(po_id);
CREATE INDEX IF NOT EXISTS idx_po_selected_terms_term_id ON po_selected_terms(term_id);
