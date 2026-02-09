/**
 * Stock Management Service - PULL PROCUREMENT SYSTEM
 * 
 * Logic:
 * 1. When SO is confirmed, deduct available stock and record shortage (qty_backordered)
 * 2. NO auto PO creation - user manually creates PO from backlog
 * 3. When PO is received, stock increases and can fulfill backorders
 */

import { supabase } from './supabase';

interface StockReservationResult {
    success: boolean;
    processedItems: number;
    totalBackordered: number;
    error?: string;
}

interface BacklogItem {
    id: string;
    so_id: string;
    so_number: string;
    description: string;
    qty_backordered: number;
    phase_name: string | null;
}

/**
 * Process SO confirmation: deduct stock and record backorders
 * PULL system - no auto PO creation
 */
export async function processSOConfirmation(soId: string): Promise<StockReservationResult> {
    try {
        console.log('processSOConfirmation called for SO:', soId);

        // Get SO items
        const { data: soItems, error: soError } = await supabase
            .from('sales_order_items')
            .select('id, description, quantity')
            .eq('so_id', soId);

        if (soError || !soItems) {
            console.error('Failed to fetch SO items:', soError);
            throw new Error('Failed to fetch SO items');
        }

        console.log('Found SO items:', soItems.length);

        let processedCount = 0;
        let totalBackordered = 0;

        for (const soItem of soItems) {
            if (!soItem.description || !soItem.quantity) {
                console.log('Skipping item with missing description or quantity:', soItem);
                continue;
            }

            console.log('Processing item:', soItem.description, 'qty:', soItem.quantity);

            // Find matching item in inventory by name (items table uses 'name' field)
            // Try matching SO description against items.name OR items.description
            let inventoryItem = null;
            let invError = null;

            // First try matching by name
            const { data: byName, error: err1 } = await supabase
                .from('items')
                .select('id, stock, category, name, description')
                .ilike('name', `%${soItem.description}%`)
                .maybeSingle();

            if (byName) {
                inventoryItem = byName;
            } else {
                // Fallback: try matching by description
                const { data: byDesc, error: err2 } = await supabase
                    .from('items')
                    .select('id, stock, category, name, description')
                    .ilike('description', `%${soItem.description}%`)
                    .maybeSingle();
                inventoryItem = byDesc;
                invError = err1 || err2;
            }

            console.log('Inventory lookup result:', {
                found: !!inventoryItem,
                stock: inventoryItem?.stock,
                invName: inventoryItem?.name,
                invDescription: inventoryItem?.description,
                error: invError
            });

            // Skip service items (no stock tracking)
            const isService = inventoryItem?.category?.toLowerCase() === 'service';
            if (isService) {
                console.log('Item is service, skipping stock tracking');
                // Service items: qty_reserved = quantity, qty_backordered = 0
                const { error: updateError } = await supabase
                    .from('sales_order_items')
                    .update({ qty_reserved: soItem.quantity, qty_backordered: 0 })
                    .eq('id', soItem.id);
                console.log('Service item update result:', { error: updateError });
                processedCount++;
                continue;
            }

            const currentStock = inventoryItem?.stock || 0;
            const orderedQty = soItem.quantity;

            let qtyReserved = 0;
            let qtyBackordered = 0;
            let newStock = currentStock;

            if (currentStock >= orderedQty) {
                // Sufficient stock: reserve all
                qtyReserved = orderedQty;
                qtyBackordered = 0;
                newStock = currentStock - orderedQty;
                console.log('Sufficient stock:', { reserved: qtyReserved, backordered: qtyBackordered });
            } else {
                // Insufficient stock: take what's available, record shortage
                qtyReserved = Math.max(0, currentStock);
                qtyBackordered = orderedQty - qtyReserved;
                newStock = 0; // All stock consumed
                console.log('Insufficient stock:', { reserved: qtyReserved, backordered: qtyBackordered });
            }

            // Update SO item with reservation info
            const { error: soUpdateError } = await supabase
                .from('sales_order_items')
                .update({ qty_reserved: qtyReserved, qty_backordered: qtyBackordered })
                .eq('id', soItem.id);

            console.log('SO item update result:', { error: soUpdateError });

            // Update inventory stock
            if (inventoryItem) {
                const { error: stockUpdateError } = await supabase
                    .from('items')
                    .update({ stock: newStock })
                    .eq('id', inventoryItem.id);
                console.log('Stock update result:', { error: stockUpdateError });
            }

            processedCount++;
            totalBackordered += qtyBackordered;
        }

        console.log('processSOConfirmation complete:', { processedCount, totalBackordered });

        return {
            success: true,
            processedItems: processedCount,
            totalBackordered
        };
    } catch (error: any) {
        console.error('Failed to process SO confirmation:', error);
        return {
            success: false,
            processedItems: 0,
            totalBackordered: 0,
            error: error.message
        };
    }
}

