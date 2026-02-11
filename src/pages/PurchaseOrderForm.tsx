import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, FolderPlus, ShoppingCart, AlertTriangle, ChevronDown, ChevronUp, Check, FileText, Truck, MapPin } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { supabase, Item, Partner, QuotationTerm, TERM_CATEGORIES, TermCategoryName } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { getBacklogItems } from '../lib/stockService';

interface BacklogItem {
    id: string;
    so_id: string;
    so_number: string;
    description: string;
    qty_backordered: number;
    phase_name: string | null;
    selected?: boolean;
}

interface POLineItem {
    id: string;
    group_name: string;
    item_id: string;
    item_code: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface ItemGroup {
    name: string;
    items: POLineItem[];
}

export const PurchaseOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [vendors, setVendors] = useState<Partner[]>([]);
    const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // PO Details
    const [formData, setFormData] = useState({
        vendor_id: '',
        po_number: '',
        date: new Date().toISOString().split('T')[0],
        quote_ref: '',
        po_terms: 'Refer to Payment Below',
        shipping_info: 'Ship Via: FCA – To Working Site.\nIncoterm: DAP',
        delivery_address: '',
        doc_address: '',
        subject: '',
        notes: '',
        status: 'pending',
        gst_rate: 9,
    });

    // Grouped items structure
    const [groups, setGroups] = useState<ItemGroup[]>([
        { name: 'Default', items: [] }
    ]);
    const [newGroupName, setNewGroupName] = useState('');

    // Backlog modal state
    const [showBacklogModal, setShowBacklogModal] = useState(false);
    const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
    const [loadingBacklog, setLoadingBacklog] = useState(false);

    // Terms & Conditions state
    const [availableTerms, setAvailableTerms] = useState<QuotationTerm[]>([]);
    const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<TermCategoryName[]>([...TERM_CATEGORIES]);

    useEffect(() => {
        fetchVendors();
        fetchInventoryItems();
        fetchAvailableTerms();
        if (id) {
            setIsEditMode(true);
            loadPurchaseOrder(id);
        }
    }, [id]);

    const fetchVendors = async () => {
        const { data } = await supabase.from('partners').select('*').eq('type', 'vendor').order('company_name');
        if (data) setVendors(data);
    };

