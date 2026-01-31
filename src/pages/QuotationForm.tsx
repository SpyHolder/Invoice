import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Partner, Item } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LineItem {
    id: string;
    item_id: string;
    item_name: string; // Used for display context/search if needed
    item_description: string;
    quantity: number;
    unit_price: number;
    disc_percent: number;
    disc_amount: number;
    uom: string;
    total_price: number;
}

export const QuotationForm = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Partner[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subject: '',
        // notes: '', // removed
        // payment_terms: '', // removed
        discount_amount: 0,
        gst_rate: 0,
    });

    const [lineItems, setLineItems] = useState<LineItem[]>([
        {
            id: '1',
            item_id: '',
            item_name: '',
            item_description: '',
            quantity: 1,
            unit_price: 0,
            disc_percent: 0,
            disc_amount: 0,
            uom: 'EA',
            total_price: 0,
        },
    ]);

    useEffect(() => {
        fetchCustomers();
        fetchItems();
        if (id) {
            setIsEditMode(true);
            loadQuotation(id);
        }
    }, [id]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('partners').select('*').eq('type', 'customer').order('company_name');
        if (data) setCustomers(data);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setItems(data);
    };

    const loadQuotation = async (quotationId: string) => {
        setLoading(true);
        try {
            // Load quotation header
            const { data: quotation, error: quotationError } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', quotationId)
                .single();

            if (quotationError) throw quotationError;

            if (quotation) {
                setFormData({
                    customer_id: quotation.customer_id,
                    date: quotation.date,
                    valid_until: quotation.validity_date || '',
                    subject: quotation.subject || '',
                    // notes: quotation.notes || '', // removed form schema
                    // Wait, `quotations` table in `update_schema.sql` has:
                    // quote_number, customer_id, date, validity_date, subject, subtotal, discount_amount, total_amount, gst_rate, status.
                    // It does NOT have `notes`, `payment_terms`.
                    // The previous schema had them.
                    // If I removed them, I should remove them from form.
                    // But Image 1 has "Budget Summary" which implies concise financial data, but usually quotes have T&C.
                    // Let's assume `notes` might have been missed or not needed? Or maybe they are generic?
                    // I will check `20260131100000_update_schema.sql` content again.
                    // `CREATE TABLE IF NOT EXISTS public.quotations ... subject text ... status text`. 
                    // No `notes` column. 
                    // I will remove `notes` and `payment_terms` from form push to DB, or I should have added them.
                    // Given strict requirements, I'll stick to what's defined.
                    // However, `validity_date` is there.

                    // Actually, I'll just keep them in state but not save them if they don't exist, OR I'll assume I should have added them.
                    // For now, I'll remove them from saving logic if table doesn't have them.
                    // But wait, `notes` allows "To Supply Labor..." description? No that's `subject`.
                    // Okay, I'll use `subject` properly.

                    // payment_terms removed
                    // notes removed
                    discount_amount: quotation.discount_amount,
                    gst_rate: quotation.gst_rate,
                });

                // Load quotation items
                const { data: quotationItems, error: itemsError } = await supabase
                    .from('quotation_items')
                    .select('*')
                    .eq('quotation_id', quotationId);

                if (itemsError) throw itemsError;

                if (quotationItems && quotationItems.length > 0) {
                    const loadedItems = quotationItems.map((item, index) => ({
                        id: `loaded-${index}`,
                        item_id: '', // no item_id in new schema items table relation? `quotation_items` has `item_description`. It does NOT have `item_id`.
                        // So I can't link back to specific Item ID easily unless I stored it.
                        // But I can pre-fill description.
                        item_name: '',
                        item_description: item.item_description || '',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        disc_percent: item.disc_percent,
                        disc_amount: item.disc_amount,
                        uom: item.uom || 'EA',
                        total_price: item.total_price,
                    }));
                    setLineItems(loadedItems);
                }
            }
        } catch (error: any) {
            console.error('Error loading quotation:', error);
            showToast('Failed to load quotation', 'error');
            navigate('/quotations');
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
                item_description: '',
                quantity: 1,
                unit_price: 0,
                disc_percent: 0,
                disc_amount: 0,
                uom: 'EA',
                total_price: 0,
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

                    // If item_id changed, auto-fill details
                    if (field === 'item_id' && value) {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updated.item_name = selectedItem.name;
                            updated.item_description = selectedItem.description || selectedItem.name;
                            updated.unit_price = selectedItem.price;
                            updated.uom = selectedItem.uom || 'EA';
                        }
                    }

                    // Calculate totals
                    // Logic: Total = (Qty * Price) - DiscountAmt?
                    // Or if Disc % is used.
                    const gross = updated.quantity * updated.unit_price;

                    // Priority: if field is disc_percent, calc disc_amount. If disc_amount, calc percent? 
                    // Simplification: Let's assume disc_percent drives it for now, or just amount.
                    // Let's support disc_percent logic.
                    if (field === 'disc_percent') {
                        updated.disc_amount = gross * (updated.disc_percent / 100);
                    } else if (field === 'quantity' || field === 'unit_price') {
                        updated.disc_amount = gross * (updated.disc_percent / 100);
                    }

                    updated.total_price = gross - updated.disc_amount; // + GST? No, GST is usually on subtotal.

                    return updated;
                }
                return item;
            })
        );
    };

    const calculateTotals = () => {
        let subtotal = 0;
        lineItems.forEach(item => {
            // Wait, schema `total_price` in items row.
            // Subtotal should be sum of item totals IF item discount is line-item based.
            // BUT schema also has `discount_amount` on Header (Good Will Discount).
            // So Subtotal = Sum of (Item Total Price)?
            subtotal += item.total_price;
        });

        // Good will discount
        const headerDiscount = formData.discount_amount || 0;

        // GST?
        const taxableAmount = subtotal - headerDiscount;
        const gstAmount = taxableAmount * (formData.gst_rate / 100);

        const total = taxableAmount + gstAmount;

        return { subtotal, headerDiscount, gstAmount, total };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !formData.customer_id) return;

        setLoading(true);
        try {
            const totals = calculateTotals();

            const quotationData = {
                customer_id: formData.customer_id,
                date: formData.date,
                validity_date: formData.valid_until,
                subject: formData.subject,
                subtotal: totals.subtotal,
                discount_amount: totals.headerDiscount, // Good will
                gst_rate: formData.gst_rate,
                total_amount: totals.total,
                // notes: formData.notes, // Removed from schema
            };

            let quotationId = id;

            if (isEditMode && id) {
                // Update existing
                const { error } = await supabase
                    .from('quotations')
                    .update(quotationData)
                    .eq('id', id);
                if (error) throw error;

                // Delete items
                await supabase.from('quotation_items').delete().eq('quotation_id', id);
            } else {
                // Create new
                const { data, error: insertError } = await supabase
                    .from('quotations')
                    .insert([{
                        ...quotationData,
                        quotation_number: 'CNK-Q-' + Date.now(),
                        status: 'draft'
                    }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                quotationId = data.id;
            }

            // Insert items
            if (quotationId) {
                const itemsToInsert = lineItems.map(item => ({
                    quotation_id: quotationId,
                    item_description: item.item_description,
                    quantity: item.quantity,
                    uom: item.uom,
                    unit_price: item.unit_price,
                    disc_percent: item.disc_percent,
                    disc_amount: item.disc_amount,
                    total_price: item.total_price
                }));

                const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            showToast(`Quotation ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            navigate('/quotations');

        } catch (error: any) {
            console.error('Error saving quotation:', error);
            showToast(error.message || 'Failed to save quotation', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/quotations')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Quotation</h1>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Quotation Information</h2>
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
                                        {customer.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="input w-full bg-white"
                                required
                                placeholder="To Supply Labor and Material..."
                            />
                        </div>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                            <input
                                type="date"
                                value={formData.valid_until}
                                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                className="input w-full bg-white"
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
                                    <th>Item Selection (Auto-fill)</th>
                                    <th>Description</th>
                                    <th>Qty</th>
                                    <th>UOM</th>
                                    <th>Unit Price</th>
                                    <th>Disc %</th>
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
                                                className="input w-[150px] bg-white"
                                            >
                                                <option value="">Select...</option>
                                                {items.map((i) => (
                                                    <option key={i.id} value={i.id}>
                                                        {i.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                value={item.item_description}
                                                onChange={(e) => updateLineItem(item.id, 'item_description', e.target.value)}
                                                className="input w-full min-w-[200px] bg-white"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="input w-16 bg-white"
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <select
                                                value={item.uom}
                                                onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                                                className="input w-16 bg-white"
                                            >
                                                <option value="EA">EA</option>
                                                <option value="Lot">Lot</option>
                                                <option value="Nos">Nos</option>
                                                <option value="PCS">PCS</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="input w-24 bg-white"
                                                step="0.01"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.disc_percent}
                                                onChange={(e) => updateLineItem(item.id, 'disc_percent', parseFloat(e.target.value) || 0)}
                                                className="input w-16 bg-white"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                        </td>
                                        <td className="font-semibold">${item.total_price.toFixed(2)}</td>
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
                    <h2 className="text-xl font-semibold mb-4">Budget Summary</h2>
                    <div className="space-y-4 max-w-md ml-auto">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Scope Total:</span>
                            <span className="font-semibold text-lg">${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <label className="text-gray-600">Good Will Discount ($):</label>
                            <input
                                type="number"
                                value={formData.discount_amount}
                                onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                                className="input w-32 bg-white"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        {/* GST Field if needed, defaulting to 0 as per requirements 'NO GST' */}
                        <div className="flex justify-between items-center gap-4">
                            <label className="text-gray-600">GST Rate (%):</label>
                            <input
                                type="number"
                                value={formData.gst_rate}
                                onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })}
                                className="input w-32 bg-white"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div className="border-t pt-4 flex justify-between items-center">
                            <span className="text-xl font-bold">Total Amount:</span>
                            <span className="text-2xl font-bold text-blue-600">${totals.total.toFixed(2)}</span>
                        </div>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/quotations')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !formData.customer_id}>
                        {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Quotation' : 'Create Quotation')}
                    </Button>
                </div>
            </form>
        </div>
    );
};
