import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCheck, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Quotation, QuotationItem, Partner, Company, QuotationTerm } from '../types';
import { api } from '../lib/api';
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
            const quotationData = await api.get<any>(`/quotations/${id}`);
            if (!quotationData) throw new Error('Quotation not found');
            setQuotation(quotationData);

            // Fetch customer (partner)
            const customerData = await api.get<any>(`/partners/${quotationData.customer_id}`);
            setCustomer(customerData);

            // Fetch quotation items
            setItems(quotationData.items || []);

            // Fetch Company Info
            try {
                const companies = await api.get<any[]>('/companies');
                if (companies && companies.length > 0) {
                    setCompany(companies[0]);
                }
            } catch (e) {
                console.error('Error fetching company', e);
            }

            // Fetch selected terms
            const selectedTermsData = quotationData.selected_terms || [];
            
            if (selectedTermsData.length > 0) {
                // Fetch master terms to get details
                const masterTerms = await api.get<any[]>('/terms');
                
                if (masterTerms) {
                    const selectedTermIds = selectedTermsData.map((st: any) => st.term_id);
                    const terms = masterTerms.filter(t => selectedTermIds.includes(t.id));

                    // Sort by category and sort_order
                    terms.sort((a, b) => {
                        if (a.category !== b.category) {
                            return a.category.localeCompare(b.category);
                        }
                        return a.sort_order - b.sort_order;
                    });

                    setSelectedTerms(terms);
                }
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
            const newInvoice = await api.post<any>('/invoices', {
                invoice_number: 'INV-' + Date.now(),
                so_id: null,
                date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                payment_status: 'unpaid',
                billing_type: 'itemized',
                invoice_type: 'standard',
                subtotal: quotation.subtotal,
                discount: quotation.total_amount ? (quotation.subtotal - quotation.total_amount) : 0,
                grand_total: quotation.total_amount,
                subject: quotation.subject,
                items: items.map((item) => ({
                    item_code: item.id.substring(0, 5),
                    description: item.item_description,
                    quantity: item.quantity,
                    uom: item.uom,
                    unit_price: item.unit_price,
                    total_price: item.total_price,
                }))
            });

            if (!newInvoice) throw new Error('Failed to create invoice');

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
