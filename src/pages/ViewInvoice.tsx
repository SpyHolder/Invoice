import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Invoice, InvoiceItem, Partner, Company, BankAccount, InvoiceDeliverySection } from '../types';
import { api } from '../lib/api';
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
            const invoiceData = await api.get<any>(`/invoices/${id}`);
            if (!invoiceData) throw new Error('Invoice not found');
            setInvoice(invoiceData);

            // Fetch customer (partner) via customer_id derived from SO -> Quotation
            if (invoiceData.customer_id) {
                const customerData = await api.get<any>(`/partners/${invoiceData.customer_id}`);
                setCustomer(customerData);
            }

            // Fetch invoice items
            setItems(invoiceData.items || []);

            // Fetch DO sections if invoice is DO-based
            if (invoiceData.invoice_type === 'do_based') {
                const sectionsData = invoiceData.delivery_sections || [];
                setDoSections(sectionsData);

                // Collect all DO Numbers from sections
                if (sectionsData && sectionsData.length > 0) {
                    const doNumbers = [];
                    for (const section of sectionsData) {
                        try {
                            const doData = await api.get<any>(`/delivery-orders/${section.do_id}`);
                            if (doData && doData.do_number) {
                                doNumbers.push(doData.do_number);
                            }
                        } catch (e) {
                            console.error('Error fetching DO details', e);
                        }
                    }

                    if (doNumbers.length > 0) {
                        setDoNumber(doNumbers.join('\n'));
                    }
                }
            }

            // Fetch Customer PO from Sales Order
            if (invoiceData.so_id) {
                try {
                    const soData = await api.get<any>(`/sales-orders/${invoiceData.so_id}`);
                    if (soData) {
                        setCustomerPO(soData.customer_po_number);
                    }
                } catch (e) {
                    console.error('Error fetching SO details', e);
                }
            }

            // Fetch Company Info (Assuming single company for now)
            try {
                const companiesData = await api.get<any[]>('/companies');
                if (companiesData && companiesData.length > 0) {
                    const companyData = companiesData[0];
                    const fullCompany = await api.get<any>(`/companies/${companyData.id}`);
                    if (fullCompany) {
                        setCompany(fullCompany);
                        setBankAccounts(fullCompany.bank_accounts || []);
                    }
                }
            } catch (e) {
                console.error('Error fetching company details', e);
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
