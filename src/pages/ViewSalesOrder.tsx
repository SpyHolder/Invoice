import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Truck, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, SalesOrder, SalesOrderItem, Partner, Company } from '../lib/supabase';
import { SalesOrderTemplate } from '../components/SalesOrderTemplate';
import { useReactToPrint } from 'react-to-print';

export const ViewSalesOrder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [so, setSo] = useState<SalesOrder | null>(null);
    const [customer, setCustomer] = useState<Partner | null>(null);
    const [items, setItems] = useState<SalesOrderItem[]>([]);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [billingSummary, setBillingSummary] = useState<any>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [deliveryProgress, setDeliveryProgress] = useState<any>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: so ? `SalesOrder-${so.so_number}` : 'SalesOrder',
    });

    useEffect(() => {
        if (id) fetchSalesOrderData();
    }, [id]);

    const fetchSalesOrderData = async () => {
        setLoading(true);
        try {
            // Fetch SO
            const { data: soData, error: soError } = await supabase
                .from('sales_orders')
                .select('*')
                .eq('id', id)
                .single();
            if (soError) throw soError;
            setSo(soData);

            // Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('sales_order_items')
                .select('*')
                .eq('so_id', id);
            if (itemsError) throw itemsError;
            setItems(itemsData || []);

            // Fetch Customer (via Quotation or direct? SO Schema links to Quote. Quote links to Customer)
            // Wait, earlier I found SO has no customer_id.
            if (soData.quotation_id) {
                const { data: quote, error: qError } = await supabase
                    .from('quotations')
                    .select('customer_id')
                    .eq('id', soData.quotation_id)
                    .single();

                if (qError) throw qError;

                if (quote) {
                    const { data: cust, error: cError } = await supabase
                        .from('partners')
                        .select('*')
                        .eq('id', quote.customer_id)
                        .single();
                    if (cError) throw cError;
                    setCustomer(cust);
                }
            } else {
                // If SO has no quote, we are in trouble unless we updated SO to have customer_id.
                // For now, assume it has quote. 
                // Or maybe I should have added customer_id to SO in schema update?
                // The user provided the schema.
            }

            // Fetch Company Info
            const { data: companyData } = await supabase
                .from('companies')
                .select('*')
                .limit(1)
                .single();
            if (companyData) setCompany(companyData);

            // Fetch Billing Summary
            const { data: billingSummaryData } = await supabase
                .from('v_so_billing_summary')
                .select('*')
                .eq('so_id', id)
                .single();
            if (billingSummaryData) setBillingSummary(billingSummaryData);

            // Fetch Related Invoices
            const { data: invoicesData } = await supabase
                .from('invoices')
                .select('id, invoice_number, date, grand_total, payment_status, billing_type')
                .eq('so_id', id)
                .order('date', { ascending: false });
            if (invoicesData) setInvoices(invoicesData);

            // Fetch Delivery Progress
            const { data: deliveryProgressData } = await supabase
                .from('v_so_delivery_progress')
                .select('*')
                .eq('so_id', id)
                .single();
            if (deliveryProgressData) setDeliveryProgress(deliveryProgressData);

        } catch (error) {
            console.error('Error fetching SO:', error);
            // alert('Failed to load Sales Order'); 
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Sales Order...</div>;
    if (!so || !customer) return (
        <div className="p-8 text-center">
            <p className="text-red-500 mb-4">Sales Order not found or missing linked customer.</p>
            <Button onClick={() => navigate('/sales-orders')}>Back to List</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Sales Order #{so?.so_number}</h1>
                        <p className="text-sm text-gray-600">PO: {so?.customer_po_number}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => navigate(-1)} variant="secondary">
                            <ArrowLeft className="w-4 h-4" /> Back
                        </Button>
                        <Button onClick={handlePrint} variant="secondary">
                            <Printer className="w-4 h-4" /> Print
                        </Button>
                        <Button onClick={() => navigate(`/delivery-orders/new?so_id=${id}`)} variant="primary">
                            <Truck className="w-4 h-4" /> Create Delivery Order
                        </Button>
                        {/* Create Invoice Button - only if there are DOs */}
                        {deliveryProgress && deliveryProgress.do_count > 0 && (
                            <Button
                                onClick={() => navigate(`/invoices/new?so_id=${id}`)}
                                variant="primary"
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <FileText className="w-4 h-4" /> Create Invoice from All Deliveries
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {/* Delivery Progress Section */}
            {deliveryProgress && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">📦 Delivery Progress</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Total SO Items</p>
                            <p className="text-2xl font-bold text-gray-900">{deliveryProgress.total_so_items}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Items Delivered</p>
                            <p className="text-2xl font-bold text-green-600">
                                {deliveryProgress.delivered_items} / {deliveryProgress.total_so_items}
                            </p>
                            <p className="text-xs text-gray-500">{deliveryProgress.items_delivered_percentage}%</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Quantity Progress</p>
                            <p className="text-2xl font-bold text-emerald-600">
                                {deliveryProgress.delivered_quantity} / {deliveryProgress.total_quantity}
                            </p>
                            <p className="text-xs text-gray-500">{deliveryProgress.quantity_delivered_percentage}%</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Status</p>
                            <p className={`text-lg font-bold ${deliveryProgress.delivery_status === 'Fully Delivered' ? 'text-green-600' :
                                deliveryProgress.delivery_status === 'Partially Delivered' ? 'text-yellow-600' :
                                    'text-gray-600'
                                }`}>
                                {deliveryProgress.delivery_status}
                            </p>
                            <p className="text-xs text-gray-500">{deliveryProgress.do_count} DO(s)</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Billing Summary Section */}
            {billingSummary && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Billing Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">SO Total Value</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {billingSummary.so_total
                                    ? `$${billingSummary.so_total.toLocaleString()}`
                                    : billingSummary.total_billed > 0
                                        ? `$${billingSummary.total_billed.toLocaleString()} (from invoices)`
                                        : 'Calculate from Quote'}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Total Billed</p>
                            <p className="text-2xl font-bold text-green-600">
                                ${billingSummary.total_billed.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">{billingSummary.billed_percentage}%</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Remaining</p>
                            <p className="text-2xl font-bold text-orange-600">
                                ${billingSummary.remaining_to_bill?.toLocaleString() || 'N/A'}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-sm text-gray-600 mb-1">Status</p>
                            <p className={`text-lg font-bold ${billingSummary.billing_status === 'Fully Billed' ? 'text-green-600' :
                                billingSummary.billing_status === 'Partially Billed' ? 'text-yellow-600' :
                                    'text-gray-600'
                                }`}>
                                {billingSummary.billing_status}
                            </p>
                            <p className="text-xs text-gray-500">{billingSummary.invoice_count} invoice(s)</p>
                        </div>
                    </div>

                    {invoices.length > 0 && (
                        <div className="bg-white p-4 rounded-lg">
                            <h3 className="font-semibold text-gray-900 mb-3">Invoice History</h3>
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left">Invoice #</th>
                                        <th className="text-left">Date</th>
                                        <th className="text-left">Type</th>
                                        <th className="text-right">Amount</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                                            <td className="font-medium text-blue-600">{inv.invoice_number}</td>
                                            <td>{new Date(inv.date).toLocaleDateString()}</td>
                                            <td>
                                                <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                                                    {inv.billing_type || 'itemized'}
                                                </span>
                                            </td>
                                            <td className="text-right font-semibold">${inv.grand_total.toLocaleString()}</td>
                                            <td className="text-center">
                                                <span className={`px-2 py-1 text-xs rounded ${inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    inv.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {inv.payment_status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                <div className="origin-top scale-90">
                    <SalesOrderTemplate
                        ref={printRef}
                        so={so}
                        customer={customer}
                        items={items}
                        company={company}
                    />
                </div>
            </div>
        </div>
    );
};
