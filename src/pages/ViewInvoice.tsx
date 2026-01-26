import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, Invoice, InvoiceItem, Customer, CompanySettings } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const ViewInvoice = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
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

            // Invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', id)
                .single();
            if (invoiceError) throw invoiceError;
            setInvoice(invoiceData);

            // Customer
            const { data: customerData } = await supabase
                .from('customers')
                .select('*')
                .eq('id', invoiceData.customer_id)
                .single();
            setCustomer(customerData);

            // Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', id)
                .order('id');
            if (itemsError) throw itemsError;
            setItems(itemsData || []);

        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to load invoice', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => window.print();

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
    if (!invoice || !customer) return <div className="text-center py-12">Invoice Not Found</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center print:hidden">
                <div className="flex gap-4 items-center">
                    <Button variant="secondary" onClick={() => navigate('/invoices')}>
                        <ArrowLeft className="w-4 h-4" /> Back
                    </Button>
                    <h1 className="text-2xl font-bold">Invoice Details</h1>
                </div>
                <Button variant="secondary" onClick={handlePrint}><Printer className="w-4 h-4" /> Print</Button>
            </div>

            <div className="bg-white p-8 max-w-[210mm] mx-auto min-h-[297mm] shadow-lg print:shadow-none print:p-0">
                {/* Header */}
                <div className="flex gap-6 mb-8">
                    <div className="w-32 h-32 border flex items-center justify-center">
                        {companySettings?.logo_url ? <img src={companySettings.logo_url} className="max-h-full max-w-full" /> : <span className="text-gray-400">LOGO</span>}
                    </div>
                    <div className="flex-1">
                        <div className="font-bold text-xl uppercase mb-1">{companySettings?.name || 'COMPANY NAME'}</div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap space-y-0.5">
                            {companySettings?.address_line1}<br />
                            {companySettings?.address_line2}<br />
                            {companySettings?.address_line3}
                        </div>
                    </div>
                    <div className="text-right">
                        <h1 className="text-4xl font-bold uppercase text-gray-800 mb-2">INVOICE</h1>
                        <div className="text-sm space-y-1">
                            <div className="flex justify-end gap-2"><span className="font-bold">Invoice No:</span><span>{invoice.invoice_number}</span></div>
                            <div className="flex justify-end gap-2"><span className="font-bold">Date:</span><span>{formatDate(invoice.date)}</span></div>
                            <div className="flex justify-end gap-2"><span className="font-bold">Due Date:</span><span>{formatDate(invoice.due_date)}</span></div>
                        </div>
                    </div>
                </div>

                <hr className="border-t-2 border-gray-800 mb-8" />

                {/* Info Grid */}
                <div className="flex justify-between mb-8">
                    <div className="w-1/2 pr-4">
                        <div className="font-bold text-gray-600 mb-1">BILL TO:</div>
                        <div className="font-bold text-lg">{customer.name}</div>
                        <div className="text-sm whitespace-pre-wrap">{customer.address}</div>
                        <div className="mt-2 text-sm">
                            <span className="font-bold">Attn:</span> {customer.attn || '-'}<br />
                            <span className="font-bold">Tel:</span> {customer.phone}
                        </div>
                    </div>
                    <div className="w-1/2 pl-4 text-sm space-y-2">
                        <div className="flex border-b pb-1">
                            <div className="w-32 font-bold">Terms</div>
                            <div className="flex-1">: {invoice.terms}</div>
                        </div>
                        <div className="flex border-b pb-1">
                            <div className="w-32 font-bold">Customer PO</div>
                            <div className="flex-1">: {invoice.customer_po}</div>
                        </div>
                        <div className="flex border-b pb-1">
                            <div className="w-32 font-bold">Status</div>
                            <div className="flex-1 uppercase font-semibold">: {invoice.status}</div>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black mb-8 text-sm">
                    <thead>
                        <tr className="bg-gray-100 print:bg-transparent">
                            <th className="border border-black px-1 py-1 w-10 text-center">No</th>
                            <th className="border border-black px-2 py-1 text-left">Description</th>
                            <th className="border border-black px-1 py-1 w-12 text-center">Qty</th>
                            <th className="border border-black px-1 py-1 w-12 text-center">UOM</th>
                            <th className="border border-black px-1 py-1 w-24 text-right">Unit Price</th>
                            <th className="border border-black px-1 py-1 w-20 text-right">Discount</th>
                            <th className="border border-black px-1 py-1 w-24 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id}>
                                <td className="border border-black px-1 py-1 text-center">{index + 1}</td>
                                <td className="border border-black px-2 py-1">
                                    <div className="font-semibold">{item.item_name}</div>
                                    {item.description && <div className="text-xs text-gray-600">{item.description}</div>}
                                </td>
                                <td className="border border-black px-1 py-1 text-center">{item.quantity}</td>
                                <td className="border border-black px-1 py-1 text-center">{item.uom || 'EA'}</td>
                                <td className="border border-black px-1 py-1 text-right">{item.unit_price.toFixed(2)}</td>
                                <td className="border border-black px-1 py-1 text-right text-red-600">
                                    {item.discount > 0 ? `(${item.discount.toFixed(2)})` : '-'}
                                </td>
                                <td className="border border-black px-1 py-1 text-right font-semibold">{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-12">
                    <div className="w-[300px]">
                        <div className="flex justify-between mb-2">
                            <span>Subtotal</span>
                            <span className="font-semibold">{invoice.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2 pb-2 border-b">
                            <span>Tax ({invoice.tax > 0 ? 'Included' : '0%'})</span>
                            <span className="font-semibold">{invoice.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-blue-600 print:text-black">
                            <span>Total</span>
                            <span>$ {invoice.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="text-sm mt-8 border-t border-gray-300 pt-4">
                    <h4 className="font-bold mb-2">Notes & Terms:</h4>
                    <div className="whitespace-pre-wrap text-gray-600">{invoice.notes}</div>
                    <div className="mt-4 font-bold">{companySettings?.gst_note}</div>
                </div>
            </div>
        </div>
    );
};
