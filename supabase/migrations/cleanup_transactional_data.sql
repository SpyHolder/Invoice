-- ============================================================================
-- CLEANUP SCRIPT - Delete All Transactional Data
-- Purpose: Remove all transaction records while preserving master data
-- Preserves: Items, Partners (Customers & Vendors), Terms & Conditions, Companies
-- ============================================================================

-- IMPORTANT: This script will delete ALL transactional data!
-- Back up your database before running this script.

-- ============================================================================
-- Step 1: Truncate Invoice-Related Data
-- ============================================================================
TRUNCATE TABLE public.invoice_payments CASCADE;
TRUNCATE TABLE public.invoice_items CASCADE;
TRUNCATE TABLE public.invoices CASCADE;

-- ============================================================================
-- Step 2: Truncate Delivery Order Data
-- ============================================================================
TRUNCATE TABLE public.delivery_order_items CASCADE;
TRUNCATE TABLE public.delivery_orders CASCADE;

-- ============================================================================
-- Step 3: Truncate Sales Order Data
-- ============================================================================
TRUNCATE TABLE public.sales_order_items CASCADE;
TRUNCATE TABLE public.sales_orders CASCADE;

-- ============================================================================
-- Step 4: Truncate Quotation Data
-- ============================================================================
TRUNCATE TABLE public.quotation_items CASCADE;
TRUNCATE TABLE public.quotations CASCADE;

-- ============================================================================
-- Step 5: Truncate Purchase Order Data
-- ============================================================================
TRUNCATE TABLE public.purchase_order_items CASCADE;
TRUNCATE TABLE public.purchase_orders CASCADE;

-- ============================================================================
-- PRESERVED TABLES (NOT TRUNCATED):
-- - public.items (Product/Service catalog)
-- - public.partners (Customers & Vendors)
-- - public.terms_and_conditions (if exists)
-- - public.term_categories (if exists)
-- - public.companies (Company information)
-- - public.bank_accounts (Bank account information)
-- - public.user_profiles (User accounts)
-- ============================================================================

-- Display summary of remaining records
SELECT 
    'items' as table_name, 
    COUNT(*) as record_count 
FROM public.items
UNION ALL
SELECT 
    'partners (customers)', 
    COUNT(*) 
FROM public.partners 
WHERE type = 'customer'
UNION ALL
SELECT 
    'partners (vendors)', 
    COUNT(*) 
FROM public.partners 
WHERE type = 'vendor'
UNION ALL
SELECT 
    'companies', 
    COUNT(*) 
FROM public.companies;
