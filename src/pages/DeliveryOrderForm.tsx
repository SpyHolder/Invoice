import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Package, Truck, ClipboardList, CheckCircle2 } from 'lucide-react';
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
                <Card className="border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">1</span>
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-semibold">Source Sales Order</h2>
                        <span className="text-xs text-gray-500 ml-2">Required</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Sales Order <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.so_id}
                                onChange={(e) => handleSOSelection(e.target.value)}
                                className="input w-full bg-white"
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
                        </div>

                        {/* Phase Selection - only show when SO selected and phases exist */}
                        {formData.so_id && !isEditMode && availablePhases.length > 0 && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <label className="block text-sm font-medium text-blue-900 mb-2">
                                    Quick Import by Phase (Optional)
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                    {availablePhases.map(phase => (
                                        <label key={phase} className="flex items-center gap-2 p-2 bg-white border rounded hover:bg-blue-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedPhases.includes(phase)}
                                                onChange={() => handlePhaseToggle(phase)}
                                                className="w-4 h-4 text-blue-600"
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
                                    Import Items from {selectedPhases.length} Selected Phase(s)
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Section 2: Delivery Information */}
                <Card className="border-l-4 border-l-green-500">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">2</span>
                        <Truck className="w-5 h-5 text-green-600" />
                        <h2 className="text-xl font-semibold">Delivery Information</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subject <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="input w-full bg-white"
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
                                placeholder="e.g. On-Site Delivery"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                            <textarea
                                value={formData.shipping_address_snapshot}
                                onChange={(e) => setFormData({ ...formData, shipping_address_snapshot: e.target.value })}
                                className="input w-full bg-white h-20"
                                placeholder="Delivery address..."
                            />
                        </div>
                    </div>
                </Card>

                {/* Section 3: Item Selection from SO */}
                {formData.so_id && getAvailableSOItems().length > 0 && (
                    <Card className="border-l-4 border-l-purple-500">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">3</span>
                            <Package className="w-5 h-5 text-purple-600" />
                            <h2 className="text-xl font-semibold">Available Items from SO</h2>
                            <span className="text-xs text-gray-500 ml-2">
                                {getAvailableSOItems().length} items available
                            </span>
                        </div>

                        {/* Custom Group Creation */}
                        {!isEditMode && (
                            <div className="bg-purple-50 p-3 rounded-lg mb-4">
                                <label className="block text-sm font-medium text-purple-900 mb-2">Create Custom Group (Optional)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleCreateCustomGroup()}
                                        placeholder="Enter group name..."
                                        className="flex-1 border rounded-lg p-2 bg-white"
                                    />
                                    <Button type="button" onClick={handleCreateCustomGroup} disabled={!newGroupName.trim()} variant="secondary">
                                        Create
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {getAvailableSOItems().map((soItem, idx) => {
                                const remaining = getRemainingQty(soItem);
                                const qtyKey = `so-${idx}`;
                                const currentQty = qtyInputs[qtyKey] ?? remaining;

                                return (
                                    <div key={idx} className="flex items-center gap-2 p-3 bg-white border border-purple-200 rounded-lg hover:bg-purple-50">
                                        <div className="flex-1">
                                            <span className="font-medium">{soItem.description}</span>
                                            <span className="text-emerald-600 font-medium ml-2 text-sm">
                                                ({remaining} of {soItem.quantity} {soItem.uom} remaining)
                                            </span>
                                            {soItem.phase_name && <span className="text-gray-500 text-xs ml-1">• {soItem.phase_name}</span>}
                                        </div>
                                        <input
                                            type="number"
                                            min="1"
                                            max={remaining}
                                            value={currentQty}
                                            onChange={(e) => setQtyInputs({ ...qtyInputs, [qtyKey]: Math.min(parseInt(e.target.value) || 0, remaining) })}
                                            className="border rounded px-2 py-1 w-20 text-sm text-center"
                                        />
                                        <select
                                            onChange={(e) => {
                                                if (e.target.value && currentQty > 0) {
                                                    handleAssignSOItemToGroup(soItem, e.target.value === '__ungrouped__' ? null : e.target.value, currentQty);
                                                    setQtyInputs({ ...qtyInputs, [qtyKey]: Math.max(0, remaining - currentQty) });
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="border rounded p-2 text-sm bg-white min-w-[130px]"
                                            value=""
                                        >
                                            <option value="">Add to...</option>
                                            <option value="__ungrouped__">Ungrouped</option>
                                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* Section 4: Items Review */}
                <Card className="border-l-4 border-l-orange-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">{formData.so_id && getAvailableSOItems().length > 0 ? '4' : '3'}</span>
                            <CheckCircle2 className="w-5 h-5 text-orange-600" />
                            <h2 className="text-xl font-semibold">Delivery Items</h2>
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded ml-2">{totalItemsCount} items</span>
                        </div>
                        <Button type="button" onClick={handleAddUngroupedItem} variant="secondary">
                            <Plus className="w-4 h-4" />
                            Add Manual Item
                        </Button>
                    </div>

                    {/* Grouped Items */}
                    {groups.length > 0 && (
                        <div className="space-y-4 mb-4">
                            {groups.map((group) => (
                                <div key={group.id} className="bg-blue-50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-blue-200">
                                        <input
                                            type="text"
                                            value={group.name}
                                            onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                                            className="text-lg font-bold bg-transparent border-b-2 border-transparent hover:border-blue-400 focus:border-blue-600 focus:outline-none text-blue-900"
                                        />
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-blue-600">{group.items.length} items</span>
                                            <button type="button" onClick={() => handleDeleteGroup(group.id)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-600">
                                                    <th className="pb-2">Description</th>
                                                    <th className="pb-2 w-20">Qty</th>
                                                    <th className="pb-2 w-20">UOM</th>
                                                    <th className="pb-2 w-28">Move To</th>
                                                    <th className="pb-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="py-1">
                                                            <input type="text" value={item.description || ''} onChange={(e) => handleItemChange(group.id, item.id || '', 'description', e.target.value)} className="input w-full bg-white" />
                                                        </td>
                                                        <td className="py-1">
                                                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(group.id, item.id || '', 'quantity', parseFloat(e.target.value))} className="input w-full bg-white" />
                                                        </td>
                                                        <td className="py-1">
                                                            <input type="text" value={item.uom || ''} onChange={(e) => handleItemChange(group.id, item.id || '', 'uom', e.target.value)} className="input w-full bg-white" />
                                                        </td>
                                                        <td className="py-1">
                                                            <select
                                                                onChange={(e) => { handleMoveItem(group.id, item.id || '', e.target.value === '__ungrouped__' ? null : e.target.value); e.target.value = ''; }}
                                                                className="input w-full text-xs bg-white"
                                                                value=""
                                                            >
                                                                <option value="">Move...</option>
                                                                <option value="__ungrouped__">Ungrouped</option>
                                                                {groups.filter(g => g.id !== group.id).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="py-1">
                                                            <button type="button" onClick={() => handleRemoveItem(group.id, item.id || '')} className="text-red-500">
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
                    {ungroupedItems.length > 0 ? (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-medium text-gray-700 mb-3">Ungrouped Items</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-600">
                                            <th className="pb-2">Description</th>
                                            <th className="pb-2 w-20">Qty</th>
                                            <th className="pb-2 w-20">UOM</th>
                                            <th className="pb-2 w-28">Move To</th>
                                            <th className="pb-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ungroupedItems.map((item) => (
                                            <tr key={item.id}>
                                                <td className="py-1">
                                                    <input type="text" value={item.description || ''} onChange={(e) => handleUngroupedItemChange(item.id || '', 'description', e.target.value)} className="input w-full bg-white" />
                                                </td>
                                                <td className="py-1">
                                                    <input type="number" value={item.quantity} onChange={(e) => handleUngroupedItemChange(item.id || '', 'quantity', parseFloat(e.target.value))} className="input w-full bg-white" />
                                                </td>
                                                <td className="py-1">
                                                    <input type="text" value={item.uom || ''} onChange={(e) => handleUngroupedItemChange(item.id || '', 'uom', e.target.value)} className="input w-full bg-white" />
                                                </td>
                                                <td className="py-1">
                                                    <select onChange={(e) => handleMoveItem(null, item.id || '', e.target.value)} className="input w-full text-xs bg-white" value="">
                                                        <option value="">Move...</option>
                                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-1">
                                                    <button type="button" onClick={() => handleRemoveUngroupedItem(item.id || '')} className="text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : totalItemsCount === 0 ? (
                        <p className="text-center text-gray-500 italic py-8">No items added yet. Add items from SO or click "Add Manual Item".</p>
                    ) : null}
                </Card>

                <div className="flex gap-4 justify-end">
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
