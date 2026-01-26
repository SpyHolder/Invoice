import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    uom: string;
    unit_price: number;
    discount: number; // Amount
    discount_percent: number; // Percent
    tax_rate: number;
    total: number;
}

export const InvoiceForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const isEditMode = Boolean(id);
    const fromQuotationId = searchParams.get('from_quotation');
    const fromDoId = searchParams.get('from_do');

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [items, setItems] = useState<Item[]>([]);

    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [status, setStatus] = useState('unpaid');
    const [notes, setNotes] = useState('');

    // New Fields
    const [terms, setTerms] = useState('30 Days');
    const [customerPO, setCustomerPO] = useState('');

    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    useEffect(() => {
        fetchCustomers();
        fetchItems();
        if (isEditMode) {
            loadInvoice(id!);
        } else if (fromQuotationId) {
            setInvoiceNumber('INV-' + Date.now());
            loadFromQuotation(fromQuotationId);
        } else if (fromDoId) {
            setInvoiceNumber('INV-' + Date.now());
            loadFromDeliveryOrder(fromDoId);
        } else {
            setInvoiceNumber('INV-' + Date.now());
            addLineItem();
        }
    }, [user, id]);

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
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (error) throw error;

            setInvoiceNumber(invoice.invoice_number);
            setCustomerId(invoice.customer_id);
            setDate(invoice.date);
            setDueDate(invoice.due_date);
            setNotes(invoice.notes || '');
            setStatus(invoice.status);

            // Load New Fields
            setTerms(invoice.terms || '30 Days');
            setCustomerPO(invoice.customer_po || '');

            const { data: items } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', invoiceId)
                .order('id');

            if (items) {
                setLineItems(
                    items.map((item) => ({
                        id: item.id,
                        item_id: item.item_id || '',
                        item_name: item.item_name,
                        description: item.description || '',
                        quantity: item.quantity,
                        uom: item.uom || 'EA',
                        unit_price: item.unit_price,
                        discount: item.discount, // This is amount in DB
                        discount_percent: item.discount_percent || 0,
                        tax_rate: item.tax_rate,
                        total: item.total,
                    }))
                );
            }
        } catch (error) {
            console.error('Error loading invoice:', error);
            showToast('Failed to load invoice', 'error');
        } finally {
            setLoading(false);
        }
    };

    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            {
                id: Math.random().toString(),
                item_id: '',
                item_name: '',
                description: '',
                quantity: 1,
                uom: 'EA',
                unit_price: 0,
                discount: 0,
                discount_percent: 0,
                tax_rate: 0,
                total: 0,
            },
        ]);
    };

    const loadFromQuotation = async (qId: string) => {
        setLoading(true);
        try {
            const { data: qData, error: qError } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', qId)
                .single();
            if (qError) throw qError;

            setCustomerId(qData.customer_id);
            // setNotes(qData.notes || ''); // Optional: carry over notes?
            setCustomerPO(qData.rfq_ref_no || ''); // Map RFQ to PO? Or just leave empty. Maybe better mapping exists.

            const { data: qItems, error: itemsError } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', qId);

            if (itemsError) throw itemsError;

            if (qItems) {
                setLineItems(qItems.map(item => ({
                    id: Math.random().toString(), // New IDs
                    item_id: item.item_id || '',
                    item_name: item.item_name,
                    description: item.description || '',
                    quantity: item.quantity,
                    uom: item.uom || 'EA',
                    unit_price: item.unit_price,
                    discount: item.disc_amt || 0,
                    discount_percent: item.disc_percent || 0,
                    tax_rate: item.tax_rate || 0,
                    total: item.total
                })));
            }

        } catch (error) {
            console.error(error);
            showToast('Failed to load quotation details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadFromDeliveryOrder = async (doId: string) => {
        setLoading(true);
        try {
            const { data: doData, error: doError } = await supabase
                .from('delivery_orders')
                .select('*')
                .eq('id', doId)
                .single();
            if (doError) throw doError;

            setCustomerId(doData.customer_id);
            setCustomerPO(doData.customer_po || '');
            setTerms(doData.terms || '30 Days');

            const { data: doItems, error: itemsError } = await supabase
                .from('delivery_order_items')
                .select('*')
                .eq('delivery_order_id', doId);

            if (itemsError) throw itemsError;

            if (doItems) {
                setLineItems(doItems.map(item => ({
                    id: Math.random().toString(),
                    item_id: item.item_id || '',
                    item_name: item.item_name,
                    description: item.description || '',
                    quantity: item.quantity,
                    uom: item.uom || 'EA',
                    unit_price: item.unit_price,
                    discount: 0,
                    discount_percent: 0,
                    tax_rate: 0, // DO items usually don't have tax info stored explicitly, defaulting to 0
                    total: item.total
                })));
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to load delivery order details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const removeLineItem = (id: string) => {
        setLineItems(lineItems.filter((item) => item.id !== id));
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(
            lineItems.map((item) => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };

                    if (field === 'item_id') {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updatedItem.item_name = selectedItem.name;
                            updatedItem.description = selectedItem.description;
                            updatedItem.unit_price = selectedItem.price;
                        }
                    }

                    // Recalculate
                    const qty = field === 'quantity' ? Number(value) : updatedItem.quantity;
                    const price = field === 'unit_price' ? Number(value) : updatedItem.unit_price;
                    const discPct = field === 'discount_percent' ? Number(value) : updatedItem.discount_percent;

                    const subtotal = qty * price;
                    const discAmount = subtotal * (discPct / 100);

                    updatedItem.discount_percent = discPct;
                    updatedItem.discount = discAmount;
                    updatedItem.total = subtotal - discAmount;

                    return updatedItem;
                }
                return item;
            })
        );
    };

    const calculateTotals = () => {
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        const tax = lineItems.reduce((sum, item) => sum + (item.total * item.tax_rate) / 100, 0);
        const total = subtotal + tax;

        return { subtotal, tax, total };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { subtotal, tax, total } = calculateTotals();

        try {
            const invoiceData = {
                invoice_number: invoiceNumber,
                customer_id: customerId,
                date,
                due_date: dueDate,
                subtotal,
                discount: lineItems.reduce((sum, item) => sum + item.discount, 0),
                tax,
                total,
                notes,
                status,
                // New Fields
                terms,
                customer_po: customerPO,
            };

            let invoiceId = id;

            if (isEditMode) {
                const { error } = await supabase
                    .from('invoices')
                    .update(invoiceData)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('invoices')
                    .insert([invoiceData])
                    .select()
                    .single();
                if (error) throw error;
                invoiceId = data.id;
            }

            // Delete old items
            if (isEditMode) {
                await supabase.from('invoice_items').delete().eq('invoice_id', id);
            }

            // Insert items
            const { error: itemsError } = await supabase.from('invoice_items').insert(
                lineItems.map((item) => ({
                    invoice_id: invoiceId,
                    item_id: item.item_id || null,
                    item_name: item.item_name,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount: item.discount,
                    tax_rate: item.tax_rate,
                    total: item.total,
                    // New Fields
                    uom: item.uom,
                    discount_percent: item.discount_percent,
                }))
            );

            if (itemsError) throw itemsError;

            showToast('Invoice saved successfully', 'success');
            navigate('/invoices');
        } catch (error) {
            console.error('Error saving invoice:', error);
            showToast('Failed to save invoice', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={() => navigate('/invoices')}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">
                    {isEditMode ? 'Edit Invoice' : 'Create Invoice'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                            <select
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                required
                            >
                                <option value="">Select Customer</option>
                                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number *</label>
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                            <input
                                type="text"
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer PO</label>
                            <input
                                type="text"
                                value={customerPO}
                                onChange={(e) => setCustomerPO(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-gray-200">
                                        <th className="text-left py-2 px-2 w-64">Item</th>
                                        <th className="text-left py-2 px-2">Description</th>
                                        <th className="text-right py-2 px-2 w-20">Qty</th>
                                        <th className="text-center py-2 px-2 w-20">UOM</th>
                                        <th className="text-right py-2 px-2 w-32">Price</th>
                                        <th className="text-right py-2 px-2 w-20">Disc %</th>
                                        <th className="text-right py-2 px-2 w-32">Total</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item) => (
                                        <tr key={item.id} className="border-b border-gray-100">
                                            <td className="p-2 align-top">
                                                <select
                                                    value={item.item_id}
                                                    onChange={(e) => updateLineItem(item.id, 'item_id', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded mb-2"
                                                >
                                                    <option value="">Select Item</option>
                                                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                </select>
                                                <input
                                                    type="text"
                                                    value={item.item_name}
                                                    onChange={(e) => updateLineItem(item.id, 'item_name', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded"
                                                    placeholder="Item Name"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <textarea
                                                    value={item.description}
                                                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                                    rows={2}
                                                    className="w-full px-2 py-1 border rounded"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-right"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <select
                                                    value={item.uom}
                                                    onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-center"
                                                >
                                                    <option value="EA">EA</option>
                                                    <option value="Nos">Nos</option>
                                                    <option value="Lot">Lot</option>
                                                    <option value="PCS">PCS</option>
                                                </select>
                                            </td>
                                            <td className="p-2 align-top">
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={(e) => updateLineItem(item.id, 'unit_price', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-right"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <input
                                                    type="number"
                                                    value={item.discount_percent}
                                                    onChange={(e) => updateLineItem(item.id, 'discount_percent', e.target.value)}
                                                    className="w-full px-2 py-1 border rounded text-right"
                                                />
                                            </td>
                                            <td className="p-2 align-top text-right font-medium">
                                                ${item.total.toFixed(2)}
                                            </td>
                                            <td className="p-2 align-top text-center">
                                                <button onClick={() => removeLineItem(item.id)} className="text-red-500 hover:text-red-700">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Button type="button" onClick={addLineItem} className="mt-4" variant="secondary">
                            <Plus className="w-4 h-4" /> Add Item
                        </Button>
                    </div>
                </Card>

                <Card>
                    <div className="p-6">
                        <div className="flex justify-end">
                            <div className="w-80 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between">
                                    <span className="text-lg font-semibold">Total:</span>
                                    <span className="text-lg font-bold text-blue-600">${totals.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button type="button" variant="secondary" onClick={() => navigate('/invoices')}>Cancel</Button>
                    <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Invoice'}</Button>
                </div>
            </form>
        </div>
    );
};