    const fetchInventoryItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setInventoryItems(data);
    };

    const fetchAvailableTerms = async () => {
        const { data, error } = await supabase
            .from('quotation_terms')
            .select('*')
            .eq('is_active', true)
            .order('category')
            .order('sort_order');

        if (error) {
            console.error('Error fetching terms:', error);
            return;
        }

        if (data) {
            setAvailableTerms(data);
            // By default, select all active terms for new POs
            if (!id) {
                setSelectedTermIds(data.map(t => t.id));
            }
        }
    };

    // Terms selection handlers
    const toggleTerm = (termId: string) => {
        setSelectedTermIds(prev =>
            prev.includes(termId)
                ? prev.filter(id => id !== termId)
                : [...prev, termId]
        );
    };

    const toggleCategory = (category: TermCategoryName) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const selectAllInCategory = (category: TermCategoryName) => {
        const categoryTermIds = availableTerms.filter(t => t.category === category).map(t => t.id);
        setSelectedTermIds(prev => [...new Set([...prev, ...categoryTermIds])]);
    };

    const deselectAllInCategory = (category: TermCategoryName) => {
        const categoryTermIds = availableTerms.filter(t => t.category === category).map(t => t.id);
        setSelectedTermIds(prev => prev.filter(id => !categoryTermIds.includes(id)));
    };

    // Group terms by category for display
    const termsByCategory = TERM_CATEGORIES.reduce((acc, category) => {
        acc[category] = availableTerms.filter(t => t.category === category);
        return acc;
    }, {} as Record<TermCategoryName, QuotationTerm[]>);

    const loadPurchaseOrder = async (poId: string) => {
        setLoading(true);
        try {
            const { data: po, error: poError } = await supabase.from('purchase_orders').select('*').eq('id', poId).single();
            if (poError) throw poError;

            if (po) {
                setFormData({
                    vendor_id: po.vendor_id || '',
                    po_number: po.po_number,
                    date: po.date || new Date().toISOString().split('T')[0],
                    quote_ref: po.quote_ref || '',
                    po_terms: po.notes?.includes('Terms:') ? po.notes.split('Terms:')[1]?.trim() : 'Refer to Payment Below',
                    shipping_info: po.shipping_info || '',
                    delivery_address: po.delivery_address || '',
                    doc_address: po.notes?.includes('DocAddress:') ? po.notes.split('DocAddress:')[1]?.split('\n')[0]?.trim() : '',
                    subject: po.notes?.includes('Subject:') ? po.notes.split('Subject:')[1]?.split('\n')[0]?.trim() : '',
                    notes: po.notes || '',
                    status: po.status,
                    gst_rate: po.tax && po.subtotal ? Math.round((po.tax / po.subtotal) * 100) : 9,
                });

                const { data: items, error: itemsError } = await supabase.from('purchase_order_items').select('*').eq('po_id', poId);
                if (itemsError) throw itemsError;

                if (items && items.length > 0) {
                    // Group items based on description patterns (format: "[GroupName] Item desc")
                    const groupMap: Record<string, POLineItem[]> = { 'Default': [] };

                    items.forEach((item, idx) => {
                        const match = item.description?.match(/^\[([^\]]+)\]\s*/);
                        let groupName = 'Default';
                        let desc = item.description;

                        if (match) {
                            groupName = match[1];
                            desc = item.description.replace(match[0], '');
                        }

                        if (!groupMap[groupName]) groupMap[groupName] = [];

                        groupMap[groupName].push({
                            id: item.id || `loaded-${idx}`,
                            group_name: groupName,
                            item_id: '',
                            item_code: item.item_code || '',
                            description: desc || '',
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total: item.total
                        });
                    });

                    const newGroups = Object.entries(groupMap).map(([name, items]) => ({ name, items }));
                    setGroups(newGroups.length > 0 ? newGroups : [{ name: 'Default', items: [] }]);
                }

                // Load selected terms for this PO
                const { data: selectedTerms, error: termsError } = await supabase
                    .from('po_selected_terms')
                    .select('term_id')
                    .eq('po_id', poId);

                if (!termsError && selectedTerms) {
                    setSelectedTermIds(selectedTerms.map(t => t.term_id));
                }
            }
        } catch (error: any) {
            console.error(error);
            showToast('Failed to load PO', 'error');
        } finally {
            setLoading(false);
        }
    };



    const addGroup = () => {
        if (!newGroupName.trim()) return;
        if (groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
            showToast('Group name already exists', 'error');
            return;
        }
        setGroups([...groups, { name: newGroupName.trim(), items: [] }]);
        setNewGroupName('');
    };

    const removeGroup = (groupName: string) => {
        if (groups.length <= 1) return;
        setGroups(groups.filter(g => g.name !== groupName));
    };

    const addItemToGroup = (groupName: string) => {
        setGroups(groups.map(g => {
            if (g.name === groupName) {
                return {
                    ...g,
                    items: [...g.items, {
                        id: Date.now().toString(),
                        group_name: groupName,
                        item_id: '',
                        item_code: '',
                        description: '',
                        quantity: 1,
                        unit_price: 0,
                        total: 0
                    }]
                };
            }
            return g;
        }));
    };

    const removeItem = (groupName: string, itemId: string) => {
        setGroups(groups.map(g => {
            if (g.name === groupName) {
                return { ...g, items: g.items.filter(i => i.id !== itemId) };
            }
            return g;
        }));
    };

    const updateItem = (groupName: string, itemId: string, field: keyof POLineItem, value: any) => {
        setGroups(groups.map(g => {
            if (g.name === groupName) {
                return {
                    ...g,
                    items: g.items.map(item => {
                        if (item.id === itemId) {
                            const updated = { ...item, [field]: value };

                            // Auto-fill from inventory
                            if (field === 'item_id' && value) {
                                const invItem = inventoryItems.find(i => i.id === value);
                                if (invItem) {
                                    updated.item_code = invItem.item_code || '';
                                    updated.description = invItem.name + (invItem.description ? ` - ${invItem.description}` : '');
                                    updated.unit_price = invItem.price;
                                }
                            }

                            updated.total = updated.quantity * updated.unit_price;
                            return updated;
                        }
                        return item;
                    })
                };
            }
            return g;
        }));
    };

    const calculateSubtotal = () => groups.reduce((acc, g) => acc + g.items.reduce((sum, i) => sum + i.total, 0), 0);
    const calculateGST = () => (calculateSubtotal() * formData.gst_rate) / 100;
    const calculateTotal = () => calculateSubtotal() + calculateGST();

    const getGroupSubtotal = (groupName: string) => {
        const group = groups.find(g => g.name === groupName);
        return group ? group.items.reduce((sum, i) => sum + i.total, 0) : 0;
    };

    // Backlog functions for Pull Procurement
    const loadBacklogItems = async () => {
        setLoadingBacklog(true);
        try {
            const items = await getBacklogItems();

            // Get IDs of items already added to this PO
            const existingBacklogGroup = groups.find(g => g.name === 'Sales Backlog');
            const alreadyAddedIds = new Set(
                existingBacklogGroup?.items.map(i => (i as any)._backlogItemId).filter(Boolean) || []
            );

            // Filter out items already in the PO
            const availableItems = items.filter(i => !alreadyAddedIds.has(i.id));

            if (availableItems.length === 0 && items.length > 0) {
                showToast('All backlog items are already added to this PO', 'info');
            }

            setBacklogItems(availableItems.map(i => ({ ...i, selected: false })));
            setShowBacklogModal(true);
        } catch (error) {
            console.error('Failed to load backlog:', error);
            showToast('Failed to load backlog items', 'error');
        } finally {
            setLoadingBacklog(false);
        }
    };

    const toggleBacklogItem = (id: string) => {
        setBacklogItems(backlogItems.map(i =>
            i.id === id ? { ...i, selected: !i.selected } : i
        ));
    };

    const addSelectedBacklogItems = async () => {
        const selected = backlogItems.filter(i => i.selected);
        if (selected.length === 0) {
            showToast('Please select at least one item', 'error');
            return;
        }

        // Fetch prices from items table for each selected item
        const newItems: POLineItem[] = [];

        for (const item of selected) {
            // Try to find matching item by description to get price
            const { data: matchedItem } = await supabase
                .from('items')
                .select('price, name')
                .ilike('name', `%${item.description}%`)
                .maybeSingle();

            const unitPrice = matchedItem?.price || 0;
            const quantity = item.qty_backordered;

            newItems.push({
                id: `backlog-${item.id}-${Date.now()}`,
                group_name: 'Sales Backlog',
                item_id: '',
                item_code: '',
                // Store the original SO item ID for clearing backorder later
                description: `${item.description} (SO: ${item.so_number}, Backlog: ${item.qty_backordered})`,
                quantity: quantity,
                unit_price: unitPrice,
                total: quantity * unitPrice,
                // Store original backlog item info
                _backlogItemId: item.id,
                _originalQty: item.qty_backordered
            } as any);
        }

        // Check if "Sales Backlog" group exists
        const hasBacklogGroup = groups.some(g => g.name === 'Sales Backlog');
        if (hasBacklogGroup) {
            // Get existing item IDs to avoid duplicates
            const existingBacklogGroup = groups.find(g => g.name === 'Sales Backlog');
            const existingIds = new Set(
                existingBacklogGroup?.items.map(i => (i as any)._backlogItemId).filter(Boolean) || []
            );

            // Filter out duplicates
            const uniqueNewItems = newItems.filter(i => !existingIds.has((i as any)._backlogItemId));

            if (uniqueNewItems.length === 0) {
                showToast('Selected items are already in the PO', 'warning');
                setShowBacklogModal(false);
                return;
            }

            setGroups(groups.map(g =>
                g.name === 'Sales Backlog'
                    ? { ...g, items: [...g.items, ...uniqueNewItems] }
                    : g
            ));
            showToast(`Added ${uniqueNewItems.length} item(s) from backlog`, 'success');
        } else {
            setGroups([...groups, { name: 'Sales Backlog', items: newItems }]);
            showToast(`Added ${newItems.length} item(s) from backlog`, 'success');
        }

        // Reset backlog items selection
        setBacklogItems([]);
        setShowBacklogModal(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const subtotal = calculateSubtotal();
            const tax = calculateGST();
            const total = calculateTotal();

            // Build notes with metadata
            const notesWithMeta = [
                formData.subject ? `Subject: ${formData.subject}` : '',
                formData.doc_address ? `DocAddress: ${formData.doc_address}` : '',
                formData.notes
            ].filter(Boolean).join('\n');

            const poData = {
                vendor_id: formData.vendor_id,
                po_number: formData.po_number || `PO-${Date.now()}`,
                date: formData.date,
                quote_ref: formData.quote_ref,
                shipping_info: formData.shipping_info,
                delivery_address: formData.delivery_address,
                notes: notesWithMeta,
                status: formData.status || 'pending',
                subtotal,
                tax,
                total,
            };

            let poId = id;

            if (isEditMode && id) {
                const { error } = await supabase.from('purchase_orders').update(poData).eq('id', id);
                if (error) throw error;
                await supabase.from('purchase_order_items').delete().eq('po_id', id);
                // Delete existing selected terms
                await supabase.from('po_selected_terms').delete().eq('po_id', id);
            } else {
                const { data, error } = await supabase.from('purchase_orders').insert([poData]).select().single();
                if (error) throw error;
                poId = data.id;
            }

            if (poId) {
                // Flatten all items with group prefix in description
                const allItems: any[] = [];
                const backlogItemIds: string[] = []; // Track backlog items to clear

                groups.forEach(g => {
                    g.items.forEach(item => {
                        allItems.push({
                            po_id: poId,
                            item_code: item.item_code,
                            description: g.name !== 'Default' ? `[${g.name}] ${item.description}` : item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total: item.total
                        });

                        // Collect backlog item IDs for clearing
                        if ((item as any)._backlogItemId) {
                            backlogItemIds.push((item as any)._backlogItemId);
                        }
                    });
                });

                if (allItems.length > 0) {
                    const { error } = await supabase.from('purchase_order_items').insert(allItems);
                    if (error) throw error;
                }

                // Clear backlog (set qty_backordered to 0) for items added to this PO
                if (backlogItemIds.length > 0) {
                    for (const itemId of backlogItemIds) {
                        await supabase
                            .from('sales_order_items')
                            .update({ qty_backordered: 0 })
                            .eq('id', itemId);
                    }
                    console.log('Cleared backlog for items:', backlogItemIds);
                }

                // Insert selected terms
                if (selectedTermIds.length > 0) {
                    const termsToInsert = selectedTermIds.map(termId => ({
                        po_id: poId,
                        term_id: termId
                    }));
                    const { error: termsError } = await supabase.from('po_selected_terms').insert(termsToInsert);
                    if (termsError) throw termsError;
                }
            }

            showToast('Purchase Order saved', 'success');
            navigate('/purchase-orders');

        } catch (error: any) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/purchase-orders')} className="hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Purchase Order</h1>
                        <p className="text-sm text-gray-500">
                            {isEditMode ? `Updating PO: ${formData.po_number}` : 'Create a new purchase order'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isEditMode && (
                        <Badge variant={
                            formData.status === 'confirmed' ? 'success' :
                                formData.status === 'received' ? 'info' :
                                    formData.status === 'cancelled' ? 'danger' : 'warning'
                        }>
                            {formData.status.toUpperCase()}
                        </Badge>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* PO Header Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">General Information</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                                    <div className="relative">
                                        <select
                                            value={formData.vendor_id}
                                            onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                            className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-all"
                                            required
                                        >
                                            <option value="">Select Vendor...</option>
                                            {vendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.company_name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <Input
                                    label="PO Date *"
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />

                                <Input
                                    label="Quote Reference"
                                    value={formData.quote_ref}
                                    onChange={e => setFormData({ ...formData, quote_ref: e.target.value })}
                                    placeholder="e.g. QT-2512-0142R1"
                                />

                                <Input
                                    label="Payment Terms"
                                    value={formData.po_terms}
                                    onChange={e => setFormData({ ...formData, po_terms: e.target.value })}
                                    placeholder="e.g. 30 Days Net"
                                />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <div className="relative">
                                        <select
                                            value={formData.status}
                                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="received">Received</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <Input
                                    label="GST Rate (%)"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.gst_rate}
                                    onChange={e => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </Card>

                        {/* Subject / Project */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Subject / Project</h2>
                            </div>
                            <Input
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="e.g. PROJECT: HANWHA CCTV SYSTEM"
                            />
                        </Card>

                        {/* Address Sections */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card>
                                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-semibold text-gray-800">Bill & Ship to Documentation</h2>
                                </div>
                                <textarea
                                    value={formData.doc_address}
                                    onChange={e => setFormData({ ...formData, doc_address: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    placeholder="To: Finance&#10;60 Paya Lebar Road&#10;#08-45A Paya Lebar Square&#10;Singapore 409051"
                                />
                            </Card>
                            <Card>
                                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-semibold text-gray-800">Working Site / Delivery</h2>
                                </div>
                                <textarea
                                    value={formData.delivery_address}
                                    onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    placeholder="To: John Doe&#10;PT Jaya Subakti Perkasa&#10;No. 5 Tuas Drive 22&#10;Singapore 638549"
                                />
                            </Card>
                        </div>

                        {/* Shipping Info */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <Truck className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Shipping Info</h2>
                            </div>
                            <textarea
                                value={formData.shipping_info}
                                onChange={e => setFormData({ ...formData, shipping_info: e.target.value })}
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="Ship Via: FCA – To Working Site.&#10;Incoterm: DAP"
                            />
                        </Card>

                        {/* Item Groups */}
                        <Card>
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                                    <h2 className="text-lg font-semibold text-gray-800">Items by Group</h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Sales Backlog Button */}
                                    <Button
                                        type="button"
                                        onClick={loadBacklogItems}
                                        variant="secondary"
                                        size="sm"
                                        className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-colors"
                                        disabled={loadingBacklog}
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        {loadingBacklog ? 'Loading...' : 'Add from Sales Backlog'}
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)}
                                            placeholder="New group name..."
                                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                                        />
                                        <Button type="button" onClick={addGroup} variant="secondary" size="sm">
                                            <FolderPlus className="w-4 h-4" /> Add Group
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Backlog Modal */}
                            {showBacklogModal && (
                                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                                        <div className="p-4 border-b flex items-center justify-between bg-orange-50">
                                            <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-800">
                                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                                                Sales Backlog - Items Awaiting Procurement
                                            </h3>
                                            <button type="button" onClick={() => setShowBacklogModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                ✕
                                            </button>
                                        </div>
                                        <div className="p-4 overflow-y-auto flex-1 bg-gray-50/50">
                                            {backlogItems.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                                    <Check className="w-12 h-12 text-green-500 mb-3 opacity-20" />
                                                    <p>No backordered items found.</p>
                                                    <p className="text-sm">All Sales Orders are fully stocked.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 text-gray-700 font-medium">
                                                            <tr>
                                                                <th className="p-3 text-center w-12 bg-gray-50/50">
                                                                    <div className="sr-only">Select</div>
                                                                </th>
                                                                <th className="p-3 text-left">Sales Order</th>
                                                                <th className="p-3 text-left">Item Description</th>
                                                                <th className="p-3 text-center">Qty Needed</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {backlogItems.map(item => (
                                                                <tr key={item.id} className={`hover:bg-blue-50/50 transition-colors ${item.selected ? 'bg-blue-50/30' : ''}`}>
                                                                    <td className="p-3 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={item.selected || false}
                                                                            onChange={() => toggleBacklogItem(item.id)}
                                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                                        />
                                                                    </td>
                                                                    <td className="p-3 font-medium text-blue-600 whitespace-nowrap">{item.so_number}</td>
                                                                    <td className="p-3 text-gray-700">{item.description}</td>
                                                                    <td className="p-3 text-center">
                                                                        <Badge variant="danger">{item.qty_backordered}</Badge>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                                            <Button type="button" variant="secondary" onClick={() => setShowBacklogModal(false)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={addSelectedBacklogItems}
                                                disabled={!backlogItems.some(i => i.selected)}
                                            >
                                                Add Selected to PO
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {groups.map((group, _gIdx) => (
                                    <div key={group.name} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                                            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                                                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                                                {group.name}
                                            </h3>
                                            <div className="flex gap-2">
                                                <Button type="button" onClick={() => addItemToGroup(group.name)} variant="secondary" size="sm" className="bg-white hover:bg-gray-50">
                                                    <Plus className="w-3.5 h-3.5" /> Add Item
                                                </Button>
                                                {groups.length > 1 && (
                                                    <Button type="button" onClick={() => removeGroup(group.name)} variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-1 overflow-x-auto">
                                            {group.items.length > 0 ? (
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-gray-500 border-b border-gray-100">
                                                            <th className="p-3 text-left font-medium w-48">Select Item</th>
                                                            <th className="p-3 text-left font-medium w-32">Code</th>
                                                            <th className="p-3 text-left font-medium">Description</th>
                                                            <th className="p-3 text-center font-medium w-24">Qty</th>
                                                            <th className="p-3 text-right font-medium w-32">Unit Price</th>
                                                            <th className="p-3 text-right font-medium w-32">Total</th>
                                                            <th className="w-12"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {group.items.map((item, _iIdx) => (
                                                            <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                                                <td className="p-2">
                                                                    <div className="relative">
                                                                        <select
                                                                            value={item.item_id}
                                                                            onChange={(e) => updateItem(group.name, item.id, 'item_id', e.target.value)}
                                                                            className="w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-all text-sm"
                                                                        >
                                                                            <option value="">Manual Entry</option>
                                                                            {inventoryItems.map(i => (
                                                                                <option key={i.id} value={i.id}>{i.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                                            <ChevronDown className="w-4 h-4" />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.item_code}
                                                                        onChange={e => updateItem(group.name, item.id, 'item_code', e.target.value)}
                                                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                                                        placeholder="Code"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.description}
                                                                        onChange={e => updateItem(group.name, item.id, 'description', e.target.value)}
                                                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 text-sm"
                                                                        placeholder="Description"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="number"
                                                                        value={item.quantity}
                                                                        onChange={e => updateItem(group.name, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-sm"
                                                                        min="0"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="number"
                                                                        value={item.unit_price}
                                                                        onChange={e => updateItem(group.name, item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right text-sm"
                                                                        min="0"
                                                                        step="0.01"
                                                                    />
                                                                </td>
                                                                <td className="p-2 text-right font-semibold text-gray-900 px-4 text-sm">
                                                                    {item.total.toFixed(2)}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeItem(group.name, item.id)}
                                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 m-2 rounded-lg border-2 border-dashed border-gray-200">
                                                    <ShoppingCart className="w-8 h-8 mb-2 opacity-50" />
                                                    <p className="text-sm">No items in this group yet.</p>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => addItemToGroup(group.name)} className="mt-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                        Add First Item
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {group.items.length > 0 && (
                                            <div className="bg-gray-50 p-3 flex justify-end border-t border-gray-100">
                                                <div className="text-sm font-medium text-gray-600 bg-white px-3 py-1 rounded shadow-sm border border-gray-200">
                                                    Group Subtotal: <span className="text-blue-700 ml-1 font-bold">{getGroupSubtotal(group.name).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Total Summary */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Summary</h2>
                            </div>
                            <div className="space-y-3">
                                {groups.filter(g => g.items.length > 0).map((g) => (
                                    <div key={g.name} className="flex justify-between text-sm text-gray-600">
                                        <span>{g.name}</span>
                                        <span>{getGroupSubtotal(g.name).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 my-2 pt-2">
                                    <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
                                        <span>Subtotal</span>
                                        <span>{calculateSubtotal().toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                                        <span>GST ({formData.gst_rate}%)</span>
                                        <span>{calculateGST().toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-blue-600 border-t border-gray-200 pt-2">
                                        <span>Total</span>
                                        <span>SGD {calculateTotal().toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Terms & Conditions Selection */}
                        <Card className="border-l-4 border-l-purple-500">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    <h2 className="text-lg font-semibold text-gray-800">Terms & Conditions</h2>
                                </div>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                                    {selectedTermIds.length} Selected
                                </span>
                            </div>

                            {availableTerms.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <p className="text-sm">No terms available.</p>
                                    <a href="/terms" className="text-blue-600 hover:underline text-sm font-medium mt-1 inline-block">Manage Terms</a>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                    {TERM_CATEGORIES.map(category => {
                                        const categoryTerms = termsByCategory[category] || [];
                                        if (categoryTerms.length === 0) return null;

                                        const isExpanded = expandedCategories.includes(category);
                                        const selectedCount = categoryTerms.filter(t => selectedTermIds.includes(t.id)).length;
                                        const allSelected = selectedCount === categoryTerms.length;

                                        return (
                                            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => toggleCategory(category)}
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                                                        <span className="font-medium text-sm text-gray-700 truncate">{category}</span>
                                                    </div>
                                                    <div className="flex gap-2 items-center flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                        <span className="text-xs text-gray-500">
                                                            {selectedCount}/{categoryTerms.length}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                allSelected ? deselectAllInCategory(category) : selectAllInCategory(category);
                                                            }}
                                                            className="text-xs px-2 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                                                        >
                                                            {allSelected ? 'None' : 'All'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="p-2 space-y-1 bg-white border-t border-gray-100">
                                                        {categoryTerms.map(term => (
                                                            <label
                                                                key={term.id}
                                                                className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-all ${selectedTermIds.includes(term.id)
                                                                    ? 'bg-blue-50/50 border border-blue-100'
                                                                    : 'hover:bg-gray-50 border border-transparent'
                                                                    }`}
                                                            >
                                                                <div className="flex-shrink-0 mt-0.5">
                                                                    <div
                                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTermIds.includes(term.id)
                                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                                            : 'border-gray-300 bg-white'
                                                                            }`}
                                                                    >
                                                                        {selectedTermIds.includes(term.id) && <Check className="w-3 h-3" />}
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedTermIds.includes(term.id)}
                                                                        onChange={() => toggleTerm(term.id)}
                                                                        className="sr-only"
                                                                    />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    {term.title && (
                                                                        <div className="text-xs font-semibold text-gray-800 mb-0.5">{term.title}</div>
                                                                    )}
                                                                    <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{term.content}</div>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        {/* Notes */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Notes</h2>
                            </div>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-sm"
                                placeholder="Add any additional notes here..."
                            />
                        </Card>
                    </div>
                </div>

                <div className="flex gap-4 justify-end pt-6 border-t border-gray-200 mt-8 sticky bottom-0 bg-gray-50/80 backdrop-blur-sm p-4 -mx-4 -mb-4 rounded-b-lg">
                    <Button type="button" variant="ghost" onClick={() => navigate('/purchase-orders')} className="hover:bg-gray-200">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading} size="lg" className="px-8 shadow-lg shadow-blue-500/20">
                        {loading && <div className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {loading ? 'Saving Order...' : 'Save Purchase Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};