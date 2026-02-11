import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Package } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, SalesOrderItem, DeliveryOrderItem } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

interface DOItem extends DeliveryOrderItem {
    so_item_id?: string;
    group_name?: string | null;
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
    const [newGroupName, setNewGroupName] = useState('');
    const [qtyInputs, setQtyInputs] = useState<Record<string, number>>({});

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

        const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', soId);

        if (items) {
            let query = supabase.from('delivery_orders').select('id, do_number').eq('so_id', soId);
            if (id) query = query.neq('id', id);

            const { data: existingDOs } = await query;

            if (existingDOs && existingDOs.length > 0) {
                const doIds = existingDOs.map(d => d.id);
                const { data: deliveredItems } = await supabase.from('delivery_order_items').select('description, quantity').in('do_id', doIds);

                const deliveredQtyMap = new Map<string, number>();
                if (deliveredItems) {
                    deliveredItems.forEach(item => {
                        const desc = item.description?.trim().toLowerCase();
                        if (desc) {
                            deliveredQtyMap.set(desc, (deliveredQtyMap.get(desc) || 0) + (item.quantity || 0));
                        }
                    });
                }

                const itemsWithRemaining = items
                    .map(item => ({
                        ...item,
                        quantity: item.quantity - (deliveredQtyMap.get(item.description?.trim().toLowerCase() || '') || 0)
                    }))
                    .filter(item => item.quantity > 0);

                setAvailableItems(itemsWithRemaining);

                if (itemsWithRemaining.length < items.length) {
                    showToast(`${items.length - itemsWithRemaining.length} item(s) fully delivered. Showing remaining.`, 'info');
                }
            } else {
                setAvailableItems(items);
            }

            const uniquePhases = Array.from(new Set(items.map(i => i.phase_name).filter(Boolean) as string[]));
            setAvailablePhases(uniquePhases);
        }

