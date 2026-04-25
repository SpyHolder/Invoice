import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, FileCheck, Eye, Edit2, Trash2, Copy, Package, ShoppingCart, MoreHorizontal, FileText, X } from 'lucide-react';
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

    // Dropdown state
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    const setButtonRef = useCallback((id: string) => (el: HTMLButtonElement | null) => {
        if (el) buttonRefs.current.set(id, el);
        else buttonRefs.current.delete(id);
    }, []);

    // Confirm modal state
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmQuotation, setConfirmQuotation] = useState<Quotation | null>(null);
    const [poNumberInput, setPoNumberInput] = useState('');
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        fetchQuotations();
    }, [user, searchQuery]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

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
                        (q as any).customer_name?.toLowerCase().includes(lowerQuery) ||
                        q.customer_po_number?.toLowerCase().includes(lowerQuery)
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this quotation?')) return;
        try {
            await api.delete(`/quotations/${id}`);
            showToast('Quotation deleted successfully', 'success');
            fetchQuotations();
        } catch (error) {
            console.error('Error deleting quotation:', error);
            showToast('Failed to delete quotation', 'error');
        }
    };

    const handleConfirmQuotation = async () => {
        if (!confirmQuotation || !poNumberInput.trim()) {
            showToast('Please enter a PO number', 'error');
            return;
        }
        setConfirming(true);
        try {
            await api.patch(`/quotations/${confirmQuotation.id}/confirm`, {
                customer_po_number: poNumberInput.trim()
            });
            showToast('Quotation confirmed successfully!', 'success');
            setConfirmModalOpen(false);
            setConfirmQuotation(null);
            setPoNumberInput('');
            fetchQuotations();
        } catch (error: any) {
            console.error('Error confirming quotation:', error);
            showToast(error.message || 'Failed to confirm', 'error');
        } finally {
            setConfirming(false);
        }
    };

    const getStatusBadge = (quotation: Quotation) => {
        if (quotation.status === 'confirmed') {
            return <Badge variant="success">CONFIRMED</Badge>;
        }
        // Draft = clickable to open confirm modal
        return (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setConfirmQuotation(quotation);
                    setPoNumberInput('');
                    setConfirmModalOpen(true);
                }}
                className="cursor-pointer"
                title="Click to confirm with PO Number"
            >
                <Badge variant="default" className="hover:bg-orange-100 hover:text-orange-800 transition-colors cursor-pointer border border-transparent hover:border-orange-300">
                    DRAFT
                </Badge>
            </button>
        );
    };

    const getDeliveryStatusBadge = (status: string | undefined) => {
        if (!status || status === 'Pending') {
            return <Badge variant="default">Pending</Badge>;
        } else if (status === 'Partially Delivered') {
            return <Badge variant="info">Partial</Badge>;
        } else if (status === 'Fully Delivered') {
            return <Badge variant="success">Delivered</Badge>;
        }
        return <Badge variant="default">{status}</Badge>;
    };

    const toggleDropdown = (id: string) => {
        if (openDropdownId === id) {
            setOpenDropdownId(null);
            return;
        }
        const btn = buttonRefs.current.get(id);
        if (btn) {
            const rect = btn.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: rect.right - 208, // 208px = w-52
            });
        }
        setOpenDropdownId(id);
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
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Customer</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Quote No</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Date</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Amount</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">PO Number</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">Status</th>
                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">DO Status</th>
                                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {quotations.map((quotation) => (
                                    <tr key={quotation.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-2 px-3">
                                            <span className="font-medium text-gray-900">{(quotation as any).customer_name || '-'}</span>
                                        </td>
                                        <td className="py-2 px-3 text-sm text-gray-600">{quotation.quotation_number || quotation.quote_number}</td>
                                        <td className="py-2 px-3 text-sm text-gray-600">{new Date(quotation.date).toLocaleDateString()}</td>
                                        <td className="py-2 px-3 font-medium text-gray-900">${(quotation.total_amount || quotation.total || 0).toFixed(2)}</td>
                                        <td className="py-2 px-3 text-sm text-gray-600">
                                            {quotation.customer_po_number || <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="py-2 px-3">
                                            {getStatusBadge(quotation)}
                                        </td>
                                        <td className="py-2 px-3">
                                            {getDeliveryStatusBadge((quotation as any).delivery_status)}
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            <button
                                                ref={setButtonRef(quotation.id)}
                                                onClick={(e) => { e.stopPropagation(); toggleDropdown(quotation.id); }}
                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Actions"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Portal Dropdown */}
            {openDropdownId && (() => {
                const quotation = quotations.find(q => q.id === openDropdownId);
                if (!quotation) return null;
                return createPortal(
                    <>
                        {/* Invisible overlay to close dropdown on outside click */}
                        <div className="fixed inset-0 z-[9998]" onClick={() => setOpenDropdownId(null)} />
                        <div
                            ref={dropdownRef}
                            className="fixed w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] py-1 animate-in fade-in slide-in-from-top-1 duration-150"
                            style={{ top: dropdownPos.top, left: dropdownPos.left }}
                        >
                            {/* View */}
                            <button
                                onClick={() => { navigate(`/quotations/${quotation.id}`); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Eye className="w-4 h-4 text-blue-500" />
                                View Details
                            </button>
                            {/* Edit */}
                            <button
                                onClick={() => { navigate(`/quotations/edit/${quotation.id}`); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Edit2 className="w-4 h-4 text-gray-500" />
                                Edit Quotation
                            </button>
                            {/* Duplicate */}
                            <button
                                onClick={() => { navigate(`/quotations/new?duplicate=${quotation.id}`); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Copy className="w-4 h-4 text-indigo-500" />
                                Duplicate
                            </button>

                            <div className="border-t border-gray-100 my-1"></div>

                            {/* Create DO - only if confirmed */}
                            {quotation.status === 'confirmed' && (
                                <button
                                    onClick={() => { navigate(`/delivery-orders/new?quotation_id=${quotation.id}`); setOpenDropdownId(null); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-green-50 transition-colors"
                                >
                                    <Package className="w-4 h-4 text-green-500" />
                                    Create Delivery Order
                                </button>
                            )}
                            {/* Create PO */}
                            <button
                                onClick={() => { navigate(`/purchase-orders/new?quotation_id=${quotation.id}`); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors"
                            >
                                <ShoppingCart className="w-4 h-4 text-orange-500" />
                                Create Purchase Order
                            </button>
                            {/* Create Invoice - only if fully delivered */}
                            {(quotation as any).delivery_status === 'Fully Delivered' && (
                                <button
                                    onClick={() => { navigate(`/invoices/new?so_id=${quotation.id}`); setOpenDropdownId(null); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 transition-colors"
                                >
                                    <FileText className="w-4 h-4 text-purple-500" />
                                    Create Invoice
                                </button>
                            )}

                            <div className="border-t border-gray-100 my-1"></div>

                            {/* Delete */}
                            <button
                                onClick={() => { handleDelete(quotation.id); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </>,
                    document.body
                );
            })()}

            {/* Confirm Quotation Modal */}
            {confirmModalOpen && confirmQuotation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => { setConfirmModalOpen(false); setConfirmQuotation(null); }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Confirm Quotation</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Enter the customer PO number to confirm quotation <span className="font-medium text-gray-700">{confirmQuotation.quotation_number || confirmQuotation.quote_number}</span>
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Customer PO Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={poNumberInput}
                                onChange={(e) => setPoNumberInput(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400 placeholder:text-gray-400"
                                placeholder="e.g. 4504642120"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmQuotation(); }}
                            />
                            <p className="text-xs text-gray-400 mt-1.5">This will change the status from Draft to Confirmed</p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => { setConfirmModalOpen(false); setConfirmQuotation(null); }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleConfirmQuotation}
                                disabled={confirming || !poNumberInput.trim()}
                            >
                                {confirming ? 'Confirming...' : 'Confirm Quotation'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
