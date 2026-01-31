import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Item, Partner, PurchaseOrderItem } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface POLineItem {
    id: string;
    item_id: string;
    item_code: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export const PurchaseOrderForm = () => {
    // const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [vendors, setVendors] = useState<Partner[]>([]);
    const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        vendor_id: '',
        po_number: '',
        date: new Date().toISOString().split('T')[0],
        quote_ref: '',
        shipping_info: '',
        delivery_address: '',
        notes: '',
        status: 'pending',
    });

    const [lineItems, setLineItems] = useState<POLineItem[]>([
        {
            id: '1',
            item_id: '',
            item_code: '',
            description: '',
            quantity: 1,
            unit_price: 0,
            total: 0,
        },
    ]);

    useEffect(() => {
        fetchVendors();
        fetchInventoryItems();
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
                    shipping_info: po.shipping_info || '',
                    delivery_address: po.delivery_address || '',
                    notes: po.notes || '',
                    status: po.status,
                });

                const { data: items, error: itemsError } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', poId);
                if (itemsError) throw itemsError;

                if (items) {
                    setLineItems(items.map((i, idx) => ({
                        id: i.id || `loaded-${idx}`,
                        item_id: '', // Not strictly linking to inventory item ID if not preserved, but could try to match by code
                        item_code: i.item_code || '',
                        description: i.description || '',
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        total: i.total
                    })));
                }
            }
        } catch (error: any) {
            console.error(error);
            showToast('Failed to load PO', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateLineItem = (id: string, field: keyof POLineItem, value: any) => {
        setLineItems(lineItems.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };

                // If item selection
                if (field === 'item_id' && value) {
                    const invItem = inventoryItems.find(i => i.id === value);
                    if (invItem) {
                        updated.item_code = invItem.item_code || '';
                        updated.description = invItem.name + (invItem.description ? ` - ${invItem.description}` : '');
                        updated.unit_price = invItem.price; // Cost price might be different, but for now use price
                    }
                }

                updated.total = updated.quantity * updated.unit_price;
                return updated;
            }
            return item;
        }));
    };

    const calculateTotal = () => lineItems.reduce((acc, i) => acc + i.total, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const total = calculateTotal();
            const poData = {
                vendor_id: formData.vendor_id,
                po_number: formData.po_number || `PO-${Date.now()}`,
                date: formData.date,
                quote_ref: formData.quote_ref,
                shipping_info: formData.shipping_info,
                delivery_address: formData.delivery_address,
                notes: formData.notes,
                status: formData.status || 'pending',
                total: total
            };

            let poId = id;

            if (isEditMode && id) {
                const { error } = await supabase.from('purchase_orders').update(poData).eq('id', id);
                if (error) throw error;
                await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
            } else {
                const { data, error } = await supabase.from('purchase_orders').insert([poData]).select().single();
                if (error) throw error;
                poId = data.id;
            }

            if (poId) {
                const itemsToInsert = lineItems.map(i => ({
                    purchase_order_id: poId,
                    item_code: i.item_code,
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    total: i.total
                }));
                const { error } = await supabase.from('purchase_order_items').insert(itemsToInsert);
                if (error) throw error;
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
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Purchase Order</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">PO Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                            <select
                                value={formData.vendor_id}
                                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                                className="input w-full bg-white"
                                required
                            >
                                <option value="">Select Vendor...</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.company_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                            <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input w-full bg-white" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Quote Ref</label>
                            <input type="text" value={formData.quote_ref} onChange={e => setFormData({ ...formData, quote_ref: e.target.value })} className="input w-full bg-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Info</label>
                            <input type="text" value={formData.shipping_info} onChange={e => setFormData({ ...formData, shipping_info: e.target.value })} className="input w-full bg-white" placeholder="e.g. Ship via FCA" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Working Site Address / Delivery To</label>
                            <textarea
                                value={formData.delivery_address}
                                onChange={e => setFormData({ ...formData, delivery_address: e.target.value })}
                                className="input w-full bg-white"
                                rows={3}
                                placeholder="Enter delivery address..."
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Items</h2>
                        <Button type="button" onClick={() => setLineItems([...lineItems, { id: Date.now().toString(), item_id: '', item_code: '', description: '', quantity: 1, unit_price: 0, total: 0 }])} variant="secondary">
                            <Plus className="w-4 h-4" /> Add Item
                        </Button>
                    </div>

                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th>Item Select (Optional)</th>
                                <th>Code</th>
                                <th>Description</th>
                                <th className="w-24">Qty</th>
                                <th className="w-32">Unit Price</th>
                                <th className="w-32">Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <select
                                            value={item.item_id}
                                            onChange={(e) => updateLineItem(item.id, 'item_id', e.target.value)}
                                            className="input w-full bg-white"
                                        >
                                            <option value="">Manual Entry</option>
                                            {inventoryItems.map(i => (
                                                <option key={i.id} value={i.id}>{i.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <input type="text" value={item.item_code} onChange={e => updateLineItem(item.id, 'item_code', e.target.value)} className="input w-full" />
                                    </td>
                                    <td>
                                        <input type="text" value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} className="input w-full" />
                                    </td>
                                    <td>
                                        <input type="number" value={item.quantity} onChange={e => updateLineItem(item.id, 'quantity', parseFloat(e.target.value))} className="input w-full" />
                                    </td>
                                    <td>
                                        <input type="number" value={item.unit_price} onChange={e => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value))} className="input w-full" />
                                    </td>
                                    <td className="font-bold">
                                        {item.total.toFixed(2)}
                                    </td>
                                    <td>
                                        <button type="button" onClick={() => setLineItems(lineItems.filter(i => i.id !== item.id))} className="text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Total Amount:</h2>
                        <span className="text-3xl font-bold text-blue-600">${calculateTotal().toFixed(2)}</span>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save PO'}
                    </Button>
                </div>
            </form>
        </div>
    );
};