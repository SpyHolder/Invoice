-- Create term_categories table for dynamic category management
-- This allows users to create, edit, and delete term categories through the UI

-- Create term_categories table
CREATE TABLE IF NOT EXISTS term_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE term_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users to manage categories)
CREATE POLICY "Allow authenticated users to view term categories"
    ON term_categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to create term categories"
    ON term_categories FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update term categories"
    ON term_categories FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete term categories"
    ON term_categories FOR DELETE
    TO authenticated
    USING (true);

-- Insert existing hardcoded categories
INSERT INTO term_categories (name, sort_order) VALUES
    ('Remarks', 1),
    ('Warranty', 2),
    ('Cancellation', 3),
    ('Payment Plan', 4),
    ('General Terms', 5);

-- Add foreign key to quotation_terms table
-- First, ensure all existing terms have valid category values
UPDATE quotation_terms 
SET category = 'Remarks' 
WHERE category NOT IN ('Remarks', 'Warranty', 'Cancellation', 'Payment Plan', 'General Terms');

-- Add category_id column to quotation_terms
ALTER TABLE quotation_terms 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES term_categories(id) ON DELETE RESTRICT;

-- Populate category_id based on existing category text values
UPDATE quotation_terms qt
SET category_id = tc.id
FROM term_categories tc
WHERE qt.category = tc.name;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_quotation_terms_category_id ON quotation_terms(category_id);
CREATE INDEX IF NOT EXISTS idx_term_categories_sort_order ON term_categories(sort_order);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_term_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_term_categories_updated_at
    BEFORE UPDATE ON term_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_term_categories_updated_at();

-- Add comment
COMMENT ON TABLE term_categories IS 'Stores customizable categories for quotation terms and conditions';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
