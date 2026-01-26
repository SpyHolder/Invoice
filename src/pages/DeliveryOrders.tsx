import { useEffect, useState } from 'react';
import { Plus, Truck, Eye, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, DeliveryOrder } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export const DeliveryOrders = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('all');

    useEffect(() => {
        fetchDeliveryOrders();
    }, [user]);

    const fetchDeliveryOrders = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('delivery_orders')
            .select(`
                *,
                customer:customers(name),
                quotation:quotations(quotation_number)
            `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setDeliveryOrders(data as DeliveryOrder[]);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this delivery order?')) return;

        try {
            // Delete delivery order items first
            await supabase.from('delivery_order_items').delete().eq('delivery_order_id', id);
            // Delete delivery order
            const { error } = await supabase.from('delivery_orders').delete().eq('id', id);

            if (error) throw error;

            showToast('Delivery order deleted successfully', 'success');
            fetchDeliveryOrders();
        } catch (error) {
            console.error('Error deleting delivery order:', error);
            showToast('Failed to delete delivery order', 'error');
        }
    };

    const markAsDelivered = async (id: string) => {
        try {
            const { error } = await supabase
                .from('delivery_orders')
                .update({ status: 'delivered' })
                .eq('id', id);

            if (error) throw error;

            showToast('Delivery order marked as delivered', 'success');
            fetchDeliveryOrders();
        } catch (error) {
            console.error('Error updating delivery order:', error);
            showToast('Failed to update delivery order', 'error');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'delivered':
                return 'bg-green-100 text-green-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredOrders = filter === 'all'
        ? deliveryOrders
        : deliveryOrders.filter(order => order.status === filter);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Delivery Orders</h1>
                    <p className="text-gray-600 mt-1">Manage your delivery orders from quotations</p>
                </div>
                <Button onClick={() => navigate('/delivery-orders/new')}>
                    <Plus className="w-4 h-4" />
                    Create Delivery Order
                </Button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(['all', 'pending', 'delivered', 'cancelled'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === status
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            <Card>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12">
                        <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No delivery orders yet. Create your first delivery order!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>DO Number</th>
                                    <th>Customer</th>
                                    <th>Date</th>
                                    <th>Delivery Date</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td className="font-medium">{order.do_number}</td>
                                        <td>{order.customer?.name}</td>
                                        <td>{new Date(order.date).toLocaleDateString()}</td>
                                        <td>
                                            {order.delivery_date
                                                ? new Date(order.delivery_date).toLocaleDateString()
                                                : '-'}
                                        </td>
                                        <td>${order.total.toFixed(2)}</td>
                                        <td>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/delivery-orders/${order.id}`)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/delivery-orders/edit/${order.id}`)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {order.status === 'pending' && (
                                                    <button
                                                        onClick={() => markAsDelivered(order.id)}
                                                        className="text-purple-600 hover:text-purple-800"
                                                        title="Mark as Delivered"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(order.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Delete"
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
