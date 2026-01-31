import { forwardRef } from 'react';
import { SalesOrder, SalesOrderItem, Partner, Company } from '../lib/supabase';

interface SalesOrderTemplateProps {
    so: SalesOrder;
    customer: Partner;
    items: SalesOrderItem[];
    company?: Company;
}

export const SalesOrderTemplate = forwardRef<HTMLDivElement, SalesOrderTemplateProps>(
    ({ so, customer, items, company }, ref) => {
        const formatDate = (dateString: string | null) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        };

        // Group items by phase
        const itemsByPhase = items.reduce((acc, item) => {
            const phase = item.phase_name || 'Unspecified Phase';
            if (!acc[phase]) acc[phase] = [];
            acc[phase].push(item);
            return acc;
        }, {} as Record<string, SalesOrderItem[]>);

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

                {/* Customer Info & SO Details Row */}
                <div className="flex justify-between mb-6">
                    {/* Customer Block */}
                    <div className="w-1/2">
                        <div className="flex mb-1">
                            <span className="w-24 font-semibold">Customer:</span>
                            <div className="flex-1">
                                <p className="font-bold">{customer.company_name}</p>
                                <p>{customer.address}</p>
                            </div>
                        </div>
                        <div className="flex mb-1">
                            <span className="w-24 font-semibold">Attn:</span>
                            <span>{customer.attn_name}</span>
                        </div>
                        <div className="flex mb-1">
                            <span className="w-24 font-semibold">Tel:</span>
                            <span>{customer.phone}</span>
                        </div>
                        <div className="flex mb-1">
                            <span className="w-24 font-semibold">Email:</span>
                            <span className="text-blue-600 underline">{customer.email}</span>
                        </div>
                    </div>

                    {/* SO Info Block */}
                    <div className="w-1/2 pl-8">
                        <h1 className="text-xl font-bold mb-4 text-right">SALES ORDER</h1>
                        <div className="flex justify-between mb-1">
                            <span className="font-semibold">SO No:</span>
                            <span>{so.so_number}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span className="font-semibold">Date:</span>
                            {/* SO Date is missing in schema? Using created_at or schedule? Schema sales_orders has no `date` column! */}
                            {/* Wait, check schema. `sales_orders`: id, so_number, quotation_id, customer_po_number, project_schedule_date, status. */}
                            {/* It SHOULD have a creation date or `created_at`. Supabase adds `created_at`. */}
                            {/* I will use `project_schedule_date` as main date or fallback to `today` if not available in prop type? */}
                            {/* Type definition has NO `created_at` in `SalesOrder` interface in `lib/supabase.ts`. */}
                            {/* I should use `project_schedule_date` as "Project Date". */}
                            <span>{formatDate(so.project_schedule_date)}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span className="font-semibold">Customer PO Ref:</span>
                            <span>{so.customer_po_number}</span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-black mb-4"></div>

                {/* Items Grouped by Phase */}
                <div className="space-y-6">
                    {Object.entries(itemsByPhase).map(([phase, phaseItems]) => (
                        <div key={phase}>
                            <h3 className="font-bold mb-2 underline">{phase}</h3>
                            <table className="w-full border-collapse border border-black text-xs">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1 text-center w-12">No</th>
                                        <th className="border border-black p-1 text-left">Description</th>
                                        <th className="border border-black p-1 text-center w-16">Qty</th>
                                        <th className="border border-black p-1 text-center w-16">UOM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {phaseItems.map((item, index) => (
                                        <tr key={item.id}>
                                            <td className="border border-black p-1 text-center">{index + 1}</td>
                                            <td className="border border-black p-1">{item.description}</td>
                                            <td className="border border-black p-1 text-center">{item.quantity}</td>
                                            <td className="border border-black p-1 text-center">{item.uom}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* Footer / Notes */}
                <div className="mt-8 border-t pt-4">
                    <div className="flex justify-between items-end">
                        <div className="text-xs">
                            <p className="font-bold mb-2">Terms & Conditions:</p>
                            <p>1. Delivery: On-Site Delivery</p>
                            <p>2. Payment: As per Invoice Terms</p>
                        </div>
                        <div className="text-center">
                            <div className="h-16 border-b border-black w-48 mb-2"></div>
                            <p className="font-semibold">Authorized Signature</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);

SalesOrderTemplate.displayName = 'SalesOrderTemplate';
