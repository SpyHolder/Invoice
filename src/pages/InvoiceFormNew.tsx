import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Partner, DeliveryOrder } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const InvoiceFormNew = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);

    // Data sources
    const [customers, setCustomers] = useState<Partner[]>([]);
    const [salesOrders, setSalesOrders] = useState<any[]>([]);
    const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
    const [selectedDOs, setSelectedDOs] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        customer_id: '',
        so_id: '',
        invoice_number: '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        terms: '30 Days',
        subject: '',
        discount: 0,
        tax_rate: 9, // Default 9% GST
        notes: '',
    });

    // Preview items from selected DOs
    const [previewItems, setPreviewItems] = useState<any[]>([]);

    // ---------------------------------------------------------------
    // FIX 9: updatePreview extracted with useCallback so it can be
    // referenced stably from fetchDeliveryOrders and handleDOToggle.
    // Also filters out sections that have zero items (empty DO).
    // ---------------------------------------------------------------
    const updatePreview = useCallback(async (doIds: string[]) => {
        if (doIds.length === 0) {
            setPreviewItems([]);
            return;
        }

        // Fetch all items from selected DOs
        const { data: allDOItems } = await supabase
            .from('delivery_order_items')
            .select('*, delivery_orders(do_number, subject)')
            .in('do_id', doIds);

        if (!allDOItems) return;

        // Lookup prices
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

        // Group items by DO — filter out sections with no items
        const itemsByDO = doIds
            .map((doId, idx) => {
                const doItems = allDOItems.filter(item => item.do_id === doId);
                const doInfo = doItems[0]?.delivery_orders;

                return {
                    section_number: idx + 1,
                    do_id: doId,
                    do_number: doInfo?.do_number || `DO ${idx + 1}`,
                    subject: doInfo?.subject || '',
                    items: doItems.map(item => ({
                        item_code: item.item_code || '',
                        description: item.description || '',
                        quantity: item.quantity,
                        uom: item.uom || 'EA',
                        unit_price: priceMap.get(item.description) || 0,
                        total_price: (priceMap.get(item.description) || 0) * item.quantity
                    }))
                };
            })
            .filter(section => section.items.length > 0); // <-- FIX: buang section kosong

        setPreviewItems(itemsByDO);
    }, []);

    // ---------------------------------------------------------------
    // FIX 2: fetchDeliveryOrders filters for delivered DOs only
    // and excludes already-invoiced DOs to prevent double billing.
    // ---------------------------------------------------------------
    const fetchDeliveryOrders = useCallback(async (soId: string, autoSelect = false) => {
        if (!soId) {
            setDeliveryOrders([]);
            return;
        }

        // Fetch only delivered DOs
        const { data } = await supabase
            .from('delivery_orders')
            .select('*')
            .eq('so_id', soId)
            .eq('status', 'delivered')
            .order('created_at');

        if (data) {
            // Get already-invoiced DO IDs to exclude (prevent double billing)
            const { data: invoicedSections } = await supabase
                .from('invoice_delivery_sections')
                .select('do_id');

            const invoicedDoIds = new Set(invoicedSections?.map(s => s.do_id) || []);

            // Filter out already-invoiced DOs
            const unbilledDOs = data.filter(d => !invoicedDoIds.has(d.id));
            setDeliveryOrders(unbilledDOs);

            if (autoSelect && unbilledDOs.length > 0) {
                const doIds = unbilledDOs.map(d => d.id).filter(Boolean);
                setSelectedDOs(doIds);
                await updatePreview(doIds);
            }
        }
    }, [updatePreview]);

    const fetchCustomers = useCallback(async () => {
        const { data } = await supabase
            .from('partners')
            .select('*')
            .eq('type', 'customer')
            .order('company_name');
        if (data) setCustomers(data);
    }, []);

    const fetchSalesOrders = useCallback(async (customerId: string) => {
        if (!customerId) {
            setSalesOrders([]);
            return;
        }

        const { data } = await supabase
            .from('sales_orders')
            .select('*, quotations!inner(customer_id, quotation_number, subject)')
            .eq('status', 'confirmed')
            .eq('quotations.customer_id', customerId);

        if (data) setSalesOrders(data);
    }, []);

    // ---------------------------------------------------------------
    // FIX 6: Hapus `quotation_id` yang tidak dipakai dari select.
    // Tambahkan null-check pada `so.quotations`.
    // ---------------------------------------------------------------
    const handleSOSelection = useCallback(async (soId: string) => {
        setFormData(prev => ({ ...prev, so_id: soId }));

        // Fetch customer from SO
        const { data: so } = await supabase
            .from('sales_orders')
            .select('quotations(customer_id, subject)')
            .eq('id', soId)
            .single();

        if (so && so.quotations) {
            const quotation = Array.isArray(so.quotations) ? so.quotations[0] : so.quotations;
            if (quotation) {
                setFormData(prev => ({
                    ...prev,
                    customer_id: quotation.customer_id,
                    subject: quotation.subject || ''
                }));
                await fetchSalesOrders(quotation.customer_id);
            }
        }

        // Auto-select semua DO ketika datang dari URL param
        const isFromParam = !!soId && window.location.search.includes('so_id');
        await fetchDeliveryOrders(soId, isFromParam);
    }, [fetchSalesOrders, fetchDeliveryOrders]);

    // ---------------------------------------------------------------
    // FIX 1: useEffect dependency array lengkap. `handleSOSelection`
    // sudah stable karena dibungkus useCallback.
    // ---------------------------------------------------------------
    useEffect(() => {
        fetchCustomers();
        const soIdParam = searchParams.get('so_id');

        if (soIdParam) {
            handleSOSelection(soIdParam);
        }
    }, [searchParams, fetchCustomers, handleSOSelection]);

    const handleCustomerChange = async (custId: string) => {
        setFormData(prev => ({ ...prev, customer_id: custId, so_id: '' }));
        setSelectedDOs([]);
        setDeliveryOrders([]);
        setPreviewItems([]);
        await fetchSalesOrders(custId);
    };

    const handleDOToggle = async (doId: string) => {
        const newSelectedDOs = selectedDOs.includes(doId)
            ? selectedDOs.filter(id => id !== doId)
            : [...selectedDOs, doId];

        setSelectedDOs(newSelectedDOs);
        await updatePreview(newSelectedDOs);
    };

    // ---------------------------------------------------------------
    // FIX 4 & 10: calculateTotals sekarang aman terhadap NaN dari
    // discount. Juga mengembalikan `taxAmount` agar ditampilkan.
    // ---------------------------------------------------------------
    const calculateTotals = () => {
        const subtotal = previewItems.reduce((sum, section) => {
            return sum + section.items.reduce((itemSum: number, item: any) =>
                itemSum + item.total_price, 0);
        }, 0);

        const safeDiscount = isNaN(formData.discount) ? 0 : formData.discount;
        const safeTaxRate = isNaN(formData.tax_rate) ? 0 : formData.tax_rate;

        const taxAmount = (subtotal - safeDiscount) * (safeTaxRate / 100);
        const grandTotal = subtotal - safeDiscount + taxAmount;

        return { subtotal, taxAmount, grandTotal, safeDiscount };
    };

    // ---------------------------------------------------------------
    // FIX 8: due_date otomatis update saat `date` berubah,
    // berdasarkan angka hari dari `terms`.
    // ---------------------------------------------------------------
    useEffect(() => {
        const match = formData.terms.match(/(\d+)/);
        const days = match ? parseInt(match[1], 10) : 30;
        const newDueDate = new Date(formData.date);
        newDueDate.setDate(newDueDate.getDate() + days);
        setFormData(prev => ({
            ...prev,
            due_date: newDueDate.toISOString().split('T')[0]
        }));
    }, [formData.date, formData.terms]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDOs.length === 0) {
            showToast('Please select at least one delivery order', 'error');
            return;
        }

        setLoading(true);

        try {
            const { subtotal, taxAmount, grandTotal, safeDiscount } = calculateTotals();

            // -------------------------------------------------------
            // FIX 5: Ganti `count` dengan query `max` untuk menghindari
            // race condition pada pembuatan invoice number.
            // -------------------------------------------------------
            const { data: lastInvoice } = await supabase
                .from('invoices')
                .select('invoice_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let nextSeq = 1;
            if (lastInvoice?.invoice_number) {
                const parts = lastInvoice.invoice_number.split('-');
                const lastNum = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(lastNum)) nextSeq = lastNum + 1;
            }
            const invoiceNumber = `CNK-INV-${String(nextSeq).padStart(8, '0')}`;

            const invoiceData = {
                invoice_number: invoiceNumber,
                customer_id: formData.customer_id,
                so_id: formData.so_id,
                date: formData.date,
                due_date: formData.due_date,
                terms: formData.terms,
                subject: formData.subject,
                subtotal,
                discount: safeDiscount,
                tax: taxAmount,
                grand_total: grandTotal,
                payment_status: 'unpaid',
                invoice_type: 'do_based',
                total_sections: selectedDOs.length,
                notes: formData.notes,
            };

            const { data, error } = await supabase
                .from('invoices')
                .insert([invoiceData])
                .select()
                .single();

            if (error) throw error;

            // Use database function to populate from DOs
            const { error: funcError } = await supabase.rpc('populate_invoice_from_dos', {
                p_invoice_id: data.id,
                p_do_ids: selectedDOs
            });

            if (funcError) throw funcError;

            showToast('Invoice created successfully!', 'success');
            navigate(`/invoices/${data.id}`);

        } catch (error: any) {
            console.error('Error saving invoice:', error);
            showToast(error.message || 'Failed to save invoice', 'error');
        } finally {
            setLoading(false);
        }
    };

    // FIX 10: destructure `taxAmount` untuk ditampilkan di UI
    const { subtotal, taxAmount, grandTotal } = calculateTotals();

    return (
        <div className="p-6">
            <div className="mb-6">
                <Button variant="secondary" onClick={() => navigate('/invoices')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Invoices
                </Button>
            </div>

            <Card>
                <h1 className="text-2xl font-bold mb-6">
                    Create Invoice from Delivery Orders
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Customer and SO Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Customer *</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                value={formData.customer_id}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                required
                            >
                                <option value="">Select Customer</option>
                                {customers.map(customer => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Sales Order *</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                value={formData.so_id}
                                onChange={(e) => handleSOSelection(e.target.value)}
                                required
                                disabled={!formData.customer_id}
                            >
                                <option value="">Select Sales Order</option>
                                {salesOrders.map(so => (
                                    <option key={so.id} value={so.id}>
                                        {so.so_number} - {so.quotations?.quotation_number}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Delivery Orders Multi-Select */}
                    {deliveryOrders.length > 0 && (
                        <Card className="bg-blue-50 border-blue-200">
                            <h3 className="font-semibold mb-3">Select Delivery Orders to Include *</h3>
                            <div className="space-y-2">
                                {deliveryOrders.map(deliveryOrder => {
                                    if (!deliveryOrder.id) return null;
                                    const isSelected = selectedDOs.includes(deliveryOrder.id);
                                    const labelClass = isSelected
                                        ? 'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition bg-blue-100 border-blue-500'
                                        : 'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition bg-white border-gray-300 hover:border-blue-300';
                                    return (
                                        <label
                                            key={deliveryOrder.id}
                                            className={labelClass}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleDOToggle(deliveryOrder.id!)}
                                                className="w-4 h-4"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">{deliveryOrder.do_number || '-'}</div>
                                                <div className="text-sm text-gray-600">{deliveryOrder.subject || ''}</div>
                                            </div>
                                            {isSelected && (
                                                <Check className="w-5 h-5 text-blue-600" />
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="mt-3 text-sm text-gray-600">
                                Selected: {selectedDOs.length} of {deliveryOrders.length} delivery orders
                            </div>
                        </Card>
                    )}

                    {/* Invoice Details */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Invoice Date *</label>
                            <input
                                type="date"
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Due Date *</label>
                            <input
                                type="date"
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Payment Terms</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                value={formData.terms}
                                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                                placeholder="e.g., 30 Days, 60 Days"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Subject</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="Invoice subject"
                        />
                    </div>

                    {/* Preview Items by Section */}
                    {previewItems.length > 0 && (
                        <Card className="bg-gray-50">
                            <h3 className="font-semibold mb-4">Invoice Preview</h3>

                            {previewItems.map((section) => (
                                <div key={section.do_id} className="mb-6">
                                    <div className="bg-blue-600 text-white px-3 py-2 rounded-t-lg font-medium flex items-center gap-2">
                                        <span>Subject:</span>
                                        <input
                                            type="text"
                                            value={section.subject || ''}
                                            onChange={(e) => {
                                                const newItems = previewItems.map((s: any) =>
                                                    s.do_id === section.do_id ? { ...s, subject: e.target.value } : s
                                                );
                                                setPreviewItems(newItems);
                                            }}
                                            className="flex-1 bg-blue-500 text-white placeholder-blue-200 border-b border-blue-300 focus:outline-none focus:border-white px-1"
                                            placeholder="Enter subject for this section..."
                                        />
                                    </div>
                                    <table className="w-full border border-t-0">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border p-2 text-left">Item Code</th>
                                                <th className="border p-2 text-left">Description</th>
                                                <th className="border p-2 text-center">Qty</th>
                                                <th className="border p-2 text-center">UOM</th>
                                                <th className="border p-2 text-right">Unit Price</th>
                                                <th className="border p-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {section.items.map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="border p-2">{item.item_code}</td>
                                                    <td className="border p-2">{item.description}</td>
                                                    <td className="border p-2 text-center">{item.quantity}</td>
                                                    <td className="border p-2 text-center">{item.uom}</td>
                                                    <td className="border p-2 text-right">${item.unit_price.toFixed(2)}</td>
                                                    <td className="border p-2 text-right">${item.total_price.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}

                            {/* Totals */}
                            <div className="mt-4 border-t pt-4">
                                <div className="flex justify-between mb-2">
                                    <span>Subtotal:</span>
                                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between mb-2 items-center">
                                    <span>Discount:</span>
                                    <input
                                        type="number"
                                        className="w-32 border border-gray-300 rounded-lg p-2 text-right bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        value={formData.discount}
                                        onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="flex justify-between mb-2 items-center">
                                    <span>GST (%):</span>
                                    <input
                                        type="number"
                                        className="w-32 border border-gray-300 rounded-lg p-2 text-right bg-white text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        value={formData.tax_rate}
                                        onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                    />
                                </div>
                                {/* FIX 10: Tampilkan baris Tax Amount yang sebelumnya hilang */}
                                <div className="flex justify-between mb-2">
                                    <span>Tax Amount:</span>
                                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t">
                                    <span className="font-bold text-lg">Grand Total:</span>
                                    <span className="font-bold text-lg text-blue-600">${grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-2">Notes</label>
                        <textarea
                            className="w-full border rounded-lg p-2"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="Additional notes for this invoice"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => navigate('/invoices')}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={loading}
                            disabled={selectedDOs.length === 0}
                        >
                            Create Invoice
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};