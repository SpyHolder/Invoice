import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const DeliveryOrders = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<any[]>([]);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('delivery_orders')
                .select(`
                    *,
                    sales_orders (
                        so_number,
                        quotations (
                            partners (
                                company_name
                            )
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching DOs:', error);
        }
    };

    const updateStatus = async (doId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('delivery_orders')
                .update({ status: newStatus })
                .eq('id', doId);

            if (error) throw error;

            showToast(`Delivery Order status updated to ${newStatus}`, 'success');
            fetchOrders();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Failed to update status', 'error');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered': return 'bg-green-100 text-green-800 border-green-300';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Delivery Orders</h1>
                <Button onClick={() => navigate('/delivery-orders/new')}>
                    <Plus className="w-4 h-4" /> Create Delivery Order
                </Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4">DO Number</th>
                                <th className="text-left py-3 px-4">SO Ref</th>
                                <th className="text-left py-3 px-4">Customer</th>
                                <th className="text-left py-3 px-4">Date</th>
                                <th className="text-left py-3 px-4">Subject</th>
                                <th className="text-left py-3 px-4">Status</th>
                                <th className="text-right py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-gray-500">
                                        No delivery orders found
                                    </td>
                                </tr>
                            ) : (
                                orders.map((doRecord) => (
                                    <tr key={doRecord.id} className="border-t hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium">{doRecord.do_number}</td>
                                        <td className="py-3 px-4">{doRecord.sales_orders?.so_number || '-'}</td>
                                        <td className="py-3 px-4">
                                            {doRecord.sales_orders?.quotations?.partners?.company_name || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {new Date(doRecord.date).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">{doRecord.subject || '-'}</td>
                                        <td className="py-3 px-4">
                                            <select
                                                value={doRecord.status || 'pending'}
                                                onChange={(e) => updateStatus(doRecord.id, e.target.value)}
                                                className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${getStatusColor(doRecord.status || 'pending')}`}
                                            >
                                                <option value="pending">PENDING</option>
                                                <option value="delivered">DELIVERED</option>
                                                <option value="cancelled">CANCELLED</option>
                                            </select>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/delivery-orders/${doRecord.id}`)}
                                                    className="p-1 text-gray-600 hover:text-blue-600"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/delivery-orders/edit/${doRecord.id}`)}
                                                    className="p-1 text-gray-600 hover:text-orange-600"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/invoices/new?so_id=${doRecord.so_id}`)}
                                                    className="p-1 text-gray-600 hover:text-green-600"
                                                    title="Create Invoice"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
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