/**
 * Restore stock when SO is cancelled
 */
export async function restoreStockForSO(soId: string): Promise<{ success: boolean; restoredItems: number }> {
    try {
        const { data: soItems, error: soError } = await supabase
            .from('sales_order_items')
            .select('description, qty_reserved')
            .eq('so_id', soId);

        if (soError || !soItems) {
            throw new Error('Failed to fetch SO items');
        }

        let restoredCount = 0;

        for (const soItem of soItems) {
            if (!soItem.description || !soItem.qty_reserved) continue;

            const { data: inventoryItem } = await supabase
                .from('items')
                .select('id, stock')
                .ilike('description', soItem.description)
                .maybeSingle();

            if (inventoryItem) {
                const newStock = (inventoryItem.stock || 0) + soItem.qty_reserved;

                const { error: updateError } = await supabase
                    .from('items')
                    .update({ stock: newStock })
                    .eq('id', inventoryItem.id);

                if (!updateError) {
                    restoredCount++;
                }
            }

            // Reset backorder and reserved
            await supabase
                .from('sales_order_items')
                .update({ qty_reserved: 0, qty_backordered: 0 })
                .eq('so_id', soId);
        }

        return { success: true, restoredItems: restoredCount };
    } catch (error: any) {
        console.error('Failed to restore stock:', error);
        return { success: false, restoredItems: 0 };
    }
}

/**
 * Get all backlog items (items with qty_backordered > 0)
 * For "Create PO from Shortage" feature
 */
export async function getBacklogItems(): Promise<BacklogItem[]> {
    try {
        // First check if column exists by doing a simple query
        const { data, error } = await supabase
            .from('sales_order_items')
            .select(`
                id,
                so_id,
                description,
                qty_backordered,
                phase_name,
                sales_orders!inner (
                    so_number
                )
            `)
            .gt('qty_backordered', 0);

        console.log('getBacklogItems query result:', { data, error });

        if (error) {
            // Check if it's a column not found error
            if (error.message?.includes('qty_backordered')) {
                console.error('Column qty_backordered not found. Please run migration: 20260210_pull_procurement.sql');
                // Fallback: return empty array with helpful message
            }
            throw error;
        }

        const result = (data || []).map((item: any) => ({
            id: item.id,
            so_id: item.so_id,
            so_number: item.sales_orders?.so_number || 'Unknown',
            description: item.description || '',
            qty_backordered: item.qty_backordered || 0,
            phase_name: item.phase_name
        }));

        console.log('getBacklogItems returning:', result.length, 'items');
        return result;
    } catch (error: any) {
        console.error('Failed to fetch backlog items:', error);
        return [];
    }
}

/**
 * Clear backorder after PO items are added
 * Call this after user selects backlog items for PO
 */
export async function markBacklogItemsOrdered(_itemIds: string[]): Promise<boolean> {
    try {
        // We don't clear backorder here - it stays until items are received
        // This could be extended to track "on order" status
        return true;
    } catch (error: any) {
        console.error('Failed to mark backlog items:', error);
        return false;
    }
}

/**
 * Increase stock when PO is received
 * Also clears related backorders if items match
 */
