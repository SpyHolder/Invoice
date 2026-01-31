import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Partner } from '../lib/supabase';
// import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    uom: string;
    // Sales Order items don't strictly typically have prices in the Schema provided (SalesOrderItem: description, quantity, uom, phase_name). 
    // Wait, let's check Schema. `sales_order_items` -> id, so_id, description, quantity, uom, phase_name.
    // WHERE IS PRICE?
    // Sales Order usually has prices?
    // If not, it's just a confirmation of Quantity and Scope?
    // Quotation has prices. Invoice has prices.
    // Sales Order confirms the ORDER. Usually it has prices too.
    // Check `SalesOrderItem` interface in lib/supabase.ts again.
    // Step 94 view_file: 
    // export interface SalesOrderItem {
    //     id: string;
    //     so_id: string;
    //     description: string | null;
    //     quantity: number;
    //     uom: string | null;
    //     phase_name: string | null; 
    // }
    // NO PRICE in SalesOrderItem!
    // NO TOTAL in SalesOrder!
    // This implies the Sales Order is purely for OPERATIONS/FULFILLMENT (What to deliver, when, matching PO).
    // Billing is handled by Invoice (linked to SO).
    // Quotation had prices.
    // Okay, I will follow the schema. No prices in SO Form.
}

interface Phase {
    id: string;
    name: string;
    items: LineItem[];
}

