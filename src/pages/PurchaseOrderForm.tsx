import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Item, POGroup, Customer } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LineItem {
    id: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export const PurchaseOrderForm = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        vendor_name: '', // Used for Vendor PO
        customer_id: '', // Used for Customer PO
        date: new Date().toISOString().split('T')[0],
        notes: '',
        total_project_value: 0,
        is_customer_po: true, // Default to Customer PO based on new requirements
    });

    const [poGroups, setPoGroups] = useState<POGroup[]>([
        {
            id: 'temp-1',
            purchase_order_id: '',
            group_name: '',
            description: '',
            created_at: '',
        },
    ]);

    // Keep line items for compatibility or "Additional Items"
    const [lineItems, setLineItems] = useState<LineItem[]>([
        {
            id: '1',
            item_id: '',
            item_name: '',
            quantity: 1,
            unit_price: 0,
            total: 0,
        },
    ]);

    useEffect(() => {
        fetchItems();
        fetchCustomers();
        if (id) {
            setIsEditMode(true);
            loadPurchaseOrder(id);
        }
    }, [id]);

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setItems(data);
    };

    const fetchCustomers = async () => {
        const { data } = await supabase.from('customers').select('*').order('name');
        if (data) setCustomers(data);
    };

    const loadPurchaseOrder = async (poId: string) => {
        setLoading(true);
        try {
            // Load PO header
            const { data: po, error: poError } = await supabase
                .from('purchase_orders')
                .select('*')
                .eq('id', poId)
                .single();

            if (poError) throw poError;

            if (po) {
                setFormData({
                    vendor_name: po.vendor_name || '',
                    customer_id: po.customer_id || '',
                    date: po.date,
                    notes: po.notes || '',
                    total_project_value: po.total_project_value || 0,
                    is_customer_po: !!po.customer_id, // If customer_id exists, it's a Customer PO
                });

                // Load PO items
                const { data: poItems, error: itemsError } = await supabase
                    .from('purchase_order_items')
                    .select('*')
                    .eq('purchase_order_id', poId);

                if (itemsError) throw itemsError;

                if (poItems && poItems.length > 0) {
                    const loadedItems = poItems.map((item, index) => ({
                        id: `loaded-${index}`,
                        item_id: item.item_id,
                        item_name: '', // Will be populated when items are fetched
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.total,
                    }));
                    setLineItems(loadedItems);
                }

                // Load PO Groups
                const { data: groups, error: groupsError } = await supabase
                    .from('po_groups')
                    .select('*')
                    .eq('purchase_order_id', poId);

                if (groupsError) throw groupsError;

                if (groups && groups.length > 0) {
                    setPoGroups(groups);
                }
            }
        } catch (error: any) {
            console.error('Error loading purchase order:', error);
            showToast('Failed to load purchase order', 'error');
            navigate('/purchase-orders');
        } finally {
            setLoading(false);
        }
    };

    /* Group Management */
    const addGroup = () => {
        setPoGroups([
            ...poGroups,
            {
                id: `temp-${Date.now()}`,
                purchase_order_id: id || '',
                group_name: '',
                description: '',
                created_at: new Date().toISOString(),
            },
        ]);
    };

    const removeGroup = (groupId: string) => {
        if (poGroups.length > 1) {
            setPoGroups(poGroups.filter((g) => g.id !== groupId));
        }
    };

    const updateGroup = (groupId: string, field: keyof POGroup, value: any) => {
        setPoGroups(
            poGroups.map((g) => {
                if (g.id === groupId) {
                    return { ...g, [field]: value };
                }
                return g;
            })
        );
    };

    /* Line Item Management */
    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            {
                id: Date.now().toString(),
                item_id: '',
                item_name: '',
                quantity: 1,
                unit_price: 0,
                total: 0,
            },
        ]);
    };

    const removeLineItem = (id: string) => {
        setLineItems(lineItems.filter((item) => item.id !== id));
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(
            lineItems.map((item) => {
                if (item.id === id) {
                    const updated = { ...item, [field]: value };
                    if (field === 'item_id' && value) {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updated.item_name = selectedItem.name;
                            updated.unit_price = selectedItem.price;
                        }
                    }
                    updated.total = updated.quantity * updated.unit_price;
                    return updated;
                }
                return item;
            })
        );
    };

    const calculateTotal = () => {
        return lineItems.reduce((sum, item) => sum + item.total, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Basic validation
        if (formData.is_customer_po && !formData.customer_id) {
            showToast('Please select a customer', 'error');
            return;
        }
        if (!formData.is_customer_po && !formData.vendor_name) {
            showToast('Please enter vendor name', 'error');
            return;
        }

        setLoading(true);
        try {
            const total = calculateTotal();
            const poData = {
                customer_id: formData.is_customer_po ? formData.customer_id : null,
                vendor_name: formData.is_customer_po ? 'Customer PO' : formData.vendor_name,
                date: formData.date,
                total: total, // Still track total of line items if any
                total_project_value: formData.total_project_value,
                notes: formData.notes,
                status: 'pending',
                user_id: user.id,
                // If new, add po_number
                ...(isEditMode ? {} : { po_number: 'PO-' + Date.now() }),
            };


            let poId = id;

            if (isEditMode && id) {
                // Update PO
                const { error: poError } = await supabase
                    .from('purchase_orders')
                    .update(poData)
                    .eq('id', id);

                if (poError) throw poError;

                // Update Groups: Simple strategy - Delete all and Re-insert (or separate handling)
                // For simplicity in this iteration: Delete and Insert
                await supabase.from('po_groups').delete().eq('purchase_order_id', id);
                await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);

            } else {
                // Create PO
                const { data: newPo, error: poError } = await supabase
                    .from('purchase_orders')
                    .insert([poData])
                    .select()
                    .single();

                if (poError) throw poError;
                poId = newPo?.id;
            }

            if (!poId) throw new Error("Failed to get PO ID");

            // Insert Groups
            const validGroups = poGroups.filter(g => g.group_name.trim() !== '');
            if (validGroups.length > 0) {
                const groupsToInsert = validGroups.map(g => ({
                    purchase_order_id: poId,
                    group_name: g.group_name,
                    description: g.description
                }));
                const { error: groupError } = await supabase.from('po_groups').insert(groupsToInsert);
                if (groupError) throw groupError;
            }

            // Insert Items
            const itemsToInsert = lineItems.map((item) => ({
                purchase_order_id: poId,
                item_id: item.item_id || null, // Allow nullable if not selected
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
                item_name: item.item_name || 'Item' // Fallback
            }));

            // Filter out empty items if needed, or allow them
            if (itemsToInsert.length > 0) {
                const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            showToast(`Purchase order ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            navigate('/purchase-orders');
        } catch (error: any) {
            console.error('Error saving purchase order:', error);
            showToast(JSON.stringify(error, null, 2) || error.message || 'Failed to save purchase order', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'New'} Purchase Order</h1>
                        <p className="text-gray-600 mt-1">Manage Customer POs and Project Details</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">PO Details</h2>

                    {/* Toggle Type */}
                    <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={formData.is_customer_po}
                                onChange={() => setFormData(prev => ({ ...prev, is_customer_po: true }))}
                            />
                            Customer PO
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                checked={!formData.is_customer_po}
                                onChange={() => setFormData(prev => ({ ...prev, is_customer_po: false }))}
                            />
                            Vendor PO
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.is_customer_po ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                                <select
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                    className="input w-full bg-white"
                                    required={formData.is_customer_po}
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                                <input
                                    type="text"
                                    value={formData.vendor_name}
                                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                                    className="input w-full bg-white"
                                    placeholder="Enter vendor name"
                                    required={!formData.is_customer_po}
                                />
                            </div>
                        )}

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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Project Value</label>
                            <input
                                type="number"
                                value={formData.total_project_value}
                                onChange={(e) => setFormData({ ...formData, total_project_value: parseFloat(e.target.value) || 0 })}
                                className="input w-full bg-white"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input w-full bg-white"
                                rows={3}
                                placeholder="Optional notes"
                            />
                        </div>
                    </div>
                </Card>

                {/* Groups Section */}
                {formData.is_customer_po && (
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">PO Groups (Grouping Item)</h2>
                            <Button type="button" onClick={addGroup} variant="secondary">
                                <Plus className="w-4 h-4" />
                                Add Group
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {poGroups.map((group) => (
                                <div key={group.id} className="flex gap-3 items-start p-3 border rounded-lg bg-gray-50">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={group.group_name}
                                            onChange={(e) => updateGroup(group.id, 'group_name', e.target.value)}
                                            className="input w-full bg-white mb-2"
                                            placeholder="Group Name (e.g. Group 001)"
                                            required
                                        />
                                        <input
                                            type="text"
                                            value={group.description || ''}
                                            onChange={(e) => updateGroup(group.id, 'description', e.target.value)}
                                            className="input w-full bg-white text-sm"
                                            placeholder="Description (Optional)"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeGroup(group.id)}
                                        className="text-red-600 hover:text-red-800 p-2"
                                        disabled={poGroups.length === 1}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Define groups here to assign items later.</p>
                    </Card>
                )}

                {/* Items Section (Optional) */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Line Items (Optional)</h2>
                        <Button type="button" onClick={addLineItem} variant="secondary">
                            <Plus className="w-4 h-4" />
                            Add Item
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <select
                                                value={item.item_id}
                                                onChange={(e) => updateLineItem(item.id, 'item_id', e.target.value)}
                                                className="input w-full min-w-[200px] bg-white"
                                            >
                                                <option value="">Select Item (Optional)</option>
                                                {items.map((i) => (
                                                    <option key={i.id} value={i.id}>
                                                        {i.name} - ${i.price}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="input w-24 bg-white"
                                                min="1"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="input w-32 bg-white"
                                                step="0.01"
                                                min="0"
                                            />
                                        </td>
                                        <td className="font-semibold">${item.total.toFixed(2)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(item.id)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? 'Saving...' : 'Save Purchase Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};