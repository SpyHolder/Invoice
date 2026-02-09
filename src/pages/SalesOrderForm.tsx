import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, FileText, User, Hash, Save, CheckCircle, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, Partner } from '../lib/supabase';
import { processSOConfirmation } from '../lib/stockService';
import { useToast } from '../contexts/ToastContext';
import { Badge } from '../components/ui/Badge';

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    uom: string;
}

interface Phase {
    id: string;
    name: string;
    items: LineItem[];
}

export const SalesOrderForm = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const quotationIdParam = searchParams.get('quotation_id');
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Ref for date picker
    const dateInputRef = useRef<HTMLInputElement>(null);

    const [customers, setCustomers] = useState<Partner[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: '',
        quotation_id: '',
        so_number: '',
        customer_po_number: '',
        project_schedule_date: new Date().toISOString().split('T')[0],
        status: 'draft',
    });

    const [phases, setPhases] = useState<Phase[]>([
        {
            id: 'phase-1',
            name: '01 Phase',
            items: [
                {
                    id: 'item-1',
                    description: '',
                    quantity: 1,
                    uom: 'EA',
                }
            ]
        }
    ]);

    useEffect(() => {
        fetchCustomers();
        fetchQuotations();
        if (id) {
            setIsEditMode(true);
            loadSalesOrder(id);
        } else if (quotationIdParam) {
            loadFromQuotation(quotationIdParam);
        }
    }, [id, quotationIdParam]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('partners').select('*').eq('type', 'customer').order('company_name');
        if (data) setCustomers(data);
    };

    const fetchQuotations = async () => {
        const { data } = await supabase.from('quotations').select('id, quote_number, subject').order('created_at', { ascending: false });
        if (data) setQuotations(data);
    };

    const loadFromQuotation = async (quoteId: string) => {
        const { data: quote } = await supabase.from('quotations').select('*').eq('id', quoteId).single();
        if (quote) {
            setFormData(prev => ({
                ...prev,
                customer_id: quote.customer_id,
                quotation_id: quote.id,
            }));

            const { data: quoteItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', quoteId);
            if (quoteItems) {
                const mappedItems = quoteItems.map((qi, idx) => ({
                    id: `q-item-${idx}`,
                    description: qi.item_description || '',
                    quantity: qi.quantity,
                    uom: qi.uom || 'EA',
                }));

                if (mappedItems.length > 0) {
                    setPhases([{
                        id: 'phase-1',
                        name: '01 Phase',
                        items: mappedItems
                    }]);
                }
            }
        }
    };

    const loadSalesOrder = async (soId: string) => {
        setLoading(true);
        try {
            const { data: so, error } = await supabase.from('sales_orders').select('*').eq('id', soId).single();
            if (error) throw error;

            setFormData({
                quotation_id: so.quotation_id || '',
                so_number: so.so_number || '',
                customer_po_number: so.customer_po_number || '',
                project_schedule_date: so.project_schedule_date || '',
                status: so.status,
                customer_id: '',
            });

            if (so.quotation_id) {
                const { data: q } = await supabase.from('quotations').select('customer_id').eq('id', so.quotation_id).single();
                if (q) setFormData(prev => ({ ...prev, customer_id: q.customer_id }));
            }

            const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', soId);
            if (items) {
                const grouped: Record<string, LineItem[]> = {};
                items.forEach(item => {
                    const p = item.phase_name || 'Unspecified';
                    if (!grouped[p]) grouped[p] = [];
                    grouped[p].push({
                        id: item.id,
                        description: item.description || '',
                        quantity: item.quantity,
                        uom: item.uom || 'EA',
                    });
                });

                const phaseArray = Object.keys(grouped).map((p, i) => ({
                    id: `phase-${i}`,
                    name: p,
                    items: grouped[p]
                }));
                setPhases(phaseArray);
            }

        } catch (error) {
            console.error(error);
            showToast('Failed to load Sales Order', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPhase = () => {
        setPhases([...phases, {
            id: `phase-${Date.now()}`,
            name: `0${phases.length + 1} Phase`,
            items: []
        }]);
    };

    const handleRemovePhase = (phaseId: string) => {
        if (phases.length > 1) {
            setPhases(phases.filter(p => p.id !== phaseId));
        }
    };

    const handlePhaseNameChange = (phaseId: string, newName: string) => {
        setPhases(phases.map(p => p.id === phaseId ? { ...p, name: newName } : p));
    };

    const handleAddItem = (phaseId: string) => {
        setPhases(phases.map(p => {
            if (p.id === phaseId) {
                return {
                    ...p,
                    items: [...p.items, {
                        id: `item-${Date.now()}`,
                        description: '',
                        quantity: 1,
                        uom: 'EA'
                    }]
                };
            }
            return p;
        }));
    };

    const handleRemoveItem = (phaseId: string, itemId: string) => {
        setPhases(phases.map(p => {
            if (p.id === phaseId) {
                return {
                    ...p,
                    items: p.items.filter(i => i.id !== itemId)
                };
            }
            return p;
        }));
    };

    const handleItemChange = (phaseId: string, itemId: string, field: keyof LineItem, value: any) => {
        setPhases(phases.map(p => {
            if (p.id === phaseId) {
                return {
                    ...p,
                    items: p.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
                };
            }
            return p;
        }));
    };

    const saveOrder = async (status: string) => {
        console.log('saveOrder called with status:', status);

        // Validation
        if (!formData.customer_po_number) {
            showToast('Customer PO Number is required', 'error');
            return;
        }
        if (!formData.quotation_id) {
            showToast('Please select a linked quotation', 'error');
            return;
        }
        if (!formData.customer_id) {
            showToast('Customer is missing (should be linked to quotation)', 'error');
            return;
        }

        setLoading(true);
        try {
            const soData = {
                quotation_id: formData.quotation_id || null,
                customer_po_number: formData.customer_po_number,
                project_schedule_date: formData.project_schedule_date,
                status: status
            };

            let soId = id;

            if (isEditMode && id) {
                const { error } = await supabase.from('sales_orders').update(soData).eq('id', id);
                if (error) throw error;
                await supabase.from('sales_order_items').delete().eq('so_id', id);
            } else {
                const { data, error } = await supabase.from('sales_orders').insert([{
                    ...soData,
                    so_number: 'SO-' + Date.now()
                }]).select().single();

                if (error) throw error;
                soId = data.id;

                if (formData.quotation_id) {
                    await supabase
                        .from('quotations')
                        .update({ status: 'converted' })
                        .eq('id', formData.quotation_id);
                }
            }

            if (soId) {
                const flatItems = phases.flatMap(p => p.items.map(i => ({
                    so_id: soId,
                    phase_name: p.name,
                    description: i.description,
                    quantity: i.quantity,
                    uom: i.uom
                })));

                if (flatItems.length > 0) {
                    const { error } = await supabase.from('sales_order_items').insert(flatItems);
                    if (error) throw error;
                }

                if (status === 'confirmed') {
                    const stockResult = await processSOConfirmation(soId);
                    if (stockResult.success) {
                        if (stockResult.totalBackordered > 0) {
                            showToast(`Sales Order confirmed! ${stockResult.totalBackordered} item(s) backordered.`, 'warning');
                        } else {
                            showToast('Sales Order confirmed! All items reserved.', 'success');
                        }
                    } else {
                        showToast('Sales Order saved. Stock processing issue.', 'warning');
                    }
                } else {
                    showToast('Sales Order saved as draft.', 'success');
                }
            }

            navigate('/sales-orders');
        } catch (error: any) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Default to current status or draft if not specified
        await saveOrder(formData.status);
    };

    return (
        <div className="space-y-6 max-w-full mx-auto pb-24">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/sales-orders')} className="hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Sales Order</h1>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{isEditMode ? `Updating SO: ${formData.so_number}` : 'Create a new sales order from quotation'}</span>
                            {isEditMode && (
                                <Badge variant={formData.status === 'confirmed' ? 'success' : 'warning'}>
                                    {formData.status.toUpperCase()}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Header Section - Full Width */}
                <Card className="shadow-sm border-gray-200">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-800">Order Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Linked Quotation</label>
                            <div className="relative">
                                <select
                                    value={formData.quotation_id}
                                    onChange={async (e) => {
                                        const qId = e.target.value;
                                        setFormData({ ...formData, quotation_id: qId });
                                        if (qId) await loadFromQuotation(qId);
                                    }}
                                    className="w-full pl-4 pr-10 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none disabled:bg-gray-50 transition-all shadow-sm hover:border-blue-400"
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Quotation...</option>
                                    {quotations.map(q => (
                                        <option key={q.id} value={q.id}>{q.quote_number} - {q.subject}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                            {!formData.quotation_id && (
                                <div className="flex items-center gap-1.5 mt-2 text-amber-600 bg-amber-50 p-2 rounded text-xs font-medium">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                    Please select a quotation to populate items.
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer</label>
                            <div className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 shadow-sm h-[42px]">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                                    <User className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-medium truncate text-gray-900">
                                    {customers.find(c => c.id === formData.customer_id)?.company_name || 'No Customer Linked'}
                                </span>
                            </div>
                        </div>

                        <Input
                            label="Customer PO Number *"
                            value={formData.customer_po_number}
                            onChange={(e) => setFormData({ ...formData, customer_po_number: e.target.value })}
                            placeholder="e.g. PO-2024-001"
                            required
                            className="h-[42px]"
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Schedule (Date)</label>
                            <div className="relative group">
                                <div
                                    className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10"
                                >
                                    <CalendarIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={formData.project_schedule_date}
                                    onChange={(e) => setFormData({ ...formData, project_schedule_date: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm hover:border-blue-400 transition-all cursor-pointer"
                                    onClick={() => dateInputRef.current?.showPicker()}
                                />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Items Section */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Hash className="w-5 h-5 text-gray-500" />
                            Phases & Items
                        </h2>
                        <Button type="button" onClick={handleAddPhase} variant="secondary" className="bg-white border hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all">
                            <Plus className="w-4 h-4" /> Add Phase
                        </Button>
                    </div>

                    {phases.map((phase, index) => (
                        <Card key={phase.id} className="relative border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-visible">
                            {/* Phase Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100 bg-gray-50/50 -mx-6 -mt-6 px-6 py-4 rounded-t-lg group">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="bg-white border border-gray-200 text-gray-500 font-mono text-xs px-2 py-1 rounded shadow-sm">
                                        Phase {index + 1}
                                    </div>
                                    <input
                                        type="text"
                                        value={phase.name}
                                        onChange={(e) => handlePhaseNameChange(phase.id, e.target.value)}
                                        className="bg-transparent border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 text-lg font-bold text-gray-800 px-0 py-1 transition-colors w-full sm:w-80 placeholder-gray-400"
                                        placeholder="Phase Name (e.g. Implementation)"
                                    />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <Button type="button" onClick={() => handleAddItem(phase.id)} size="sm" variant="secondary" className="bg-white hover:bg-blue-50 text-xs shadow-sm">
                                        <Plus className="w-3.5 h-3.5" /> Add Item
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePhase(phase.id)}
                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                        title="Remove Phase"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50/50 text-xs text-gray-500 uppercase font-medium border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left w-[50%] pl-6">Description</th>
                                            <th className="px-4 py-3 text-left w-[20%]">Qty</th>
                                            <th className="px-4 py-3 text-left w-[20%]">UOM</th>
                                            <th className="px-4 py-3 text-center w-[10%] pr-6">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {phase.items.map((item) => (
                                            <tr key={item.id} className="group hover:bg-blue-50/30 transition-colors">
                                                <td className="px-4 py-3 pl-6">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(phase.id, item.id, 'description', e.target.value)}
                                                        placeholder="Item description"
                                                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(phase.id, item.id, 'quantity', parseFloat(e.target.value))}
                                                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="relative">
                                                        <select
                                                            value={item.uom}
                                                            onChange={(e) => handleItemChange(phase.id, item.id, 'uom', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer hover:border-blue-400 transition-colors"
                                                        >
                                                            <option value="EA">EA</option>
                                                            <option value="Lot">Lot</option>
                                                            <option value="Nos">Nos</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center pr-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(phase.id, item.id)}
                                                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
                                                        title="Remove Item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {phase.items.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="text-center text-gray-400 py-12 text-sm italic bg-gray-50/30">
                                                    No items added to this phase yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end gap-3 z-20 md:sticky md:bottom-0 md:rounded-b-lg">
                    <Button type="button" variant="ghost" onClick={() => navigate('/sales-orders')} className="hover:bg-gray-100">
                        Cancel
                    </Button>

                    {/* Draft Button */}
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => saveOrder('draft')}
                        disabled={loading}
                        className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                        <Save className="w-4 h-4" />
                        Save as Draft
                    </Button>

                    {/* Confirm Button */}
                    <Button
                        type="button"
                        onClick={() => saveOrder('confirmed')}
                        disabled={loading || formData.status === 'confirmed'}
                        className={`shadow-lg shadow-blue-500/20 ${formData.status === 'confirmed' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                        {formData.status === 'confirmed' ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Order Confirmed
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Confirm Order
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
};
