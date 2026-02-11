import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, Invoice, InvoiceItem, Partner, Company, BankAccount, InvoiceDeliverySection } from '../lib/supabase';
import { InvoiceTemplate } from '../components/InvoiceTemplate';

export const ViewInvoice = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [customer, setCustomer] = useState<Partner | null>(null);
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [doSections, setDoSections] = useState<InvoiceDeliverySection[]>([]);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [customerPO, setCustomerPO] = useState<string | null>(null);
    const [doNumber, setDoNumber] = useState<string | null>(null);
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

            // Fetch customer (partner)
            const { data: customerData, error: customerError } = await supabase
                .from('partners')
                .select('*')
                .eq('id', invoiceData.customer_id)
                .single();

            if (customerError) throw customerError;
            setCustomer(customerData);

            // Fetch invoice items
            const { data: itemsData, error: itemsError } = await supabase
                .from('invoice_items')
                .select('*')
                .eq('invoice_id', id);

            if (itemsError) throw itemsError;
            setItems(itemsData || []);

            // Fetch DO sections if invoice is DO-based
            if (invoiceData.invoice_type === 'do_based') {
                const { data: sectionsData, error: sectionsError } = await supabase
                    .from('invoice_delivery_sections')
                    .select('*, delivery_order:delivery_orders(do_number)')
                    .eq('invoice_id', id)
                    .order('section_number');

                if (sectionsError) console.error('Error fetching DO sections:', sectionsError);
                setDoSections(sectionsData || []);

                // Collect all DO Numbers from sections
                if (sectionsData && sectionsData.length > 0) {
                    const doNumbers = sectionsData
                        .map(section => section.delivery_order ? (section.delivery_order as any).do_number : null)
                        .filter(num => num !== null);

                    if (doNumbers.length > 0) {
                        setDoNumber(doNumbers.join('\n'));
                    }
                }
            }

            // Fetch Customer PO from Sales Order
            if (invoiceData.so_id) {
                const { data: soData } = await supabase
                    .from('sales_orders')
                    .select('customer_po_number')
                    .eq('id', invoiceData.so_id)
                    .single();

                if (soData) {
                    setCustomerPO(soData.customer_po_number);
                }
            }

            // Fetch Company Info (Assuming single company for now)
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .limit(1)
                .single();

            // It's possible company doesn't exist yet, so don't throw hard error, just log
            if (companyError && companyError.code !== 'PGRST116') {
                console.error('Error fetching company:', companyError);
            }
            if (companyData) {
                setCompany(companyData);

                // Fetch Bank Accounts for this company
                const { data: bankData, error: bankError } = await supabase
                    .from('bank_accounts')
                    .select('*')
                    .eq('company_id', companyData.id);

                if (bankError) console.error('Error fetching bank accounts:', bankError);
                setBankAccounts(bankData || []);
            }

        } catch (error) {
            console.error('Error fetching invoice details:', error);
            alert('Failed to load invoice details');
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

            <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                <div className="origin-top scale-90">
                    <InvoiceTemplate
                        ref={printRef}
                        invoice={invoice}
                        customer={customer}
                        items={items}
                        doSections={doSections}
                        company={company}
                        bankAccounts={bankAccounts}
                        customerPO={customerPO}
                        doNumber={doNumber}
                    />
                </div>
            </div>
        </div>
    );
};
