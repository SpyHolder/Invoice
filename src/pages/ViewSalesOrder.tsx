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
