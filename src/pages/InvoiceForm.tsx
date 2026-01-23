import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Customer, Item } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LineItem {
    id: string;
    item_id: string;
    item_name: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    total: number;
}

export const InvoiceForm = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        discount: 0,
        tax: 0,
    });

    const [lineItems, setLineItems] = useState<LineItem[]>([
        {
            id: '1',
            item_id: '',
            item_name: '',
            description: '',
            quantity: 1,
            unit_price: 0,
            discount: 0,
            tax_rate: 0,
            total: 0,
        },
    ]);

    useEffect(() => {
        fetchCustomers();
        fetchItems();
    }, []);

    useEffect(() => {
        // Only load invoice after items are fetched and we have an ID
        if (id && items.length > 0) {
            setIsEditMode(true);
            loadInvoice(id);
        }
    }, [id, items.length]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('customers').select('*').order('name');
        if (data) setCustomers(data);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setItems(data);
    };

    const loadInvoice = async (invoiceId: string) => {
        setLoading(true);
        try {
            // Load invoice header
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (invoiceError) throw invoiceError;

            if (invoice) {
                setFormData({
                    customer_id: invoice.customer_id,
                    date: invoice.date,
                    due_date: invoice.due_date,
                    notes: invoice.notes || '',
                    discount: invoice.discount,
                    tax: invoice.tax,
                });

                // Load invoice items
                const { data: invoiceItems, error: itemsError } = await supabase
                    .from('invoice_items')
                    .select('*')
                    .eq('invoice_id', invoiceId);

                if (itemsError) throw itemsError;

                if (invoiceItems && invoiceItems.length > 0) {
                    const loadedItems = invoiceItems.map((item, index) => {
                        // Try to find matching item by name to populate item_id
                        const matchingItem = items.find(i => i.name === item.item_name);

                        console.log('Loading invoice item:', {
                            item_name: item.item_name,
                            matchingItem: matchingItem,
                            item_id_from_db: item.item_id,
                            final_item_id: matchingItem?.id || item.item_id || ''
                        });

                        return {
                            id: `loaded-${index}`,
                            item_id: matchingItem?.id || item.item_id || '', // Prioritize matched item
                            item_name: item.item_name,
                            description: item.description || '',
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            discount: item.discount,
                            tax_rate: item.tax_rate,
                            total: item.total,
                        };
                    });
                    console.log('Setting line items:', loadedItems);
                    setLineItems(loadedItems);
                }
            }
        } catch (error: any) {
            console.error('Error loading invoice:', error);
            showToast('Failed to load invoice', 'error');
            navigate('/invoices');
        } finally {
            setLoading(false);
        }
    };

    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            {
                id: Date.now().toString(),
                item_id: '',
                item_name: '',
                description: '',
                quantity: 1,
                unit_price: 0,
                discount: 0,
                tax_rate: 0,
                total: 0,
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

                    // If item_id changed, auto-fill name and price
                    if (field === 'item_id' && value) {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updated.item_name = selectedItem.name;
                            updated.description = selectedItem.description || '';
                            updated.unit_price = selectedItem.price;
                        }
                    }

                    // Calculate line total
                    const subtotal = updated.quantity * updated.unit_price;
                    const discountAmount = subtotal * (updated.discount / 100);
                    const taxAmount = (subtotal - discountAmount) * (updated.tax_rate / 100);
                    updated.total = subtotal - discountAmount + taxAmount;
                    return updated;
                }
                return item;
            })
        );
    };

    const calculateTotals = () => {
        // Subtotal is now the sum of row totals (which already include row-level discounts + taxes)
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        // Global discount and tax still apply on top
        const discountAmount = subtotal * (formData.discount / 100);
        const taxAmount = (subtotal - discountAmount) * (formData.tax / 100);
        const total = subtotal - discountAmount + taxAmount;
        return { subtotal, discountAmount, taxAmount, total };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !formData.customer_id) return;

        setLoading(true);
        try {
            const totals = calculateTotals();

            if (isEditMode && id) {
                // Update existing invoice
                const { error: invoiceError } = await supabase
                    .from('invoices')
                    .update({
                        customer_id: formData.customer_id,
                        date: formData.date,
                        due_date: formData.due_date,
                        subtotal: totals.subtotal,
                        discount: formData.discount,
                        tax: formData.tax,
                        total: totals.total,
                        notes: formData.notes,
                    })
                    .eq('id', id);

                if (invoiceError) throw invoiceError;

                // Delete existing items
                await supabase.from('invoice_items').delete().eq('invoice_id', id);

                // Insert updated items
                const itemsToInsert = lineItems.map((item) => ({
                    invoice_id: id,
                    item_id: item.item_id,
                    item_name: item.item_name,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: item.discount,
                    tax_rate: item.tax_rate,
                    total: item.total,
                }));

                const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);

                if (itemsError) throw itemsError;

                showToast('Invoice updated successfully!', 'success');
            } else {
                // Create invoice
                const { data: invoice, error: invoiceError } = await supabase
                    .from('invoices')
                    .insert([
                        {
                            invoice_number: 'INV-' + Date.now(),
                            customer_id: formData.customer_id,
                            date: formData.date,
                            due_date: formData.due_date,
                            subtotal: totals.subtotal,
                            discount: formData.discount,
                            tax: formData.tax,
                            total: totals.total,
                            notes: formData.notes,
                            status: 'unpaid',
                        },
                    ])
                    .select()
                    .single();

                if (invoiceError) throw invoiceError;

                // Create invoice items
                const itemsToInsert = lineItems.map((item) => ({
                    invoice_id: invoice.id,
                    item_id: item.item_id,
                    item_name: item.item_name,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: item.discount,
                    tax_rate: item.tax_rate,
                    total: item.total,
                }));

                const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);

                if (itemsError) throw itemsError;

                showToast('Invoice created successfully!', 'success');
            }

            navigate('/invoices');
        } catch (error: any) {
            console.error('Error saving invoice:', error);
            showToast(error.message || 'Failed to save invoice', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/invoices')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Invoice</h1>
                        <p className="text-gray-600 mt-1">{isEditMode ? 'Update' : 'Add'} invoice details and line items</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Invoice Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                            <select
                                value={formData.customer_id}
                                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                className="input w-full bg-white"
                                required
                            >
                                <option value="">Select Customer</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="input w-full bg-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                className="input w-full bg-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <input
                                type="text"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input w-full bg-white"
                                placeholder="Optional notes"
                            />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Line Items</h2>
                        <Button type="button" onClick={addLineItem} variant="secondary">
                            <Plus className="w-4 h-4" />
                            Add Item
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>Unit Price</th>
                                    <th>Discount %</th>
                                    <th>Tax %</th>
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
                                                className="input w-full min-w-[180px] bg-white"
                                                required
                                            >
                                                <option value="">Select Item</option>
                                                {items.map((inventoryItem) => (
                                                    <option key={inventoryItem.id} value={inventoryItem.id}>
                                                        {inventoryItem.name} - ${inventoryItem.price.toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                                className="input w-full min-w-[150px] bg-white"
                                                placeholder="Description"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="input w-20 bg-white"
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="input w-28 bg-white"
                                                step="0.01"
                                                min="0"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.discount}
                                                onChange={(e) => updateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                                                className="input w-20 bg-white"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.tax_rate}
                                                onChange={(e) => updateLineItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)}
                                                className="input w-20 bg-white"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                        </td>
                                        <td className="font-semibold">${item.total.toFixed(2)}</td>
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
                    <h2 className="text-xl font-semibold mb-4">Totals</h2>
                    <div className="space-y-4 max-w-md ml-auto">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold text-lg">${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <label className="text-gray-600">Discount (%):</label>
                            <input
                                type="number"
                                value={formData.discount}
                                onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                className="input w-24 bg-white"
                                step="0.01"
                                min="0"
                                max="100"
                            />
                            <span className="font-semibold w-24 text-right">-${totals.discountAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <label className="text-gray-600">Tax (%):</label>
                            <input
                                type="number"
                                value={formData.tax}
                                onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                                className="input w-24 bg-white"
                                step="0.01"
                                min="0"
                                max="100"
                            />
                            <span className="font-semibold w-24 text-right">+${totals.taxAmount.toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-4 flex justify-between items-center">
                            <span className="text-xl font-bold">Total:</span>
                            <span className="text-2xl font-bold text-blue-600">${totals.total.toFixed(2)}</span>
                        </div>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/invoices')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !formData.customer_id}>
                        {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Invoice' : 'Create Invoice')}
                    </Button>
                </div>
            </form>
        </div>
    );
};