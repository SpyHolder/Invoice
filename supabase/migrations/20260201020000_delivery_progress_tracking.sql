-- Fix delivery progress - prevent quantity doubling from JOIN duplication
-- Bug: When 2 DOs exist, SO quantities get counted multiple times (8 becomes 16)
-- Solution: Use subqueries to aggregate delivered quantities separately

DROP VIEW IF EXISTS v_so_delivery_progress;

CREATE OR REPLACE VIEW v_so_delivery_progress AS
WITH so_totals AS (
    -- Calculate SO totals separately (no JOIN duplication)
    SELECT 
        so_id,
        COUNT(*) AS total_so_items,
        COALESCE(SUM(quantity), 0) AS total_quantity
    FROM sales_order_items
    GROUP BY so_id
),
delivered_totals AS (
    -- Calculate delivered totals by joining DO items with SO items
    SELECT 
        soi.so_id,
        COUNT(DISTINCT soi.description) AS delivered_item_count,
        COALESCE(SUM(doi.quantity), 0) AS delivered_quantity
    FROM sales_order_items soi
    INNER JOIN delivery_orders do_tbl ON do_tbl.so_id = soi.so_id
    INNER JOIN delivery_order_items doi ON doi.do_id = do_tbl.id 
        AND doi.description = soi.description
    GROUP BY soi.so_id
),
do_counts AS (
    -- Count DOs per SO
    SELECT 
        so_id,
        COUNT(*) AS do_count
    FROM delivery_orders
    GROUP BY so_id
)
SELECT 
    so.id AS so_id,
    so.so_number,
    so.customer_po_number,
    
    -- SO totals (no duplication)
    COALESCE(st.total_so_items, 0) AS total_so_items,
    COALESCE(st.total_quantity, 0) AS total_quantity,
    
    -- Delivered totals
    COALESCE(dt.delivered_item_count, 0) AS delivered_items,
    COALESCE(dt.delivered_quantity, 0) AS delivered_quantity,
    
    -- Progress percentages
    CASE 
        WHEN COALESCE(st.total_so_items, 0) > 0 
        THEN ROUND((COALESCE(dt.delivered_item_count, 0)::DECIMAL / st.total_so_items * 100), 2)
        ELSE 0
    END AS items_delivered_percentage,
    
    CASE 
        WHEN COALESCE(st.total_quantity, 0) > 0 
        THEN ROUND((COALESCE(dt.delivered_quantity, 0)::DECIMAL / st.total_quantity * 100), 2)
        ELSE 0
    END AS quantity_delivered_percentage,
    
    -- Delivery status based on QUANTITY
    CASE 
        WHEN COALESCE(st.total_so_items, 0) = 0 THEN 'Not Started'
        WHEN COALESCE(dt.delivered_quantity, 0) = 0 THEN 'Not Started'
        WHEN COALESCE(dt.delivered_quantity, 0) >= COALESCE(st.total_quantity, 0) THEN 'Fully Delivered'
        ELSE 'Partially Delivered'
    END AS delivery_status,
    
    -- DO count
    COALESCE(dc.do_count, 0) AS do_count

FROM sales_orders so
LEFT JOIN so_totals st ON st.so_id = so.id
LEFT JOIN delivered_totals dt ON dt.so_id = so.id
LEFT JOIN do_counts dc ON dc.so_id = so.id;

COMMENT ON VIEW v_so_delivery_progress IS 'Delivery progress using CTEs to prevent JOIN duplication. Correctly shows 4/8 not 8/16.';
