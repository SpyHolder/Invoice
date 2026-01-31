import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, SalesOrderItem, DeliveryOrderItem } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface DOItem extends DeliveryOrderItem {
    so_item_id?: string;
    group_name?: string | null; // Include group_name for proper typing
}

interface DOGroup {
    id: string;
    name: string;
    items: DOItem[];
}

export const DeliveryOrderForm = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const soIdParam = searchParams.get('so_id');
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Data sources
    const [salesOrders, setSalesOrders] = useState<any[]>([]);
    const [availablePhases, setAvailablePhases] = useState<string[]>([]);
    const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
    const [availableItems, setAvailableItems] = useState<SalesOrderItem[]>([]);

    const [formData, setFormData] = useState({
        so_id: '',
        do_number: '',
        date: new Date().toISOString().split('T')[0],
        subject: '',
        terms: 'On-Site Delivery',
        requestor_name: '',
        shipping_address_snapshot: '',
        customer_id: '',
    });

    const [groups, setGroups] = useState<DOGroup[]>([]);
    const [ungroupedItems, setUngroupedItems] = useState<DOItem[]>([]);

    useEffect(() => {
        fetchSalesOrders();
        if (id) {
            setIsEditMode(true);
            loadDeliveryOrder(id);
        } else if (soIdParam) {
            handleSOSelection(soIdParam);
        }
    }, [id, soIdParam]);

    const fetchSalesOrders = async () => {
        const { data } = await supabase.from('sales_orders').select('id, so_number, customer_po_number').eq('status', 'confirmed').order('created_at', { ascending: false });
        if (data) setSalesOrders(data);
    };

    const handleSOSelection = async (soId: string) => {
        setFormData(prev => ({ ...prev, so_id: soId }));

        // Fetch SO items to get phases
        const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', soId);

        if (items) {
            console.log('[DO Filter] Total SO items:', items.length, items.map(i => i.description));

            // Get items already delivered in OTHER DOs from this SO (exclude current DO if editing)
            let query = supabase
                .from('delivery_orders')
                .select('id, do_number')
                .eq('so_id', soId);

            // Only exclude current DO when editing (id exists)
            if (id) {
                query = query.neq('id', id);
            }

            const { data: existingDOs, error: doError } = await query;

            if (doError) {
                console.error('[DO Filter] Error fetching existing DOs:', doError);
            }

            console.log('[DO Filter] Existing DOs:', existingDOs?.length || 0, existingDOs?.map(d => d.do_number));

            if (existingDOs && existingDOs.length > 0) {
                const doIds = existingDOs.map(d => d.id);
                const { data: deliveredItems } = await supabase
                    .from('delivery_order_items')
                    .select('description, quantity')
                    .in('do_id', doIds);

                console.log('[DO Filter] Delivered items:', deliveredItems?.length || 0, deliveredItems);

                // Calculate total delivered quantity per item description
                const deliveredQtyMap = new Map<string, number>();
                if (deliveredItems) {
                    deliveredItems.forEach(item => {
                        const desc = item.description?.trim().toLowerCase();
                        if (desc) {
                            const current = deliveredQtyMap.get(desc) || 0;
                            deliveredQtyMap.set(desc, current + (item.quantity || 0));
                        }
                    });
                }

                console.log('[DO Filter] Delivered qty map:', Object.fromEntries(deliveredQtyMap));

                // Calculate remaining quantities for each item
                const itemsWithRemaining = items
                    .map(item => {
                        const desc = item.description?.trim().toLowerCase();
                        const deliveredQty = desc ? (deliveredQtyMap.get(desc) || 0) : 0;
                        const remainingQty = item.quantity - deliveredQty;

                        return {
                            ...item,
                            quantity: remainingQty
                        };
                    })
                    .filter(item => item.quantity > 0); // Only show items with remaining qty

                console.log('[DO Filter] Items with remaining qty:', itemsWithRemaining.length, itemsWithRemaining);

                setAvailableItems(itemsWithRemaining);

                // Show toast if items were filtered or quantities adjusted
                if (itemsWithRemaining.length < items.length) {
                    const filteredCount = items.length - itemsWithRemaining.length;
                    showToast(
                        `${filteredCount} item(s) fully delivered. Showing ${itemsWithRemaining.length} items with remaining quantities.`,
                        'info'
                    );
                } else if (itemsWithRemaining.some((item, idx) => item.quantity !== items[idx].quantity)) {
                    showToast('Showing remaining quantities for partially delivered items', 'info');
                }
            } else {
                // No existing DOs, all items available
                console.log('[DO Filter] No existing DOs, all items available');
                setAvailableItems(items);
            }

            const uniquePhases = Array.from(new Set(items.map(i => i.phase_name).filter(Boolean) as string[]));
            setAvailablePhases(uniquePhases);
        }

        // Fetch Customer
        const { data: so } = await supabase.from('sales_orders').select('quotation_id').eq('id', soId).single();
        if (so && so.quotation_id) {
            const { data: q } = await supabase.from('quotations').select('customer_id, partners(address, shipping_address)').eq('id', so.quotation_id).single();
            if (q && q.partners) {
                setFormData(prev => ({
                    ...prev,
                    shipping_address_snapshot: (q.partners as any).shipping_address || (q.partners as any).address || ''
                }));
            }
        }
    };

    const loadDeliveryOrder = async (doId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('delivery_orders').select('*').eq('id', doId).single();
            if (error) throw error;

            setFormData({
                so_id: data.so_id || '',
                do_number: data.do_number,
                date: data.date,
                subject: data.subject || '',
                terms: data.terms || '',
                requestor_name: data.requestor_name || '',
                shipping_address_snapshot: data.shipping_address_snapshot || '',
                customer_id: '',
            });

            // Load Items and group by group_name
            const { data: items } = await supabase.from('delivery_order_items').select('*').eq('do_id', doId);
            if (items) {
                const grouped: Record<string, DOItem[]> = {};
                const ungrouped: DOItem[] = [];

                items.forEach(item => {
                    const groupName = item.group_name;
                    if (groupName && groupName !== 'Ungrouped') {
                        if (!grouped[groupName]) grouped[groupName] = [];
                        grouped[groupName].push({
                            id: item.id,
                            do_id: item.do_id,
                            item_code: item.item_code,
                            description: item.description,
                            quantity: item.quantity,
                            uom: item.uom,
                            group_name: item.group_name
                        });
                    } else {
                        ungrouped.push({
                            id: item.id,
                            do_id: item.do_id,
                            item_code: item.item_code,
                            description: item.description,
                            quantity: item.quantity,
                            uom: item.uom,
                            group_name: null
                        });
                    }
                });

                const groupArray = Object.keys(grouped).map((name, idx) => ({
                    id: `group-${idx}`,
                    name: name,
                    items: grouped[name]
                }));
                setGroups(groupArray);
                setUngroupedItems(ungrouped);
            }

        } catch (error) {
            console.error(error);
            showToast('Failed to load DO', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePhaseToggle = (phase: string) => {
        setSelectedPhases(prev =>
            prev.includes(phase)
                ? prev.filter(p => p !== phase)
                : [...prev, phase]
        );
    };

    const handleGenerateFromPhases = () => {
        const newGroups: DOGroup[] = [];

        selectedPhases.forEach(phase => {
            const phaseItems = availableItems.filter(i => i.phase_name === phase);
            if (phaseItems.length > 0) {
                newGroups.push({
                    id: `phase-${phase}`,
                    name: phase,
                    items: phaseItems.map((pi, idx) => ({
                        id: `${phase}-${idx}`,
                        do_id: '',
                        item_code: '',
                        description: pi.description || '',
                        quantity: pi.quantity,
                        uom: pi.uom || 'EA',
                        group_name: phase
                    }))
                });
            }
        });

        setGroups(newGroups);

        if (!formData.subject && selectedPhases.length > 0) {
            setFormData(prev => ({ ...prev, subject: `${selectedPhases.join(', ')} - Upon Project Schedule` }));
        }
    };

    const handleItemChange = (groupId: string, itemId: string, field: keyof DOItem, value: any) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: g.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
                };
            }
            return g;
        }));
    };

    const handleRemoveItem = (groupId: string, itemId: string) => {
        setGroups(groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    items: g.items.filter(i => i.id !== itemId)
                };
            }
            return g;
        }));
    };

    const handleUngroupedItemChange = (itemId: string, field: keyof DOItem, value: any) => {
        setUngroupedItems(ungroupedItems.map(i => i.id === itemId ? { ...i, [field]: value } : i));
    };

    const handleRemoveUngroupedItem = (itemId: string) => {
        setUngroupedItems(ungroupedItems.filter(i => i.id !== itemId));
    };

    const handleAddUngroupedItem = () => {
        setUngroupedItems([...ungroupedItems, {
            id: `ungrouped-${Date.now()}`,
            do_id: '',
            item_code: '',
            description: '',
            quantity: 1,
            uom: 'EA',
            group_name: null
        }]);
    };

    // Get SO items that are not in any phase group
    const getAvailableSOItems = () => {
        if (!formData.so_id || availableItems.length === 0) return [];

        // Get all item descriptions that are already in phase groups
        const groupedDescriptions = new Set(
            groups.flatMap(g => g.items.map(i => i.description))
        );

        // Filter out items that are already in groups
        return availableItems.filter(item => !groupedDescriptions.has(item.description));
    };

    const handleAddFromSOItem = (soItem: SalesOrderItem) => {
        const newItem: DOItem = {
            id: `so-ungrouped-${Date.now()}`,
            do_id: '',
            item_code: '',
            description: soItem.description || '',
            quantity: soItem.quantity,
            uom: soItem.uom || 'EA',
            group_name: null
        };
        setUngroupedItems([...ungroupedItems, newItem]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const doData = {
                so_id: formData.so_id || null,
                date: formData.date,
                subject: formData.subject,
                terms: formData.terms,
                requestor_name: formData.requestor_name,
                shipping_address_snapshot: formData.shipping_address_snapshot
            };

            let doId = id;

            if (isEditMode && id) {
                const { error } = await supabase.from('delivery_orders').update(doData).eq('id', id);
                if (error) throw error;
                await supabase.from('delivery_order_items').delete().eq('do_id', id);
            } else {
                const { data, error } = await supabase.from('delivery_orders').insert([{
                    ...doData,
                    do_number: 'DO-' + Date.now()
                }]).select().single();
                if (error) throw error;
                doId = data.id;
            }

            if (doId) {
                // Combine grouped and ungrouped items
                const groupedItems = groups.flatMap(g =>
                    g.items.map(i => ({
                        do_id: doId,
                        item_code: i.item_code,
                        description: i.description,
                        quantity: i.quantity,
                        uom: i.uom,
                        group_name: g.name
                    }))
                );

                const ungroupedForInsert = ungroupedItems.map(i => ({
                    do_id: doId,
                    item_code: i.item_code,
                    description: i.description,
                    quantity: i.quantity,
                    uom: i.uom,
                    group_name: null
                }));

                const allItems = [...groupedItems, ...ungroupedForInsert];

                if (allItems.length > 0) {
                    const { error } = await supabase.from('delivery_order_items').insert(allItems);
                    if (error) throw error;
                }
            }

            showToast('Delivery Order saved', 'success');
            navigate('/delivery-orders');
        } catch (error: any) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Delivery Order</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Delivery Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source Sales Order</label>
                            <select
                                value={formData.so_id}
                                onChange={(e) => handleSOSelection(e.target.value)}
                                className="input w-full bg-white"
                                disabled={isEditMode}
                            >
                                <option value="">Select SO...</option>
                                {salesOrders.map(so => (
                                    <option key={so.id} value={so.id}>{so.so_number} (PO: {so.customer_po_number})</option>
                                ))}
                            </select>
                        </div>

                        {formData.so_id && !isEditMode && availablePhases.length > 0 && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Phases to Include:</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                    {availablePhases.map(phase => (
                                        <label key={phase} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedPhases.includes(phase)}
                                                onChange={() => handlePhaseToggle(phase)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm">{phase}</span>
                                        </label>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleGenerateFromPhases}
                                    disabled={selectedPhases.length === 0}
                                    className="w-full"
                                >
                                    Generate Items from Selected Phases ({selectedPhases.length})
                                </Button>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="input w-full bg-white"
                                required
                                placeholder="e.g. 01 Phase - Upon Project Schedule"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="input w-full bg-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                            <input
                                type="text"
                                value={formData.terms}
                                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                className="input w-full bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Requestor Name</label>
                            <input
                                type="text"
                                value={formData.requestor_name}
                                onChange={(e) => setFormData({ ...formData, requestor_name: e.target.value })}
                                className="input w-full bg-white"
                                placeholder="e.g. Sammy"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address Snapshot</label>
                            <textarea
                                value={formData.shipping_address_snapshot}
                                onChange={(e) => setFormData({ ...formData, shipping_address_snapshot: e.target.value })}
                                className="input w-full bg-white h-24"
                            />
                        </div>
                    </div>
                </Card>

                {/* Phase Groups */}
                {groups.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Phase Groups</h2>
                        {groups.map((group) => (
                            <Card key={group.id} className="bg-blue-50">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-blue-200">
                                    <h3 className="text-lg font-bold text-blue-900">{group.name}</h3>
                                    <span className="text-sm text-blue-600">{group.items.length} items</span>
                                </div>

                                <table className="table w-full">
                                    <thead>
                                        <tr>
                                            <th>Item Code</th>
                                            <th>Description</th>
                                            <th className="w-24">Qty</th>
                                            <th className="w-24">UOM</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.item_code || ''}
                                                        onChange={(e) => handleItemChange(group.id, item.id, 'item_code', e.target.value)}
                                                        className="input w-full"
                                                        placeholder="Code"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.description || ''}
                                                        onChange={(e) => handleItemChange(group.id, item.id, 'description', e.target.value)}
                                                        className="input w-full"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(group.id, item.id, 'quantity', parseFloat(e.target.value))}
                                                        className="input w-full"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.uom || ''}
                                                        onChange={(e) => handleItemChange(group.id, item.id, 'uom', e.target.value)}
                                                        className="input w-full"
                                                    />
                                                </td>
                                                <td>
                                                    <button type="button" onClick={() => handleRemoveItem(group.id, item.id)} className="text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Ungrouped Items (Manual Input + SO Items) */}
                <Card className="bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-semibold">Other Items (Ungrouped)</h2>
                            <p className="text-sm text-gray-600">Add items manually or select from available SO items</p>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" onClick={handleAddUngroupedItem} variant="secondary">
                                <Plus className="w-4 h-4" /> Add Blank Item
                            </Button>
                        </div>
                    </div>

                    {/* Available SO Items Picker */}
                    {formData.so_id && getAvailableSOItems().length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm font-semibold text-blue-900 mb-2">📦 Available SO Items (not in phase groups):</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {getAvailableSOItems().map((soItem, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleAddFromSOItem(soItem)}
                                        className="text-left p-2 bg-white border border-blue-300 rounded hover:bg-blue-100 text-sm flex justify-between items-center"
                                    >
                                        <span className="truncate">
                                            {soItem.description} ({soItem.quantity} {soItem.uom})
                                            {soItem.phase_name && <span className="text-gray-500 text-xs ml-1">({soItem.phase_name})</span>}
                                        </span>
                                        <Plus className="w-3 h-3 text-blue-600 flex-shrink-0 ml-2" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {ungroupedItems.length > 0 ? (
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Item Code</th>
                                    <th>Description</th>
                                    <th className="w-24">Qty</th>
                                    <th className="w-24">UOM</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {ungroupedItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.item_code || ''}
                                                onChange={(e) => handleUngroupedItemChange(item.id, 'item_code', e.target.value)}
                                                className="input w-full"
                                                placeholder="Code"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.description || ''}
                                                onChange={(e) => handleUngroupedItemChange(item.id, 'description', e.target.value)}
                                                className="input w-full"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleUngroupedItemChange(item.id, 'quantity', parseFloat(e.target.value))}
                                                className="input w-full"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.uom || ''}
                                                onChange={(e) => handleUngroupedItemChange(item.id, 'uom', e.target.value)}
                                                className="input w-full"
                                            />
                                        </td>
                                        <td>
                                            <button type="button" onClick={() => handleRemoveUngroupedItem(item.id)} className="text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-gray-500 italic py-4">No ungrouped items. Click "Add Item" to add manual items.</p>
                    )}
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/delivery-orders')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Delivery Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
