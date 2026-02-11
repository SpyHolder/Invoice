import { forwardRef } from 'react';
import { Quotation, QuotationItem, Partner, Company, QuotationTerm, TERM_CATEGORIES, TermCategory } from '../lib/supabase';

interface QuotationTemplateProps {
    quotation: Quotation;
    customer: Partner;
    items: QuotationItem[];
    company?: Company;
    selectedTerms?: QuotationTerm[];
}

// Static Bank Details (CNK Bank Details)
const BANK_DETAILS = {
    bankName: 'UOB Serangoon Central',
    bankAddress: 'No.23 Serangoon Central, #01-52/53 NEX, Singapore 556083',
    accountNumber: '123456788',
    swiftCode: 'UOVBSGSG',
    branchCode: '65432343',
    paynowUen: '202244240N'
};

export const QuotationTemplate = forwardRef<HTMLDivElement, QuotationTemplateProps>(
    ({ quotation, customer, items, company, selectedTerms = [] }, ref) => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        };

        // Group selected terms by category
        const termsByCategory = TERM_CATEGORIES.reduce((acc, category) => {
            acc[category] = selectedTerms.filter(t => t.category === category);
            return acc;
        }, {} as Record<TermCategory, QuotationTerm[]>);

        return (
            <div ref={ref} className="p-8 bg-white text-black font-sans text-sm h-full mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                {/* Header: Logo and Company Info */}
                <div className="flex gap-4 mb-4 border-b pb-4">
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
                <div className="flex justify-between mb-2">
                    {/* Customer Block */}
                    <div className="w-1/2">
                        <div className="flex">
                            <span className="w-24">Customer</span>
                            <span>:</span>
                            <div className="ml-2">
                                <p className="font-bold">{customer.company_name}</p>
                                <p>{customer.address}</p>
                            </div>
                        </div>
                        <div className="flex mt-2">
                            <span className="w-24">Attn</span>
                            <span>:</span>
                            <span className="ml-2">{customer.attn_name}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24">Tel</span>
                            <span>:</span>
                            <span className="ml-2">{customer.phone}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24">Email</span>
                            <span>:</span>
                            <a href={`mailto:${customer.email}`} className="ml-2 text-blue-600 underline">{customer.email}</a>
                        </div>
                    </div>

                    {/* Quote Info Block */}
                    <div className="w-1/2 pl-8">
                        <div className="flex">
                            <span className="w-32">Contact</span>
                            <span>:</span>
                            <span className="ml-2">{quotation.contact || company?.phone || '-'}</span>
                        </div>
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
                <div className="flex border-t border-black pt-2 mb-2">
                    <span className="w-24">Subject</span>
                    <span>:</span>
                    <span className="ml-2 font-semibold underline">{quotation.subject || 'To Supply Labor and Material...'}</span>
                </div>

                <div className="border-t border-black mb-1"></div>

                {/* Table Header - Matches Image 1 */}
                <div className="font-semibold mb-1">
                    A ) {quotation.subject || 'To Supply Labor and Material...'}
                </div>

                <table className="w-full border-collapse border border-black mb-4 text-xs">
                    <thead>
                        <tr className="bg-white">
                            <th className="border border-black p-1 text-center w-8">No</th>
                            <th className="border border-black p-1 text-left">Description</th>
                            <th className="border border-black p-1 text-center w-10">QTY</th>
                            <th className="border border-black p-1 text-center w-10">UOM</th>
                            <th className="border border-black p-1 text-right w-16">U/Price</th>
                            <th className="border border-black p-1 text-right w-16">Bef Disc</th>
                            <th className="border border-black p-1 text-center w-12">Disc %</th>
                            <th className="border border-black p-1 text-right w-16">Disc Amt</th>
                            <th className="border border-black p-1 text-right w-16">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            return (
                                <tr key={item.id}>
                                    <td className="border border-black p-1 text-center">{index + 1}</td>
                                    <td className="border border-black p-1">{item.item_description || 'Item'}</td>
                                    <td className="border border-black p-1 text-center">{item.quantity}</td>
                                    <td className="border border-black p-1 text-center">{item.uom || 'EA'}</td>
                                    <td className="border border-black p-1 text-right">{item.unit_price?.toFixed(2)}</td>
                                    <td className="border border-black p-1 text-right">{(items[index].quantity * items[index].unit_price).toFixed(2)}</td>
                                    <td className="border border-black p-1 text-center">{item.disc_percent || 0}</td>
                                    <td className="border border-black p-1 text-right">{item.disc_amount?.toFixed(2) || '0.00'}</td>
                                    <td className="border border-black p-1 text-right">{item.total_price?.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Budget Summary Footer */}
                <div className="flex justify-end mt-4">
                    <div className="w-1/2 border border-black">
                        <div className="flex justify-center border-b border-black bg-gray-100 p-1 font-semibold text-sm">
                            Budget Summary
                        </div>
                        <div className="p-1">
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

                {/* Page Break - Terms & Conditions always on new page */}
                <div className="break-before-page" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}></div>

                {/* Terms & Conditions by Category - Page 2 */}
                {selectedTerms.length > 0 && (
                    <div className="text-xs mt-8">
                        {/* Remarks */}
                        {termsByCategory['Remarks']?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold underline mb-1">Remarks:</p>
                                <ul className="list-none space-y-1">
                                    {termsByCategory['Remarks'].map((term) => (
                                        <li key={term.id} className="flex">
                                            <span className="mr-2">*</span>
                                            <span>{term.title ? `${term.title}: ` : ''}{term.content}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Warranty */}
                        {termsByCategory['Warranty']?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold underline mb-1">WARRANTY:</p>
                                <ul className="list-none space-y-1">
                                    {termsByCategory['Warranty'].map((term) => (
                                        <li key={term.id} className="flex">
                                            <span className="mr-2">*</span>
                                            <div>
                                                {term.title && <span className="font-semibold">{term.title}</span>}
                                                <span className="whitespace-pre-wrap">{term.title ? '\n' : ''}{term.content}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Cancellation */}
                        {termsByCategory['Cancellation']?.length > 0 && (
                            <div className="mb-4">
                                <p className="font-bold underline mb-1">CANCELLATION:</p>
                                <ul className="list-none space-y-1">
                                    {termsByCategory['Cancellation'].map((term) => (
                                        <li key={term.id} className="flex">
                                            <span className="mr-2">*</span>
                                            <span>{term.content}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Payment Plan */}
                        {termsByCategory['Payment Plan']?.length > 0 && (
                            <div className="mb-4">
                                {termsByCategory['Payment Plan'].map((term) => (
                                    <div key={term.id}>
                                        {term.title && <p className="font-bold underline italic mb-1">{term.title}</p>}
                                        <ul className="list-none space-y-0.5 ml-4">
                                            {term.content.split('\n').map((line, i) => (
                                                <li key={i} className="flex">
                                                    <span className="mr-2">-</span>
                                                    <span className="underline italic">{line}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* General Terms */}
                        {termsByCategory['General Terms']?.length > 0 && (
                            <div className="mb-4">
                                <ul className="list-none space-y-1">
                                    {termsByCategory['General Terms'].map((term) => (
                                        <li key={term.id} className="flex">
                                            <span className="mr-2">*</span>
                                            <span>{term.content}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* CNK Bank Details (Static) */}
                <div className="mt-8 text-xs">
                    <p className="font-bold mb-2">CNK Bank Details</p>
                    <table className="border-collapse border border-black">
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 w-48">Bank Name (Final Destination Bank)</td>
                                <td className="border border-black p-1">{BANK_DETAILS.bankName}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1">Bank Address</td>
                                <td className="border border-black p-1">{BANK_DETAILS.bankAddress}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1">Account Number</td>
                                <td className="border border-black p-1">{BANK_DETAILS.accountNumber}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1">Swift Code (Non-US Bank)</td>
                                <td className="border border-black p-1">{BANK_DETAILS.swiftCode}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1">Bank Key/Branch Code</td>
                                <td className="border border-black p-1">{BANK_DETAILS.branchCode}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1">PayNow UEN</td>
                                <td className="border border-black p-1">{BANK_DETAILS.paynowUen}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
);

QuotationTemplate.displayName = 'QuotationTemplate';
