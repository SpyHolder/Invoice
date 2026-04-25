import { forwardRef } from 'react';
import { PurchaseOrder, PurchaseOrderItem, Partner, Company } from '../types';

interface PurchaseOrderTemplateProps {
    po: PurchaseOrder;
    vendor: Partner;
    items: PurchaseOrderItem[];
    company?: Company;
    termsContent?: string;
}

interface GroupedItem {
    groupName: string;
    items: PurchaseOrderItem[];
    subtotal: number;
}

export const PurchaseOrderTemplate = forwardRef<HTMLDivElement, PurchaseOrderTemplateProps>(
    ({ po, vendor, items, company, termsContent = '' }, ref) => {
        const formatDate = (dateString: string | null) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleDateString('en-GB', {
                year: 'numeric', month: 'long', day: 'numeric',
            });
        };

        // Parse subject from notes
        const getSubject = () => {
            if (!po.notes) return '';
            const match = po.notes.match(/Subject:\s*([^\n]+)/);
            return match ? match[1].trim() : '';
        };

        // Parse PO terms
        const getPoTerms = () => 'Refer to Payment Below';

        // Use snapshot data if available, otherwise fall back to vendor master data
        const vendorSnap = (po as any).vendor_snapshot;
        const vendorDisplay = vendorSnap ? {
            company_name: vendorSnap.company_name || vendor?.company_name || '',
            address: vendorSnap.address || vendor?.address || '',
            attn_name: vendorSnap.attn_name || vendor?.attn_name || '',
            phone: vendorSnap.phone || vendor?.phone || '',
            email: vendorSnap.email || vendor?.email || '',
        } : {
            company_name: vendor?.company_name || '',
            address: vendor?.address || '',
            attn_name: vendor?.attn_name || '',
            phone: vendor?.phone || '',
            email: vendor?.email || '',
        };

        // Bill & Ship snapshot
        const billShipSnap = (po as any).bill_ship_snapshot;
        const billShipDisplay = billShipSnap ? {
            bill_to: billShipSnap.bill_to || 'To: Finance',
            bill_address: billShipSnap.bill_address || company?.address || '',
        } : {
            bill_to: 'To: Finance',
            bill_address: company?.address || '60 Paya Lebar Road\n#08-45A Paya Lebar Square\nSingapore 409051',
        };

        // Working Area snapshot
        const workingAreaSnap = (po as any).working_area_snapshot;
        const workingAreaDisplay = workingAreaSnap ? {
            name: workingAreaSnap.name || '',
            address: workingAreaSnap.address || '',
            contact_person: workingAreaSnap.contact_person || '',
            phone: workingAreaSnap.phone || '',
        } : {
            name: '', address: po.delivery_address || 'To follow instruction',
            contact_person: '', phone: '',
        };

        // Group items by section subject (parsed from "[SectionSubject] description")
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
                                    <td className="font-semibold text-left pr-3 border border-gray-400 py-0.5 px-1 bg-gray-100">PO Number</td>
                                    <td className="text-left border border-gray-400 py-0.5 px-1">{po.po_number}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 py-0.5 px-1 bg-gray-100">PO Date</td>
                                    <td className="text-left border border-gray-400 py-0.5 px-1">{formatDate(po.date)}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 py-0.5 px-1 bg-gray-100">PO Terms</td>
                                    <td className="text-left border border-gray-400 py-0.5 px-1">{getPoTerms()}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-3 border border-gray-400 py-0.5 px-1 bg-gray-100">Quote Ref</td>
                                    <td className="text-left border border-gray-400 py-0.5 px-1">{po.quote_ref || '-'}</td>
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
                            <p className="font-bold">{vendorDisplay.company_name}</p>
                            <p className="whitespace-pre-line">{vendorDisplay.address}</p>
                            {vendorDisplay.attn_name && <p>Attn: {vendorDisplay.attn_name}</p>}
                            {vendorDisplay.phone && <p>Tel: {vendorDisplay.phone}</p>}
                            {vendorDisplay.email && <p>Email: {vendorDisplay.email}</p>}
                        </div>
                    </div>
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">SHIPPING INFO</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-24 whitespace-pre-line">
                            {po.shipping_info || 'Ship Via: FCA \u2013 To Working Site.\nIncoterm: DAP'}
                        </div>
                    </div>
                </div>

                {/* Address Sections */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">BILL AND SHIP TO DOCUMENTATION ADDRESS</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-28 whitespace-pre-line">
                            {billShipDisplay.bill_to}
                            {'\n'}{billShipDisplay.bill_address}
                        </div>
                    </div>
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 text-center text-xs">WORKING SITE AND EQUIPMENT DELIVERY ADDRESS</div>
                        <div className="border border-gray-400 p-2 text-xs min-h-28 whitespace-pre-line">
                            {workingAreaDisplay.name && <p className="font-bold">{workingAreaDisplay.name}</p>}
                            {workingAreaDisplay.address}
                            {workingAreaDisplay.contact_person && <p>Contact: {workingAreaDisplay.contact_person}</p>}
                            {workingAreaDisplay.phone && <p>Tel: {workingAreaDisplay.phone}</p>}
                        </div>
                    </div>
                </div>

                {/* Subject */}
                {subject && (
                    <div className="mb-2 text-xs">
                        <span className="font-bold">Subject:</span> <span className="uppercase">{subject}</span>
                    </div>
                )}

                {/* Items Table with Subject Section Headers */}
                <table className="w-full border-collapse border border-black mb-4 text-xs">
                    <thead>
                        <tr className="bg-cyan-500 text-white">
                            <th className="border border-black py-0.5 px-1 text-center w-8">No</th>
                            <th className="border border-black py-0.5 px-1 text-left w-24">Item Code</th>
                            <th className="border border-black py-0.5 px-1 text-left">Description</th>
                            <th className="border border-black py-0.5 px-1 text-center w-14">QTY</th>
                            <th className="border border-black py-0.5 px-1 text-center w-20">Unit Price<br />(SGD)</th>
                            <th className="border border-black py-0.5 px-1 text-center w-20">Total (SGD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedItems.map((group, gIdx) => {
                            // Sort items by item_code within each group
                            const sortedItems = [...group.items].sort((a, b) => {
                                if (a.item_code && !b.item_code) return -1;
                                if (!a.item_code && b.item_code) return 1;
                                return (a.item_code || '').localeCompare(b.item_code || '');
                            });

                            // Build item_code groups for rowSpan merging
                            const codeGroups: { code: string; items: typeof sortedItems; startNo: number }[] = [];
                            let currentNo = 1;
                            let currentCode = '';
                            let currentGroup: typeof sortedItems = [];

                            sortedItems.forEach(item => {
                                const code = item.item_code || '';
                                if (code && code === currentCode) {
                                    currentGroup.push(item);
                                } else {
                                    if (currentGroup.length > 0) {
                                        codeGroups.push({ code: currentCode, items: currentGroup, startNo: currentNo });
                                        currentNo++;
                                    }
                                    currentCode = code;
                                    currentGroup = [item];
                                }
                            });
                            if (currentGroup.length > 0) {
                                codeGroups.push({ code: currentCode, items: currentGroup, startNo: currentNo });
                            }

                            return (
                                <>
                                    {/* Subject Section Header */}
                                    {group.groupName !== 'Default' && (
                                        <tr key={`header-${gIdx}`} className="bg-blue-50">
                                            <td colSpan={6} className="border border-black py-1 px-2">
                                                <span className="font-bold text-blue-800 italic">Subject: {group.groupName}</span>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Render items with item_code merging */}
                                    {codeGroups.map((cg, cgIdx) => (
                                        cg.items.map((item, iIdx) => (
                                            <tr key={item.id || `item-${gIdx}-${cgIdx}-${iIdx}`}>
                                                {/* No + Item Code: merged for grouped items */}
                                                {(cg.code && cg.items.length > 1) ? (
                                                    iIdx === 0 ? (
                                                        <>
                                                            <td className="border border-black py-0.5 px-1 text-center" rowSpan={cg.items.length}>{cg.startNo}</td>
                                                            <td className="border border-black py-0.5 px-1" rowSpan={cg.items.length}>{cg.code}</td>
                                                        </>
                                                    ) : null
                                                ) : (
                                                    <>
                                                        <td className="border border-black py-0.5 px-1 text-center">{cg.startNo}</td>
                                                        <td className="border border-black py-0.5 px-1">{item.item_code}</td>
                                                    </>
                                                )}
                                                <td className="border border-black py-0.5 px-1 whitespace-pre-line">{cleanDescription(item.description || '')}</td>
                                                <td className="border border-black py-0.5 px-1 text-center">{item.quantity}</td>
                                                <td className="border border-black py-0.5 px-1 text-right">{(item.unit_price || 0).toFixed(2)}</td>
                                                <td className="border border-black py-0.5 px-1 text-right">{(item.total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ))}
                                </>
                            );
                        })}
                    </tbody>
                </table>

                {/* Total Summary */}
                <div className="flex justify-center mb-4">
                    <div>
                        <h3 className="text-center font-bold text-sm mb-2">Total Summary</h3>
                        <table className="border-collapse text-xs">
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-black py-0.5 px-1 text-center">No</th>
                                    <th className="border border-black py-0.5 px-1 text-left">Description</th>
                                    <th className="border border-black py-0.5 px-1 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedItems.filter(g => g.groupName !== 'Default').map((g, idx) => (
                                    <tr key={g.groupName}>
                                        <td className="border border-black py-0.5 px-1 text-center">{idx + 1}</td>
                                        <td className="border border-black py-0.5 px-1">{g.groupName}</td>
                                        <td className="border border-black py-0.5 px-1 text-right">{g.subtotal.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {groupedItems.filter(g => g.groupName === 'Default').length > 0 && (
                                    <tr>
                                        <td className="border border-black py-0.5 px-1 text-center">{groupedItems.filter(g => g.groupName !== 'Default').length + 1}</td>
                                        <td className="border border-black py-0.5 px-1">Other Items</td>
                                        <td className="border border-black py-0.5 px-1 text-right">
                                            {groupedItems.find(g => g.groupName === 'Default')?.subtotal.toFixed(2)}
                                        </td>
                                    </tr>
                                )}
                                <tr className="font-bold">
                                    <td className="border border-black py-0.5 px-1" colSpan={2}>Total (SGD) Before Tax</td>
                                    <td className="border border-black py-0.5 px-1 text-right">{subtotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black py-0.5 px-1" colSpan={2}>GST {gstRate}%</td>
                                    <td className="border border-black py-0.5 px-1 text-right">{gst.toFixed(2)}</td>
                                </tr>
                                <tr className="font-bold bg-gray-100">
                                    <td className="border border-black py-0.5 px-1" colSpan={2}>Total After Tax</td>
                                    <td className="border border-black py-0.5 px-1 text-right">{total.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Terms and Conditions */}
                {termsContent ? (
                    <div className="mt-6 text-xs border-t pt-2">
                        <p className="font-bold mb-1">Terms & Conditions:</p>
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: termsContent }} />
                    </div>
                ) : (
                    <div className="mt-6 text-xs text-gray-600 border-t pt-2">
                        <p className="font-bold mb-1">Terms & Conditions:</p>
                        <ol className="list-decimal pl-4 space-y-1">
                            <li>Please acknowledge receipt of this PO.</li>
                            <li>Delivery must be made to the specified address.</li>
                            <li>Invoices must quote the PO Number.</li>
                        </ol>
                    </div>
                )}
            </div>
        );
    }
);

PurchaseOrderTemplate.displayName = 'PurchaseOrderTemplate';