        // Fetch Customer shipping address
        const { data: so } = await supabase.from('sales_orders').select('quotation_id').eq('id', soId).single();
        if (so?.quotation_id) {
            const { data: q } = await supabase.from('quotations').select('customer_id, partners(address, shipping_address)').eq('id', so.quotation_id).single();
            if (q?.partners) {
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

            const { data: items } = await supabase.from('delivery_order_items').select('*').eq('do_id', doId);
            if (items) {
                const grouped: Record<string, DOItem[]> = {};
                const ungrouped: DOItem[] = [];

                items.forEach(item => {
                    const groupName = item.group_name;
                    if (groupName && groupName.trim() !== '' && groupName !== 'Ungrouped') {
                        if (!grouped[groupName]) grouped[groupName] = [];
                        grouped[groupName].push({ ...item });
                    } else {
                        ungrouped.push({ ...item, group_name: null });
                    }
                });

                const groupArray = Object.keys(grouped).map((name, idx) => ({
                    id: `group-${idx}`,
                    name,
                    items: grouped[name]
                }));
                setGroups(groupArray);
                setUngroupedItems(ungrouped);
            }
        } catch (error) {
            showToast('Failed to load DO', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Phase selection handlers
    const handlePhaseToggle = (phase: string) => {
        setSelectedPhases(prev => prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]);
    };

    const handleGenerateFromPhases = () => {
        const newGroups: DOGroup[] = selectedPhases.map(phase => {
            const phaseItems = availableItems.filter(i => i.phase_name === phase);
            return {
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
            };
        }).filter(g => g.items.length > 0);

        setGroups(newGroups);
        if (!formData.subject && selectedPhases.length > 0) {
            setFormData(prev => ({ ...prev, subject: `${selectedPhases.join(', ')} - Upon Project Schedule` }));
        }
    };

    // Item management
    const handleItemChange = (groupId: string, itemId: string, field: keyof DOItem, value: any) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, [field]: value } : i) } : g));
    };

    const handleRemoveItem = (groupId: string, itemId: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g));
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

    // Group management
    const handleCreateCustomGroup = () => {
        if (!newGroupName.trim()) return;
        if (groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
            showToast('Group name already exists', 'error');
            return;
        }
        setGroups([...groups, { id: `custom-${Date.now()}`, name: newGroupName.trim(), items: [] }]);
        setNewGroupName('');
        showToast(`Group "${newGroupName}" created`, 'success');
    };

    const handleRenameGroup = (groupId: string, newName: string) => {
        if (!newName.trim()) return;
        setGroups(groups.map(g => g.id === groupId ? { ...g, name: newName.trim(), items: g.items.map(i => ({ ...i, group_name: newName.trim() })) } : g));
    };

    const handleDeleteGroup = (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        setUngroupedItems([...ungroupedItems, ...group.items.map(i => ({ ...i, group_name: null }))]);
        setGroups(groups.filter(g => g.id !== groupId));
        showToast(`Group "${group.name}" deleted`, 'info');
    };

    const handleMoveItem = (fromGroupId: string | null, itemId: string, toGroupId: string | null) => {
        let itemToMove: DOItem | undefined;

        if (fromGroupId) {
            itemToMove = groups.find(g => g.id === fromGroupId)?.items.find(i => i.id === itemId);
            setGroups(groups.map(g => g.id === fromGroupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g));
        } else {
            itemToMove = ungroupedItems.find(i => i.id === itemId);
            setUngroupedItems(ungroupedItems.filter(i => i.id !== itemId));
        }

        if (!itemToMove) return;

        if (toGroupId) {
            setGroups(groups.map(g => g.id === toGroupId ? { ...g, items: [...g.items, { ...itemToMove, group_name: g.name }] } : g));
        } else {
            setUngroupedItems([...ungroupedItems, { ...itemToMove, group_name: null }]);
        }
    };

    // Qty tracking
    const getTotalAssignedQty = (soItemDescription: string): number => {
        let total = 0;
        groups.forEach(g => g.items.forEach(i => { if (i.description === soItemDescription) total += i.quantity; }));
        ungroupedItems.forEach(i => { if (i.description === soItemDescription) total += i.quantity; });
        return total;
    };

    const getRemainingQty = (soItem: SalesOrderItem): number => soItem.quantity - getTotalAssignedQty(soItem.description || '');

    const handleAssignSOItemToGroup = (soItem: SalesOrderItem, targetGroupId: string | null, qty: number) => {
        const remaining = getRemainingQty(soItem);
        if (qty <= 0 || qty > remaining) {
            showToast(qty <= 0 ? 'Quantity must be > 0' : `Only ${remaining} remaining`, 'error');
            return;
        }

        const newItem: DOItem = {
            id: `so-${Date.now()}-${Math.random()}`,
            do_id: '',
            item_code: '',
            description: soItem.description || '',
            quantity: qty,
            uom: soItem.uom || 'EA',
            group_name: null
        };

        if (targetGroupId) {
            setGroups(groups.map(g => g.id === targetGroupId ? { ...g, items: [...g.items, { ...newItem, group_name: g.name }] } : g));
        } else {
            setUngroupedItems([...ungroupedItems, newItem]);
        }
        showToast(`Added ${qty} ${soItem.uom}`, 'success');
    };

    const getAvailableSOItems = () => availableItems.filter(soItem => getRemainingQty(soItem) > 0);

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
                await supabase.from('delivery_orders').update(doData).eq('id', id);
                await supabase.from('delivery_order_items').delete().eq('do_id', id);
            } else {
                const { data, error } = await supabase.from('delivery_orders').insert([{ ...doData, do_number: 'DO-' + Date.now() }]).select().single();
                if (error) throw error;
                doId = data.id;
            }

            if (doId) {
                const allItems = [
                    ...groups.flatMap(g => g.items.map(i => ({ do_id: doId, item_code: i.item_code, description: i.description, quantity: i.quantity, uom: i.uom, group_name: g.name }))),
                    ...ungroupedItems.map(i => ({ do_id: doId, item_code: i.item_code, description: i.description, quantity: i.quantity, uom: i.uom, group_name: null }))
                ];

                if (allItems.length > 0) {
                    await supabase.from('delivery_order_items').insert(allItems);
                }
            }

            showToast('Delivery Order saved', 'success');
            navigate('/delivery-orders');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const totalItemsCount = groups.reduce((sum, g) => sum + g.items.length, 0) + ungroupedItems.length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Delivery Order</h1>
                        {formData.so_id && <p className="text-sm text-gray-500 mt-1">Linked to SO</p>}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: Sales Order Source */}
                <Card>
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Source Sales Order
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Sales Order <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.so_id}
                                    onChange={(e) => handleSOSelection(e.target.value)}
                                    className="w-full pl-3 pr-8 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none disabled:bg-gray-100 disabled:text-gray-500"
                                    disabled={isEditMode}
                                    required
                                >
                                    <option value="">Select Sales Order...</option>
                                    {salesOrders.map(so => (
                                        <option key={so.id} value={so.id}>
                                            {so.so_number} (PO: {so.customer_po_number || 'N/A'})
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Phase Selection - only show when SO selected and phases exist */}
                        {formData.so_id && !isEditMode && availablePhases.length > 0 && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <label className="block text-sm font-medium text-blue-900 mb-3">
                                    Quick Import by Phase (Optional)
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    {availablePhases.map(phase => (
                                        <label key={phase} className="flex items-center gap-2 p-2.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors shadow-sm">
                                            <input
                                                type="checkbox"
                                                checked={selectedPhases.includes(phase)}
                                                onChange={() => handlePhaseToggle(phase)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">{phase}</span>
                                        </label>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleGenerateFromPhases}
                                    disabled={selectedPhases.length === 0}
                                    className="w-full"
                                >
                                    Import Items from {selectedPhases.length} Selected Phase(s)
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Section 2: Delivery Information */}
                <Card>
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Delivery Information
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subject <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                                required
                                placeholder="e.g. Phase 1 - Upon Project Schedule"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                            <input
                                type="text"
                                value={formData.terms}
                                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                                placeholder="e.g. On-Site Delivery"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Requestor Name</label>
                            <input
                                type="text"
                                value={formData.requestor_name}
                                onChange={(e) => setFormData({ ...formData, requestor_name: e.target.value })}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                                placeholder="e.g. Sammy"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                            <textarea
                                value={formData.shipping_address_snapshot}
                                onChange={(e) => setFormData({ ...formData, shipping_address_snapshot: e.target.value })}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-y placeholder:text-gray-400"
                                placeholder="Delivery address..."
                            />
                        </div>
                    </div>
                </Card>

                {/* Section 3: Item Selection from SO */}
                {formData.so_id && getAvailableSOItems().length > 0 && (
                    <Card>
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Available Items from SO
                            <span className="ml-auto text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {getAvailableSOItems().length} items available
                            </span>
                        </h2>

                        {/* Custom Group Creation */}
                        {!isEditMode && (
                            <div className="bg-purple-50 p-4 rounded-lg mb-6 border border-purple-100">
                                <label className="block text-sm font-medium text-purple-900 mb-2">Create Custom Group (Optional)</label>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleCreateCustomGroup()}
                                        placeholder="Enter group name..."
                                        className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400"
                                    />
                                    <Button type="button" onClick={handleCreateCustomGroup} disabled={!newGroupName.trim()} variant="secondary">
                                        Create
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                            {getAvailableSOItems().map((soItem, idx) => {
                                const remaining = getRemainingQty(soItem);
                                const qtyKey = `so-${idx}`;
                                const currentQty = qtyInputs[qtyKey] ?? remaining;

                                return (
                                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors shadow-sm">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-900 truncate">{soItem.description}</span>
                                                {soItem.phase_name && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                                                        {soItem.phase_name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Available: <span className="font-medium text-gray-900">{remaining} {soItem.uom}</span>
                                                <span className="text-gray-400 mx-2">|</span>
                                                Original: {soItem.quantity} {soItem.uom}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs font-medium text-gray-500">Qty:</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={remaining}
                                                    value={currentQty}
                                                    onChange={(e) => setQtyInputs({ ...qtyInputs, [qtyKey]: Math.min(parseInt(e.target.value) || 0, remaining) })}
                                                    className="w-20 px-2 py-1.5 bg-white border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <select
                                                onChange={(e) => {
                                                    if (e.target.value && currentQty > 0) {
                                                        handleAssignSOItemToGroup(soItem, e.target.value === '__ungrouped__' ? null : e.target.value, currentQty);
                                                        // Don't manually update qtyInputs - let remaining qty recalculate automatically
                                                        e.target.value = '';
                                                    }
                                                }}
                                                className="w-40 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                value=""
                                            >
                                                <option value="">Add to...</option>
                                                <option value="__ungrouped__">Ungrouped</option>
                                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* Section 4: Items Review */}
                <Card>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Delivery Items
                            <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {totalItemsCount} items
                            </span>
                        </h2>
                        <Button type="button" onClick={handleAddUngroupedItem} variant="secondary" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Manual Item
                        </Button>
                    </div>

                    {/* Grouped Items */}
                    {groups.length > 0 && (
                        <div className="space-y-6 mb-8">
                            {groups.map((group) => (
                                <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="flex justify-between items-center bg-gray-50 px-4 py-3 border-b border-gray-200">
                                        <div className="flex items-center gap-3 flex-1">
                                            <input
                                                type="text"
                                                value={group.name}
                                                onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                                                className="bg-transparent font-semibold text-gray-900 focus:outline-none focus:border-b-2 focus:border-blue-500 px-1"
                                            />
                                            <span className="text-xs font-medium bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-500">
                                                {group.items.length} items
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteGroup(group.id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            title="Delete Group"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-white border-b border-gray-100 text-left text-gray-500 font-medium">
                                                    <th className="py-2.5 px-4 w-[40%]">Description</th>
                                                    <th className="py-2.5 px-2 w-24">Qty</th>
                                                    <th className="py-2.5 px-2 w-24">UOM</th>
                                                    <th className="py-2.5 px-2 w-40">Move To</th>
                                                    <th className="py-2.5 px-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {group.items.map((item) => (
                                                    <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                                        <td className="py-2 px-4">
                                                            <input
                                                                type="text"
                                                                value={item.description || ''}
                                                                onChange={(e) => handleItemChange(group.id, item.id || '', 'description', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleItemChange(group.id, item.id || '', 'quantity', parseFloat(e.target.value))}
                                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-sm"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="text"
                                                                value={item.uom || ''}
                                                                onChange={(e) => handleItemChange(group.id, item.id || '', 'uom', e.target.value)}
                                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-sm"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <select
                                                                onChange={(e) => { handleMoveItem(group.id, item.id || '', e.target.value === '__ungrouped__' ? null : e.target.value); e.target.value = ''; }}
                                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs cursor-pointer"
                                                                value=""
                                                            >
                                                                <option value="">Move...</option>
                                                                <option value="__ungrouped__">Ungrouped</option>
                                                                {groups.filter(g => g.id !== group.id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="py-2 px-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(group.id, item.id || '')}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ungrouped Items */}
                    {(ungroupedItems.length > 0 || groups.length === 0) && (
                        <div className={`border border-gray-200 rounded-xl overflow-hidden ${ungroupedItems.length === 0 && groups.length === 0 ? 'border-dashed' : ''}`}>
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h3 className="font-semibold text-gray-900">Ungrouped Items</h3>
                            </div>

                            {ungroupedItems.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-white border-b border-gray-100 text-left text-gray-500 font-medium">
                                                <th className="py-2.5 px-4 w-[40%]">Description</th>
                                                <th className="py-2.5 px-2 w-24">Qty</th>
                                                <th className="py-2.5 px-2 w-24">UOM</th>
                                                <th className="py-2.5 px-2 w-40">Move To</th>
                                                <th className="py-2.5 px-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {ungroupedItems.map((item) => (
                                                <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-2 px-4">
                                                        <input
                                                            type="text"
                                                            value={item.description || ''}
                                                            onChange={(e) => handleUngroupedItemChange(item.id || '', 'description', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUngroupedItemChange(item.id || '', 'quantity', parseFloat(e.target.value))}
                                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-sm"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <input
                                                            type="text"
                                                            value={item.uom || ''}
                                                            onChange={(e) => handleUngroupedItemChange(item.id || '', 'uom', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-sm"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2">
                                                        <select
                                                            onChange={(e) => handleMoveItem(null, item.id || '', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs cursor-pointer"
                                                            value=""
                                                        >
                                                            <option value="">Move...</option>
                                                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="py-2 px-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveUngroupedItem(item.id || '')}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                                        <Package className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-1">No items selected</h3>
                                    <p className="text-gray-500 text-sm max-w-sm mx-auto">
                                        Select items from the "Available Items" section above or click "Add Manual Item" to get started.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                <div className="flex gap-4 justify-end pt-6 border-t border-gray-200 mt-8 sticky bottom-0 bg-gray-50/80 backdrop-blur-sm p-4 -mx-4 -mb-4 rounded-b-lg">
                    <Button type="button" variant="secondary" onClick={() => navigate('/delivery-orders')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || totalItemsCount === 0}>
                        {loading ? 'Saving...' : 'Save Delivery Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
