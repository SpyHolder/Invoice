import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, Quotation, QuotationItem, Partner, Company, QuotationTerm } from '../lib/supabase';
import { QuotationTemplate } from '../components/QuotationTemplate';
import { useReactToPrint } from 'react-to-print';

export const ViewQuotation = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [customer, setCustomer] = useState<Partner | null>(null);
    const [items, setItems] = useState<QuotationItem[]>([]);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    const [selectedTerms, setSelectedTerms] = useState<QuotationTerm[]>([]);
    const [loading, setLoading] = useState(true);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: quotation ? `Quotation-${quotation.quote_number}` : 'Quotation',
    });

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

            // Fetch customer (partner)
            const { data: customerData, error: customerError } = await supabase
                .from('partners')
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

            // Fetch Company Info
            const { data: companyData } = await supabase
                .from('companies')
                .select('*')
                .limit(1)
                .single();

            if (companyData) setCompany(companyData);

            // Fetch selected terms with their details
            const { data: selectedTermsData, error: termsError } = await supabase
                .from('quotation_selected_terms')
                .select('term_id, quotation_terms(*)')
                .eq('quotation_id', id);

            if (!termsError && selectedTermsData) {
                // Extract the terms from the joined data
                const terms = selectedTermsData
                    .map((st: any) => st.quotation_terms)
                    .filter((t: QuotationTerm | null) => t !== null) as QuotationTerm[];

                // Sort by category and sort_order
                terms.sort((a, b) => {
                    if (a.category !== b.category) {
                        return a.category.localeCompare(b.category);
                    }
                    return a.sort_order - b.sort_order;
                });

                setSelectedTerms(terms);
            }

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
                        so_id: null,
                        date: new Date().toISOString().split('T')[0],
                        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        payment_status: 'unpaid',
                        subtotal: quotation.subtotal,
                        discount: quotation.total_amount ? (quotation.subtotal - quotation.total_amount) : 0,
                        grand_total: quotation.total_amount,
                        subject: quotation.subject,
                    },
                ])
                .select()
                .single();

            if (error || !newInvoice) throw error;

            // Create invoice items
            const invoiceItems = items.map((item) => ({
                invoice_id: newInvoice.id,
                item_code: item.id.substring(0, 5),
                description: item.item_description,
                quantity: item.quantity,
                uom: item.uom,
                unit_price: item.unit_price,
                total_price: item.total_price,
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
                        <p className="text-gray-600 mt-1">{quotation.quote_number}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handlePrint} variant="secondary">
                        <Printer className="w-4 h-4" />
                        Print
                    </Button>
                    <Button onClick={convertToInvoice}>
                        <FileCheck className="w-4 h-4" />
                        Convert to Invoice
                    </Button>
                </div>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                <div className="origin-top scale-90">
                    <QuotationTemplate
                        ref={printRef}
                        quotation={quotation}
                        customer={customer}
                        items={items}
                        company={company}
                        selectedTerms={selectedTerms}
                    />
                </div>
            </div>
        </div>
    );
};
