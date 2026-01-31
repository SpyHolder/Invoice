import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, DeliveryOrder, DeliveryOrderItem, Partner, Company } from '../lib/supabase';
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
            const { data: doRecord, error: doError } = await supabase
                .from('delivery_orders')
                .select('*')
                .eq('id', id)
                .single();
            if (doError) throw doError;
            setDoData(doRecord);

            // Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('delivery_order_items')
                .select('*')
                .eq('do_id', id);
            if (itemsError) throw itemsError;
            setItems(itemsData || []);

            // Fetch Customer via SO -> Quotation
            if (doRecord.so_id) {
                const { data: so } = await supabase.from('sales_orders').select('quotation_id').eq('id', doRecord.so_id).single();
                if (so && so.quotation_id) {
                    const { data: q } = await supabase.from('quotations').select('customer_id').eq('id', so.quotation_id).single();
                    if (q) {
                        const { data: cust } = await supabase.from('partners').select('*').eq('id', q.customer_id).single();
                        if (cust) setCustomer(cust);
                    }
                }
            } else {
                // If created standalone? How to link customer?
                // Ideally DO should have customer_id too if standalone.
                // Assuming linked to SO for now.
            }

            // Fetch Company Info
            const { data: companyData } = await supabase
                .from('companies')
                .select('*')
                .limit(1)
                .single();
            if (companyData) setCompany(companyData);

        } catch (error) {
            console.error(error);
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
                    />
                </div>
            </div>
        </div>
    );
};
