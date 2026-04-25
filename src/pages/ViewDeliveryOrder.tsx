import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DeliveryOrder, DeliveryOrderItem, Partner, Company } from '../types';
import { api } from '../lib/api';
import { DeliveryOrderTemplate } from '../components/DeliveryOrderTemplate';
import { useReactToPrint } from 'react-to-print';

export const ViewDeliveryOrder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [doData, setDoData] = useState<DeliveryOrder | null>(null);
    const [customer, setCustomer] = useState<Partner | null>(null);
    const [items, setItems] = useState<DeliveryOrderItem[]>([]);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    const [customerPO, setCustomerPO] = useState<string | null>(null);
    const [quoteRef, setQuoteRef] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: doData ? `DO-${doData.do_number}` : 'DeliveryOrder',
    });

    useEffect(() => {
        if (id) fetchDOData();
    }, [id]);

    const fetchDOData = async () => {
        setLoading(true);
        try {
            // Fetch DO
            const doRecord = await api.get<any>(`/delivery-orders/${id}`);
            if (!doRecord) throw new Error('Delivery Order not found');
            setDoData(doRecord);

            // Fetch Items
            setItems(doRecord.items || []);

            // Fetch Customer, Customer PO, and Quote Ref via Quotation (SO removed)
            if (doRecord.quotation_id) {
                try {
                    const q = await api.get<any>(`/quotations/${doRecord.quotation_id}`);
                    if (q) {
                        // Set Customer PO from quotation
                        setCustomerPO(q.customer_po_number);
                        // Set Quote Ref
                        setQuoteRef(q.quote_number);

                        // Fetch Customer
                        if (q.customer_id) {
                            const cust = await api.get<any>(`/partners/${q.customer_id}`);
                            if (cust) setCustomer(cust);
                        }
                    }
                } catch (e) {
                    console.error('Error fetching Quotation related data', e);
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

        } catch (error) {
            console.error('Error fetching DO details', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
    if (!doData || !customer) return <div className="p-8 text-center">DO not found or missing customer link</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/delivery-orders')}>
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Delivery Order Details</h1>
                        <p className="text-gray-600">{doData.do_number}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handlePrint} variant="secondary">
                        <Printer className="w-4 h-4" /> Print
                    </Button>
                    <Button onClick={() => navigate(`/invoices/new?do_id=${doData.id}`)}>
                        <FileText className="w-4 h-4" /> Create Invoice
                    </Button>
                </div>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                <div className="origin-top scale-90">
                    <DeliveryOrderTemplate
                        ref={printRef}
                        doData={doData}
                        customer={customer}
                        items={items}
                        company={company}
                        customerPO={customerPO}
                        quoteRef={quoteRef}
                    />
                </div>
            </div>
        </div>
    );
};