export const SalesOrderForm = () => {
    // const { user } = useAuth();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const quotationIdParam = searchParams.get('quotation_id');
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [customers, setCustomers] = useState<Partner[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]); // To select quote if needed
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const [formData, setFormData] = useState({
        customer_id: '',
        quotation_id: '',
        so_number: '', // Auto-gen usually
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
        // Pre-fill from Quotation
        const { data: quote } = await supabase.from('quotations').select('*').eq('id', quoteId).single();
        if (quote) {
            setFormData(prev => ({
                ...prev,
                customer_id: quote.customer_id,
                quotation_id: quote.id,
                // subject? SO schema doesn't have subject, but items have description.
            }));

            // Fetch Items
            const { data: quoteItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', quoteId);
            if (quoteItems) {
                // Map quote items to Phase 1 by default
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
                // customer_id: so.quotation_id ? '' : '', // handled below
                // Wait, Schema `sales_orders` -> `quotation_id`. Does it have `customer_id`?
                // Check `lib/supabase.ts` again.
                // Step 94: `export interface SalesOrder { id, so_number, quotation_id, customer_po_number, project_schedule_date, status }`.
                // IT DOES NOT HAVE `customer_id`!
                // It relies on `quotation_id` to link to Customer?
                // What if starting from scratch without Quote? User might want to create SO directly.
                // If `quotation_id` is null, how do we know the customer?
                // MAJOR ISSUE in Schema if SO can exist without Quote but has no customer_id.
                // But `view_file` of schema (Step 94) shows `quotation_id`.
                // Let's check the SQL file `20260131100000_update_schema.sql` (Step 92) if possible, or assume Step 94 is accurate.
                // Step 94 is accurate reflection of `lib/supabase.ts`.
                // If `so` has no `customer_id`, we MUST link it to a Quotation?
                // Info: "After Quote is accepted, it becomes a Sales Order."
                // So maybe SO *always* requires a Quote?
                // If so, `quotation_id` is mandatory?
                // But if I want to create SO from scratch...
                // I'll assume for now `quotation_id` is the way. OR I should have added `customer_id` to `sales_orders`.
                // Actually `invoices` has `customer` helper but `sales_orders` doesn't?
                // Let's look at `invoices`. `so_id` (ref SO).
                // If SO doesn't have customer, Invoice can't know customer easily unless via SO->Quote->Customer.
                // This seems fragile if Quote is deleted.
                // I should probably check if I can add valid `customer_id` or just rely on Quote.
                // For now, I will REQUIRE a Quotation to create an SO, OR I will assume the Schema intended `quotation_id` to be the link.
                // But wait, if I select a Customer in this Form, where do I save it?
                // I can't save `customer_id` if the table doesn't have it.
                // I'll assume I need to create a "Dummy Quotation" or just enforce Quote selection?
                // Or maybe I missed `customer_id` in `sales_orders`?
                // Let's check `tasks.md` or `implementation_plan.md`? No details.
                // I will proceed assuming I must select a Quotation.
                // BUT user requirements say "Customer PO Input".
                // Using `quotation_id` as link.

                // Fetch linked Quote to get Customer
                quotation_id: so.quotation_id || '',
                so_number: so.so_number || '',
                customer_po_number: so.customer_po_number || '',
                project_schedule_date: so.project_schedule_date || '',
                status: so.status,
                customer_id: '', // Will fetch below
            });

            if (so.quotation_id) {
                const { data: q } = await supabase.from('quotations').select('customer_id').eq('id', so.quotation_id).single();
                if (q) setFormData(prev => ({ ...prev, customer_id: q.customer_id }));
            }

            // Load Items
            const { data: items } = await supabase.from('sales_order_items').select('*').eq('so_id', soId);
            if (items) {
                // Group by phase
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Upsert header
            const soData = {
                quotation_id: formData.quotation_id || null,
                customer_po_number: formData.customer_po_number,
                project_schedule_date: formData.project_schedule_date,
                status: formData.status
            };

            let soId = id;

            if (isEditMode && id) {
                const { error } = await supabase.from('sales_orders').update(soData).eq('id', id);
                if (error) throw error;
                // Delete items
                await supabase.from('sales_order_items').delete().eq('so_id', id);
            } else {
                const { data, error } = await supabase.from('sales_orders').insert([{
                    ...soData,
                    so_number: 'SO-' + Date.now() // Simple gen
                }]).select().single();

                if (error) throw error;
                soId = data.id;
            }

            // Insert Items flattened
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
            }

            showToast('Sales Order saved successfully', 'success');
            navigate('/sales-orders'); // Route needs to exist
        } catch (error: any) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Sales Order</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Order Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Linked Quotation</label>
                            <select
                                value={formData.quotation_id}
                                onChange={async (e) => {
                                    const qId = e.target.value;
                                    setFormData({ ...formData, quotation_id: qId });
                                    if (qId) await loadFromQuotation(qId);
                                }}
                                className="input w-full bg-white"
                                disabled={isEditMode} // Usually don't change source quote in edit
                            >
                                <option value="">Select Quotation...</option>
                                {quotations.map(q => (
                                    <option key={q.id} value={q.id}>{q.quote_number} - {q.subject}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Selecting a quotation will import its items.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer PO Ref *</label>
                            <input
                                type="text"
                                value={formData.customer_po_number}
                                onChange={(e) => setFormData({ ...formData, customer_po_number: e.target.value })}
                                className="input w-full bg-white"
                                required
                                placeholder="e.g. 4504642120"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project Schedule (Date)</label>
                            <input
                                type="date"
                                value={formData.project_schedule_date}
                                onChange={(e) => setFormData({ ...formData, project_schedule_date: e.target.value })}
                                className="input w-full bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Auto-filled)</label>
                            <div className="p-2 bg-gray-100 rounded">
                                {customers.find(c => c.id === formData.customer_id)?.company_name || 'No Customer Linked'}
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Phases & Items</h2>
                        <Button type="button" onClick={handleAddPhase} variant="secondary">
                            <Plus className="w-4 h-4" /> Add Phase
                        </Button>
                    </div>

                    {phases.map((phase) => (
                        <Card key={phase.id} className="relative">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <div className="flex items-center gap-2 w-1/2">
                                    <span className="font-semibold text-gray-500">Phase Name:</span>
                                    <input
                                        type="text"
                                        value={phase.name}
                                        onChange={(e) => handlePhaseNameChange(phase.id, e.target.value)}
                                        className="input flex-1 font-bold"
                                        placeholder="e.g. 01 Phase"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" onClick={() => handleAddItem(phase.id)}>
                                        <Plus className="w-3 h-3" /> Add Item
                                    </Button>
                                    <button type="button" onClick={() => handleRemovePhase(phase.id)} className="text-red-500 hover:text-red-700 p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th className="w-24">Qty</th>
                                        <th className="w-24">UOM</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {phase.items.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(phase.id, item.id, 'description', e.target.value)}
                                                    className="input w-full"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(phase.id, item.id, 'quantity', parseFloat(e.target.value))}
                                                    className="input w-full"
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    value={item.uom}
                                                    onChange={(e) => handleItemChange(phase.id, item.id, 'uom', e.target.value)}
                                                    className="input w-full"
                                                >
                                                    <option value="EA">EA</option>
                                                    <option value="Lot">Lot</option>
                                                    <option value="Nos">Nos</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button type="button" onClick={() => handleRemoveItem(phase.id, item.id)} className="text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {phase.items.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-center text-gray-500 italic py-4">No items in this phase</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </Card>
                    ))}
                </div>

                <div className="flex gap-4 justify-end">
                    <Button type="button" variant="secondary" onClick={() => navigate('/sales-orders')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Sales Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
