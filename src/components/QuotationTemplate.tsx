import { forwardRef } from 'react';
import { CertificationFooter } from './CertificationFooter';
import { Quotation, QuotationItem, Partner, Company, BankAccount } from '../types';

interface QuotationTemplateProps {
    quotation: Quotation;
    customer: Partner;
    items: QuotationItem[];
    company?: Company;
    termsContent?: string;
    bankDetails?: BankAccount;
    customerSnapshot?: { company_name: string; attn_name: string; address: string; phone: string; email: string } | null;
}

// Fallback Bank Details (CNK Bank Details) if none provided
const FALLBACK_BANK = {
    bank_name: 'UOB Serangoon Central',
    bank_address: 'No.23 Serangoon Central, #01-52/53 NEX, Singapore 556083',
    account_number: '123456788',
    swift_code: 'UOVBSGSG',
    branch_code: '65432343',
    paynow_uen: '202244240N'
};

// Parse contacts from JSON or legacy plain string
const parseContacts = (contactStr?: string | null): { name: string; value: string }[] => {
    if (!contactStr) return [];
    try {
        const parsed = JSON.parse(contactStr);
        if (Array.isArray(parsed)) return parsed;
    } catch {
        // Legacy: plain string
    }
    return [{ name: '', value: contactStr }];
};

