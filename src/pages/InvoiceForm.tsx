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
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Invoice Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <select
                                    value={formData.customer_id}
                                    onChange={(e) => handleCustomerChange(e.target.value)}
                                    className="w-full pl-3 pr-8 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none disabled:bg-gray-100 disabled:text-gray-500"
                                    required
                                    disabled={loading}
                                >
                                    <option value="">Select Customer...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.company_name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Linked Sales Order (Optional)</label>
                            <div className="relative">
                                <select
                                    value={formData.so_id}
                                    onChange={(e) => handleSOSelection(e.target.value)}
                                    className="w-full pl-3 pr-8 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none disabled:bg-gray-100 disabled:text-gray-500"
                                    disabled={loading}
                                >
                                    <option value="">Select SO...</option>
                                    {salesOrders.map(so => (
                                        <option key={so.id} value={so.id}>{so.so_number} - {so.quotations?.subject}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                            <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                            <input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terms</label>
                            <input type="text" value={formData.terms} onChange={e => setFormData({ ...formData, terms: e.target.value })} className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 30 Days" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <input type="text" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Invoice for Service" />
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Billing & Items
                        </h2>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, pricing_mode: 'standard' })}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${formData.pricing_mode === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Standard (Itemized)
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, pricing_mode: 'milestone' })}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${formData.pricing_mode === 'milestone' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Progressive (Milestone)
                            </button>
                        </div>
                    </div>

                    {formData.pricing_mode === 'milestone' && (
                        <div className="mb-6 p-6 bg-blue-50 rounded-xl border border-blue-100">
                            <h3 className="text-sm font-semibold text-blue-900 mb-4 uppercase tracking-wider">Milestone Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-blue-900 mb-1">Milestone Description</label>
                                    <input
                                        type="text"
                                        value={formData.milestone_description}
                                        onChange={e => handleMilestoneGenerate('desc', e.target.value)}
                                        placeholder="e.g. Down Payment 30%"
                                        className="w-full px-3 py-2 bg-white text-gray-900 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-blue-900 mb-1">Amount to Bill</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                        <input
                                            type="number"
                                            value={formData.milestone_amount}
                                            onChange={e => handleMilestoneGenerate('amt', e.target.value)}
                                            className="w-full pl-6 pr-3 py-2 bg-white text-gray-900 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.pricing_mode === 'standard' && (
                        <div className="mb-4 flex justify-end">
                            <Button type="button" onClick={() => setLineItems([...lineItems, { id: Date.now().toString(), item_code: '', item_id: '', description: '', quantity: 1, uom: 'EA', unit_price: 0, total_price: 0 }])} variant="secondary" size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Add Item
                            </Button>
                        </div>
                    )}

                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Ref/Code</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Qty</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">UOM</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Price</th>
                                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Total</th>
                                    {formData.pricing_mode === 'standard' && <th className="w-10"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {lineItems.map((item) => (
                                    <tr key={item.id} className={`group hover:bg-gray-50 transition-colors ${formData.pricing_mode === 'milestone' ? 'bg-gray-50' : ''}`}>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={item.item_code}
                                                onChange={e => handleLineItemChange(item.id, 'item_code', e.target.value)}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                                                placeholder="Code"
                                                readOnly={formData.pricing_mode === 'milestone'}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={e => handleLineItemChange(item.id, 'description', e.target.value)}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                                                placeholder="Description"
                                                readOnly={formData.pricing_mode === 'milestone'}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value))}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="0"
                                                readOnly={formData.pricing_mode === 'milestone'}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={item.uom}
                                                onChange={e => handleLineItemChange(item.id, 'uom', e.target.value)}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                readOnly={formData.pricing_mode === 'milestone'}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={e => handleLineItemChange(item.id, 'unit_price', parseFloat(e.target.value))}
                                                    className="w-full pl-6 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    step="0.01"
                                                    readOnly={formData.pricing_mode === 'milestone'}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-medium text-gray-900">
                                            ${(item.quantity * item.unit_price).toFixed(2)}
                                        </td>
                                        {formData.pricing_mode === 'standard' && (
                                            <td className="p-2 text-center">
                                                <button type="button" onClick={() => setLineItems(lineItems.filter(i => i.id !== item.id))} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col items-end gap-2 mt-6">
                        <div className="w-72 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="font-semibold text-gray-900">${vals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Global Discount:</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs">-$</span>
                                    <input
                                        type="number"
                                        value={formData.discount}
                                        onChange={e => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                        className="w-20 px-2 py-1 text-right text-sm border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">GST (%):</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={formData.tax}
                                        onChange={e => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                                        className="w-16 px-2 py-1 text-right text-sm border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                                        min="0"
                                    />
                                    <span className="text-gray-400 text-xs">%</span>
                                </div>
                            </div>
                            <div className="border-t border-gray-200 pt-3 mt-2 flex justify-between items-center">
                                <span className="text-base font-bold text-gray-900">Total:</span>
                                <span className="text-xl font-bold text-blue-600">${vals.total.toFixed(2)}</span>
                            </div>
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