import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Partner } from '../lib/supabase';
// import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface InvoiceLineItem {
    id: string;
    item_code: string;
    item_id: string; // Optional, for lookup only, not in DB
    description: string;
    quantity: number;
    uom: string;
    unit_price: number;
    total_price: number; // Match DB column name (was 'total')
}

export const InvoiceForm = () => {
    // const { user } = useAuth();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Data sources
    const [customers, setCustomers] = useState<Partner[]>([]);
    const [salesOrders, setSalesOrders] = useState<any[]>([]); // SOs specific to customer

    const [formData, setFormData] = useState({
        customer_id: '',
        so_id: '',
        invoice_number: '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        terms: '30 Days',
        subject: '',
        status: 'unpaid',
        pricing_mode: 'standard', // 'standard' (itemized) or 'milestone' (progressive)
        milestone_description: '',
        milestone_amount: 0,
        subtotal: 0,
        discount: 0,
        tax: 0, // global tax percent (GST)
        notes: '',
    });

    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
        {
            id: '1',
            item_code: '',
            item_id: '',
            description: '',
            quantity: 1,
            uom: 'EA',
            unit_price: 0,
            total_price: 0
        }
    ]);

    useEffect(() => {
        fetchCustomers();
        const doIdParam = searchParams.get('do_id');
        const soIdParam = searchParams.get('so_id');

        if (id) {
            setIsEditMode(true);
            loadInvoice(id);
        } else if (doIdParam) {
            handleDOSelection(doIdParam);
        } else if (soIdParam) {
            handleSOSelectionForInvoice(soIdParam);
        }
    }, [id, searchParams]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('partners').select('*').eq('type', 'customer').order('company_name');
        if (data) setCustomers(data);
    };

    const fetchSalesOrders = async (customerId: string) => {
        if (!customerId) {
            setSalesOrders([]);
            return;
        }

        const { data } = await supabase.from('sales_orders')
            .select('*, quotations!inner(customer_id)')
            .eq('status', 'confirmed')
            .eq('quotations.customer_id', customerId);

        if (data) setSalesOrders(data);
    };

    const handleCustomerChange = async (custId: string) => {
        setFormData(prev => ({ ...prev, customer_id: custId, so_id: '' }));
        await fetchSalesOrders(custId);
    };

    // Handle when creating invoice directly from SO (combine all DOs)
    const handleSOSelectionForInvoice = async (soId: string) => {
        setFormData(prev => ({ ...prev, so_id: soId }));

        // Fetch customer from SO → Quotation
        const { data: so } = await supabase
            .from('sales_orders')
            .select('quotation_id')
            .eq('id', soId)
            .single();

        if (so && so.quotation_id) {
            const { data: quotation } = await supabase
                .from('quotations')
                .select('customer_id')
                .eq('id', so.quotation_id)
                .single();

            if (quotation) {
                setFormData(prev => ({ ...prev, customer_id: quotation.customer_id, so_id: soId }));
            }
        }

        // Fetch all DOs from this SO
        const { data: dos } = await supabase
            .from('delivery_orders')
            .select('id, do_number')
            .eq('so_id', soId);

        if (!dos || dos.length === 0) {
            showToast('No delivery orders found for this SO', 'warning');
            return;
        }

        // Fetch ALL items from ALL DOs
        const doIds = dos.map(d => d.id);
        const { data: allDOItems } = await supabase
            .from('delivery_order_items')
            .select('*')
            .in('do_id', doIds);

        if (allDOItems && allDOItems.length > 0) {
            // Lookup prices from items master data
            const descriptions = allDOItems.map(i => i.description).filter(Boolean);
            const { data: masterItems } = await supabase
                .from('items')
                .select('description, price')
                .in('description', descriptions);

            const priceMap = new Map();
            if (masterItems) {
                masterItems.forEach(item => {
                    if (item.description) priceMap.set(item.description, item.price);
                });
            }

            // Combine all DO items into line items with prices
            setLineItems(allDOItems.map((item, idx) => ({
                id: `combined-${idx}`,
                item_code: item.item_code || '',
                item_id: '',
                description: item.description || '',
                quantity: item.quantity,
                uom: item.uom || 'EA',
                unit_price: priceMap.get(item.description) || 0,
                total_price: (priceMap.get(item.description) || 0) * item.quantity
            })));

            // Set DO reference to all DO numbers
            const doNumbers = dos.map(d => d.do_number).join(', ');
            showToast(`Loaded ${allDOItems.length} items from ${dos.length} delivery order(s): ${doNumbers}`, 'success');
        }
    };

    const handleSOSelection = async (soId: string) => {
        // Load SO details
        const { data: so } = await supabase.from('sales_orders').select('*, quotations(customer_id, subject)').eq('id', soId).single();
        if (so) {
            setFormData(prev => ({
                ...prev,
                so_id: so.id,
                customer_id: so.quotations?.customer_id || prev.customer_id,
                subject: so.quotations?.subject || prev.subject
            }));

            // If customer was not set, set it and fetch other SOs?
            if (!formData.customer_id && so.quotations?.customer_id) {
                // await fetchSalesOrders(so.quotations.customer_id); // Might loop if not careful
            }

            // If Standard mode, maybe pull items?
            if (formData.pricing_mode === 'standard') {
                importItemsFromSO(soId);
            }
        }
    };

    const importItemsFromSO = async (soId: string) => {
        const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', soId);
        if (items && items.length > 0) {
            // Lookup prices from items master data
            const descriptions = items.map(i => i.description).filter(Boolean);
            const { data: masterItems } = await supabase
                .from('items')
                .select('description, price')
                .in('description', descriptions);

            const priceMap = new Map();
            if (masterItems) {
                masterItems.forEach(item => {
                    if (item.description) priceMap.set(item.description, item.price);
                });
            }

            setLineItems(items.map((i, idx) => ({
                id: `so-${idx}`,
                item_code: '',
                item_id: '',
                description: i.description || '',
                quantity: i.quantity,
                uom: i.uom || 'EA',
                unit_price: priceMap.get(i.description) || 0, // Auto-lookup from items table
                total_price: (priceMap.get(i.description) || 0) * i.quantity
            })));
        }
    };

    const handleDOSelection = async (doId: string) => {
        // Fetch DO details
        const { data: doData } = await supabase.from('delivery_orders').select('*').eq('id', doId).single();
        if (!doData) return;

        // Fetch DO items
        const { data: doItems } = await supabase.from('delivery_order_items').select('*').eq('do_id', doId);

        if (doData) {
            setFormData(prev => ({
                ...prev,
                so_id: doData.so_id || '',
                subject: doData.subject || prev.subject,
            }));

            // Get customer from SO if available
            if (doData.so_id) {
                const { data: so } = await supabase.from('sales_orders').select('quotation_id').eq('id', doData.so_id).single();
                if (so && so.quotation_id) {
                    const { data: q } = await supabase.from('quotations').select('customer_id').eq('id', so.quotation_id).single();
                    if (q) {
                        setFormData(prev => ({ ...prev, customer_id: q.customer_id }));
                    }
                }
            }
        }

        // Pre-populate line items from DO with price lookup
        if (doItems && doItems.length > 0) {
            // Lookup prices from items master data
            const descriptions = doItems.map(i => i.description).filter(Boolean);
            const { data: masterItems } = await supabase
                .from('items')
                .select('description, price')
                .in('description', descriptions);

            const priceMap = new Map();
            if (masterItems) {
                masterItems.forEach(item => {
                    if (item.description) priceMap.set(item.description, item.price);
                });
            }

            setLineItems(doItems.map((item, idx) => ({
                id: `do-${idx}`,
                item_code: item.item_code || '',
                item_id: '',
                description: item.description || '',
                quantity: item.quantity,
                uom: item.uom || 'EA',
                unit_price: priceMap.get(item.description) || 0, // Auto-lookup from items table
                total_price: (priceMap.get(item.description) || 0) * item.quantity
            })));
            showToast(`Loaded ${doItems.length} items from Delivery Order with prices`, 'success');
        }
    };

    const loadInvoice = async (invoiceId: string) => {
        setLoading(true);
        try {
            const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
            if (error) throw error;

            setFormData({
                customer_id: inv.customer_id,
                so_id: inv.so_id || '',
                invoice_number: inv.invoice_number,
                date: inv.date,
                due_date: inv.due_date,
                terms: inv.terms || '30 Days',
                subject: inv.subject || '',
                status: inv.payment_status || 'unpaid', // Database uses payment_status
                pricing_mode: 'standard', // default
                milestone_description: '',
                milestone_amount: 0,
                subtotal: inv.subtotal,
                discount: inv.discount, // amount
                tax: inv.tax || 0, // Database column is 'tax'
                notes: inv.notes || ''
            });

            // Load Items
            const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
            if (items) {
                setLineItems(items.map((i) => ({
                    id: i.id,
                    item_code: i.item_code || '',
                    item_id: '',
                    description: i.description,
                    quantity: i.quantity,
                    uom: i.uom || 'EA',
                    unit_price: i.unit_price,
                    total_price: i.total_price  // DB column name
                })));
            }

            // Fetch SOs for customer
            if (inv.customer_id) fetchSalesOrders(inv.customer_id);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLineItemChange = (itemId: string, field: keyof InvoiceLineItem, value: any) => {
        setLineItems(lineItems.map(i => {
            if (i.id !== itemId) return i;
            const updated = { ...i, [field]: value };
            // Recalculate total_price when quantity or unit_price changes
            if (field === 'quantity' || field === 'unit_price') {
                updated.total_price = updated.quantity * updated.unit_price;
            }
            return updated;
        }));
    };

    const getCalculatedValues = () => {
        const subtotal = lineItems.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);
        const discountVal = formData.discount; // assume amount
        const taxable = subtotal - discountVal;
        const taxVal = taxable * (formData.tax / 100);
        const total = taxable + taxVal;
        return { subtotal, discountVal, taxVal, total };
    };

    const handleMilestoneGenerate = (field: 'desc' | 'amt', value: string) => {
        setFormData({ ...formData, [field === 'desc' ? 'milestone_description' : 'milestone_amount']: value });

        if (field === 'desc' && value || field === 'amt' && parseFloat(value) > 0) {
            setLineItems([{
                id: 'milestone-1',
                item_code: '',
                item_id: '',
                description: field === 'desc' ? value : formData.milestone_description,
                quantity: 1,
                uom: 'LS',
                unit_price: field === 'amt' ? parseFloat(value) || 0 : formData.milestone_amount,
                total_price: field === 'amt' ? parseFloat(value) || 0 : formData.milestone_amount
            }]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const vals = getCalculatedValues();

            // Header
            const invData = {
                customer_id: formData.customer_id,
                so_id: formData.so_id || null,
                // Map pricing_mode to billing_type: 'standard' → 'itemized', 'milestone' → 'milestone'
                billing_type: formData.pricing_mode === 'standard' ? 'itemized' : 'milestone',
                invoice_number: formData.invoice_number || `INV-${Date.now()}`,
                date: formData.date,
                due_date: formData.due_date,
                terms: formData.terms,
                subject: formData.subject,
                payment_status: formData.status, // Database uses payment_status not status

                subtotal: vals.subtotal,
                discount: vals.discountVal,
                tax: vals.taxVal, // Database column is 'tax', not 'tax_rate' or 'tax_amount'
                grand_total: vals.total,
            };

            let invId = id;

            if (isEditMode && id) {
                const { error } = await supabase.from('invoices').update(invData).eq('id', id);
                if (error) throw error;
                await supabase.from('invoice_items').delete().eq('invoice_id', id);
            } else {
                const { data, error } = await supabase.from('invoices').insert([invData]).select().single();
                if (error) throw error;
                invId = data.id;
            }

            if (invId) {
                const itemsToInsert = lineItems.map(i => ({
                    invoice_id: invId,
                    item_code: i.item_code || null,
                    description: i.description,
                    quantity: i.quantity,
                    uom: i.uom,
                    unit_price: i.unit_price,
                    total_price: i.total_price  // Match DB column
                }));
                const { error } = await supabase.from('invoice_items').insert(itemsToInsert);
                if (error) throw error;
            }

            showToast('Invoice saved', 'success');
            navigate('/invoices');

        } catch (error: any) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const vals = getCalculatedValues();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Invoice</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Invoice Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                            <select
                                value={formData.customer_id}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                className="input w-full bg-white"
                                required
                            >
                                <option value="">Select Customer...</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.company_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Linked Sales Order (Optional)</label>
                            <select
                                value={formData.so_id}
                                onChange={(e) => handleSOSelection(e.target.value)}
                                className="input w-full bg-white"
                            >
                                <option value="">Select SO...</option>
                                {salesOrders.map(so => (
                                    <option key={so.id} value={so.id}>{so.so_number} - {so.quotations?.subject}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input w-full bg-white" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="input w-full bg-white" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                            <input type="text" value={formData.terms} onChange={e => setFormData({ ...formData, terms: e.target.value })} className="input w-full bg-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="input w-full bg-white" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Billing Logic</h2>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="pricing_mode"
                                    value="standard"
                                    checked={formData.pricing_mode === 'standard'}
                                    onChange={() => setFormData({ ...formData, pricing_mode: 'standard' })}
                                />
                                Standard (Itemized)
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="pricing_mode"
                                    value="milestone"
                                    checked={formData.pricing_mode === 'milestone'}
                                    onChange={() => setFormData({ ...formData, pricing_mode: 'milestone' })}
                                />
                                Progressive (Milestone)
                            </label>
                        </div>
                    </div>

                    {formData.pricing_mode === 'milestone' && (
                        <div className="mb-6 p-4 bg-yellow-50 rounded border border-yellow-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Description</label>
                                    <input
                                        type="text"
                                        value={formData.milestone_description}
                                        onChange={e => handleMilestoneGenerate('desc', e.target.value)}
                                        placeholder="e.g. Down Payment 30%"
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Bill</label>
                                    <input
                                        type="number"
                                        value={formData.milestone_amount}
                                        onChange={e => handleMilestoneGenerate('amt', e.target.value)}
                                        className="input w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.pricing_mode === 'standard' && (
                        <div className="mb-4">
                            <Button type="button" onClick={() => setLineItems([...lineItems, { id: Date.now().toString(), item_code: '', item_id: '', description: '', quantity: 1, uom: 'EA', unit_price: 0, total_price: 0 }])} variant="secondary">
                                <Plus className="w-4 h-4" /> Add Item
                            </Button>
                        </div>
                    )}

                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th>Ref/Code</th>
                                <th>Description</th>
                                <th className="w-20">Qty</th>
                                <th className="w-20">UOM</th>
                                <th className="w-32">Price</th>
                                <th className="w-24">Total</th>
                                {formData.pricing_mode === 'standard' && <th className="w-10"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.map((item) => (
                                <tr key={item.id} className={formData.pricing_mode === 'milestone' ? 'bg-gray-50' : ''}>
                                    <td>
                                        <input
                                            type="text"
                                            value={item.item_code}
                                            onChange={e => handleLineItemChange(item.id, 'item_code', e.target.value)}
                                            className="input w-full"
                                            readOnly={formData.pricing_mode === 'milestone'}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={e => handleLineItemChange(item.id, 'description', e.target.value)}
                                            className="input w-full"
                                            readOnly={formData.pricing_mode === 'milestone'}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value))}
                                            className="input w-full"
                                            readOnly={formData.pricing_mode === 'milestone'}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            value={item.uom}
                                            onChange={e => handleLineItemChange(item.id, 'uom', e.target.value)}
                                            className="input w-full"
                                            readOnly={formData.pricing_mode === 'milestone'}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            value={item.unit_price}
                                            onChange={e => handleLineItemChange(item.id, 'unit_price', parseFloat(e.target.value))}
                                            className="input w-full"
                                            readOnly={formData.pricing_mode === 'milestone'}
                                        />
                                    </td>
                                    <td>
                                        <span className="font-bold">{item.quantity * item.unit_price}</span>
                                    </td>
                                    {formData.pricing_mode === 'standard' && (
                                        <td>
                                            <button type="button" onClick={() => setLineItems(lineItems.filter(i => i.id !== item.id))} className="text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex justify-between w-64">
                            <span>Subtotal:</span>
                            <span className="font-bold">{vals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between w-64 items-center">
                            <span>Global Discount:</span>
                            <input type="number" value={formData.discount} onChange={e => setFormData({ ...formData, discount: parseFloat(e.target.value) })} className="input w-24 text-right" />
                        </div>
                        <div className="flex justify-between w-64 items-center">
                            <span>GST (%):</span>
                            <input type="number" value={formData.tax} onChange={e => setFormData({ ...formData, tax: parseFloat(e.target.value) })} className="input w-24 text-right" />
                        </div>
                        <div className="flex justify-between w-64 border-t pt-2">
                            <span className="text-xl font-bold">Total:</span>
                            <span className="text-xl font-bold">{vals.total.toFixed(2)}</span>
                        </div>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/invoices')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Invoice'}
                    </Button>
                </div>
            </form>
        </div>
    );
};