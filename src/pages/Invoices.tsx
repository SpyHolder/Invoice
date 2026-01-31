import { useEffect, useState } from 'react';
import { Plus, FileText, Eye, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Invoice } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export const Invoices = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvoices();
    }, [user]);

    const fetchInvoices = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('invoices')
            .select(`
        *,
        customer:partners!customer_id(company_name)
      `)
            .order('created_at', { ascending: false });

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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
                    <p className="text-gray-600 mt-1">Manage your sales invoices</p>
                </div>
                <Button onClick={() => navigate('/invoices/new')}>
                    <Plus className="w-4 h-4" />
                    Create Invoice
                </Button>
            </div>

            <Card>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : invoices.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No invoices yet. Create your first invoice!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Due Date</th>
                                    <th>Amount</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <td className="font-medium">{invoice.customer?.company_name}</td>
                                        <td>{new Date(invoice.date).toLocaleDateString()}</td>
                                        <td>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}</td>
                                        <td>${invoice.grand_total?.toFixed(2) || '0.00'}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View Invoice"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Edit Invoice"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(invoice)}
                                                    className={`px-3 py-1 rounded-full text-sm ${invoice.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                                            invoice.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    {invoice.payment_status}
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(invoice.id)}
                                                    className="text-red-600 hover:text-red-800"
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
