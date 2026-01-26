import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, DeliveryOrder, DeliveryOrderItem, CompanySettings } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const ViewDeliveryOrder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [deliveryOrder, setDeliveryOrder] = useState<DeliveryOrder | null>(null);
    const [groupedItems, setGroupedItems] = useState<Record<string, DeliveryOrderItem[]>>({});
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // Company Settings
            const { data: settings } = await supabase.from('company_settings').select('*').single();
            setCompanySettings(settings);

            // DO
            const { data: doData, error: doError } = await supabase
                .from('delivery_orders')
                .select(`*, customer:customers(*), quotation:quotations(*)`)
                .eq('id', id)
                .single();
            if (doError) throw doError;
            setDeliveryOrder(doData);

            // DO Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('delivery_order_items')
                .select('*')
                .eq('delivery_order_id', id)
                .order('id');
            if (itemsError) throw itemsError;



            // Group items
            const grouped: Record<string, DeliveryOrderItem[]> = {};
            const ungrouped: DeliveryOrderItem[] = [];

            itemsData?.forEach(item => {
                if (item.group_name) {
                    if (!grouped[item.group_name]) grouped[item.group_name] = [];
                    grouped[item.group_name].push(item);
                } else {
                    ungrouped.push(item);
                }
            });

            // Store grouped and keep ungrouped under 'General' or separate
            if (ungrouped.length > 0) {
                // Use a special key for ungrouped if needed, or handle separately
                grouped['__ungrouped__'] = ungrouped;
            }
            setGroupedItems(grouped);

        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to load delivery order', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => window.print();

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    if (loading) return <div className="text-center py-12">Loading...</div>;
    if (!deliveryOrder) return <div className="text-center py-12">Delivery Order Not Found</div>;

    // Helper to render items table rows
    const renderItemsRows = (itemsToRender: DeliveryOrderItem[], startIndex: number) => {
        return itemsToRender.map((item, index) => (
            <tr key={item.id} className="text-sm">
                <td className="border border-black px-1 py-1 text-center w-10">{startIndex + index + 1}</td>
                <td className="border border-black px-1 py-1 text-center w-24">{item.item_id ? 'ITEM' : ''}</td>
                <td className="border border-black px-2 py-1">
                    <div className="font-semibold">{item.item_name}</div>
                    {item.description && <div className="text-xs whitespace-pre-wrap">{item.description}</div>}
                </td>
                <td className="border border-black px-1 py-1 text-center w-12">{item.quantity}</td>
                <td className="border border-black px-1 py-1 text-center w-12">{item.uom || 'EA'}</td>
            </tr>
        ));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center print:hidden">
                <div className="flex gap-4 items-center">
                    <Button variant="secondary" onClick={() => navigate('/delivery-orders')}><ArrowLeft className="w-4 h-4" /> Back</Button>
                    <h1 className="text-2xl font-bold">Delivery Order Details</h1>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate(`/invoices/new?from_do=${id}`)}>
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                        Create Invoice
                    </Button>
                    <Button variant="secondary" onClick={handlePrint}><Printer className="w-4 h-4" /> Print</Button>
                </div>
            </div>

            <div className="bg-white p-8 max-w-[210mm] mx-auto min-h-[297mm] shadow-lg print:shadow-none print:p-0">
                {/* Header */}
                <div className="flex gap-6 mb-4">
                    <div className="w-40 h-28 border flex items-center justify-center p-2">
                        {companySettings?.logo_url ? <img src={companySettings.logo_url} className="max-h-full max-w-full" /> : <span className="text-gray-400">LOGO</span>}
                    </div>
                    <div>
                        <div className="font-bold text-lg uppercase">{companySettings?.name || 'COMPANY NAME'}</div>
                        <div className="text-sm whitespace-pre-wrap">{companySettings?.address_line1} {companySettings?.address_line2} {companySettings?.address_line3}</div>
                    </div>
                    <div className="flex-1 text-right">
                        <h1 className="text-3xl font-bold uppercase mb-2">DELIVERY ORDER</h1>
                        <table className="text-sm border-collapse border border-black w-full max-w-[300px] ml-auto">
                            <tbody>
                                <tr><td className="border border-black px-2 font-bold bg-gray-100">DO Number</td><td className="border border-black px-2">{deliveryOrder.do_number}</td></tr>
                                <tr><td className="border border-black px-2 font-bold bg-gray-100">DO Date</td><td className="border border-black px-2">{formatDate(deliveryOrder.date)}</td></tr>
                                <tr><td className="border border-black px-2 font-bold bg-gray-100">DO Terms</td><td className="border border-black px-2">{deliveryOrder.terms}</td></tr>
                                <tr><td className="border border-black px-2 font-bold bg-gray-100">Customer PO</td><td className="border border-black px-2">{deliveryOrder.customer_po}</td></tr>
                                <tr><td className="border border-black px-2 font-bold bg-gray-100">Quote Ref</td><td className="border border-black px-2">{deliveryOrder.quotation?.quotation_number}</td></tr>
                                <tr><td className="border border-black px-2 font-bold bg-gray-100">Requestor</td><td className="border border-black px-2">{deliveryOrder.requestor}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center border border-black border-b-0">BILLING ADDRESS</div>
                        <div className="border border-black p-2 h-32 text-sm whitespace-pre-wrap">
                            {deliveryOrder.billing_address || deliveryOrder.customer?.address}
                        </div>
                    </div>
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center border border-black border-b-0">SHIPPING ADDRESS</div>
                        <div className="border border-black p-2 h-32 text-sm whitespace-pre-wrap">
                            {deliveryOrder.delivery_address}
                        </div>
                    </div>
                </div>

                {/* Subject */}
                <div className="mb-4 text-sm">
                    <span className="font-bold">Subject: </span> {deliveryOrder.quotation?.subject || 'Delivery of Goods'}
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black mb-8">
                    <thead>
                        <tr className="bg-gray-400 text-white print:bg-gray-300 print:text-black">
                            <th className="border border-black px-1 py-1 w-10">No</th>
                            <th className="border border-black px-1 py-1 w-24">Items</th>
                            <th className="border border-black px-2 py-1">Description</th>
                            <th className="border border-black px-1 py-1 w-12">QTY</th>
                            <th className="border border-black px-1 py-1 w-12">UOM</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Ungrouped Items First */}
                        {groupedItems['__ungrouped__'] && renderItemsRows(groupedItems['__ungrouped__'], 0)}

                        {/* Grouped Items */}
                        {Object.entries(groupedItems).map(([groupName, groupItems]) => {
                            if (groupName === '__ungrouped__') return null;
                            return (
                                <>
                                    <tr key={`group-${groupName}`}>
                                        <td colSpan={5} className="border border-black px-2 py-1 font-bold bg-gray-100">
                                            {groupName}
                                        </td>
                                    </tr>
                                    {renderItemsRows(groupItems, 0)}
                                </>
                            );
                        })}
                    </tbody>
                </table>

                {/* Notes */}
                <div className="text-sm mb-12">
                    <div className="font-bold">Notes:</div>
                    <ul className="list-disc ml-5 mt-1">
                        <li>The title of the goods retains with Company at all times until full payment for the goods has been made</li>
                        {deliveryOrder.notes && <li>{deliveryOrder.notes}</li>}
                    </ul>
                </div>

                {/* Footer Signature */}
                <div className="flex justify-end mt-20">
                    <div className="text-center w-64">
                        <div className="font-bold mb-12">Customer Acknowledgement<br />Received in Good Order and Condition</div>
                        <div className="border-t border-black pt-2 font-bold">Customer's Official Stamp & Signature</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
