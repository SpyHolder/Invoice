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
    uom: string;
    unit_price: number;
    bef_disc: number;
    disc_percent: number;
    disc_amt: number;
    tax_rate: number;
    total: number;
}

export const QuotationForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const isEditMode = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [items, setItems] = useState<Item[]>([]);

    const [quotationNumber, setQuotationNumber] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [validUntil, setValidUntil] = useState(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    // New Fields
    const [contact, setContact] = useState('');
    const [rfqRefNo, setRfqRefNo] = useState('');
    const [subject, setSubject] = useState('');
    const [goodwillDiscount, setGoodwillDiscount] = useState(0);

    const [notes, setNotes] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);

    useEffect(() => {
        fetchCustomers();
        fetchItems();
        if (isEditMode) {
            loadQuotation(id!);
        } else {
            setQuotationNumber('QT-' + Date.now());
            addLineItem();
        }
    }, [user, id]);

    // Use effect to populate contact when customer changes
    useEffect(() => {
        if (customerId) {
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
                // Prefer attn if available, otherwise phone
                if (customer.attn) setContact(customer.attn);
                else setContact(customer.phone || '');
            }
        }
    }, [customerId, customers]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('customers').select('*').order('name');
        if (data) setCustomers(data);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setItems(data);
    };

    const loadQuotation = async (quotationId: string) => {
        setLoading(true);
        try {
            const { data: quotation, error } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', quotationId)
                .single();

            if (error) throw error;

            setQuotationNumber(quotation.quotation_number);
            setCustomerId(quotation.customer_id);
            setDate(quotation.date);
            setValidUntil(quotation.valid_until);
            setNotes(quotation.notes || '');
            setPaymentTerms(quotation.payment_terms || '');

            // Load new fields
            setContact(quotation.contact || '');
            setRfqRefNo(quotation.rfq_ref_no || '');
            setSubject(quotation.subject || '');
            setGoodwillDiscount(quotation.goodwill_discount || 0);

            const { data: items } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', quotationId)
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
                        bef_disc: item.bef_disc || (item.unit_price * item.quantity),
                        disc_percent: item.disc_percent || 0,
                        disc_amt: item.disc_amt || 0,
                        tax_rate: item.tax_rate,
                        total: item.total,
                    }))
                );
            }
        } catch (error) {
            console.error('Error loading quotation:', error);
            showToast('Failed to load quotation', 'error');
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
                bef_disc: 0,
                disc_percent: 0,
                disc_amt: 0,
                tax_rate: 0,
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
                    const updatedItem = { ...item, [field]: value };

                    if (field === 'item_id') {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updatedItem.item_name = selectedItem.name;
                            updatedItem.description = selectedItem.description;
                            updatedItem.unit_price = selectedItem.price;
                        }
                    }

                    // Recalculate logic
                    const qty = field === 'quantity' ? Number(value) : updatedItem.quantity;
                    const price = field === 'unit_price' ? Number(value) : updatedItem.unit_price;
                    const discPercent = field === 'disc_percent' ? Number(value) : updatedItem.disc_percent;

                    // Bef Disc = Qty * Unit Price
                    updatedItem.bef_disc = qty * price;

                    // Disc Amt = Bef Disc * (Disc % / 100)
                    updatedItem.disc_amt = updatedItem.bef_disc * (discPercent / 100);

                    // Total = Bef Disc - Disc Amt
                    updatedItem.total = updatedItem.bef_disc - updatedItem.disc_amt;

                    return updatedItem;
                }
                return item;
            })
        );
    };

    const calculateTotals = () => {
        const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
        // We only have per-item discount now, global discount is replaced by Goodwill Discount
        // Tax is simplified to 0 for now as per user request "NO GST"
        // But we keep tax calculation logic in case
        const tax = lineItems.reduce((sum, item) => sum + (item.total * item.tax_rate) / 100, 0);
        const total = subtotal + tax - goodwillDiscount;

        return { subtotal, tax, total };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { subtotal, tax, total } = calculateTotals();

        try {
            const quotationData = {
                quotation_number: quotationNumber,
                customer_id: customerId,
                date,
                valid_until: validUntil,
                subtotal,
                discount: 0, // Deprecated global discount
                tax,
                total,
                notes,
                payment_terms: paymentTerms,
                status: 'draft',
                // New fields
                contact,
                rfq_ref_no: rfqRefNo,
                subject,
                goodwill_discount: goodwillDiscount,
            };

            let quotationId = id;

            if (isEditMode) {
                const { error } = await supabase
                    .from('quotations')
                    .update(quotationData)
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('quotations')
                    .insert([quotationData])
                    .select()
                    .single();
                if (error) throw error;
                quotationId = data.id;
            }

            // Delete existing items if edit mode
            if (isEditMode) {
                await supabase.from('quotation_items').delete().eq('quotation_id', id);
            }

            // Insert new items
            const { error: itemsError } = await supabase.from('quotation_items').insert(
                lineItems.map((item) => ({
                    quotation_id: quotationId,
                    item_id: item.item_id || null,
                    item_name: item.item_name,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    tax_rate: item.tax_rate,
                    total: item.total,
                    // New fields
                    uom: item.uom,
                    bef_disc: item.bef_disc,
                    disc_percent: item.disc_percent,
                    disc_amt: item.disc_amt,
                }))
            );

            if (itemsError) throw itemsError;

            showToast('Quotation saved successfully', 'success');
            navigate('/quotations');
        } catch (error) {
            console.error('Error saving quotation:', error);
            showToast('Failed to save quotation', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={() => navigate('/quotations')}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">
                    {isEditMode ? 'Edit Quotation' : 'Create Quotation'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Customer *
                            </label>
                            <select
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quotation Number *
                            </label>
                            <input
                                type="text"
                                value={quotationNumber}
                                onChange={(e) => setQuotationNumber(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valid Until
                            </label>
                            <input
                                type="date"
                                value={validUntil}
                                onChange={(e) => setValidUntil(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* New Fields */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contact (Attn)
                            </label>
                            <input
                                type="text"
                                value={contact}
                                onChange={(e) => setContact(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Contact Name / Phone"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                RFQ Ref No
                            </label>
                            <input
                                type="text"
                                value={rfqRefNo}
                                onChange={(e) => setRfqRefNo(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g. RFQ - 55777"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Your Quotation Subject"
                            />
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
                                        <th className="text-right py-2 px-2 w-32">U/Price</th>
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
                                                    className="w-full px-2 py-1 border border-gray-300 rounded mb-2"
                                                >
                                                    <option value="">Select Item</option>
                                                    {items.map((i) => (
                                                        <option key={i.id} value={i.id}>
                                                            {i.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    value={item.item_name}
                                                    onChange={(e) => updateLineItem(item.id, 'item_name', e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded"
                                                    placeholder="Item Name"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <textarea
                                                    value={item.description}
                                                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                                    rows={2}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded"
                                                    placeholder="Description"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <select
                                                    value={item.uom}
                                                    onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-center"
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
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unit_price}
                                                    onChange={(e) => updateLineItem(item.id, 'unit_price', e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                                                />
                                            </td>
                                            <td className="p-2 align-top">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={item.disc_percent}
                                                    onChange={(e) => updateLineItem(item.id, 'disc_percent', e.target.value)}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right"
                                                />
                                            </td>
                                            <td className="p-2 align-top text-right font-medium">
                                                ${item.total.toFixed(2)}
                                                {item.disc_percent > 0 && <div className="text-xs text-red-500">(-{item.disc_amt.toFixed(2)})</div>}
                                            </td>
                                            <td className="p-2 align-top text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeLineItem(item.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Button type="button" onClick={addLineItem} className="mt-4" variant="secondary">
                            <Plus className="w-4 h-4" />
                            Add Item
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
                                <div className="flex justify-between text-sm items-center">
                                    <span className="text-gray-600">Goodwill Discount:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={goodwillDiscount}
                                        onChange={(e) => setGoodwillDiscount(parseFloat(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                                    />
                                </div>
                                <div className="border-t pt-3 flex justify-between">
                                    <span className="text-lg font-semibold">Total Amount:</span>
                                    <span className="text-lg font-bold text-blue-600">
                                        ${totals.total.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Payment Terms
                                </label>
                                <input
                                    type="text"
                                    value={paymentTerms}
                                    onChange={(e) => setPaymentTerms(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => navigate('/quotations')}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Quotation'}
                    </Button>
                </div>
            </form>
        </div>
    );
};