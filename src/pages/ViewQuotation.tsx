import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Printer, ShoppingCart, FileText, Truck, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Quotation, QuotationItem, Partner, Company, BankAccount } from '../types';
import { api } from '../lib/api';
import { QuotationTemplate } from '../components/QuotationTemplate';
import { useReactToPrint } from 'react-to-print';

interface DeliveryProgress {
    total_items: number;
    total_quantity: number;
    do_count: number;
    delivered_items: number;
    delivered_quantity: number;
    quantity_delivered_percentage: number;
    delivery_status: string;
}

interface DOInfo {
    id: string;
    do_number: string;
    date: string;
    status: string;
    items?: any[];
}

export const ViewQuotation = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [customer, setCustomer] = useState<Partner | null>(null);
    const [items, setItems] = useState<QuotationItem[]>([]);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    const [bankAccount, setBankAccount] = useState<BankAccount | undefined>(undefined);

    // DO tracking
    const [deliveryProgress, setDeliveryProgress] = useState<DeliveryProgress | null>(null);
    const [deliveryOrders, setDeliveryOrders] = useState<DOInfo[]>([]);

    const [loading, setLoading] = useState(true);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: quotation ? `Quotation-${quotation.quote_number}` : 'Quotation',
    });

    useEffect(() => {
        fetchQuotationData();
    }, [id]);

    const fetchQuotationData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            // Fetch quotation
            const quotationData = await api.get<any>(`/quotations/${id}`);
            if (!quotationData) throw new Error('Quotation not found');
            setQuotation(quotationData);

            // Fetch customer (partner)
            const customerData = await api.get<any>(`/partners/${quotationData.customer_id}`);
            setCustomer(customerData);

            // Fetch quotation items
            setItems(quotationData.items || []);

            // Fetch Company Info
            try {
                const companies = await api.get<any[]>('/companies');
                if (companies && companies.length > 0) {
                    setCompany(companies[0]);
                }
            } catch (e) {
                console.error('Error fetching company', e);
            }

            // Fetch primary bank account
            try {
                const bankData = await api.get<any>('/companies/bank/primary');
                if (bankData) {
                    // Handle both array and object response
                    const bank = Array.isArray(bankData) ? bankData[0] : bankData;
                    if (bank) setBankAccount(bank);
                }
            } catch (e) {
                console.error('Error fetching bank', e);
            }

            // Fetch delivery progress
            try {
                const progress = await api.get<DeliveryProgress>(`/quotations/${id}/delivery-progress`);
                if (progress) setDeliveryProgress(progress);
            } catch (e) {
                console.error('Error fetching delivery progress', e);
            }

            // Fetch DOs linked to this quotation
            try {
                const allDOs = await api.get<any[]>('/delivery-orders');
                if (allDOs) {
                    const linkedDOs = allDOs.filter(d => d.quotation_id === id);
                    setDeliveryOrders(linkedDOs);
                }
            } catch (e) {
                console.error('Error fetching DOs', e);
            }

        } catch (error) {
            console.error('Error fetching quotation:', error);
            alert('Failed to load quotation');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'delivered': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'cancelled': return <AlertCircle className="w-4 h-4 text-red-500" />;
            default: return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading quotation...</div>
            </div>
        );
    }

    if (!quotation || !customer) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="text-gray-500 mb-4">Quotation not found</div>
                <Button onClick={() => navigate('/quotations')}>Back to Quotations</Button>
            </div>
        );
    }

    const isFullyDelivered = deliveryProgress?.delivery_status === 'Fully Delivered';
    const progressPercent = deliveryProgress?.quantity_delivered_percentage || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/quotations')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Quotation Details</h1>
                        <p className="text-gray-600 mt-1">{quotation.quote_number}</p>
                        {quotation.customer_po_number && (
                            <p className="text-sm text-gray-500">PO: {quotation.customer_po_number}</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button onClick={handlePrint} variant="secondary">
                        <Printer className="w-4 h-4" />
                        Print
                    </Button>
                    {quotation.status === 'confirmed' && (
                        <>
                            <Button onClick={() => navigate(`/delivery-orders/new?quotation_id=${quotation.id}`)} variant="secondary">
                                <Package className="w-4 h-4" />
                                Create DO
                            </Button>
                            <Button onClick={() => navigate(`/purchase-orders/new?quotation_id=${quotation.id}`)} variant="secondary">
                                <ShoppingCart className="w-4 h-4" />
                                Create PO
                            </Button>
                        </>
                    )}
                    {isFullyDelivered && (
                        <Button onClick={() => navigate(`/invoices/new?so_id=${quotation.id}`)}>
                            <FileText className="w-4 h-4" />
                            Create Invoice
                        </Button>
                    )}
                </div>
            </div>

            {/* Delivery Progress Panel */}
            {quotation.status === 'confirmed' && (
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <Truck className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Delivery Progress</h2>
                        {deliveryProgress && (
                            <Badge variant={isFullyDelivered ? 'success' : deliveryProgress.delivery_status === 'Partially Delivered' ? 'info' : 'default'}>
                                {deliveryProgress.delivery_status}
                            </Badge>
                        )}
                    </div>

                    {deliveryProgress && (
                        <div className="space-y-4">
                            {/* Progress bar */}
                            <div>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="text-gray-600">
                                        {deliveryProgress.delivered_quantity} / {deliveryProgress.total_quantity} items delivered
                                    </span>
                                    <span className="font-medium text-gray-900">{progressPercent}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className={`h-2.5 rounded-full transition-all duration-500 ${isFullyDelivered ? 'bg-green-500' : 'bg-blue-500'}`}
                                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{deliveryProgress.do_count}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">DOs Created</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{deliveryProgress.total_quantity}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Total Qty</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-green-600">{deliveryProgress.delivered_quantity}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Delivered</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-orange-600">
                                        {Math.max(0, Number(deliveryProgress.total_quantity) - Number(deliveryProgress.delivered_quantity))}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">Remaining</p>
                                </div>
                            </div>

                            {/* DO List */}
                            {deliveryOrders.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Delivery Orders</h3>
                                    <div className="space-y-1.5">
                                        {deliveryOrders.map(doItem => (
                                            <div
                                                key={doItem.id}
                                                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => navigate(`/delivery-orders/${doItem.id}`)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(doItem.status || 'pending')}
                                                    <span className="text-sm font-medium text-gray-900">{doItem.do_number}</span>
                                                    <span className="text-xs text-gray-400">
                                                        {doItem.date ? new Date(doItem.date).toLocaleDateString() : ''}
                                                    </span>
                                                </div>
                                                <Badge variant={doItem.status === 'delivered' ? 'success' : doItem.status === 'cancelled' ? 'danger' : 'default'}>
                                                    {doItem.status || 'pending'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}

            <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                <div className="origin-top scale-90">
                    <QuotationTemplate
                        ref={printRef}
                        quotation={quotation}
                        customer={customer}
                        items={items}
                        company={company}
                        termsContent={quotation.terms_content || ''}
                        bankDetails={bankAccount}
                    />
                </div>
            </div>
        </div>
    );
};
