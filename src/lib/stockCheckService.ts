/**
 * Stock Check and Back-to-Back PO Service
 * 
 * Checks stock levels when a Sales Order is confirmed and automatically
 * creates Purchase Orders for items with insufficient stock.
 */

import { supabase } from './supabase';

interface StockCheckResult {
    itemDescription: string;
    requiredQty: number;
    availableStock: number;
    shortfall: number;
    itemId: string | null;
}

interface POCreationResult {
    success: boolean;
    poId?: string;
    poNumber?: string;
    itemsCount: number;
    error?: string;
}

/**
 * Check stock levels for all items in a Sales Order
 */
export async function checkStockForSO(soId: string): Promise<StockCheckResult[]> {
    // Get SO items
    const { data: soItems, error: soError } = await supabase
        .from('sales_order_items')
        .select('description, quantity')
        .eq('so_id', soId);

    if (soError || !soItems) {
        console.error('Failed to fetch SO items:', soError);
        return [];
    }

    const results: StockCheckResult[] = [];

    for (const soItem of soItems) {
        if (!soItem.description) continue;

        // Find matching item in inventory
        const { data: inventoryItem } = await supabase
            .from('items')
            .select('id, stock, category')
            .ilike('description', soItem.description)
            .maybeSingle();

        const availableStock = inventoryItem?.stock ?? 0;
        const requiredQty = soItem.quantity || 0;
        const shortfall = Math.max(0, requiredQty - availableStock);

        // Only include items with shortfall and that are goods (not services)
        // Services typically have category = 'service' or similar
        const isGoods = !inventoryItem?.category ||
            inventoryItem.category.toLowerCase() !== 'service';

        if (shortfall > 0 && isGoods) {
            results.push({
                itemDescription: soItem.description,
                requiredQty,
                availableStock,
                shortfall,
                itemId: inventoryItem?.id || null
            });
        }
    }

    return results;
}

/**
 * Create a Purchase Order for items with insufficient stock
 */
export async function createBackToBackPO(
    _soId: string,  // Used for future tracking/linking
    soNumber: string,
    items: StockCheckResult[],
    vendorId?: string
): Promise<POCreationResult> {
    if (items.length === 0) {
        return { success: true, itemsCount: 0 };
    }

    try {
        // Generate PO number
        const poNumber = `PO-BTB-${Date.now()}`;

        // Calculate totals (use 0 as placeholder since we don't have supplier prices)
        const subtotal = 0;
        const tax = 0;
        const total = 0;

        // Create PO header
        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .insert([{
                po_number: poNumber,
                vendor_id: vendorId || null,
                date: new Date().toISOString().split('T')[0],
                quote_ref: soNumber, // Reference to source SO for tracking
                subtotal,
                tax,
                total,
                status: 'draft',
                notes: `Auto-generated Back-to-Back PO from ${soNumber}. Prices need to be updated.`
            }])
            .select()
            .single();

        if (poError) throw poError;

        // Create PO items
        const poItems = items.map(item => ({
            po_id: po.id,
            description: item.itemDescription,
            quantity: item.shortfall,
            unit_price: 0, // Placeholder - needs update
            total: 0
        }));

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(poItems);

        if (itemsError) throw itemsError;

        return {
            success: true,
            poId: po.id,
            poNumber: po.po_number,
            itemsCount: items.length
        };
    } catch (error: any) {
        console.error('Failed to create Back-to-Back PO:', error);
        return {
            success: false,
            itemsCount: 0,
            error: error.message
        };
    }
}

/**
 * Main function: Check stock and create PO if needed
 * Called after SO is confirmed
 */
export async function checkStockAndCreatePO(
    soId: string,
    soNumber: string
): Promise<{ checked: boolean; poCreated: boolean; poNumber?: string; shortfallItems: number }> {
    // Step 1: Check stock
    const shortfallItems = await checkStockForSO(soId);

    if (shortfallItems.length === 0) {
        return { checked: true, poCreated: false, shortfallItems: 0 };
    }

    // Step 2: Create PO for shortfall items
    const result = await createBackToBackPO(soId, soNumber, shortfallItems);

    return {
        checked: true,
        poCreated: result.success && result.itemsCount > 0,
        poNumber: result.poNumber,
        shortfallItems: shortfallItems.length
    };
}
