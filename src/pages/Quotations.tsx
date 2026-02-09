import { useEffect, useState } from 'react';
import { Plus, FileCheck, Eye, ArrowRight, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Quotation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export const Quotations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
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
        customer:partners!customer_id(company_name, type)
      `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setQuotations(data as Quotation[]);
        }
        setLoading(false);
    };

    const convertToSalesOrder = async (quotation: Quotation) => {
        try {
            // Fetch quotation items
            const { data: quotationItems } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', quotation.id);

            if (!quotationItems || quotationItems.length === 0) {
                showToast('No items found in quotation', 'error');
                return;
            }

            // Create Sales Order with draft status (needs confirmation)
            const { data: newSO, error: soError } = await supabase
                .from('sales_orders')
                .insert([{
                    so_number: 'CNK-SO-' + Date.now(),
                    quotation_id: quotation.id,
                    status: 'draft'
                }])
                .select()
                .single();

            if (soError || !newSO) {
                console.error('SO Error:', soError);
                showToast('Failed to create Sales Order', 'error');
                return;
            }

            // Create SO Items (copy from quotation items)
            const soItems = quotationItems.map(item => ({
                so_id: newSO.id,
                description: item.item_description,
                quantity: item.quantity,
                uom: item.uom,
                phase_name: null // User will assign phases in SO edit form
            }));

            const { error: itemsError } = await supabase
                .from('sales_order_items')
                .insert(soItems);

            if (itemsError) {
                console.error('Items Error:', itemsError);
                showToast('Failed to create SO items', 'error');
                return;
            }

            // Update quotation status to 'converted'
            await supabase
                .from('quotations')
                .update({ status: 'converted' })
                .eq('id', quotation.id);

            showToast('Sales Order created successfully!', 'success');
            navigate(`/sales-orders/edit/${newSO.id}`);
        } catch (error) {
            console.error('Error converting to Sales Order:', error);
            showToast('Failed to convert to Sales Order', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            // Delete quotation items first
            await supabase.from('quotation_items').delete().eq('quotation_id', id);
            // Delete quotation
            const { error } = await supabase.from('quotations').delete().eq('id', id);

            if (error) throw error;

            showToast('Quotation deleted successfully', 'success');
            fetchQuotations();
        } catch (error) {
            console.error('Error deleting quotation:', error);
            showToast('Failed to delete quotation', 'error');
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
                                    <th>Quote No</th>
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
                                        <td className="font-medium">{(quotation as any).customer?.company_name || '-'}</td>
                                        <td>{quotation.quotation_number || quotation.quote_number}</td>
                                        <td>{new Date(quotation.date).toLocaleDateString()}</td>
                                        <td>{quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : '-'}</td>
                                        <td>${(quotation.total_amount || quotation.total || 0).toFixed(2)}</td>
                                        <td>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${quotation.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                                quotation.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                                    quotation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                                        quotation.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                            quotation.status === 'converted' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-gray-100 text-gray-800'
                                                }`}>
                                                {quotation.status?.toUpperCase() || 'DRAFT'}
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
                                                    onClick={() => convertToSalesOrder(quotation)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="Create Sales Order"
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
