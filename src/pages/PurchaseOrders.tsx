import { useEffect, useState } from 'react';
import { Plus, ShoppingCart, CheckCircle, Eye, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase, PurchaseOrder } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';

export const PurchaseOrders = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchPurchaseOrders();
    }, [user, searchQuery]);

    const fetchPurchaseOrders = async () => {
        if (!user) return;
        setLoading(true);

        let query = supabase
            .from('purchase_orders')
            .select('*, vendor:partners!vendor_id(company_name)')
            .order('created_at', { ascending: false });

        if (searchQuery) {
            query = query.or(`po_number.ilike.%${searchQuery}%,quote_ref.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query;

        if (!error && data) {
            setPurchaseOrders(data);
        }
        setLoading(false);
    };

    const markAsReceived = async (po: PurchaseOrder) => {
        try {
            // Only update PO status - no stock changes
            const { error } = await supabase
                .from('purchase_orders')
                .update({ status: 'received' })
                .eq('id', po.id);

            if (error) throw error;

            showToast('Purchase order marked as received!', 'success');
            fetchPurchaseOrders();
        } catch (error) {
            console.error('Error marking as received:', error);
            showToast('Failed to mark as received', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            // Delete PO items first (handled by cascade usually, but manual safety check)
            const { error: itemsError } = await supabase.from('purchase_order_items').delete().eq('po_id', id);
            if (itemsError) {
                console.error('Error deleting items:', itemsError);
                throw itemsError;
            }

            // Delete PO
            const { error } = await supabase.from('purchase_orders').delete().eq('id', id);

            if (error) {
                console.error('Error deleting PO:', error);
                throw error;
            }

            showToast('Purchase order deleted successfully', 'success');
            fetchPurchaseOrders();
        } catch (error) {
            console.error('Error deleting purchase order:', error);
            showToast('Failed to delete purchase order. Check console for details.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-10 bg-white pb-4 pt-6 -mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Purchase Orders</h1>
                    <p className="text-gray-500 mt-1">Manage your procurement and supply chain.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search PO #, Ref..."
                        className="w-full sm:w-64"
                    />
                    <Button onClick={() => navigate('/purchase-orders/new')} className="shadow-lg shadow-blue-500/30">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline ml-2">Create Purchase Order</span>
                        <span className="sm:hidden ml-2">New</span>
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading purchase orders...</p>
                    </div>
                ) : purchaseOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 bg-gray-50">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                            <ShoppingCart className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No purchase orders yet</h3>
                        <p className="text-gray-500 mt-1 mb-6">Create your first purchase order to get started.</p>
                        <Button variant="secondary" onClick={() => navigate('/purchase-orders/new')}>
                            Create Now
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/50">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">PO Number</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vendor</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 pl-8">Status</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {purchaseOrders.map((po) => (
                                    <tr key={po.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span
                                                    className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                                                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                                                >
                                                    {po.po_number || 'Draft'}
                                                </span>
                                                {po.quote_ref && <span className="text-xs text-gray-500">Ref: {po.quote_ref}</span>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                                                    {((po as any).vendor?.company_name || po.vendor_name || '?').substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-gray-900">{(po as any).vendor?.company_name || po.vendor_name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {po.date ? new Date(po.date).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                                            ${po.total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-3 px-4 pl-8">
                                            <Badge variant={
                                                po.status === 'received' ? 'success' :
                                                    po.status === 'pending' ? 'warning' : 'danger'
                                            }>
                                                {po.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2 relative z-10">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        navigate(`/purchase-orders/${po.id}`);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4 pointer-events-none" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        navigate(`/purchase-orders/edit/${po.id}`);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4 pointer-events-none" />
                                                </button>
                                                {po.status === 'pending' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            markAsReceived(po);
                                                        }}
                                                        className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                                        title="Mark as Received"
                                                    >
                                                        <CheckCircle className="w-4 h-4 pointer-events-none" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(po.id);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete PO"
                                                >
                                                    <Trash2 className="w-4 h-4 pointer-events-none" />
                                                </button>
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
