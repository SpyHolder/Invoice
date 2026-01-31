import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';

export const DeliveryOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<any[]>([]);
    // const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        // setLoading(true);
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
        } finally {
            // setLoading(false);
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
                                <th className="text-right py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">
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
                                        <td className="py-3 px-4">{doRecord.subject}</td>
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
