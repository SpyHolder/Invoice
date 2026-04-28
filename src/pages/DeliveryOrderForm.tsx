import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Package, X, ArrowRightLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SalesOrderItem, DeliveryOrderItem } from '../types';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { SearchableSelect } from '../components/ui/SearchableSelect';

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
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Data sources
    const [quotations, setQuotations] = useState<any[]>([]);
    const [availablePhases, setAvailablePhases] = useState<string[]>([]);
    const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
    const [availableItems, setAvailableItems] = useState<SalesOrderItem[]>([]);

    const [formData, setFormData] = useState({
        quotation_id: '',
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

    // Checkbox multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedAvailableItems, setSelectedAvailableItems] = useState<Set<number>>(new Set());
    const [showMoveModal, setShowMoveModal] = useState(false);

    const toggleSelectItem = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAvailableItem = (idx: number) => {
        setSelectedAvailableItems(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    };

    const getAllItems = (): DOItem[] => [
        ...groups.flatMap(g => g.items),
        ...ungroupedItems
    ];

    const toggleSelectAllInGroup = (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const allSelected = group.items.every(i => selectedItems.has(i.id || ''));
        setSelectedItems(prev => {
            const next = new Set(prev);
            group.items.forEach(i => { if (allSelected) next.delete(i.id || ''); else next.add(i.id || ''); });
            return next;
        });
    };

    const toggleSelectAllUngrouped = () => {
        const allSelected = ungroupedItems.every(i => selectedItems.has(i.id || ''));
        setSelectedItems(prev => {
            const next = new Set(prev);
            ungroupedItems.forEach(i => { if (allSelected) next.delete(i.id || ''); else next.add(i.id || ''); });
            return next;
        });
    };

    const deleteSelectedItemsDO = () => {
        if (selectedItems.size === 0) return;
        setGroups(prev => prev.map(g => ({ ...g, items: g.items.filter(i => !selectedItems.has(i.id || '')) })));
        setUngroupedItems(prev => prev.filter(i => !selectedItems.has(i.id || '')));
        showToast(`Deleted ${selectedItems.size} item(s)`, 'success');
        setSelectedItems(new Set());
    };

    const getSelectedItemsList = (): DOItem[] => {
        return getAllItems().filter(i => selectedItems.has(i.id || ''));
    };

    const handleBulkMoveToGroup = (targetGroupId: string | null) => {
        const itemsToMove = getSelectedItemsList();
        if (itemsToMove.length === 0) return;

        // Remove from current locations
        const selectedIds = new Set(itemsToMove.map(i => i.id));
        const newGroups = groups.map(g => ({ ...g, items: g.items.filter(i => !selectedIds.has(i.id)) }));
        const newUngrouped = ungroupedItems.filter(i => !selectedIds.has(i.id));

        if (targetGroupId) {
            const targetGroup = newGroups.find(g => g.id === targetGroupId);
            if (targetGroup) {
                targetGroup.items = [...targetGroup.items, ...itemsToMove.map(i => ({ ...i, group_name: targetGroup.name }))];
            }
        } else {
            newUngrouped.push(...itemsToMove.map(i => ({ ...i, group_name: null })));
        }

        setGroups(newGroups);
        setUngroupedItems(newUngrouped);
        setSelectedItems(new Set());
        setShowMoveModal(false);
        showToast(`Moved ${itemsToMove.length} item(s)`, 'success');
    };

    const handleBulkAssignAvailableItems = (targetGroupId: string | null) => {
        if (selectedAvailableItems.size === 0) return;
        
        const availableSOItems = getAvailableSOItems();
        let newGroups = [...groups];
        let newUngrouped = [...ungroupedItems];
        let itemsAdded = 0;

        selectedAvailableItems.forEach(idx => {
            const soItem = availableSOItems[idx];
            if (!soItem) return;
            
            
            // Use getRemainingQty for robust remaining quantity checking
            const currentRemaining = getRemainingQty(soItem);
            
            const qtyKey = `so-${idx}`;
            const currentQty = qtyInputs[qtyKey] ?? currentRemaining;
            
            if (currentQty <= 0 || currentQty > currentRemaining) return;

            const newItem: DOItem = {
                id: `so-${Date.now()}-${Math.random()}`,
                do_id: '',
                item_code: '',
                description: soItem.description || '',
                quantity: currentQty,
                uom: soItem.uom,
                so_item_id: soItem.id,
                group_name: targetGroupId ? (newGroups.find(g => g.id === targetGroupId)?.name || null) : null
            };

            if (targetGroupId) {
                newGroups = newGroups.map(g => g.id === targetGroupId ? { ...g, items: [...g.items, newItem] } : g);
            } else {
                newUngrouped.push(newItem);
            }
            itemsAdded++;
        });

        if (itemsAdded > 0) {
            setGroups(newGroups);
            setUngroupedItems(newUngrouped);
            setSelectedAvailableItems(new Set());
            showToast(`Added ${itemsAdded} item(s)`, 'success');
        } else {
            showToast('No items were added due to invalid quantities.', 'error');
        }
    };

    useEffect(() => {
        fetchQuotations();
        const searchParams = new URLSearchParams(window.location.search);
        const quotationIdParam = searchParams.get('quotation_id');
        const duplicateId = searchParams.get('duplicate');
        if (id) {
            setIsEditMode(true);
            loadDeliveryOrder(id);
        } else if (duplicateId) {
            loadDeliveryOrder(duplicateId, true);
        } else if (quotationIdParam) {
            handleQuotationSelection(quotationIdParam);
        }
    }, [id]);

    const fetchQuotations = async () => {
        const data = await api.get<any[]>('/quotations');
        if (data) {
            // Only show confirmed quotations (those with PO number)
            setQuotations(data.filter(q => q.status === 'confirmed'));
        }
    };

    const handleQuotationSelection = async (quotationId: string) => {
        setFormData(prev => ({ ...prev, quotation_id: quotationId }));

        try {
            const quotation = await api.get<any>(`/quotations/${quotationId}`);
            const items = quotation?.items;

            if (items) {
                // Map quotation items to SalesOrderItem-like structure for compatibility
                const mappedItems = items.map((item: any) => ({
                    id: item.id,
                    so_id: '',
                    description: item.item_description,
                    quantity: item.quantity,
                    uom: item.uom,
                    phase_name: item.item_name,
                    qty_backordered: 0,
                    qty_reserved: 0,
                }));
                await loadAvailableQuotationItems(quotationId, mappedItems, id);
            }

            // Fetch Customer shipping address
            const partnerId = quotation?.customer_id;
            if (partnerId) {
                const partners = await api.get<any[]>(`/partners`);
                const partner = partners?.find(p => p.id === partnerId);
                if (partner) {
                    setFormData(prev => ({
                        ...prev,
                        shipping_address_snapshot: partner.shipping_address || partner.address || ''
                    }));
                }
            }
        } catch (error) {
            console.error('Error handling Quotation selection:', error);
            showToast('Failed to load Quotation details', 'error');
        }
    };

    const loadAvailableQuotationItems = async (quotationId: string, items: any[], excludeDoId?: string) => {
        const allDOs = await api.get<any[]>('/delivery-orders');
        let existingDOs = allDOs?.filter(d => d.quotation_id === quotationId) || [];
        if (excludeDoId) existingDOs = existingDOs.filter(d => d.id !== excludeDoId);

        if (existingDOs.length > 0) {
            const deliveredQtyMap = new Map<string, number>();
            for (const d of existingDOs) {
                const doRecord = await api.get<any>(`/delivery-orders/${d.id}`);
                if (doRecord?.items) {
                    doRecord.items.forEach((item: any) => {
                        const desc = item.description?.trim().toLowerCase();
                        if (desc) {
                            deliveredQtyMap.set(desc, (deliveredQtyMap.get(desc) || 0) + (item.quantity || 0));
                        }
                    });
                }
            }

            const itemsWithRemaining = items
                .map((item: any) => ({
                    ...item,
                    quantity: item.quantity - (deliveredQtyMap.get(item.description?.trim().toLowerCase() || '') || 0)
                }))
                .filter((item: any) => item.quantity > 0);

            setAvailableItems(itemsWithRemaining);

            if (itemsWithRemaining.length < items.length) {
                showToast(`${items.length - itemsWithRemaining.length} item(s) fully delivered. Showing remaining.`, 'info');
            }
        } else {
            setAvailableItems(items);
        }

        const uniquePhases = Array.from(new Set(items.map((i: any) => i.item_name).filter(Boolean) as string[]));
        setAvailablePhases(uniquePhases);
    };

    const loadDeliveryOrder = async (doId: string, isDuplicate = false) => {
        setLoading(true);
        try {
            const data = await api.get<any>(`/delivery-orders/${doId}`);
            if (!data) throw new Error('Not found');

            setFormData({
                quotation_id: isDuplicate ? '' : (data.quotation_id || ''),
                do_number: isDuplicate ? '' : data.do_number,
                date: isDuplicate ? new Date().toISOString().split('T')[0] : (data.date ? new Date(data.date).toISOString().split('T')[0] : ''),
                subject: data.subject || '',
                terms: data.terms || '',
                requestor_name: data.requestor_name || '',
                shipping_address_snapshot: data.shipping_address_snapshot || '',
                customer_id: '',
            });

            if (data.quotation_id) {
                try {
                    const quotation = await api.get<any>(`/quotations/${data.quotation_id}`);
                    if (quotation?.items) {
                        const mappedItems = quotation.items.map((item: any) => ({
                            id: item.id,
                            so_id: '',
                            description: item.item_description,
                            quantity: item.quantity,
                            uom: item.uom,
                            phase_name: item.item_name,
                            qty_backordered: 0,
                            qty_reserved: 0,
                        }));
                        await loadAvailableQuotationItems(data.quotation_id, mappedItems, isDuplicate ? undefined : doId);
                    }
                } catch (e) {
                    console.error("Failed to load available Quotation items", e);
                }
            }

            const items = data.items;
            if (items) {
                const grouped: Record<string, DOItem[]> = {};
                const ungrouped: DOItem[] = [];

                items.forEach((item: any) => {
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
                quotation_id: formData.quotation_id || null,
                date: formData.date,
                subject: formData.subject,
                terms: formData.terms,
                requestor_name: formData.requestor_name,
                shipping_address_snapshot: formData.shipping_address_snapshot
            };

            const allItems = [
                ...groups.flatMap(g => g.items.map(i => ({ item_code: i.item_code, description: i.description, quantity: i.quantity, uom: i.uom, group_name: g.name }))),
                ...ungroupedItems.map(i => ({ item_code: i.item_code, description: i.description, quantity: i.quantity, uom: i.uom, group_name: null }))
            ];

            if (isEditMode && id) {
                await api.put(`/delivery-orders/${id}`, {
                    ...doData,
                    do_number: formData.do_number,
                    items: allItems
                });
            } else {
                await api.post('/delivery-orders', { 
                    ...doData, 
                    do_number: 'DO-' + Date.now(),
                    items: allItems
                });
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
                        {formData.quotation_id && <p className="text-sm text-gray-500 mt-1">Linked to Quotation</p>}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: Quotation Source */}
                <Card>
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Source Quotation
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Quotation <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <SearchableSelect
                                    value={formData.quotation_id || ''}
                                    onChange={(val) => handleQuotationSelection(val)}
                                    options={quotations.map(q => ({ label: `${q.quotation_number || q.quote_number} (PO: ${q.customer_po_number || 'N/A'})`, value: q.id }))}
                                    placeholder="Select Quotation..."
                                    className="w-full"
                                    disabled={isEditMode}
                                />
                            </div>
                        </div>

                        {/* Phase Selection - only show when Quotation selected and phases exist */}
                        {formData.quotation_id && availablePhases.length > 0 && (
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

                {/* Section 3: Item Selection from Quotation */}
                {formData.quotation_id && getAvailableSOItems().length > 0 && (
                    <Card>
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Available Items from Quotation
                            <span className="ml-auto text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {getAvailableSOItems().length} items available
                            </span>
                        </h2>



                        <div className="flex items-center justify-between mb-3 text-sm text-gray-600 bg-gray-50 px-4 py-2 border-y border-gray-200">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={getAvailableSOItems().length > 0 && selectedAvailableItems.size === getAvailableSOItems().length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedAvailableItems(new Set(getAvailableSOItems().map((_, i) => i)));
                                        } else {
                                            setSelectedAvailableItems(new Set());
                                        }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="font-medium">Select All</span>
                            </div>
                            {selectedAvailableItems.size > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-blue-700">{selectedAvailableItems.size} selected</span>
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleBulkAssignAvailableItems(e.target.value === '__ungrouped__' ? null : e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                        value=""
                                    >
                                        <option value="">Move selected to...</option>
                                        <option value="__ungrouped__">Ungrouped</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                            {getAvailableSOItems().map((soItem, idx) => {
                                const remaining = getRemainingQty(soItem);
                                const qtyKey = `so-${idx}`;
                                const currentQty = qtyInputs[qtyKey] ?? remaining;

                                return (
                                    <div key={idx} className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg transition-colors shadow-sm ${selectedAvailableItems.has(idx) ? 'bg-blue-50 border-blue-300' : 'bg-white hover:border-blue-300'}`}>
                                        <div className="pl-1 text-center items-center flex shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedAvailableItems.has(idx)}
                                                onChange={() => toggleSelectAvailableItem(idx)}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                        </div>
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
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Delivery Items
                            <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {totalItemsCount} items
                            </span>
                        </h2>
                        <div className="flex items-center gap-2">
                            {selectedItems.size > 0 && (
                                <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                    <span className="text-xs font-medium text-blue-700">{selectedItems.size} selected</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowMoveModal(true)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                                    >
                                        <ArrowRightLeft className="w-3 h-3" />
                                        Move
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deleteSelectedItemsDO}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded hover:bg-red-200 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Delete
                                    </button>
                                </div>
                            )}
                            <Button type="button" onClick={handleAddUngroupedItem} variant="secondary" size="sm">
                                <Plus className="w-4 h-4 mr-1" />
                                Add Item
                            </Button>
                        </div>
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

                                    <div className="overflow-visible">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-white border-b border-gray-100 text-left text-xs text-gray-500 font-medium uppercase">
                                                    <th className="py-2 px-2 w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={group.items.length > 0 && group.items.every(i => selectedItems.has(i.id || ''))}
                                                            onChange={() => toggleSelectAllInGroup(group.id)}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </th>
                                                    <th className="py-2 px-2 w-[40%]">Description</th>
                                                    <th className="py-2 px-2 w-20">Qty</th>
                                                    <th className="py-2 px-2 w-20">UOM</th>
                                                    <th className="py-2 px-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {group.items.map((item) => (
                                                    <tr key={item.id} className={`group hover:bg-gray-50/50 transition-colors ${selectedItems.has(item.id || '') ? 'bg-blue-50/40' : ''}`}>
                                                        <td className="py-1.5 px-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(item.id || '')}
                                                                onChange={() => toggleSelectItem(item.id || '')}
                                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 px-2">
                                                            <input
                                                                type="text"
                                                                value={item.description || ''}
                                                                onChange={(e) => handleItemChange(group.id, item.id || '', 'description', e.target.value)}
                                                                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 px-2">
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => handleItemChange(group.id, item.id || '', 'quantity', parseFloat(e.target.value))}
                                                                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 px-2">
                                                            <input
                                                                type="text"
                                                                value={item.uom || ''}
                                                                onChange={(e) => handleItemChange(group.id, item.id || '', 'uom', e.target.value)}
                                                                className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 px-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(group.id, item.id || '')}
                                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
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
                                <div className="overflow-visible">
                                    <table className="w-full text-sm">
                                        <thead>
                                                <tr className="bg-white border-b border-gray-100 text-left text-xs text-gray-500 font-medium uppercase">
                                                    <th className="py-2 px-2 w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={ungroupedItems.length > 0 && ungroupedItems.every(i => selectedItems.has(i.id || ''))}
                                                            onChange={toggleSelectAllUngrouped}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </th>
                                                    <th className="py-2 px-2 w-[40%]">Description</th>
                                                    <th className="py-2 px-2 w-20">Qty</th>
                                                    <th className="py-2 px-2 w-20">UOM</th>
                                                    <th className="py-2 px-2 w-10"></th>
                                                </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {ungroupedItems.map((item) => (
                                                <tr key={item.id} className={`group hover:bg-gray-50/50 transition-colors ${selectedItems.has(item.id || '') ? 'bg-blue-50/40' : ''}`}>
                                                    <td className="py-1.5 px-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(item.id || '')}
                                                            onChange={() => toggleSelectItem(item.id || '')}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                        <input
                                                            type="text"
                                                            value={item.description || ''}
                                                            onChange={(e) => handleUngroupedItemChange(item.id || '', 'description', e.target.value)}
                                                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUngroupedItemChange(item.id || '', 'quantity', parseFloat(e.target.value))}
                                                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 px-2">
                                                        <input
                                                            type="text"
                                                            value={item.uom || ''}
                                                            onChange={(e) => handleUngroupedItemChange(item.id || '', 'uom', e.target.value)}
                                                            className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveUngroupedItem(item.id || '')}
                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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

                    {/* Custom Group Creation moved here to always be visible */}
                    <div className="bg-purple-50 p-4 rounded-lg mb-6 border border-purple-100">
                        <label className="block text-sm font-medium text-purple-900 mb-2">Create Custom Group</label>
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

            {/* Move to Group Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between bg-blue-50">
                            <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                                Move {selectedItems.size} Item(s) to Group
                            </h3>
                            <button type="button" onClick={() => setShowMoveModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Selected items preview */}
                        <div className="p-4 border-b max-h-[200px] overflow-y-auto bg-gray-50/50">
                            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Items to move:</p>
                            <div className="space-y-1">
                                {getSelectedItemsList().map(item => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm bg-white px-3 py-1.5 rounded border border-gray-200">
                                        <span className="font-medium text-gray-900 truncate flex-1">{item.description || 'No description'}</span>
                                        <span className="text-xs text-gray-500">{item.quantity} {item.uom}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Target group selection */}
                        <div className="p-4 flex-1 overflow-y-auto">
                            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Select target group:</p>
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => handleBulkMoveToGroup(null)}
                                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 transition-all text-sm font-medium text-gray-700"
                                >
                                    Ungrouped
                                </button>
                                {groups.map(g => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => handleBulkMoveToGroup(g.id)}
                                        className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all text-sm font-medium text-gray-700"
                                    >
                                        {g.name}
                                        <span className="ml-2 text-xs text-gray-400">({g.items.length} items)</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-end bg-white">
                            <Button type="button" variant="secondary" onClick={() => setShowMoveModal(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
