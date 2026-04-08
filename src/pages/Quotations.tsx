import { useEffect, useState } from 'react';
import { Plus, FileCheck, Eye, ArrowRight, Edit2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Quotation } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';

export const Quotations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');

    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotations();
    }, [user, searchQuery]); // Re-fetch when search query changes

    const fetchQuotations = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const data = await api.get<Quotation[]>('/quotations');

            if (data) {
                let filteredData = data;
                if (searchQuery) {
                    const lowerQuery = searchQuery.toLowerCase();
                    filteredData = data.filter(q => 
                        q.quotation_number?.toLowerCase().includes(lowerQuery) ||
                        q.subject?.toLowerCase().includes(lowerQuery) ||
                        (q as any).customer_name?.toLowerCase().includes(lowerQuery)
                    );
                }
                setQuotations(filteredData);
            }
        } catch (error) {
            console.error('Error fetching quotations:', error);
            showToast('Failed to fetch quotations', 'error');
        } finally {
            setLoading(false);
        }
    };

    const convertToSalesOrder = async (quotation: Quotation) => {
        try {
            // Fetch quotation details including items
            const quotationDetails = await api.get<any>(`/quotations/${quotation.id}`);
            
            if (!quotationDetails.items || quotationDetails.items.length === 0) {
                showToast('No items found in quotation', 'error');
                return;
            }

            // Create Sales Order Items
            const soItems = quotationDetails.items.map((item: any) => ({
                description: item.item_description,
                quantity: item.quantity,
                uom: item.uom,
                phase_name: null 
            }));

            // Create Sales Order via API
            const newSO = await api.post<any>('/sales-orders', {
                so_number: 'CNK-SO-' + Date.now(),
                quotation_id: quotation.id,
                status: 'draft',
                items: soItems
            });

            // Update quotation status
            await api.put(`/quotations/${quotation.id}`, {
                ...quotation,
                status: 'converted'
            });

            showToast('Sales Order created successfully!', 'success');
            navigate(`/sales-orders/edit/${newSO.id}`);
        } catch (error) {
            console.error('Error converting to Sales Order:', error);
            showToast('Failed to convert to Sales Order', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/quotations/${id}`);
            showToast('Quotation deleted successfully', 'success');
            fetchQuotations();
        } catch (error) {
            console.error('Error deleting quotation:', error);
            showToast('Failed to delete quotation', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-10 bg-white pb-4 pt-6 -mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Quotations</h1>
                    <p className="text-gray-600 mt-1">Manage your sales quotations</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search quotes..."
                        className="w-full sm:w-64"
                    />
                    <Button onClick={() => navigate('/quotations/new')}>
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline ml-2">Create Quotation</span>
                        <span className="sm:hidden ml-2">New</span>
                    </Button>
                </div>
            </div>

            <Card>
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading quotations...</p>
                    </div>
                ) : quotations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                            <FileCheck className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No quotations found</h3>
                        <p className="text-gray-500 mb-6">Create your first quotation to get started.</p>
                        <Button onClick={() => navigate('/quotations/new')}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Quotation
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/50">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Quote No</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Valid Until</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {quotations.map((quotation) => (
                                    <tr key={quotation.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span className="font-medium text-gray-900">{(quotation as any).customer_name || '-'}</span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{quotation.quotation_number || quotation.quote_number}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{new Date(quotation.date).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : '-'}</td>
                                        <td className="py-3 px-4 font-medium text-gray-900">${(quotation.total_amount || quotation.total || 0).toFixed(2)}</td>
                                        <td className="py-3 px-4">
                                            <Badge variant={
                                                quotation.status === 'sent' ? 'info' :
                                                    quotation.status === 'accepted' ? 'success' :
                                                        quotation.status === 'rejected' ? 'danger' :
                                                            quotation.status === 'converted' ? 'purple' :
                                                                'default'
                                            }>
                                                {quotation.status?.toUpperCase() || 'DRAFT'}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${quotation.id}`); }}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/quotations/edit/${quotation.id}`); }}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); convertToSalesOrder(quotation); }}
                                                    className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                                                    title="Convert to Sales Order"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(quotation.id); }}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
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