export const QuotationTemplate = forwardRef<HTMLDivElement, QuotationTemplateProps>(
    ({ quotation, customer, items, company, termsContent = '', bankDetails, customerSnapshot }, ref) => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        };

        const bank = bankDetails || FALLBACK_BANK;
        const contacts = parseContacts(quotation.contact);

        // Use snapshot if available, otherwise use customer master data
        const displayCustomer = customerSnapshot ? {
            ...customer,
            company_name: customerSnapshot.company_name || customer.company_name,
            attn_name: customerSnapshot.attn_name || customer.attn_name,
            address: customerSnapshot.address || customer.address,
            phone: customerSnapshot.phone || customer.phone,
            email: customerSnapshot.email || customer.email,
        } : customer;

        // Parse phone - could be JSON array from multi-phone feature
        const parsePhone = (phone?: string | null): string => {
            if (!phone) return '-';
            try {
                const parsed = JSON.parse(phone);
                if (Array.isArray(parsed)) return parsed.filter(Boolean).join(' / ') || '-';
            } catch { /* plain string */ }
            return phone;
        };

        return (
            <div ref={ref} className="bg-white text-black font-sans mx-auto" style={{ width: '210mm' }}>
                {/* Print-only fixed footer for every page */}
                <CertificationFooter mode="print-fixed" />

                {/* Suppress browser URL/title in print footer */}
                <style>{`
                    @media print {
                        @page { margin: 0; }
                    }
                `}</style>

                {/* ===== PAGE 1 ===== */}
                <div className="p-8 print-page" style={{ width: '210mm', minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
                    <div>
                        {/* Header: Logo and Company Info */}
                        <div className="flex gap-4 mb-4 border-b pb-4 text-md">
                            <div className="w-32 h-32 border border-orange-400 flex items-center justify-center text-gray-400">
                                {company?.logo_url ? (
                                    <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full" />
                                ) : (
                                    <span className="text-xs">Logo</span>
                                )}
                            </div>
                            <div>
                                <p className="font-bold uppercase tracking-wider">{company?.address}</p>
                                <p className="font-bold uppercase tracking-wider">{company?.name || 'Company Name'}</p>
                            </div>
                        </div>

                        {/* Customer Info & Quote Details Row */}
                        <div className="flex justify-between mb-2 text-xs">
                            {/* Customer Block */}
                            <div className="w-1/2">
                                <div className="flex">
                                    <span className="w-24">Customer</span>
                                    <span>:</span>
                                    <div className="ml-2">
                                        <p className="font-bold">{displayCustomer.company_name}</p>
                                        <p>{displayCustomer.address}</p>
                                    </div>
                                </div>
                                <div className="flex mt-2">
                                    <span className="w-24">Attn</span>
                                    <span>:</span>
                                    <span className="ml-2">{displayCustomer.attn_name}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-24">Tel</span>
                                    <span>:</span>
                                    <span className="ml-2">{parsePhone(displayCustomer.phone)}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-24">Email</span>
                                    <span>:</span>
                                    <a href={`mailto:${displayCustomer.email}`} className="ml-2 text-blue-600 underline">{displayCustomer.email}</a>
                                </div>
                            </div>

                            {/* Quote Info Block */}
                            <div className="w-1/2 pl-8">
                                {/* Dynamic Contacts */}
                                {contacts.length > 0 ? (
                                    <div className="flex">
                                        <span className="w-32">Contact</span>
                                        <span>:</span>
                                        <div className="ml-2">
                                            {contacts.map((c, idx) => (
                                                <div key={idx}>{c.value || c.name || '-'}</div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex">
                                        <span className="w-32">Contact</span>
                                        <span>:</span>
                                        <span className="ml-2">{company?.phone || '-'}</span>
                                    </div>
                                )}
                                <div className="flex">
                                    <span className="w-32">RFQ Ref No</span>
                                    <span>:</span>
                                    <span className="ml-2">{quotation.rfq_ref_no || '-'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Quote No</span>
                                    <span>:</span>
                                    <span className="ml-2 font-semibold">{quotation.quote_number}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Quote Date</span>
                                    <span>:</span>
                                    <span className="ml-2">{formatDate(quotation.date)}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-32">Quote Validity</span>
                                    <span>:</span>
                                    <span className="ml-2">{quotation.validity_date ? formatDate(quotation.validity_date) : '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Subject Line */}
                        <div className="flex border-t border-black pt-2 mb-2 text-xs">
                            <span className="w-24">Subject</span>
                            <span>:</span>
                            <span className="ml-2 font-semibold underline">{quotation.subject || 'To Supply Labor and Material...'}</span>
                        </div>

                        <div className="border-t border-black mb-1"></div>

                        {/* Table Header - Matches Image 1 */}
                        <div className="font-semibold mb-1 text-xs">
                            A ) {quotation.subject || 'To Supply Labor and Material...'}
                        </div>

                        <table className="w-full border-collapse border border-black mb-4 text-xs">
                            <thead>
                                <tr className="bg-white">
                                    <th className="border border-black py-0.5 px-1 text-center w-8">No</th>
                                    <th className="border border-black py-0.5 px-1 text-left">Description</th>
                                    <th className="border border-black py-0.5 px-1 text-center w-10">QTY</th>
                                    <th className="border border-black py-0.5 px-1 text-center w-10">UOM</th>
                                    <th className="border border-black py-0.5 px-1 text-right w-16">U/Price</th>
                                    <th className="border border-black py-0.5 px-1 text-right w-16">Bef Disc</th>
                                    <th className="border border-black py-0.5 px-1 text-center w-12">Disc %</th>
                                    <th className="border border-black py-0.5 px-1 text-right w-16">Disc Amt</th>
                                    <th className="border border-black py-0.5 px-1 text-right w-16">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => {
                                    return (
                                        <tr key={item.id}>
                                            <td className="border border-black py-0.5 px-1 text-center">{index + 1}</td>
                                            <td className="border border-black py-0.5 px-1">{item.item_description || 'Item'}</td>
                                            <td className="border border-black py-0.5 px-1 text-center">{item.quantity}</td>
                                            <td className="border border-black py-0.5 px-1 text-center">{item.uom || 'EA'}</td>
                                            <td className="border border-black py-0.5 px-1 text-right">{item.unit_price?.toFixed(2)}</td>
                                            <td className="border border-black py-0.5 px-1 text-right">{(items[index].quantity * items[index].unit_price).toFixed(2)}</td>
                                            <td className="border border-black py-0.5 px-1 text-center">{item.disc_percent || 0}</td>
                                            <td className="border border-black py-0.5 px-1 text-right">{item.disc_amount?.toFixed(2) || '0.00'}</td>
                                            <td className="border border-black py-0.5 px-1 text-right">{item.total_price?.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Budget Summary Footer */}
                        <div className="flex justify-end mt-4 text-xs">
                            <div className="w-2/5 border border-black">
                                <div className="flex justify-center border-b border-black bg-gray-100 py-0.5 px-1 font-semibold text-sm">
                                    Budget Summary
                                </div>
                                <div className="py-0.5 px-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-right flex-1 pr-4">Scope for A</span>
                                        <span className="w-24 text-right border-b border-gray-300">{quotation.subtotal?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-right flex-1 pr-4">Good Will Discount For</span>
                                        <span className="w-24 text-right border-b border-gray-300 pointer-events-none">
                                            {quotation.discount_amount ? `(${quotation.discount_amount.toFixed(2)})` : '0.00'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between font-bold">
                                        <span className="text-right flex-1 pr-4">Total Amount</span>
                                        <span className="w-24 text-right">{quotation.total_amount?.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-4">
                            <div className="text-right">
                                <p className="font-bold text-lg">Total in (SGD) $ {quotation.total_amount?.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="mt-8">
                            <p className="font-bold">* NO GST as {company?.name || 'CNK'} is NOT a GST Registered Company Yet</p>
                        </div>
                    </div>

                    {/* Certification Footer - Page 1 (inline for screen preview) */}
                    <CertificationFooter currentPage={1} totalPages={2} mode="inline" />
                </div>

                {/* ===== PAGE 2 ===== */}
                <div className="p-8 print-page" style={{ width: '210mm', minHeight: '297mm', display: 'flex', flexDirection: 'column', pageBreakBefore: 'always', breakBefore: 'page' }}>
                    <div>
                        {/* Terms & Conditions - Rendered as HTML */}
                        {termsContent && (
                            <div className="text-xs mt-8">
                                <p className="font-bold underline mb-2">Terms & Conditions:</p>
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: termsContent }}
                                />
                            </div>
                        )}

                        {/* Bank Details (Dynamic from DB or fallback) */}
                        <div className="mt-8 text-xs">
                            <p className="font-bold mb-2">{company?.name || 'CNK'} Bank Details</p>
                            <table className="border-collapse border border-black">
                                <tbody>
                                    <tr>
                                        <td className="border border-black py-0.5 px-1 w-48">Bank Name (Final Destination Bank)</td>
                                        <td className="border border-black py-0.5 px-1">{bank.bank_name}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black py-0.5 px-1">Bank Address</td>
                                        <td className="border border-black py-0.5 px-1">{bank.bank_address}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black py-0.5 px-1">Account Number</td>
                                        <td className="border border-black py-0.5 px-1">{bank.account_number}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black py-0.5 px-1">Swift Code (Non-US Bank)</td>
                                        <td className="border border-black py-0.5 px-1">{bank.swift_code}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black py-0.5 px-1">Bank Key/Branch Code</td>
                                        <td className="border border-black py-0.5 px-1">{bank.branch_code}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black py-0.5 px-1">PayNow UEN</td>
                                        <td className="border border-black py-0.5 px-1">{bank.paynow_uen}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Certification Footer - Page 2 (inline for screen preview) */}
                    <CertificationFooter currentPage={2} totalPages={2} mode="inline" />
                </div>
            </div>
        );
    }
);

QuotationTemplate.displayName = 'QuotationTemplate';
