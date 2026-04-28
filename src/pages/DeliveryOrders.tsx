import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SearchInput } from '../components/ui/SearchInput';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

export const DeliveryOrders = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Delete confirmation state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteDO, setDeleteDO] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, [searchQuery]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const data = await api.get<any[]>('/delivery-orders');
            
            let filteredOrders = data || [];
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                filteredOrders = filteredOrders.filter(doRecord => 
                    doRecord.do_number?.toLowerCase().includes(lowerQuery) || 
                    doRecord.subject?.toLowerCase().includes(lowerQuery)
                );
            }
            
            setOrders(filteredOrders);
        } catch (error) {
            console.error('Error fetching DOs:', error);
            showToast('Failed to fetch delivery orders', 'error');
        } finally {
            setLoading(false);
        }
    };

    // When DO is delivered, increase stock (items successfully shipped means stock is back to available)
    const updateStatus = async (doRecord: any, newStatus: string, previousStatus: string) => {
        try {
            // Update DO status
            await api.put(`/delivery-orders/${doRecord.id}`, { ...doRecord, status: newStatus });

            // When marked as delivered, increase stock for delivered items
            if (newStatus === 'delivered' && previousStatus !== 'delivered') {
                await restoreStockForDO(doRecord.id);
                showToast(`Delivery Order marked as delivered! Stock restored.`, 'success');
            } else if (previousStatus === 'delivered' && newStatus !== 'delivered') {
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
            const doRecord = await api.get<any>(`/delivery-orders/${doId}`);
            const doItems = doRecord?.items;
            
            if (!doItems) return;

            for (const doItem of doItems) {
                if (!doItem.description || !doItem.quantity) continue;

                const items = await api.get<any[]>(`/items`);
                const invItem = items?.find(i => i.name?.toLowerCase().includes(doItem.description.toLowerCase()));

                if (invItem) {
                    await api.put(`/items/${invItem.id}`, { stock: (invItem.stock || 0) + doItem.quantity });
                }
            }
        } catch (error) {
            console.error('Error restoring stock for DO:', error);
        }
    };

    const handleDeleteDO = (doRecord: any) => {
        setDeleteDO(doRecord);
        setDeleteModalOpen(true);
    };

    const confirmDeleteDO = async () => {
        if (!deleteDO) return;
        setDeleting(true);
        try {
            await api.delete(`/delivery-orders/${deleteDO.id}`);
            showToast(`Delivery Order ${deleteDO.do_number} deleted successfully`, 'success');
            setDeleteModalOpen(false);
            setDeleteDO(null);
            fetchOrders();
        } catch (error) {
            console.error('Error deleting DO:', error);
            showToast('Failed to delete delivery order', 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-10 bg-white pb-4 pt-6 -mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">DO Number</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Quote Ref</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Customer</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Subject</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Status</th>
                                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-500">Actions</th>
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
                                            <td className="py-2 px-3 text-sm font-medium text-gray-900">{doRecord.do_number}</td>
                                            <td className="py-2 px-3 text-sm text-gray-600">{doRecord.quote_number || doRecord.quotation_number || '-'}</td>
                                            <td className="py-2 px-3 text-sm text-gray-600">
                                                {doRecord.customer_name || '-'}
                                            </td>
                                            <td className="py-2 px-3 text-sm text-gray-600">
                                                {new Date(doRecord.date).toLocaleDateString()}
                                            </td>
                                            <td className="py-2 px-3 text-sm text-gray-600">{doRecord.subject || '-'}</td>
                                            <td className="py-2 px-3">
                                                <select
                                                    value={doRecord.status || 'pending'}
                                                    onChange={(e) => updateStatus(doRecord, e.target.value, doRecord.status || 'pending')}
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
                                            <td className="py-2 px-3 text-right">
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
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteDO(doRecord); }}
                                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete DO"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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

            {/* Delete DO Confirmation Modal */}
            {deleteModalOpen && deleteDO && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                        <div className="mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                    <Trash2 className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Delete Delivery Order?</h3>
                                    <p className="text-sm text-gray-500">{deleteDO.do_number}</p>
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-amber-800">
                                    This delivery order will be permanently deleted. Items from the linked quotation will remain available for creating new delivery orders.
                                </p>
                            </div>
                            <p className="text-sm text-gray-600">
                                This action <span className="font-semibold text-red-600">cannot be undone</span>.
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setDeleteModalOpen(false); setDeleteDO(null); }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteDO}
                                disabled={deleting}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {deleting ? 'Deleting...' : 'Delete DO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
