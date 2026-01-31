import { forwardRef } from 'react';
import { DeliveryOrder, DeliveryOrderItem, Partner, Company } from '../lib/supabase';

interface DeliveryOrderTemplateProps {
    doData: DeliveryOrder;
    customer: Partner;
    items: DeliveryOrderItem[];
    company?: Company;
}

export const DeliveryOrderTemplate = forwardRef<HTMLDivElement, DeliveryOrderTemplateProps>(
    ({ doData, customer, items, company }, ref) => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        };

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

                {/* Addresses Row */}
                <div className="flex justify-between mb-6">
                    {/* Billing Address */}
                    <div className="w-1/2 pr-4">
                        <h3 className="font-bold border-b border-black mb-2">BILLING ADDRESS</h3>
                        <p className="font-bold">{customer.company_name}</p>
                        <p>{customer.address}</p>
                        <div className="mt-2">
                            <div className="flex">
                                <span className="w-16 font-semibold">Attn:</span>
                                <span>{customer.attn_name}</span>
                            </div>
                            <div className="flex">
                                <span className="w-16 font-semibold">Tel:</span>
                                <span>{customer.phone}</span>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Address - Specific to DO */}
                    <div className="w-1/2 pl-4 border-l border-gray-300">
                        <h3 className="font-bold border-b border-black mb-2">SHIPPING ADDRESS</h3>
                        {/* Use DO specific shipping address snapshot if available, else Customer Shipping Address */}
                        <p className="whitespace-pre-wrap">{doData.shipping_address_snapshot || customer.shipping_address || customer.address}</p>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <h1 className="text-xl font-bold text-right mb-2">DELIVERY ORDER</h1>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold">DO No:</span>
                                <span>{doData.do_number}</span>
                            </div>
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold">Date:</span>
                                <span>{formatDate(doData.date)}</span>
                            </div>
                            {/* Terms/Subject from DO */}
                            <div className="flex justify-between mb-1">
                                <span className="font-semibold">Subject:</span>
                                <span>{doData.subject}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-black mb-4"></div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black text-xs mb-8">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-1 text-center w-12">No</th>
                            <th className="border border-black p-1 text-left">Description</th>
                            <th className="border border-black p-1 text-center w-16">Qty</th>
                            <th className="border border-black p-1 text-center w-16">UOM</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id}>
                                <td className="border border-black p-1 text-center">{index + 1}</td>
                                <td className="border border-black p-1">
                                    <span className="font-semibold">{item.item_code}</span> {item.description && `- ${item.description}`}
                                </td>
                                <td className="border border-black p-1 text-center">{item.quantity}</td>
                                <td className="border border-black p-1 text-center">{item.uom}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer Signatures */}
                <div className="mt-12 flex justify-between items-end">
                    <div className="text-center">
                        <p className="mb-8">Received By:</p>
                        <div className="h-0 border-b border-black w-48 mb-2"></div>
                        <p className="font-semibold">Customer Signature & Stamp</p>
                    </div>
                    <div className="text-center">
                        <p className="mb-8">Authorized By:</p>
                        <div className="h-0 border-b border-black w-48 mb-2"></div>
                        <p className="font-semibold">Company Stamp & Signature</p>
                    </div>
                </div>
            </div>
        );
    }
);

DeliveryOrderTemplate.displayName = 'DeliveryOrderTemplate';
