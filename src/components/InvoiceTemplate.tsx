import React, { forwardRef } from 'react';
import { Invoice, InvoiceItem, Partner, Company, BankAccount, InvoiceDeliverySection } from '../lib/supabase';
import { PaymentInstructions } from './PaymentInstructions';

interface InvoiceTemplateProps {
    invoice: Invoice;
    customer: Partner;
    items: InvoiceItem[];
    doSections?: InvoiceDeliverySection[]; // Optional for legacy invoices
    company?: Company;
    bankAccounts?: BankAccount[];
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
    ({ invoice, customer, items, doSections = [], company, bankAccounts }, ref) => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        };

        // Calculate totals
        // Note: In the new schema, these might come directly from invoice object, 
        // but let's recalculate if needed or use the ones from invoice.
        // The Invoice interface has subtotal, discount, tax, total.
        // Wait, the new schema has 'grand_total', 'discount' (numeric value or percent?), 'subtotal'.
        // Let's rely on the passed invoice object for totals as the backend/form should calculate them.

        return (
            <div ref={ref} className="p-8 bg-white text-black font-sans text-sm h-full mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
                {/* Header Row */}
                <div className="flex justify-between items-start mb-6">
                    {/* Left: Logo & Company Info */}
                    <div className="flex gap-4">
                        <div className="w-32 h-32 border border-green-500 flex items-center justify-center text-gray-400">
                            {company?.logo_url ? (
                                <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full" />
                            ) : (
                                <span>Logo</span>
                            )}
                        </div>
                        <div className="text-sm">
                            <h2 className="font-bold text-lg uppercase">{company?.name || 'Comany Name'}</h2>
                            <p className="whitespace-pre-line">{company?.address}</p>
                            {company?.uen_number && <p>Co. UEN: {company.uen_number}</p>}
                        </div>
                    </div>

                    {/* Right: INVOICE Title & Details Table */}
                    <div className="text-right">
                        <h1 className="text-4xl font-bold mb-4">INVOICE</h1>
                        <table className="text-sm border-collapse inline-table">
                            <tbody>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Invoice No</td>
                                    <td className="text-left">{invoice.invoice_number}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Invoice Date</td>
                                    <td className="text-left">{formatDate(invoice.date)}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Term</td>
                                    <td className="text-left">{invoice.terms || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Due Date</td>
                                    <td className="text-left">{invoice.due_date ? formatDate(invoice.due_date) : '-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">DO Number</td>
                                    <td className="text-left">{invoice.do_number_ref || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Customer PO</td>
                                    {/* Assuming Customer PO is passed via customer or invoice logic, if available. New schema has it on Sales Order. */}
                                    <td className="text-left">{'-'}</td>
                                </tr>
                                <tr>
                                    <td className="font-semibold text-left pr-4">Requestor</td>
                                    <td className="text-left">{'-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Addresses */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                    {/* Billing Address */}
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 mb-2 text-center uppercase">Billing Address</div>
                        <div className="border border-black p-2 h-32">
                            <p>To: {customer.attn_name || 'Finance Department'}</p>
                            <p className="font-bold">{customer.company_name}</p>
                            <p className="whitespace-pre-line">{customer.address}</p>
                            <p>{customer.email}</p>
                        </div>
                    </div>

                    {/* Billing Info / Shipping Info (Image 2 says BILLING INFO, Image 3 says SHIPPING ADDRESS) */}
                    {/* For Invoice (Image 2), it seems to use Billing Info on the right, but maybe just empty or same? */}
                    {/* The image shows 'BILLING INFO' on the right too, but let's stick to the Image 2 template which has valid info. 
                         Actually Image 2 right side is 'BILLING INFO' header but lists Invoice No, Date etc... 
                         Wait, the Image 2 provided shows 'BILLING ADDRESS' (Left) and 'BILLING INFO' (Right).
                         But the 'BILLING INFO' block content IS the table I put in the header right?
                         Let's look closely at Image 2.
                         Ah, Image 2: 
                         Header Left: Logo + Address. Header Right: "INVOICE".
                         Row 2 Left: "BILLING ADDRESS" (Blue bar) -> Content.
                         Row 2 Right: "BILLING INFO" (Blue bar) -> Content (Invoice No, Date, Term...).
                         
                         So I should move the "Invoice Details Table" into this "Billing Info" block to match Image 2 exactly.
                     */}
                    <div>
                        <div className="bg-cyan-500 text-white font-bold px-2 py-1 mb-2 text-center uppercase">Billing Info</div>
                        <div className="border border-black p-0 h-32 overflow-hidden">
                            {/* Moving the table here */}
                            <table className="w-full text-sm">
                                <tbody>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5 w-1/3">Invoice No</td>
                                        <td className="py-0.5">{invoice.invoice_number}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5">Invoice Date</td>
                                        <td className="py-0.5">{formatDate(invoice.date)}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5">Term</td>
                                        <td className="py-0.5">{invoice.terms || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5">Due Date</td>
                                        <td className="py-0.5">{invoice.due_date ? formatDate(invoice.due_date) : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5">DO Number</td>
                                        <td className="py-0.5">{invoice.do_number_ref || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5">Customer PO</td>
                                        <td className="py-0.5"> - </td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold pl-2 py-0.5">Requestor</td>
                                        <td className="py-0.5"> - </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Subject */}
                <div className="mb-4">
                    <span className="font-bold">Subject: </span>
                    <span>{invoice.subject || 'service'}</span>
                </div>

                {/* Items Table - Image 2 Style */}
                <table className="w-full border-collapse border border-black mb-4">
                    <thead>
                        <tr className="bg-white border-b border-black">
                            <th className="border-r border-black p-1 text-center w-10">No</th>
                            <th className="border-r border-black p-1 text-left w-24">Customer Items</th>
                            <th className="border-r border-black p-1 text-left">Description</th>
                            <th className="border-r border-black p-1 text-center w-12">QTY</th>
                            <th className="border-r border-black p-1 text-center w-12">UOM</th>
                            <th className="border-r border-black p-1 text-center w-24">Unit Price (SGD)</th>
                            <th className="p-1 text-center w-24">Total (SGD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {doSections && doSections.length > 0 ? (
                            // DO-based invoice: Show sections with headers
                            doSections.map((section) => {
                                const sectionItems = items.filter(item => item.do_section_id === section.id);
                                let itemCounter = items.filter(item =>
                                    doSections.findIndex(s => s.id === item.do_section_id) <
                                    doSections.findIndex(s => s.id === section.id)
                                ).length;

                                return (
                                    <React.Fragment key={section.id}>
                                        {/* Section Header */}
                                        <tr className="bg-blue-100 border-b border-black">
                                            <td colSpan={7} className="p-2 font-bold text-blue-900">
                                                {section.section_label || `Section ${section.section_number}`}
                                            </td>
                                        </tr>
                                        {/* Section Items */}
                                        {sectionItems.map((item) => {
                                            itemCounter++;
                                            return (
                                                <tr key={item.id} className="border-b border-black">
                                                    <td className="border-r border-black p-1 text-center">{itemCounter}</td>
                                                    <td className="border-r border-black p-1">{item.item_code}</td>
                                                    <td className="border-r border-black p-1">{item.description || item.item_code}</td>
                                                    <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                                                    <td className="border-r border-black p-1 text-center">{item.uom}</td>
                                                    <td className="border-r border-black p-1 text-right">{item.unit_price.toFixed(2)}</td>
                                                    <td className="p-1 text-right">{item.total_price.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            // Legacy invoice: Show items normally
                            items.map((item, index) => (
                                <tr key={item.id} className="border-b border-black">
                                    <td className="border-r border-black p-1 text-center">{index + 1}</td>
                                    <td className="border-r border-black p-1">{item.item_code}</td>
                                    <td className="border-r border-black p-1">{item.description || item.item_code}</td>
                                    <td className="border-r border-black p-1 text-center">{item.quantity}</td>
                                    <td className="border-r border-black p-1 text-center">{item.uom}</td>
                                    <td className="border-r border-black p-1 text-right">{item.unit_price.toFixed(2)}</td>
                                    <td className="p-1 text-right">{item.total_price.toFixed(2)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Financial Footer */}
                <div className="flex justify-end mb-4">
                    <div className="w-1/3 border border-black">
                        <div className="flex justify-between border-b border-black p-1">
                            <span>GST {(invoice as any).tax_rate || 0}%</span>
                            <span>{((invoice as any).tax_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-black p-1">
                            <span>Sub-Total</span>
                            <span>{(invoice.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-b border-black p-1">
                            <span>Discount</span>
                            <span>({(invoice.discount || 0).toFixed(2)})</span>
                        </div>
                        <div className="flex justify-between p-1 font-bold">
                            <span>Total (SGD)</span>
                            <span>{(invoice.grand_total || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Instructions */}
                {bankAccounts && <PaymentInstructions bankAccounts={bankAccounts} />}

                {/* Footer Notes */}
                <div className="mt-8 text-xs text-gray-500">
                    <p className="mb-2">Please Note:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                        <li>Cheques should be made payable to {company?.name || 'Company Name'} and crossed A/C Payee Only.</li>
                        <li>Invoice not paid within payment terms of the invoice will carry interest of 5% per month until settled.</li>
                        <li>All goods sold shall still remain the property of {company?.name || 'Company Name'} until full settlement has been by the company.</li>
                    </ol>
                </div>
            </div>
        );
    }
);

InvoiceTemplate.displayName = 'InvoiceTemplate';
