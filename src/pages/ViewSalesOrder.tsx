import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Truck, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { SalesOrder, SalesOrderItem, Partner, Company } from '../types';
import { api } from '../lib/api';
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
            const soData = await api.get<any>(`/sales-orders/${id}`);
            if (!soData) throw new Error('Sales Order not found');
            setSo(soData);

            // Fetch Items
            setItems(soData.items || []);

            // Fetch Customer (via Quotation or direct? SO Schema links to Quote. Quote links to Customer)
            if (soData.quotation_id) {
                try {
                    const quote = await api.get<any>(`/quotations/${soData.quotation_id}`);
                    if (quote && quote.customer_id) {
                        const cust = await api.get<any>(`/partners/${quote.customer_id}`);
                        setCustomer(cust);
                    }
                } catch (e) {
                    console.error('Error fetching customer via SO', e);
                }
            }

            // Fetch Company Info
            try {
                const companies = await api.get<any[]>('/companies');
                if (companies && companies.length > 0) {
                    setCompany(companies[0]);
                }
            } catch (e) {
                console.error('Error fetching company', e);
            }

            // Fetch Delivery Progress
            try {
                const deliveryProgressData = await api.get<any>(`/sales-orders/${id}/delivery-progress`);
                if (deliveryProgressData) {
                    setDeliveryProgress(deliveryProgressData);
                }
            } catch (e) {
                console.error('Error fetching delivery progress', e);
            }

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
