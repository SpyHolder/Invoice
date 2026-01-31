-- FIX RLS POLICIES FOR ALL TABLES
-- Explicitly drop existing policies to ensure new permissive ones are applied.

DO $$
BEGIN
    -- 1. Companies
    DROP POLICY IF EXISTS "Public access companies" ON public.companies;
    EXECUTE 'CREATE POLICY "Public access companies" ON public.companies FOR ALL USING (true) WITH CHECK (true)';

    -- 2. Bank Accounts
    DROP POLICY IF EXISTS "Public access bank_accounts" ON public.bank_accounts;
    EXECUTE 'CREATE POLICY "Public access bank_accounts" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true)';

    -- 3. Partners (CRITICAL FIX)
    DROP POLICY IF EXISTS "Public access partners" ON public.partners;
    EXECUTE 'CREATE POLICY "Public access partners" ON public.partners FOR ALL USING (true) WITH CHECK (true)';

    -- 4. Items
    DROP POLICY IF EXISTS "Public access items" ON public.items;
    EXECUTE 'CREATE POLICY "Public access items" ON public.items FOR ALL USING (true) WITH CHECK (true)';

    -- 5. Quotations
    DROP POLICY IF EXISTS "Public access quotations" ON public.quotations;
    EXECUTE 'CREATE POLICY "Public access quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true)';

    DROP POLICY IF EXISTS "Public access quotation_items" ON public.quotation_items;
    EXECUTE 'CREATE POLICY "Public access quotation_items" ON public.quotation_items FOR ALL USING (true) WITH CHECK (true)';

    -- 6. Sales Orders
    DROP POLICY IF EXISTS "Public access sales_orders" ON public.sales_orders;
    EXECUTE 'CREATE POLICY "Public access sales_orders" ON public.sales_orders FOR ALL USING (true) WITH CHECK (true)';

    DROP POLICY IF EXISTS "Public access sales_order_items" ON public.sales_order_items;
    EXECUTE 'CREATE POLICY "Public access sales_order_items" ON public.sales_order_items FOR ALL USING (true) WITH CHECK (true)';

    -- 7. Delivery Orders
    DROP POLICY IF EXISTS "Public access delivery_orders" ON public.delivery_orders;
    EXECUTE 'CREATE POLICY "Public access delivery_orders" ON public.delivery_orders FOR ALL USING (true) WITH CHECK (true)';

    DROP POLICY IF EXISTS "Public access delivery_order_items" ON public.delivery_order_items;
    EXECUTE 'CREATE POLICY "Public access delivery_order_items" ON public.delivery_order_items FOR ALL USING (true) WITH CHECK (true)';

    -- 8. Invoices
    DROP POLICY IF EXISTS "Public access invoices" ON public.invoices;
    EXECUTE 'CREATE POLICY "Public access invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true)';

    DROP POLICY IF EXISTS "Public access invoice_items" ON public.invoice_items;
    EXECUTE 'CREATE POLICY "Public access invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true)';

    DROP POLICY IF EXISTS "Public access invoice_payments" ON public.invoice_payments;
    EXECUTE 'CREATE POLICY "Public access invoice_payments" ON public.invoice_payments FOR ALL USING (true) WITH CHECK (true)';

    -- 9. Purchase Orders
    DROP POLICY IF EXISTS "Public access purchase_orders" ON public.purchase_orders;
    EXECUTE 'CREATE POLICY "Public access purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true)';

    DROP POLICY IF EXISTS "Public access purchase_order_items" ON public.purchase_order_items;
    EXECUTE 'CREATE POLICY "Public access purchase_order_items" ON public.purchase_order_items FOR ALL USING (true) WITH CHECK (true)';

END $$;
