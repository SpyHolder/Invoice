import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, Quotation, QuotationItem, Customer } from '../lib/supabase';

export const ViewQuotation = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [items, setItems] = useState<QuotationItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotationData();
    }, [id]);

    const fetchQuotationData = async () => {
        if (!id) return;

        setLoading(true);
        try {
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
            alert('Failed to load quotation');
        } finally {
            setLoading(false);
        }
    };

    const convertToInvoice = async () => {
        if (!quotation || !confirm('Convert this quotation to an invoice?')) return;

        try {
            // Create invoice
            const { data: newInvoice, error } = await supabase
                .from('invoices')
                .insert([
                    {
                        invoice_number: 'INV-' + Date.now(),
                        customer_id: quotation.customer_id,
                        date: new Date().toISOString().split('T')[0],
                        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        status: 'unpaid',
                        subtotal: quotation.subtotal,
                        discount: quotation.discount,
                        tax: quotation.tax,
                        total: quotation.total,
                        notes: quotation.notes,
                    },
                ])
                .select()
                .single();

            if (error || !newInvoice) throw error;

            // Create invoice items
            const invoiceItems = items.map((item) => ({
                invoice_id: newInvoice.id,
                item_name: item.item_name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: item.discount,
                tax_rate: item.tax_rate,
                total: item.total,
            }));

            const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);

            if (itemsError) throw itemsError;

            alert('Quotation converted to invoice successfully!');
            navigate('/invoices');
        } catch (error) {
            console.error('Error converting to invoice:', error);
            alert('Failed to convert quotation');
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

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

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
                        <p className="text-gray-600 mt-1">{quotation.quotation_number}</p>
                    </div>
                </div>
                <Button onClick={convertToInvoice}>
                    <FileCheck className="w-4 h-4" />
                    Convert to Invoice
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-blue-600 mb-2">QUOTATION</h2>
                        <p className="text-sm text-gray-600">Quotation Number:</p>
                        <p className="text-lg font-semibold">{quotation.quotation_number}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600">Status:</p>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                            {quotation.status}
                        </span>
                    </div>
                </div>

                {/* Customer & Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">CUSTOMER:</p>
                        <p className="text-lg font-semibold">{customer.name}</p>
                        <p className="text-sm">{customer.phone}</p>
                        <p className="text-sm">{customer.email}</p>
                        {customer.address && <p className="text-sm">{customer.address}</p>}
                    </div>
                    <div className="text-right">
                        <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-600">Date: </span>
                            <span className="text-sm">{formatDate(quotation.date)}</span>
                        </div>
                        <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-600">Valid Until: </span>
                            <span className="text-sm">{formatDate(quotation.valid_until)}</span>
                        </div>
                        {quotation.payment_terms && (
                            <div>
                                <span className="text-sm font-semibold text-gray-600">Payment Terms: </span>
                                <span className="text-sm">{quotation.payment_terms}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Line Items */}
                <table className="w-full mb-8">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-3 text-sm font-semibold">ITEM</th>
                            <th className="text-left py-3 text-sm font-semibold">DESCRIPTION</th>
                            <th className="text-right py-3 text-sm font-semibold">QTY</th>
                            <th className="text-right py-3 text-sm font-semibold">UNIT PRICE</th>
                            <th className="text-right py-3 text-sm font-semibold">DISCOUNT %</th>
                            <th className="text-right py-3 text-sm font-semibold">TAX %</th>
                            <th className="text-right py-3 text-sm font-semibold">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200">
                                <td className="py-3">{item.item_name}</td>
                                <td className="py-3 text-sm text-gray-600">{item.description}</td>
                                <td className="py-3 text-right">{item.quantity}</td>
                                <td className="py-3 text-right">${item.unit_price.toFixed(2)}</td>
                                <td className="py-3 text-right">{item.discount}%</td>
                                <td className="py-3 text-right">{item.tax_rate}%</td>
                                <td className="py-3 text-right font-semibold">${item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                    <div className="w-80">
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">${quotation.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-gray-600">Discount ({quotation.discount}%):</span>
                            <span className="font-semibold">
                                -${(quotation.subtotal * (quotation.discount / 100)).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between mb-3 text-sm">
                            <span className="text-gray-600">Tax ({quotation.tax}%):</span>
                            <span className="font-semibold">
                                +$
                                {((quotation.subtotal - quotation.subtotal * (quotation.discount / 100)) * (quotation.tax / 100)).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                            <span className="text-xl font-bold">TOTAL:</span>
                            <span className="text-xl font-bold text-blue-600">${quotation.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {quotation.notes && (
                    <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">NOTES:</p>
                        <p className="text-sm text-gray-700">{quotation.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
