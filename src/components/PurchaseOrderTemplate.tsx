import { forwardRef } from 'react';
import { PurchaseOrder, PurchaseOrderItem, Partner, Company } from '../lib/supabase';

interface PurchaseOrderTemplateProps {
    po: PurchaseOrder;
    vendor: Partner;
    items: PurchaseOrderItem[];
    company?: Company;
}

interface GroupedItem {
    groupName: string;
    items: PurchaseOrderItem[];
    subtotal: number;
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

        // Parse subject from notes
        const getSubject = () => {
            if (!po.notes) return '';
            const match = po.notes.match(/Subject:\s*([^\n]+)/);
            return match ? match[1].trim() : '';
        };

        // Parse doc address from notes
        const getDocAddress = () => {
            if (!po.notes) return '';
            const match = po.notes.match(/DocAddress:\s*([^\n]+)/);
            return match ? match[1].trim() : '';
        };

        // Parse PO terms from notes or default
        const getPoTerms = () => {
            return 'Refer to Payment Below';
        };

        // Group items by group name (parsed from description "[GroupName] ...")
        const groupItems = (): GroupedItem[] => {
            const groupMap: Record<string, PurchaseOrderItem[]> = { 'Default': [] };

            items.forEach(item => {
                const match = item.description?.match(/^\[([^\]]+)\]\s*/);
                let groupName = 'Default';

                if (match) {
                    groupName = match[1];
                }

                if (!groupMap[groupName]) groupMap[groupName] = [];
                groupMap[groupName].push(item);
            });

