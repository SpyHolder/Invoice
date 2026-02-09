import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, PurchaseOrder, PurchaseOrderItem, Partner, Company } from '../lib/supabase';
import { PurchaseOrderTemplate } from '../components/PurchaseOrderTemplate';

export const ViewPurchaseOrder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [vendor, setVendor] = useState<Partner | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: po ? `PO-${po.po_number}` : 'Purchase Order',
    });

    useEffect(() => {
        fetchPOData();
    }, [id]);

    const fetchPOData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            // Fetch PO
            const { data: poData, error: poError } = await supabase
                .from('purchase_orders')
                .select('*')
                .eq('id', id)
                .single();

            if (poError) throw poError;
            setPo(poData);

            // Fetch Vendor
            if (poData.vendor_id) {
                const { data: vendorData, error: vendorError } = await supabase
                    .from('partners')
                    .select('*')
                    .eq('id', poData.vendor_id)
                    .single();

                if (vendorError) {
                    console.error('Error fetching vendor:', vendorError);
                } else {
                    setVendor(vendorData);
                }
            }

            // Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('po_id', id);

            if (itemsError) throw itemsError;
            setItems(itemsData || []);

            // Fetch Company Info
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .limit(1)
                .single();

            if (companyError && companyError.code !== 'PGRST116') {
                console.error('Error fetching company:', companyError);
            }
            if (companyData) setCompany(companyData);

        } catch (error) {
            console.error('Error fetching purchase order:', error);
            alert('Failed to load purchase order');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading purchase order...</div>
            </div>
        );
    }

    if (!po) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="text-gray-500 mb-4">Purchase order not found</div>
                <Button onClick={() => navigate('/purchase-orders')}>Back to Purchase Orders</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Purchase Order Details</h1>
                        <p className="text-gray-600 mt-1">{po.po_number}</p>
                    </div>
                </div>
                <Button onClick={handlePrint}>
                    <Printer className="w-4 h-4" />
                    Print PO
                </Button>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                <div className="origin-top scale-90">
                    {vendor ? (
                        <PurchaseOrderTemplate
                            ref={printRef}
                            po={po}
                            vendor={vendor}
                            items={items}
                            company={company}
                        />
                    ) : (
                        <div className="bg-white p-8 text-center text-red-500">
                            Vendor information missing or deleted.
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
