import { useEffect, useState } from 'react';
import { Plus, FileText, Eye, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Invoice } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';

export const Invoices = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchInvoices();
    }, [user, searchQuery]);

    const fetchInvoices = async () => {
        if (!user) return;
        setLoading(true);

        const query = supabase
            .from('invoices')
            .select(`
        *,
        customer:partners!customer_id(company_name)
      `)
            .order('created_at', { ascending: false });

        if (searchQuery) {
            query.ilike('invoice_number', `%${searchQuery}%`);
        }

        const { data, error } = await query;

        if (!error && data) {
            setInvoices(data as Invoice[]);
        }
        setLoading(false);
    };

    const toggleStatus = async (invoice: Invoice) => {
        const newStatus = invoice.payment_status === 'paid' ? 'unpaid' : 'paid';
        await supabase
            .from('invoices')
            .update({ payment_status: newStatus })  // Database column is payment_status
            .eq('id', invoice.id);
        fetchInvoices();
    };

    const handleDelete = async (id: string) => {
        try {
            // Delete invoice items first
            await supabase.from('invoice_items').delete().eq('invoice_id', id);
            // Delete invoice
            const { error } = await supabase.from('invoices').delete().eq('id', id);

            if (error) throw error;

            showToast('Invoice deleted successfully', 'success');
            fetchInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            showToast('Failed to delete invoice', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
                    <p className="text-gray-600 mt-1">Manage your sales invoices</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search invoices..."
                        className="w-full sm:w-64"
                    />
                    <Button onClick={() => navigate('/invoices/new')}>
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline ml-2">Create Invoice</span>
                        <span className="sm:hidden ml-2">New</span>
                    </Button>
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading invoices...</p>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No invoices found</h3>
                        <p className="text-gray-500 mb-6">Create your first invoice to get started.</p>
                        <Button onClick={() => navigate('/invoices/new')}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Invoice
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/50">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Invoice #</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Due Date</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span
                                                className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                                                onClick={() => navigate(`/invoices/${invoice.id}`)}
                                            >
                                                {invoice.invoice_number}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="font-medium text-gray-900">{invoice.customer?.company_name}</span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {new Date(invoice.date).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-gray-900">
                                            ${invoice.grand_total?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={() => toggleStatus(invoice)}
                                                className="focus:outline-none"
                                            >
                                                <Badge
                                                    variant={
                                                        invoice.payment_status === 'paid' ? 'success' :
                                                            invoice.payment_status === 'partial' ? 'warning' : 'danger'
                                                    }
                                                >
                                                    {invoice.payment_status ? invoice.payment_status.toUpperCase() : 'UNKNOWN'}
                                                </Badge>
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="View Invoice"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
                                                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                    title="Edit Invoice"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(invoice.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete Invoice"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};
