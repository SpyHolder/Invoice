import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Truck, Layers } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Customer, Quotation, QuotationItem } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface SelectableItem extends QuotationItem {
    selected: boolean;
    deliveryQty: number;
    availableStock: number;
    groupName?: string; // For grouping feature
}

export const DeliveryOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const isEditMode = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [quotationItems, setQuotationItems] = useState<SelectableItem[]>([]);

    // Form state
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedQuotationId, setSelectedQuotationId] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [billingAddress, setBillingAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<'pending' | 'delivered' | 'cancelled'>('pending');

    // New Fields
    const [terms, setTerms] = useState('On-Site Delivery');
    const [customerPO, setCustomerPO] = useState('');
    const [requestor, setRequestor] = useState('');

    // Grouping feature
    const [enableGrouping, setEnableGrouping] = useState(false);
    const [currentGroupName, setCurrentGroupName] = useState('');

    useEffect(() => {
        fetchCustomers();
        if (isEditMode) {
            loadDeliveryOrder(id!);
        }
    }, [user, id]);

    useEffect(() => {
        if (selectedCustomerId) {
            fetchCustomers();
            fetchQuotationsForCustomer(selectedCustomerId);
            // Auto fill billing address from customer address initially
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer && !billingAddress) {
                setBillingAddress(customer.address || '');
            }
        } else {
            setQuotations([]);
            setSelectedQuotationId('');
            setQuotationItems([]);
        }
    }, [selectedCustomerId]);

    useEffect(() => {
        if (selectedQuotationId && !isEditMode) {
            fetchQuotationItems(selectedQuotationId);
        }
    }, [selectedQuotationId]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('customers').select('*').order('name');
        if (data) setCustomers(data);
    };

    const fetchQuotationsForCustomer = async (customerId: string) => {
        const { data } = await supabase
            .from('quotations')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
        if (data) setQuotations(data);
    };

    const fetchQuotationItems = async (quotationId: string) => {
        const { data: items } = await supabase
            .from('quotation_items')
            .select('*')
            .eq('quotation_id', quotationId);

        if (items) {
            const itemsWithStock = await Promise.all(
                items.map(async (item) => {
                    let stock = 999;
                    if (item.item_id) {
                        const { data: stockItem } = await supabase
                            .from('items')
                            .select('stock')
                            .eq('id', item.item_id)
                            .single();
                        if (stockItem) stock = stockItem.stock;
                    }
                    return {
                        ...item,
                        selected: false,
                        deliveryQty: 0,
                        availableStock: stock,
                        groupName: '',
                    };
                })
            );
            setQuotationItems(itemsWithStock);
        }
    };

    const loadDeliveryOrder = async (doId: string) => {
        setLoading(true);
        try {
            const { data: doData, error: doError } = await supabase
                .from('delivery_orders')
                .select('*')
                .eq('id', doId)
                .single();

            if (doError) throw doError;

            setSelectedCustomerId(doData.customer_id);
            setSelectedQuotationId(doData.quotation_id);
            setDeliveryDate(doData.delivery_date || '');
            setDeliveryAddress(doData.delivery_address || '');
            setNotes(doData.notes || '');
            setStatus(doData.status);

            // New fields load
            setTerms(doData.terms || 'On-Site Delivery');
            setCustomerPO(doData.customer_po || '');
            setRequestor(doData.requestor || '');
            setBillingAddress(doData.billing_address || '');

            await fetchQuotationsForCustomer(doData.customer_id);

            const { data: doItems } = await supabase
                .from('delivery_order_items')
                .select('*')
                .eq('delivery_order_id', doId);

            const { data: qItems } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', doData.quotation_id);

            if (qItems) {
                const itemsWithStock = await Promise.all(
                    qItems.map(async (item) => {
                        let stock = 999;
                        if (item.item_id) {
                            const { data: stockItem } = await supabase
                                .from('items')
                                .select('stock')
                                .eq('id', item.item_id)
                                .single();
                            if (stockItem) stock = stockItem.stock;
                        }

                        const doItem = doItems?.find(di => di.quotation_item_id === item.id);
                        return {
                            ...item,
                            selected: Boolean(doItem),
                            deliveryQty: doItem?.quantity || 0,
                            availableStock: stock,
                            groupName: doItem?.group_name || '',
                        };
                    })
                );
                setQuotationItems(itemsWithStock);

                // Detect if grouping was used
                const hasGroups = doItems?.some(di => di.group_name);
                if (hasGroups) setEnableGrouping(true);
            }
        } catch (error) {
            console.error('Error loading delivery order:', error);
            showToast('Failed to load delivery order', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleItemSelection = (itemId: string) => {
        setQuotationItems((prev) =>
            prev.map((item) =>
                item.id === itemId
                    ? {
                        ...item,
                        selected: !item.selected,
                        deliveryQty: !item.selected ? Math.min(item.quantity, item.availableStock) : 0,
                        groupName: !item.selected && enableGrouping ? currentGroupName : item.groupName,
                    }
                    : item
            )
        );
    };

    const updateItemQty = (itemId: string, qty: number) => {
        setQuotationItems((prev) =>
            prev.map((item) =>
                item.id === itemId
                    ? {
                        ...item,
                        deliveryQty: Math.max(0, Math.min(qty, item.quantity, item.availableStock)),
                        selected: qty > 0,
                        groupName: qty > 0 && enableGrouping && !item.groupName ? currentGroupName : item.groupName,
                    }
                    : item
            )
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const selectedItems = quotationItems.filter((item) => item.selected && item.deliveryQty > 0);

        if (selectedItems.length === 0) {
            showToast('Please select at least one item', 'error');
            return;
        }

        setLoading(true);

        try {
            const doData = {
                customer_id: selectedCustomerId,
                quotation_id: selectedQuotationId,
                delivery_date: deliveryDate || null,
                delivery_address: deliveryAddress,
                notes: notes,
                status: status,
                total: selectedItems.reduce((sum, item) => sum + item.unit_price * item.deliveryQty, 0),
                // New fields
                terms,
                customer_po: customerPO,
                requestor,
                billing_address: billingAddress,
            };

            let doId = id;

            if (isEditMode) {
                const { error } = await supabase
                    .from('delivery_orders')
                    .update(doData)
                    .eq('id', id);
                if (error) throw error;

                // Delete old items
                await supabase.from('delivery_order_items').delete().eq('delivery_order_id', id);
            } else {
                const { data, error } = await supabase
                    .from('delivery_orders')
                    .insert([{ ...doData, do_number: 'DO-' + Date.now(), date: new Date().toISOString().split('T')[0] }])
                    .select()
                    .single();
                if (error) throw error;
                doId = data.id;

                // Deduct stock for new DO
                for (const item of selectedItems) {
                    if (item.item_id) {
                        const { data: currentItem } = await supabase
                            .from('items')
                            .select('stock')
                            .eq('id', item.item_id)
                            .single();

                        if (currentItem) {
                            await supabase
                                .from('items')
                                .update({ stock: Math.max(0, currentItem.stock - item.deliveryQty) })
                                .eq('id', item.item_id);
                        }
                    }
                }
            }

            // Insert items
            const doItems = selectedItems.map((item) => ({
                delivery_order_id: doId,
                quotation_item_id: item.id,
                item_id: item.item_id,
                item_name: item.item_name,
                description: item.description,
                quantity: item.deliveryQty,
                unit_price: item.unit_price,
                total: item.unit_price * item.deliveryQty,
                uom: item.uom || 'EA',
                group_name: enableGrouping ? item.groupName : null,
            }));

            const { error: itemsError } = await supabase.from('delivery_order_items').insert(doItems);
            if (itemsError) throw itemsError;

            showToast('Delivery order saved successfully', 'success');
            navigate('/delivery-orders');
        } catch (error) {
            console.error('Error saving delivery order:', error);
            showToast('Failed to save delivery order', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={() => navigate('/delivery-orders')}>
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isEditMode ? 'Edit Delivery Order' : 'Create Delivery Order'}
                    </h1>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <div className="p-6 space-y-4">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-blue-600" />
                                    Delivery Information
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                                        <select
                                            value={selectedCustomerId}
                                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                            required
                                            disabled={isEditMode}
                                        >
                                            <option value="">Select Customer</option>
                                            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Quotation *</label>
                                        <select
                                            value={selectedQuotationId}
                                            onChange={(e) => setSelectedQuotationId(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                            required
                                            disabled={!selectedCustomerId || isEditMode}
                                        >
                                            <option value="">Select Quotation</option>
                                            {quotations.map((q) => <option key={q.id} value={q.id}>{q.quotation_number}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">DO Terms</label>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Requestor</label>
                                        <input
                                            type="text"
                                            value={requestor}
                                            onChange={(e) => setRequestor(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                                        <input
                                            type="date"
                                            value={deliveryDate}
                                            onChange={(e) => setDeliveryDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                                        <textarea
                                            value={billingAddress}
                                            onChange={(e) => setBillingAddress(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                                        <textarea
                                            value={deliveryAddress}
                                            onChange={(e) => setDeliveryAddress(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Item Selection with Grouping */}
                        {quotationItems.length > 0 && (
                            <Card>
                                <div className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-semibold text-gray-900">Items</h2>
                                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={enableGrouping}
                                                    onChange={(e) => setEnableGrouping(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                                <label className="text-sm font-medium flex items-center gap-1">
                                                    <Layers className="w-4 h-4" />
                                                    Enable Grouping
                                                </label>
                                            </div>
                                            {enableGrouping && (
                                                <input
                                                    type="text"
                                                    value={currentGroupName}
                                                    onChange={(e) => setCurrentGroupName(e.target.value)}
                                                    placeholder="Group Name (e.g. Area A)"
                                                    className="px-3 py-1 border rounded text-sm w-48"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b-2 border-gray-200">
                                                    <th className="text-left py-3 px-2 w-10"></th>
                                                    <th className="text-left py-3 px-2">Item</th>
                                                    {enableGrouping && <th className="text-left py-3 px-2">Group</th>}
                                                    <th className="text-right py-3 px-2">Qty</th>
                                                    <th className="text-right py-3 px-2 w-28">Deliver</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {quotationItems.map((item) => (
                                                    <tr key={item.id} className="border-b border-gray-100">
                                                        <td className="py-3 px-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.selected}
                                                                onChange={() => toggleItemSelection(item.id)}
                                                                className="w-5 h-5 text-blue-600 rounded"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <div className="font-medium">{item.item_name}</div>
                                                            <div className="text-xs text-gray-500">{item.description}</div>
                                                        </td>
                                                        {enableGrouping && (
                                                            <td className="py-3 px-2">
                                                                {item.selected ? (
                                                                    <input
                                                                        type="text"
                                                                        value={item.groupName || ''}
                                                                        onChange={(e) => {
                                                                            const newName = e.target.value;
                                                                            setQuotationItems(prev => prev.map(i => i.id === item.id ? { ...i, groupName: newName } : i));
                                                                        }}
                                                                        className="w-full px-2 py-1 border rounded text-sm"
                                                                        placeholder="Group..."
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-400 text-sm">-</span>
                                                                )}
                                                            </td>
                                                        )}
                                                        <td className="py-3 px-2 text-right">{item.quantity}</td>
                                                        <td className="py-3 px-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={item.availableStock}
                                                                value={item.deliveryQty}
                                                                onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 0)}
                                                                className="w-full px-2 py-1 border rounded text-right"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <div className="p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
                                <p className="text-sm text-gray-600 mb-4">
                                    Selected Item: {quotationItems.filter(i => i.selected).length}
                                </p>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? 'Saving...' : 'Save Delivery Order'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                </div>
            </form>
        </div>
    );
};
