-- Add contact and rfq_ref_no columns to quotations table
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS contact TEXT,
ADD COLUMN IF NOT EXISTS rfq_ref_no TEXT;
