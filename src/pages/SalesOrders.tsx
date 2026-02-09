import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const SalesOrders = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<any[]>([]); // Using any for joined data convenience

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('sales_orders')
                .select(`
                    *,
                    quotations (
                        quotation_number,
                        customer:partners!customer_id(company_name)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching sales orders:', error);
        }
    };

    const toggleStatus = async (so: any) => {
        try {
            const newStatus = so.status === 'confirmed' ? 'draft' : 'confirmed';
            const { error } = await supabase
                .from('sales_orders')
                .update({ status: newStatus })
                .eq('id', so.id);

            if (error) throw error;

            showToast(`Sales Order ${newStatus === 'confirmed' ? 'confirmed' : 'set to draft'}`, 'success');
            fetchOrders();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Failed to update status', 'error');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-gray-100 text-gray-800';
            case 'confirmed': return 'bg-green-100 text-green-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Sales Orders</h1>
                <Button onClick={() => navigate('/sales-orders/new')}>
                    <Plus className="w-4 h-4" /> Create Sales Order
                </Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4">SO Number</th>
                                <th className="text-left py-3 px-4">Customer</th>
                                <th className="text-left py-3 px-4">Customer PO</th>
                                <th className="text-left py-3 px-4">Date</th>
                                <th className="text-left py-3 px-4">Status</th>
                                <th className="text-right py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">
                                        No sales orders found
                                    </td>
                                </tr>
                            ) : (
                                orders.map((so) => (
                                    <tr key={so.id} className="border-t hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium">{so.so_number}</td>
                                        <td className="py-3 px-4">
                                            {so.quotations?.customer?.company_name || '-'}
                                        </td>
                                        <td className="py-3 px-4">{so.customer_po_number || '-'}</td>
                                        <td className="py-3 px-4">
                                            {new Date(so.project_schedule_date || so.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={() => toggleStatus(so)}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition ${getStatusColor(so.status)}`}
                                                title="Click to toggle status"
                                            >
                                                {so.status?.toUpperCase() || 'DRAFT'}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/sales-orders/${so.id}`)}
                                                    className="p-1 text-gray-600 hover:text-blue-600"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/sales-orders/edit/${so.id}`)}
                                                    className="p-1 text-gray-600 hover:text-orange-600"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {so.status === 'draft' && (
                                                    <button
                                                        onClick={() => toggleStatus(so)}
                                                        className="p-1 text-gray-600 hover:text-green-600"
                                                        title="Confirm Sales Order"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
