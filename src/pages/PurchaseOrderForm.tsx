import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Item } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface LineItem {
    id: string;
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    amount: number;
}

export const PurchaseOrderForm = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        vendor_name: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const [lineItems, setLineItems] = useState<LineItem[]>([
        {
            id: '1',
            item_id: '',
            item_name: '',
            quantity: 1,
            unit_price: 0,
            amount: 0,
        },
    ]);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setItems(data);
    };

    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            {
                id: Date.now().toString(),
                item_id: '',
                item_name: '',
                quantity: 1,
                unit_price: 0,
                amount: 0,
            },
        ]);
    };

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((item) => item.id !== id));
        }
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(
            lineItems.map((item) => {
                if (item.id === id) {
                    const updated = { ...item, [field]: value };

                    // If item_id changed, update item_name and unit_price
                    if (field === 'item_id' && value) {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updated.item_name = selectedItem.name;
                            updated.unit_price = selectedItem.price;
                        }
                    }

                    // Calculate amount
                    updated.amount = updated.quantity * updated.unit_price;
                    return updated;
                }
                return item;
            })
        );
    };

    const calculateTotal = () => {
        return lineItems.reduce((sum, item) => sum + item.amount, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !formData.vendor_name) return;

        setLoading(true);
        try {
            const total = calculateTotal();

            const { data: purchaseOrder, error: poError } = await supabase
                .from('purchase_orders')
                .insert([
                    {
                        vendor_name: formData.vendor_name,
                        date: formData.date,
                        total_amount: total,
                        notes: formData.notes,
                        status: 'pending',
                    },
                ])
                .select()
                .single();

            if (poError) throw poError;

            const itemsToInsert = lineItems.map((item) => ({
                purchase_order_id: purchaseOrder.id,
                item_id: item.item_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                amount: item.amount,
            }));

            const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsToInsert);

            if (itemsError) throw itemsError;

            navigate('/purchase-orders');
        } catch (error) {
            console.error('Error creating purchase order:', error);
            alert('Failed to create purchase order');
        } finally {
            setLoading(false);
        }
    };

    const total = calculateTotal();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Create Purchase Order</h1>
                        <p className="text-gray-600 mt-1">Add purchase order details and items</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Purchase Order Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                            <input
                                type="text"
                                value={formData.vendor_name}
                                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                                className="input w-full"
                                placeholder="Enter vendor name"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="input w-full"
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input w-full"
                                rows={3}
                                placeholder="Optional notes"
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Order Items</h2>
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
                                    <th>Amount</th>
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
                                                className="input w-full min-w-[200px]"
                                                required
                                            >
                                                <option value="">Select Item</option>
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
                                                className="input w-24"
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="input w-32"
                                                step="0.01"
                                                min="0"
                                                required
                                            />
                                        </td>
                                        <td className="font-semibold">${item.amount.toFixed(2)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(item.id)}
                                                className="text-red-600 hover:text-red-800"
                                                disabled={lineItems.length === 1}
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

                <Card>
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Total Amount:</h2>
                        <span className="text-3xl font-bold text-blue-600">${total.toFixed(2)}</span>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !formData.vendor_name}>
                        {loading ? 'Creating...' : 'Create Purchase Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
