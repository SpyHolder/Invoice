import { useEffect, useState } from 'react';
import { Plus, FileCheck, Eye, ArrowRight, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Quotation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Quotations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotations();
    }, [user]);

    const fetchQuotations = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('quotations')
            .select(`
        *,
        customer:customers(name)
      `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setQuotations(data as Quotation[]);
        }
        setLoading(false);
    };

    const convertToInvoice = async (quotation: Quotation) => {
        if (!confirm('Convert this quotation to an invoice?')) return;

        // Fetch quotation items
        const { data: quotationItems } = await supabase
            .from('quotation_items')
            .select('*')
            .eq('quotation_id', quotation.id);

        if (!quotationItems) return;

        // Create invoice
        const { data: newInvoice, error } = await supabase
            .from('invoices')
            .insert([
                {
                    invoice_number: 'INV-' + Date.now(),
                    customer_id: quotation.customer_id,
                    date: new Date().toISOString().split('T')[0],
                    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    status: 'unpaid',
                    subtotal: quotation.subtotal,
                    discount: quotation.discount,
                    tax: quotation.tax,
                    total: quotation.total,
                    notes: quotation.notes,
                },
            ])
            .select()
            .single();

        if (error || !newInvoice) return;

        // Create invoice items and deduct stock
        for (const item of quotationItems) {
            await supabase.from('invoice_items').insert([
                {
                    invoice_id: newInvoice.id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    amount: item.amount,
                },
            ]);

            // Deduct stock
            const { data: currentItem } = await supabase
                .from('items')
                .select('stock')
                .eq('id', item.item_id)
                .single();

            if (currentItem) {
                await supabase
                    .from('items')
                    .update({ stock: currentItem.stock - item.quantity })
                    .eq('id', item.item_id);
            }
        }

        navigate('/invoices');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this quotation?')) return;

        try {
            // Delete quotation items first
            await supabase.from('quotation_items').delete().eq('quotation_id', id);
            // Delete quotation
            await supabase.from('quotations').delete().eq('id', id);
            fetchQuotations();
        } catch (error) {
            console.error('Error deleting quotation:', error);
            alert('Failed to delete quotation');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Quotations</h1>
                    <p className="text-gray-600 mt-1">Manage your sales quotations</p>
                </div>
                <Button onClick={() => navigate('/quotations/new')}>
                    <Plus className="w-4 h-4" />
                    Create Quotation
                </Button>
            </div>

            <Card>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : quotations.length === 0 ? (
                    <div className="text-center py-12">
                        <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No quotations yet. Create your first quotation!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Valid Until</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotations.map((quotation) => (
                                    <tr key={quotation.id}>
                                        <td className="font-medium">{quotation.customer?.name}</td>
                                        <td>{new Date(quotation.date).toLocaleDateString()}</td>
                                        <td>{new Date(quotation.valid_until).toLocaleDateString()}</td>
                                        <td>${quotation.total.toFixed(2)}</td>
                                        <td>
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                {quotation.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/quotations/${quotation.id}`)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View Quotation"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/quotations/edit/${quotation.id}`)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Edit Quotation"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => convertToInvoice(quotation)}
                                                    className="text-purple-600 hover:text-purple-800"
                                                    title="Convert to Invoice"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(quotation.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Delete Quotation"
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