export async function increaseStockForPO(poId: string): Promise<{ success: boolean; updatedItems: number; clearedBackorders: number }> {
    try {
        console.log('increaseStockForPO called for PO:', poId);

        const { data: poItems, error: poError } = await supabase
            .from('purchase_order_items')
            .select('description, quantity')
            .eq('po_id', poId);

        console.log('PO items found:', poItems?.length, poError);

        if (poError || !poItems) {
            throw new Error('Failed to fetch PO items');
        }

        let updatedCount = 0;
        let clearedBackorders = 0;

        for (const poItem of poItems) {
            if (!poItem.description || !poItem.quantity) {
                console.log('Skipping item with missing data:', poItem);
                continue;
            }

            console.log('Processing PO item:', poItem.description, 'qty:', poItem.quantity);

            // Clean description for matching (remove group prefixes like "[Sales Backlog]")
            let cleanDesc = poItem.description;
            if (cleanDesc.startsWith('[')) {
                const closeBracket = cleanDesc.indexOf(']');
                if (closeBracket > 0) {
                    cleanDesc = cleanDesc.substring(closeBracket + 1).trim();
                }
            }
            // Also remove backlog info like "(SO: SO-xxx, Backlog: 8)"
            const parenIndex = cleanDesc.indexOf('(SO:');
            if (parenIndex > 0) {
                cleanDesc = cleanDesc.substring(0, parenIndex).trim();
            }

            console.log('Clean description for matching:', cleanDesc);

            // Try matching by name first (items table uses 'name' as primary field)
            let inventoryItem = null;

            const { data: byName } = await supabase
                .from('items')
                .select('id, stock, name')
                .ilike('name', `%${cleanDesc}%`)
                .maybeSingle();

            if (byName) {
                inventoryItem = byName;
                console.log('Matched by name:', byName.name, 'current stock:', byName.stock);
            } else {
                // Fallback to description matching
                const { data: byDesc } = await supabase
                    .from('items')
                    .select('id, stock, name')
                    .ilike('description', `%${cleanDesc}%`)
                    .maybeSingle();
                inventoryItem = byDesc;
                console.log('Matched by description:', byDesc?.name || 'not found');
            }

            if (inventoryItem) {
                const newStock = (inventoryItem.stock || 0) + poItem.quantity;

                const { error: updateError } = await supabase
                    .from('items')
                    .update({ stock: newStock })
                    .eq('id', inventoryItem.id);

                console.log('Stock updated:', inventoryItem.name, 'from', inventoryItem.stock, 'to', newStock, 'error:', updateError);

                if (!updateError) {
                    updatedCount++;
                }
            } else {
                console.log('No matching inventory item found for:', cleanDesc);
            }

            // Clear/reduce backorders for matching SO items
            const { data: backlogItems } = await supabase
                .from('sales_order_items')
                .select('id, qty_backordered')
                .ilike('description', `%${cleanDesc}%`)
                .gt('qty_backordered', 0)
                .order('created_at', { ascending: true }); // FIFO

            let remainingQty = poItem.quantity;

            for (const backlog of backlogItems || []) {
                if (remainingQty <= 0) break;

                const clearQty = Math.min(remainingQty, backlog.qty_backordered);
                const newBackorder = backlog.qty_backordered - clearQty;

                await supabase
                    .from('sales_order_items')
                    .update({
                        qty_backordered: newBackorder,
                        qty_reserved: backlog.qty_backordered - newBackorder // Add to reserved
                    })
                    .eq('id', backlog.id);

                remainingQty -= clearQty;
                if (clearQty > 0) clearedBackorders++;
            }
        }

        console.log('increaseStockForPO complete:', { updatedCount, clearedBackorders });
        return { success: true, updatedItems: updatedCount, clearedBackorders };
    } catch (error: any) {
        console.error('Failed to increase stock:', error);
        return { success: false, updatedItems: 0, clearedBackorders: 0 };
    }
}

/**
 * Check physical stock availability for Delivery Order items
 */
export async function checkPhysicalStockForDO(doItems: { description: string; quantity: number }[]): Promise<{
    canProceed: boolean;
    insufficientItems: { description: string; needed: number; available: number }[];
}> {
    const insufficientItems: { description: string; needed: number; available: number }[] = [];

    for (const doItem of doItems) {
        if (!doItem.description || !doItem.quantity) continue;

        const { data: inventoryItem } = await supabase
            .from('items')
            .select('id, stock')
            .ilike('description', doItem.description)
            .maybeSingle();

        if (inventoryItem) {
            const currentStock = inventoryItem.stock || 0;

            if (currentStock < doItem.quantity) {
                insufficientItems.push({
                    description: doItem.description,
                    needed: doItem.quantity,
                    available: Math.max(0, currentStock)
                });
            }
        }
    }

    return {
        canProceed: insufficientItems.length === 0,
        insufficientItems
    };
}
