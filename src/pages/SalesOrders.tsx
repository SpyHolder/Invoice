import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';

export const SalesOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<any[]>([]); // Using any for joined data convenience
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Join with Quotations to get Customer? 
            // Supabase client might not support deep joins in one query easily without type hacking or view.
            // But we can fetch SOs and then fetch Quotes/Customers.
            // Or just fetch SOs and `quotation_id`.

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
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-gray-100 text-gray-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-green-100 text-green-800';
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
                                            {so.quotations?.partners?.company_name || '-'}
                                        </td>
                                        <td className="py-3 px-4">{so.customer_po_number || '-'}</td>
                                        <td className="py-3 px-4">
                                            {new Date(so.project_schedule_date || so.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(so.status)}`}>
                                                {so.status.toUpperCase()}
                                            </span>
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
