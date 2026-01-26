import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Printer, Loader2, FileCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, Quotation, QuotationItem, Customer, CompanySettings } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const ViewQuotation = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [items, setItems] = useState<QuotationItem[]>([]);
    const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotationData();
    }, [id]);

    const fetchQuotationData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            // Fetch company settings first (or default)
            const { data: settings } = await supabase.from('company_settings').select('*').single();
            setCompanySettings(settings);

            // Fetch quotation
            const { data: quotationData, error: quotationError } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', id)
                .single();

            if (quotationError) throw quotationError;
            setQuotation(quotationData);

            // Fetch customer
            const { data: customerData, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', quotationData.customer_id)
                .single();

            if (customerError) throw customerError;
            setCustomer(customerData);

            // Fetch quotation items
            const { data: itemsData, error: itemsError } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', id)
                .order('id');

            if (itemsError) throw itemsError;
            setItems(itemsData || []);
        } catch (error) {
            console.error('Error fetching quotation:', error);
            showToast('Failed to load quotation', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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

    return (
        <div className="space-y-6">
            {/* Action Buttons - Hidden on print */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/quotations')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Quotation Details</h1>
                        <p className="text-gray-600 mt-1">{quotation.quotation_number}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/delivery-orders/new')}>
                        <Truck className="w-4 h-4" />
                        Create Delivery Order
                    </Button>
                    <Button onClick={() => navigate(`/invoices/new?from_quotation=${id}`)}>
                        <FileCheck className="w-4 h-4" />
                        Create Invoice
                    </Button>
                    <Button variant="secondary" onClick={handlePrint}>
                        <Printer className="w-4 h-4" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Printable Content - A4 Styles */}
            <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none print:p-0 print:text-sm max-w-[210mm] mx-auto min-h-[297mm]">

                {/* Header Section */}
                <div className="flex gap-6 mb-8">
                    {/* Logo Box */}
                    <div className="w-32 h-32 border flex items-center justify-center">
                        {companySettings?.logo_url ? (
                            <img src={companySettings.logo_url} alt="Company Logo" className="max-w-full max-h-full" />
                        ) : (
                            <span className="text-gray-400">Logo</span>
                        )}
                    </div>
                    {/* Company Address */}
                    <div className="flex-1">
                        <h2 className="font-bold text-lg uppercase mb-1">{companySettings?.name || 'YOUR COMPANY NAME'}</h2>
                        <div className="text-gray-700 space-y-0.5">
                            <p>{companySettings?.address_line1}</p>
                            <p>{companySettings?.address_line2}</p>
                            <p>{companySettings?.address_line3}</p>
                            <div className="flex gap-8 mt-2">
                                {/* <p>Tel: {companySettings?.phone}</p> */}
                                {/* <p>Fax: {companySettings?.fax}</p> */}
                                {/* <p>Email: {companySettings?.email}</p> */}
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-t-2 border-gray-800 mb-6" />

                {/* Info Grid */}
                <div className="flex flex-wrap mb-6">
                    {/* Left: Customer Info */}
                    <div className="w-full md:w-3/5 pr-4 space-y-1">
                        <div className="flex">
                            <div className="w-24 font-bold">Customer</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1 font-bold">{customer.name}</div>
                        </div>
                        <div className="flex">
                            <div className="w-24"></div>
                            <div className="mx-2"></div>
                            <div className="flex-1 whitespace-pre-wrap">{customer.address}</div>
                        </div>
                        <div className="flex mt-2">
                            <div className="w-24">Attn</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{quotation.contact || customer.attn}</div>
                        </div>
                        <div className="flex">
                            <div className="w-24">Tel</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{customer.phone}</div>
                        </div>
                        <div className="flex">
                            <div className="w-24">Email</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1 underline text-blue-600">{customer.email}</div>
                        </div>
                    </div>

                    {/* Right: Quote Info */}
                    <div className="w-full md:w-2/5 pl-4 space-y-1">
                        <div className="flex">
                            <div className="w-32 font-bold">Contact</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{companySettings?.phone || '085272124268'}</div>
                        </div>
                        <div className="flex">
                            <div className="w-32 font-bold">RFQ Ref No</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{quotation.rfq_ref_no || '-'}</div>
                        </div>
                        <div className="flex">
                            <div className="w-32 font-bold">Quote No</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{quotation.quotation_number}</div>
                        </div>
                        <div className="flex">
                            <div className="w-32 font-bold">Quote Date</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{formatDate(quotation.date)}</div>
                        </div>
                        <div className="flex">
                            <div className="w-32 font-bold">Quote Validity</div>
                            <div className="mx-2">:</div>
                            <div className="flex-1">{formatDate(quotation.valid_until)}</div>
                        </div>
                    </div>
                </div>

                {/* Subject Line */}
                <div className="flex mb-6 border-b border-gray-300 pb-2">
                    <div className="w-24 font-bold">Subject</div>
                    <div className="mx-2">:</div>
                    <div className="flex-1 font-semibold underline decoration-solid">
                        {quotation.subject || 'Supply Labor and Material'}
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-100 print:bg-transparent">
                                <th className="border border-black px-1 py-1 text-center w-10">No</th>
                                <th className="border border-black px-2 py-1 text-left">Description</th>
                                <th className="border border-black px-1 py-1 text-center w-12">QTY</th>
                                <th className="border border-black px-1 py-1 text-center w-12">UOM</th>
                                <th className="border border-black px-1 py-1 text-right w-20">U/Price</th>
                                <th className="border border-black px-1 py-1 text-right w-20">Bef Disc</th>
                                <th className="border border-black px-1 py-1 text-center w-12">Disc %</th>
                                <th className="border border-black px-1 py-1 text-right w-20">Disc Amt</th>
                                <th className="border border-black px-1 py-1 text-right w-24">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="border border-black px-1 py-1 text-center">{index + 1}</td>
                                    <td className="border border-black px-2 py-1">
                                        <div className="font-semibold">{item.item_name}</div>
                                        {item.description && (
                                            <div className="text-xs whitespace-pre-wrap">{item.description}</div>
                                        )}
                                    </td>
                                    <td className="border border-black px-1 py-1 text-center">{item.quantity}</td>
                                    <td className="border border-black px-1 py-1 text-center">{item.uom || 'EA'}</td>
                                    <td className="border border-black px-1 py-1 text-right">{item.unit_price.toFixed(2)}</td>
                                    <td className="border border-black px-1 py-1 text-right">
                                        {(item.bef_disc || (item.quantity * item.unit_price)).toFixed(2)}
                                    </td>
                                    <td className="border border-black px-1 py-1 text-center">{item.disc_percent || 0}</td>
                                    <td className="border border-black px-1 py-1 text-right">
                                        {(item.disc_amt || 0).toFixed(2)}
                                    </td>
                                    <td className="border border-black px-1 py-1 text-right font-semibold">
                                        {item.total.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Box */}
                <div className="flex justify-end mb-8">
                    <div className="w-[400px] border-2 border-black">
                        <div className="border-b border-black text-center font-bold py-1 bg-gray-50 print:bg-transparent">
                            Budget Summary
                        </div>
                        <div className="divide-y divide-black">
                            {/* Subtotal / Scope for A */}
                            <div className="flex justify-between px-2 py-1">
                                <span className="text-right flex-1 pr-4">Subtotal</span>
                                <span className="w-24 text-right font-medium">
                                    {quotation.subtotal.toFixed(2)}
                                </span>
                            </div>

                            {/* Goodwill Discount */}
                            <div className="flex justify-between px-2 py-1">
                                <span className="text-right flex-1 pr-4">Good Will Discount For</span>
                                <span className="w-24 text-right font-medium">
                                    {quotation.goodwill_discount > 0 ? `(${quotation.goodwill_discount.toFixed(2)})` : '0.00'}
                                </span>
                            </div>

                            {/* Total Amount */}
                            <div className="flex justify-between px-2 py-1 font-bold">
                                <span className="text-right flex-1 pr-4">Total Amount</span>
                                <span className="w-24 text-right">
                                    {quotation.total.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grand Total Words */}
                <div className="text-right mb-12">
                    <div className="text-xl font-bold">
                        Total in ({quotation.currency || 'SGD'}) $ {quotation.total.toFixed(2)}
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="font-bold text-sm">
                    {companySettings?.gst_note || '* NO GST as Company is NOT a GST Registered Company Yet'}
                </div>

                {/* Terms & Conditions (if any) */}
                {quotation.notes && (
                    <div className="mt-8 text-sm text-gray-600 border-t pt-4">
                        <p className="font-bold mb-1">Terms & Conditions:</p>
                        <p className="whitespace-pre-wrap">{quotation.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
