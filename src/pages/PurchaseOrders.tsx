import { useEffect, useState } from 'react';
import { Plus, ShoppingCart, CheckCircle, Eye, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, PurchaseOrder } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export const PurchaseOrders = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPurchaseOrders();
    }, [user]);

    const fetchPurchaseOrders = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('purchase_orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setPurchaseOrders(data);
        }
        setLoading(false);
    };

    const markAsReceived = async (po: PurchaseOrder) => {
        try {
            // Get PO items
            const { data: poItems, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('item_id, quantity')
                .eq('purchase_order_id', po.id);

            if (itemsError) throw itemsError;

            // Update stock for each item
            if (poItems) {
                for (const poItem of poItems) {
                    if (poItem.item_id) {
                        // Get current stock
                        const { data: currentItem } = await supabase
                            .from('items')
                            .select('stock')
                            .eq('id', poItem.item_id)
                            .single();

                        if (currentItem) {
                            // Increase stock
                            await supabase
                                .from('items')
                                .update({ stock: currentItem.stock + poItem.quantity })
                                .eq('id', poItem.item_id);
                        }
                    }
                }
            }

            // Update PO status
            await supabase
                .from('purchase_orders')
                .update({ status: 'received' })
                .eq('id', po.id);

            showToast('Purchase order marked as received and stock updated!', 'success');
            fetchPurchaseOrders();
        } catch (error) {
            console.error('Error marking as received:', error);
            showToast('Failed to mark as received', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            // Delete PO items first
            await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
            // Delete PO
            const { error } = await supabase.from('purchase_orders').delete().eq('id', id);

            if (error) throw error;

            showToast('Purchase order deleted successfully', 'success');
            fetchPurchaseOrders();
        } catch (error) {
            console.error('Error deleting purchase order:', error);
            showToast('Failed to delete purchase order', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
                    <p className="text-gray-600 mt-1">Manage your procurement</p>
                </div>
                <Button onClick={() => navigate('/purchase-orders/new')}>
                    <Plus className="w-4 h-4" />
                    Create Purchase Order
                </Button>
            </div>

            <Card>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : purchaseOrders.length === 0 ? (
                    <div className="text-center py-12">
                        <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No purchase orders yet. Create your first PO!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Vendor</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseOrders.map((po) => (
                                    <tr key={po.id}>
                                        <td className="font-medium">{po.vendor_name}</td>
                                        <td>{new Date(po.date).toLocaleDateString()}</td>
                                        <td>${po.total.toFixed(2)}</td>
                                        <td>
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-semibold ${po.status === 'received'
                                                    ? 'bg-green-100 text-green-800'
                                                    : po.status === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {po.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View Purchase Order"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/purchase-orders/edit/${po.id}`)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Edit Purchase Order"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {po.status === 'pending' && (
                                                    <button
                                                        onClick={() => markAsReceived(po)}
                                                        className="text-purple-600 hover:text-purple-800"
                                                        title="Mark as Received"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(po.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Delete Purchase Order"
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
