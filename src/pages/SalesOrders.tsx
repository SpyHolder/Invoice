import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, CheckCircle, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { processSOConfirmation, restoreStockForSO } from '../lib/stockService';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';

export const SalesOrders = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<any[]>([]); // Using any for joined data convenience
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [searchQuery]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('sales_orders')
                .select(`
                    *,
                    quotations (
                        quotation_number,
                        customer:partners!customer_id(company_name)
                    )
                `)
                .order('created_at', { ascending: false });

            if (searchQuery) {
                query = query.or(`so_number.ilike.%${searchQuery}%,customer_po_number.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching sales orders:', error);
            showToast('Failed to fetch sales orders', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (so: any) => {
        // Remove native confirm for better UX and reliability
        // if (!confirm(...)) return; 

        showToast('Updating order status...', 'info');

        try {
            const newStatus = so.status === 'confirmed' ? 'draft' : 'confirmed';

            // Update status in database
            const { error } = await supabase
                .from('sales_orders')
                .update({ status: newStatus })
                .eq('id', so.id);

            if (error) throw error;

            // Process stock based on new status
            if (newStatus === 'confirmed') {
                // Confirming: Deduct stock, record backorders
                const stockResult = await processSOConfirmation(so.id);

                if (stockResult.success) {
                    if (stockResult.totalBackordered > 0) {
                        showToast(
                            `Sales Order confirmed! ${stockResult.totalBackordered} item(s) backordered.`,
                            'warning'
                        );
                    } else {
                        showToast('Sales Order confirmed! Stock reserved.', 'success');
                    }
                } else {
                    showToast('Sales Order confirmed, but stock processing had issues.', 'warning');
                }
            } else {
                // Reverting to draft: Restore stock
                const restoreResult = await restoreStockForSO(so.id);

                if (restoreResult.success) {
                    showToast(`Sales Order reverted to draft. Stock restored.`, 'success');
                } else {
                    showToast('Sales Order reverted to draft. Stock restore failed.', 'warning');
                }
            }

            fetchOrders();
        } catch (error: any) {
            console.error('Error updating status:', error);
            showToast(`Failed to update status: ${error.message}`, 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-10 bg-white pb-4 pt-6 -mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sales Orders</h1>
                    <p className="text-gray-500 mt-1">Manage your customer orders and projects.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search SO #, PO #..."
                        className="w-full sm:w-64"
                    />
                    <Button onClick={() => navigate('/sales-orders/new')} className="shadow-lg shadow-indigo-500/30">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline ml-2">Create Sales Order</span>
                        <span className="sm:hidden ml-2">New</span>
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading sales orders...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 bg-gray-50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                            <ShoppingCart className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No sales orders yet</h3>
                        <p className="text-gray-500 mt-1 mb-6">Create your first sales order to get started.</p>
                        <Button variant="secondary" onClick={() => navigate('/sales-orders/new')}>
                            Create Now
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/50">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">SO Number</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer PO</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.map((so) => (
                                    <tr key={so.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span
                                                className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                                                onClick={() => navigate(`/sales-orders/${so.id}`)}
                                            >
                                                {so.so_number}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                                                    {(so.quotations?.customer?.company_name || '?').substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-gray-900">{so.quotations?.customer?.company_name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {so.customer_po_number || <span className="text-gray-400 italic">None</span>}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {new Date(so.project_schedule_date || so.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleStatus(so); }}
                                                className="focus:outline-none"
                                                title="Click to toggle status"
                                            >
                                                <Badge variant={
                                                    so.status === 'confirmed' ? 'success' :
                                                        so.status === 'completed' ? 'info' :
                                                            so.status === 'cancelled' ? 'danger' : 'default'
                                                } className="cursor-pointer hover:opacity-80 transition-opacity">
                                                    {so.status ? so.status.toUpperCase() : 'DRAFT'}
                                                </Badge>
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/sales-orders/${so.id}`)}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/sales-orders/edit/${so.id}`)}
                                                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {so.status === 'draft' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleStatus(so); }}
                                                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                        title="Confirm Sales Order"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
