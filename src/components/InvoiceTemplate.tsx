import { forwardRef } from 'react';
import { Invoice, InvoiceItem, Customer } from '../lib/supabase';

interface InvoiceTemplateProps {
    invoice: Invoice;
    customer: Customer;
    items: InvoiceItem[];
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
    ({ invoice, customer, items }, ref) => {
        const formatDate = (dateString: string) => {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        };

        return (
            <div ref={ref} className="p-12 bg-white text-gray-900">
                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h1 className="text-4xl font-bold text-blue-600 mb-2">INVOICE</h1>
                        <p className="text-sm text-gray-600">Invoice Number:</p>
                        <p className="text-lg font-semibold">{invoice.invoice_number}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold mb-2">Business Suite</h2>
                        <p className="text-sm">Your Company Address</p>
                        <p className="text-sm">City, State ZIP</p>
                        <p className="text-sm">Phone: (555) 123-4567</p>
                        <p className="text-sm">Email: info@businesssuite.com</p>
                    </div>
                </div>

                {/* Bill To & Invoice Info */}
                <div className="flex justify-between mb-12">
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-600 mb-2">BILL TO:</p>
                        <p className="text-lg font-semibold">{customer.name}</p>
                        <p className="text-sm">{customer.phone}</p>
                        <p className="text-sm">{customer.email}</p>
                        {customer.address && <p className="text-sm">{customer.address}</p>}
                    </div>
                    <div className="flex-1 text-right">
                        <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-600">Invoice Date: </span>
                            <span className="text-sm">{formatDate(invoice.date)}</span>
                        </div>
                        <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-600">Due Date: </span>
                            <span className="text-sm">{formatDate(invoice.due_date)}</span>
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-gray-600">Status: </span>
                            <span
                                className={`text-sm font-semibold ${invoice.status === 'paid'
                                    ? 'text-green-600'
                                    : invoice.status === 'unpaid'
                                        ? 'text-red-600'
                                        : 'text-yellow-600'
                                    }`}
                            >
                                {invoice.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Line Items Table */}
                <table className="w-full mb-8">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-3 text-sm font-semibold">ITEM</th>
                            <th className="text-left py-3 text-sm font-semibold">DESCRIPTION</th>
                            <th className="text-right py-3 text-sm font-semibold">QTY</th>
                            <th className="text-right py-3 text-sm font-semibold">UNIT PRICE</th>
                            <th className="text-right py-3 text-sm font-semibold">DISCOUNT %</th>
                            <th className="text-right py-3 text-sm font-semibold">TAX %</th>
                            <th className="text-right py-3 text-sm font-semibold">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200">
                                <td className="py-3">{item.item_name}</td>
                                <td className="py-3 text-sm text-gray-600">{item.description}</td>
                                <td className="py-3 text-right">{item.quantity}</td>
                                <td className="py-3 text-right">${item.unit_price.toFixed(2)}</td>
                                <td className="py-3 text-right">{item.discount}%</td>
                                <td className="py-3 text-right">{item.tax_rate}%</td>
                                <td className="py-3 text-right font-semibold">${item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-12">
                    <div className="w-80">
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">${invoice.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2 text-sm">
                            <span className="text-gray-600">Discount ({invoice.discount}%):</span>
                            <span className="font-semibold">-${(invoice.subtotal * (invoice.discount / 100)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-3 text-sm">
                            <span className="text-gray-600">Tax ({invoice.tax}%):</span>
                            <span className="font-semibold">
                                +$
                                {((invoice.subtotal - invoice.subtotal * (invoice.discount / 100)) * (invoice.tax / 100)).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                            <span className="text-xl font-bold">TOTAL:</span>
                            <span className="text-xl font-bold text-blue-600">${invoice.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {invoice.notes && (
                    <div className="mb-8">
                        <p className="text-sm font-semibold text-gray-600 mb-2">NOTES:</p>
                        <p className="text-sm text-gray-700">{invoice.notes}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="border-t pt-8">
                    <p className="text-center text-sm text-gray-600">Thank you for your business!</p>
                    <p className="text-center text-xs text-gray-500 mt-2">
                        For questions about this invoice, please contact info@businesssuite.com
                    </p>
                </div>
            </div>
        );
    }
);

InvoiceTemplate.displayName = 'InvoiceTemplate';
