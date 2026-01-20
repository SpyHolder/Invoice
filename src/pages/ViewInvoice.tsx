import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, Invoice, InvoiceItem, Customer } from '../lib/supabase';
import { InvoiceTemplate } from '../components/InvoiceTemplate';

export const ViewInvoice = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [loading, setLoading] = useState(true);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: invoice ? `Invoice-${invoice.invoice_number}` : 'Invoice',
    });

    useEffect(() => {
        fetchInvoiceData();
    }, [id]);

    const fetchInvoiceData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            // Fetch invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', id)
                .single();

            if (invoiceError) throw invoiceError;
            setInvoice(invoiceData);

            // Fetch customer
            const { data: customerData, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', invoiceData.customer_id)
                .single();

            if (customerError) throw customerError;
            setCustomer(customerData);

            // Fetch invoice items
            const { data: itemsData, error: itemsError } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', id)
                .order('id');

            if (itemsError) throw itemsError;
            setItems(itemsData || []);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            alert('Failed to load invoice');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading invoice...</div>
            </div>
        );
    }

    if (!invoice || !customer) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="text-gray-500 mb-4">Invoice not found</div>
                <Button onClick={() => navigate('/invoices')}>Back to Invoices</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/invoices')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Invoice Details</h1>
                        <p className="text-gray-600 mt-1">{invoice.invoice_number}</p>
                    </div>
                </div>
                <Button onClick={handlePrint}>
                    <Printer className="w-4 h-4" />
                    Print Invoice
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow-lg">
                <InvoiceTemplate ref={printRef} invoice={invoice} customer={customer} items={items} />
            </div>
        </div>
    );
};
