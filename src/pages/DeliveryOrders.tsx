import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SearchInput } from '../components/ui/SearchInput';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const DeliveryOrders = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [searchQuery]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let query = supabase
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

            if (searchQuery) {
                query = query.or(`do_number.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching DOs:', error);
            showToast('Failed to fetch delivery orders', 'error');
        } finally {
            setLoading(false);
        }
    };

    // When DO is delivered, increase stock (items successfully shipped means stock is back to available)
    const updateStatus = async (doId: string, newStatus: string, previousStatus: string) => {
        try {
            // Update DO status
            const { error } = await supabase
                .from('delivery_orders')
                .update({ status: newStatus })
                .eq('id', doId);

            if (error) throw error;

            // When marked as delivered, increase stock for delivered items
            if (newStatus === 'delivered' && previousStatus !== 'delivered') {
                await restoreStockForDO(doId);
                showToast(`Delivery Order marked as delivered! Stock restored.`, 'success');
            } else if (previousStatus === 'delivered' && newStatus !== 'delivered') {
                // If reverting from delivered, we might want to deduct again
                // For now just show a warning
                showToast(`Delivery Order status updated to ${newStatus}. Note: Stock was previously restored.`, 'warning');
            } else {
                showToast(`Delivery Order status updated to ${newStatus}`, 'success');
            }

            fetchOrders();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Failed to update status', 'error');
        }
    };

    // Restore/increase stock for DO items when delivered
    const restoreStockForDO = async (doId: string) => {
        try {
            // Get DO items
            const { data: doItems, error: doError } = await supabase
                .from('delivery_order_items')
                .select('description, quantity')
                .eq('do_id', doId);

            if (doError || !doItems) return;

            for (const doItem of doItems) {
                if (!doItem.description || !doItem.quantity) continue;

                // Find matching inventory item by name
                const { data: invItem } = await supabase
                    .from('items')
                    .select('id, stock, name')
                    .ilike('name', `%${doItem.description}%`)
                    .maybeSingle();

                if (invItem) {
                    // Increase stock
                    const { error: updateError } = await supabase
                        .from('items')
                        .update({ stock: (invItem.stock || 0) + doItem.quantity })
                        .eq('id', invItem.id);

                    if (updateError) {
                        console.error('Error updating stock for:', doItem.description);
                    }
                }
            }
        } catch (error) {
            console.error('Error restoring stock for DO:', error);
        }
    };



    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900">Delivery Orders</h1>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search DO #, Subject..."
                        className="w-full sm:w-64"
                    />
                    <Button onClick={() => navigate('/delivery-orders/new')}>
                        <Plus className="w-4 h-4" /> Create Delivery Order
                    </Button>
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading delivery orders...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/50">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">DO Number</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">SO Ref</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Subject</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-500">
                                            No delivery orders found
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((doRecord) => (
                                        <tr key={doRecord.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900">{doRecord.do_number}</td>
                                            <td className="py-3 px-4 text-sm text-gray-600">{doRecord.sales_orders?.so_number || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-gray-600">
                                                {doRecord.sales_orders?.quotations?.partners?.company_name || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600">
                                                {new Date(doRecord.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600">{doRecord.subject || '-'}</td>
                                            <td className="py-3 px-4">
                                                <select
                                                    value={doRecord.status || 'pending'}
                                                    onChange={(e) => updateStatus(doRecord.id, e.target.value, doRecord.status || 'pending')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 ring-1 ring-inset focus:ring-2 focus:ring-blue-500 outline-none ${doRecord.status === 'delivered'
                                                        ? 'bg-green-50 text-green-700 ring-green-600/20'
                                                        : doRecord.status === 'cancelled'
                                                            ? 'bg-red-50 text-red-700 ring-red-600/20'
                                                            : 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                                                        }`}
                                                >
                                                    <option value="pending">PENDING</option>
                                                    <option value="delivered">DELIVERED</option>
                                                    <option value="cancelled">CANCELLED</option>
                                                </select>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/delivery-orders/${doRecord.id}`); }}
                                                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/delivery-orders/edit/${doRecord.id}`); }}
                                                        className="p-1 text-gray-400 hover:text-orange-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/invoices/new?so_id=${doRecord.so_id}`); }}
                                                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
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
                )}
            </Card>
        </div>
    );
};
