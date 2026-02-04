import { forwardRef } from 'react';
import { Quotation, QuotationItem, Partner, Company } from '../lib/supabase';

interface QuotationTemplateProps {
    quotation: Quotation;
    customer: Partner;
    items: QuotationItem[];
    company?: Company;
}

export const QuotationTemplate = forwardRef<HTMLDivElement, QuotationTemplateProps>(
    ({ quotation, customer, items, company }, ref) => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        };

        // If items are not yet migrated to new structure, use fallbacks
        // New structure: item_description, unit_price, disc_percent, disc_amount, total_price

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
                                {/* City/Zip if needed */}
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
                            <span className="ml-2">{company?.phone || '085272124268'}</span>
                        </div>
                        <div className="flex">
                            <span className="w-32">RFQ Ref No</span>
                            <span>:</span>
                            <span className="ml-2">{'RFQ - 55777'}</span>
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
                            // const befDisc = (item.unit_price * item.quantity); 
                            // Image 1: U/Price 10.00, Bef Disc 20.00 (Qty 2). So Bef Disc = Qty * Unit Price.
                            return (
                                <tr key={item.id}>
                                    <td className="border border-black p-1 text-center">{index + 1}</td>
                                    <td className="border border-black p-1">{item.item_description || 'Item'}</td>
                                    <td className="border border-black p-1 text-center">{item.quantity}</td>
                                    <td className="border border-black p-1 text-center">{item.uom || 'EA'}</td>
                                    <td className="border border-black p-1 text-right">{item.unit_price?.toFixed(2)}</td>
                                    <td className="border border-black p-1 text-right">{items[index].quantity * items[index].unit_price}</td>
                                    {/* Note: In Image 1, Bef Disc is 20.00 for 2 * 10.00. */}
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
            </div>
        );
    }
);

QuotationTemplate.displayName = 'QuotationTemplate';
