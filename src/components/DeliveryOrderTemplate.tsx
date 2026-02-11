import { forwardRef } from 'react';
import { DeliveryOrder, DeliveryOrderItem, Partner, Company } from '../lib/supabase';

interface DeliveryOrderTemplateProps {
    doData: DeliveryOrder;
    customer: Partner;
    items: DeliveryOrderItem[];
    company?: Company;
    customerPO?: string | null;
    quoteRef?: string | null;
}

export const DeliveryOrderTemplate = forwardRef<HTMLDivElement, DeliveryOrderTemplateProps>(
    ({ doData, customer, items, company, customerPO, quoteRef }, ref) => {
        // Extract ordinal suffix for DO date
        const getOrdinalSuffix = (day: number) => {
            if (day > 3 && day < 21) return 'th';
            switch (day % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };

        const formatDateWithOrdinal = (dateString: string | null) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            const day = date.getDate();
            const month = date.toLocaleDateString('en-GB', { month: 'long' });
            const year = date.getFullYear();
            return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
        };

        return (
            <div ref={ref} className="p-8 bg-white text-black font-sans text-sm h-full mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                {/* Header: Logo + Address (Left) | DO Info Table (Right) */}
                <div className="flex justify-between mb-6">
                    {/* Left: Logo + Company Address */}
                    <div className="flex gap-4">
                        <div className="w-28 h-28 border-2 border-black flex items-center justify-center">
                            {company?.logo_url ? (
                                <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full" />
                            ) : (
                                <span className="text-xs text-gray-400">Logo</span>
                            )}
                        </div>
                        <div className="text-xs leading-relaxed">
                            <div>60 PAYA LEBAR ROAD</div>
                            <div>#08-45A PAYA LEBAR</div>
                            <div>SQUARE Singapore</div>
                            <div>409051</div>
                            <div>Co. UEN: 202244240N</div>
                        </div>
                    </div>

                    {/* Right: DO Info Table */}
                    <div className="text-right">
                        <h1 className="text-2xl font-bold mb-3">DELIVERY ORDER</h1>
                        <table className="border-collapse ml-auto text-xs">
                            <tbody>
                                <tr>
                                    <th className="border border-black px-1 py-0.5 bg-gray-100 text-left whitespace-nowrap">DO Number</th>
                                    <td className="border border-black px-1 py-0.5">{doData.do_number || '-'}</td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-1 py-0.5 bg-gray-100 text-left whitespace-nowrap">DO Date</th>
                                    <td className="border border-black px-1 py-0.5">{formatDateWithOrdinal(doData.date)}</td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-1 py-0.5 bg-gray-100 text-left whitespace-nowrap">DO Terms</th>
                                    <td className="border border-black px-1 py-0.5">{doData.terms || 'On-Site Delivery'}</td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-1 py-0.5 bg-gray-100 text-left whitespace-nowrap">Customer PO</th>
                                    <td className="border border-black px-1 py-0.5">{customerPO || '-'}</td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-1 py-0.5 bg-gray-100 text-left whitespace-nowrap">Quote Ref</th>
                                    <td className="border border-black px-1 py-0.5">{quoteRef || '-'}</td>
                                </tr>
                                <tr>
                                    <th className="border border-black px-1 py-0.5 bg-gray-100 text-left whitespace-nowrap">Requestor</th>
                                    <td className="border border-black px-1 py-0.5">{doData.requestor_name || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Addresses Row: Billing = Shipping (Same Content) */}
                <div className="flex gap-4 mb-3">
                    {/* Billing Address */}
                    <div className="flex-1 border border-black">
                        <div className="bg-cyan-500 text-white font-bold px-3 py-2 text-center">
                            BILLING ADDRESS
                        </div>
                        <div className="p-3 text-xs leading-relaxed">
                            <div>To: {customer.attn_name || 'Contact Person Name'}</div>
                            <div className="font-bold">{customer.company_name || 'Company Name'}</div>
                            <div>{customer.address || 'Address Line'}</div>
                            <div>Tel {customer.phone || '-'}</div>
                            <div>Email: {customer.email || '-'}</div>
                        </div>
                    </div>

                    {/* Shipping Address (Same as Billing) */}
                    <div className="flex-1 border border-black ">
                        <div className="bg-cyan-500 text-white font-bold px-3 py-2 text-center">
                            SHIPPING ADDRESS
                        </div>
                        <div className="p-3 text-xs leading-relaxed">
                            <div>To: {customer.attn_name || 'Contact Person Name'}</div>
                            <div className="font-bold">{customer.company_name || 'Company Name'}</div>
                            <div>{customer.address || 'Address Line'}</div>
                            <div>Tel {customer.phone || '-'}</div>
                            <div>Email: {customer.email || '-'}</div>
                        </div>
                    </div>
                </div>

                {/* Subject Section */}
                {doData.subject && (
                    <div className="mb-3">
                        <strong className="font-bold text-xs">Subject:</strong> <span>{doData.subject}</span>
                    </div>
                )}

                {/* Items Table */}
                <table className="w-full border-collapse border border-black text-xs mb-8 ">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black py-0.5 px-1 text-center w-12">No</th>
                            <th className="border border-black py-0.5 px-1 text-left w-32">Items</th>
                            <th className="border border-black py-0.5 px-1 text-left">Description</th>
                            <th className="border border-black py-0.5 px-1 text-center w-16">QTY</th>
                            <th className="border border-black py-0.5 px-1 text-center w-16">UOM</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(() => {
                            // Group items by group_name
                            const grouped = items.reduce((acc, item) => {
                                const groupKey = item.group_name || item.item_code || '__ungrouped__';
                                if (!acc[groupKey]) acc[groupKey] = [];
                                acc[groupKey].push(item);
                                return acc;
                            }, {} as Record<string, DeliveryOrderItem[]>);

                            let counter = 1;
                            const rows: JSX.Element[] = [];

                            // Render all groups with rowspan for Items column
                            Object.entries(grouped).forEach(([groupName, groupItems]) => {
                                groupItems.forEach((item, idx) => {
                                    rows.push(
                                        <tr key={item.id}>
                                            <td className="border border-black py-0.5 px-1 text-center">{counter++}</td>
                                            {/* Items column with rowspan on first row only */}
                                            {idx === 0 && (
                                                <td
                                                    className="border border-black py-0.5 px-1 text-center"
                                                    rowSpan={groupItems.length}
                                                >
                                                    {groupName !== '__ungrouped__' ? groupName : ''}
                                                </td>
                                            )}
                                            <td className="border border-black py-0.5 px-1">{item.description}</td>
                                            <td className="border border-black py-0.5 px-1 text-center">{item.quantity}</td>
                                            <td className="border border-black py-0.5 px-1 text-center">{item.uom}</td>
                                        </tr>
                                    );
                                });
                            });

                            return rows;
                        })()}
                    </tbody>
                </table>

                {/* Footer Signatures */}
                <div className="mt-12 flex justify-between items-end">
                    <div className="text-center">
                        <p className="mb-20">Received By:</p>
                        <div className="h-0 border-b border-black w-48 mb-2"></div>
                        <p className="font-semibold">Customer Signature & Stamp</p>
                    </div>
                    <div className="text-center">
                        <p className="mb-20">Authorized By:</p>
                        <div className="h-0 border-b border-black w-48 mb-2"></div>
                        <p className="font-semibold">Company Stamp & Signature</p>
                    </div>
                </div>
            </div>
        );
    }
);

DeliveryOrderTemplate.displayName = 'DeliveryOrderTemplate';