            return Object.entries(groupMap)
                .filter(([_, items]) => items.length > 0)
                .map(([name, items]) => ({
                    groupName: name,
                    items,
                    subtotal: items.reduce((sum, i) => sum + (i.total || 0), 0)
                }));
        };

        // Clean description (remove group prefix)
        const cleanDescription = (desc: string) => {
            if (!desc) return '';
            return desc.replace(/^\[([^\]]+)\]\s*/, '');
        };

        const groupedItems = groupItems();
        const subtotal = po.subtotal || items.reduce((acc, i) => acc + (i.total || 0), 0);
        const gstRate = po.tax && subtotal ? Math.round((po.tax / subtotal) * 100) : 9;
        const gst = po.tax || (subtotal * gstRate / 100);
        const total = po.total || (subtotal + gst);
        const subject = getSubject();
        const docAddress = getDocAddress();

        return (
            <div ref={ref} className="p-8 bg-white text-black font-sans text-sm mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4">
                        <div className="w-24 h-24 border-2 border-cyan-500 flex items-center justify-center text-gray-400">
                            {company?.logo_url ? (
                                <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full" />
                            ) : (
                                <span className="text-xs">Logo</span>
                            )}
                        </div>
                        <div className="text-xs">
                            <p className="font-bold text-sm">{company?.address?.split('\n')[0] || '60 PAYA LEBAR ROAD'}</p>
                            <p className="whitespace-pre-line">{company?.address?.split('\n').slice(1).join('\n') || '#08-45A PAYA LEBAR\nSQUARE Singapore\n409051'}</p>
                            {company?.uen_number && <p className="mt-1">Co. UEN: {company.uen_number}</p>}
                        </div>
                    </div>

                    <div className="text-right">
                        <h1 className="text-3xl font-bold mb-3" style={{ color: '#00A86B' }}>PURCHASE ORDER</h1>
                        <table className="text-xs border-collapse ml-auto">
                            <tbody>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 px-2 py-1 bg-gray-100">PO Number</td>
                                    <td className="text-left border border-gray-400 px-2 py-1">{po.po_number}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 px-2 py-1 bg-gray-100">PO Date</td>
                                    <td className="text-left border border-gray-400 px-2 py-1">{formatDate(po.date)}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 px-2 py-1 bg-gray-100">PO Terms</td>
                                    <td className="text-left border border-gray-400 px-2 py-1">{getPoTerms()}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 px-2 py-1 bg-gray-100">Quote Ref</td>
                                    <td className="text-left border border-gray-400 px-2 py-1">{po.quote_ref || '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Vendor & Shipping Info */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">VENDOR</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-24">
                            <p className="font-bold">{vendor.company_name}</p>
                            <p className="whitespace-pre-line">{vendor.address}</p>
                            {vendor.attn_name && <p>Attn: {vendor.attn_name}</p>}
                            {vendor.phone && <p>Tel: {vendor.phone}</p>}
                        </div>
                    </div>

                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">SHIPPING INFO</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-24 whitespace-pre-line">
                            {po.shipping_info || 'Ship Via: FCA – To Working Site.\nIncoterm: DAP'}
                        </div>
                    </div>
                </div>

                {/* Address Sections */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">BILL AND SHIP TO DOCUMENTATION ADDRESS</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-28 whitespace-pre-line">
                            {docAddress || `To: Finance\n${company?.address || '60 Paya Lebar Road\n#08-45A Paya Lebar Square\nSingapore 409051'}`}
                        </div>
                    </div>
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">WORKING SITE AND EQUIPMENT DELIVERY ADDRESS</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-28 whitespace-pre-line">
                            {po.delivery_address || 'To follow instruction'}
                        </div>
                    </div>
                </div>

                {/* Subject */}
                {subject && (
                    <div className="mb-2 text-xs">
                        <span className="font-bold">Subject:</span> <span className="uppercase">{subject}</span>
                    </div>
                )}

                {/* Items Table */}
                <table className="w-full border-collapse border border-black mb-4 text-xs">
                    <thead>
                        <tr className="bg-cyan-500 text-white">
                            <th className="border border-black p-1 text-center w-8">No</th>
                            <th className="border border-black p-1 text-left w-24">Item Code</th>
                            <th className="border border-black p-1 text-left">Description</th>
                            <th className="border border-black p-1 text-center w-14">QTY</th>
                            <th className="border border-black p-1 text-center w-20">Unit Price<br />(SGD)</th>
                            <th className="border border-black p-1 text-center w-20">Total (SGD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedItems.map((group, gIdx) => (
                            <>
                                {/* Group Header */}
                                {group.groupName !== 'Default' && (
                                    <tr key={`header-${gIdx}`} className="bg-gray-100">
                                        <td className="border border-black p-1 text-center font-bold">{String.fromCharCode(65 + gIdx)}</td>
                                        <td colSpan={5} className="border border-black p-1 font-bold">{group.groupName}</td>
                                    </tr>
                                )}
                                {/* Group Items */}
                                {group.items.map((item, iIdx) => (
                                    <tr key={item.id || `item-${gIdx}-${iIdx}`}>
                                        <td className="border border-black p-1 text-center">
                                            {group.groupName !== 'Default' ? iIdx + 1 : iIdx + 1}
                                        </td>
                                        <td className="border border-black p-1">{item.item_code}</td>
                                        <td className="border border-black p-1">{cleanDescription(item.description || '')}</td>
                                        <td className="border border-black p-1 text-center">{item.quantity}</td>
                                        <td className="border border-black p-1 text-right">{(item.unit_price || 0).toFixed(2)}</td>
                                        <td className="border border-black p-1 text-right">{(item.total || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </>
                        ))}
                    </tbody>
                </table>

                {/* Total Summary */}
                <div className="flex justify-center mb-4">
                    <div>
                        <h3 className="text-center font-bold text-sm mb-2">Total Summary</h3>
                        <table className="border-collapse text-xs">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-black px-3 py-1 text-center">No</th>
                                    <th className="border border-black px-3 py-1 text-left">Description</th>
                                    <th className="border border-black px-3 py-1 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedItems.filter(g => g.groupName !== 'Default').map((g, idx) => (
                                    <tr key={g.groupName}>
                                        <td className="border border-black px-3 py-1 text-center">{idx + 1}</td>
                                        <td className="border border-black px-3 py-1">{g.groupName}</td>
                                        <td className="border border-black px-3 py-1 text-right">{g.subtotal.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {groupedItems.filter(g => g.groupName === 'Default').length > 0 && (
                                    <tr>
                                        <td className="border border-black px-3 py-1 text-center">{groupedItems.filter(g => g.groupName !== 'Default').length + 1}</td>
                                        <td className="border border-black px-3 py-1">Other Items</td>
                                        <td className="border border-black px-3 py-1 text-right">
                                            {groupedItems.find(g => g.groupName === 'Default')?.subtotal.toFixed(2)}
                                        </td>
                                    </tr>
                                )}
                                <tr className="font-bold">
                                    <td className="border border-black px-3 py-1" colSpan={2}>Total (SGD) Before Tax</td>
                                    <td className="border border-black px-3 py-1 text-right">{subtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black px-3 py-1" colSpan={2}>GST {gstRate}%</td>
                                    <td className="border border-black px-3 py-1 text-right">{gst.toFixed(2)}</td>
                                </tr>
                                <tr className="font-bold bg-gray-100">
                                    <td className="border border-black px-3 py-1" colSpan={2}>Total After Tax</td>
                                    <td className="border border-black px-3 py-1 text-right">{total.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className="mt-6 text-xs text-gray-600 border-t pt-2">
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
