import { forwardRef } from 'react';
import { PurchaseOrder, PurchaseOrderItem, Partner, Company } from '../lib/supabase';

interface PurchaseOrderTemplateProps {
    po: PurchaseOrder;
    vendor: Partner;
    items: PurchaseOrderItem[];
    company?: Company;
}

export const PurchaseOrderTemplate = forwardRef<HTMLDivElement, PurchaseOrderTemplateProps>(
    ({ po, vendor, items, company }, ref) => {
        const formatDate = (dateString: string | null) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        };

        return (
            <div ref={ref} className="p-8 bg-white text-black font-sans text-sm mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4">
                        <div className="w-32 h-32 border border-green-500 flex items-center justify-center text-gray-400">
                            {company?.logo_url ? (
                                <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full" />
                            ) : (
                                <span>Logo</span>
                            )}
                        </div>
                        <div className="text-sm">
                            <h2 className="font-bold text-lg uppercase">{company?.name || 'Company Name'}</h2>
                            <p className="whitespace-pre-line">{company?.address}</p>
                            {company?.uen_number && <p>Co. UEN: {company.uen_number}</p>}
                        </div>
                    </div>

                    <div className="text-right">
                        <h1 className="text-4xl font-bold mb-4">PURCHASE ORDER</h1>
                        <table className="text-sm border-collapse inline-table">
                            <tbody>
                                <tr>
                                    <td className="font-semibold text-left pr-4">PO No.</td>
                                    <td className="text-left">{po.po_number}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Date</td>
                                    <td className="text-left">{formatDate(po.date)}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Vendor Quote Ref</td>
                                    <td className="text-left">{po.quote_ref || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Vendor & Shipping Address */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 mb-2 text-center uppercase">Vendor</div>
                        <div className="border border-black p-2 h-32">
                            <p className="font-bold">{vendor.company_name}</p>
                            <p>Attn: {vendor.attn_name || 'Sales Department'}</p>
                            <p className="whitespace-pre-line">{vendor.address}</p>
                            <p>{vendor.phone} {vendor.email ? ` | ${vendor.email}` : ''}</p>
                        </div>
                    </div>

                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 mb-2 text-center uppercase">Working Site Address / Shipping Info</div>
                        <div className="border border-black p-2 h-32">
                            <p className="whitespace-pre-line">{po.delivery_address || 'To follow instruction'}</p>
                            {po.shipping_info && (
                                <div className="mt-2 border-t border-gray-300 pt-1">
                                    <span className="font-bold">Shipping Info: </span>
                                    <span>{po.shipping_info}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border border-black mb-4">
                    <thead>
                        <tr className="bg-white border-b border-black">
                            <th className="border-r border-black p-1 text-center w-10">No</th>
                            <th className="border-r border-black p-1 text-left w-32">Item Code</th>
                            <th className="border-r border-black p-1 text-left">Description</th>
                            <th className="border-r border-black p-1 text-center w-12">QTY</th>
                            <th className="border-r border-black p-1 text-center w-24">Unit Price</th>
                            <th className="p-1 text-center w-24">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-b border-black">
                                <td className="border-r border-black p-1 text-center">{index + 1}</td>
                                <td className="border-r border-black p-1">{item.item_code}</td>
                                <td className="border-r border-black p-1">{item.description}</td>
                                <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                                <td className="border-r border-black p-1 text-right">{item.unit_price.toFixed(2)}</td>
                                <td className="p-1 text-right">{item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer Totals (Optional for PO based on design, often just Total) */}
                {/* Assuming PO just needs Grand Total */}
                {/* But let's check schema: PurchaseOrder has 'total'. Doesn't seem to have subtotal/tax broken out in schema? */}
                {/* Step 94 log for PurchaseOrder doesn't show tax fields. */}
                {/* So just show Total. */}
                <div className="flex justify-end mb-4">
                    <div className="w-1/3 border border-black flex justify-between p-2 font-bold text-lg">
                        <span>Total</span>
                        <span>{po.status === 'confirmed' || items.length > 0 ? items.reduce((acc, i) => acc + i.total, 0).toFixed(2) : '0.00'}</span>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className="mt-8 text-xs text-gray-500 border-t pt-2">
                    <p className="font-bold mb-1">Terms & Conditions:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                        <li>Please acknowledge receipt of this PO.</li>
                        <li>Delivery must be made to the specified address.</li>
                        <li>Invoices must quote the PO Number.</li>
                    </ol>
                </div>
            </div>
        );
    }
);

PurchaseOrderTemplate.displayName = 'PurchaseOrderTemplate';
