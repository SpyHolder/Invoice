import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, Partner, Item, QuotationTerm, TERM_CATEGORIES, TermCategory } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LineItem {
    id: string;
    item_id: string;
    item_name: string; // Used for display context/search if needed
    item_description: string;
    quantity: number;
    unit_price: number;
    disc_percent: number;
    disc_amount: number;
    uom: string;
    total_price: number;
}

export const QuotationForm = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Partner[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Available and selected terms
    const [availableTerms, setAvailableTerms] = useState<QuotationTerm[]>([]);
    const [selectedTermIds, setSelectedTermIds] = useState<string[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<TermCategory[]>([...TERM_CATEGORIES]);

    const [formData, setFormData] = useState({
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subject: '',
        discount_amount: 0,
        gst_rate: 0,
    });

    const [lineItems, setLineItems] = useState<LineItem[]>([
        {
            id: '1',
            item_id: '',
            item_name: '',
            item_description: '',
            quantity: 1,
            unit_price: 0,
            disc_percent: 0,
            disc_amount: 0,
            uom: 'EA',
            total_price: 0,
        },
    ]);

    useEffect(() => {
        fetchCustomers();
        fetchItems();
        fetchAvailableTerms();
        if (id) {
            setIsEditMode(true);
            loadQuotation(id);
        }
    }, [id]);

    const fetchCustomers = async () => {
        const { data } = await supabase.from('partners').select('*').eq('type', 'customer').order('company_name');
        if (data) setCustomers(data);
    };

    const fetchItems = async () => {
        const { data } = await supabase.from('items').select('*').order('name');
        if (data) setItems(data);
    };

    const fetchAvailableTerms = async () => {
        const { data, error } = await supabase
            .from('quotation_terms')
            .select('*')
            .eq('is_active', true)
            .order('category')
            .order('sort_order');

        if (error) {
            console.error('Error fetching terms:', error);
            return;
        }

        if (data) {
            setAvailableTerms(data);
            // By default, select all active terms for new quotations
            if (!id) {
                setSelectedTermIds(data.map(t => t.id));
            }
        }
    };

    const loadQuotation = async (quotationId: string) => {
        setLoading(true);
        try {
            // Load quotation header
            const { data: quotation, error: quotationError } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', quotationId)
                .single();

            if (quotationError) throw quotationError;

            if (quotation) {
                setFormData({
                    customer_id: quotation.customer_id,
                    date: quotation.date,
                    valid_until: quotation.validity_date || '',
                    subject: quotation.subject || '',
                    discount_amount: quotation.discount_amount,
                    gst_rate: quotation.gst_rate,
                });

                // Load quotation items
                const { data: quotationItems, error: itemsError } = await supabase
                    .from('quotation_items')
                    .select('*')
                    .eq('quotation_id', quotationId);

                if (itemsError) throw itemsError;

                if (quotationItems && quotationItems.length > 0) {
                    const loadedItems = quotationItems.map((item, index) => ({
                        id: `loaded-${index}`,
                        item_id: '',
                        item_name: '',
                        item_description: item.item_description || '',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        disc_percent: item.disc_percent,
                        disc_amount: item.disc_amount,
                        uom: item.uom || 'EA',
                        total_price: item.total_price,
                    }));
                    setLineItems(loadedItems);
                }

                // Load selected terms
                const { data: selectedTerms, error: termsError } = await supabase
                    .from('quotation_selected_terms')
                    .select('term_id')
                    .eq('quotation_id', quotationId);

                if (termsError) throw termsError;

                if (selectedTerms) {
                    setSelectedTermIds(selectedTerms.map(t => t.term_id));
                }
            }
        } catch (error: any) {
            console.error('Error loading quotation:', error);
            showToast('Failed to load quotation', 'error');
            navigate('/quotations');
        } finally {
            setLoading(false);
        }
    };

    const addLineItem = () => {
        setLineItems([
            ...lineItems,
            {
                id: Date.now().toString(),
                item_id: '',
                item_name: '',
                item_description: '',
                quantity: 1,
                unit_price: 0,
                disc_percent: 0,
                disc_amount: 0,
                uom: 'EA',
                total_price: 0,
            },
        ]);
    };

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((item) => item.id !== id));
        }
    };

    const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
        setLineItems(
            lineItems.map((item) => {
                if (item.id === id) {
                    const updated = { ...item, [field]: value };

                    // If item_id changed, auto-fill details
                    if (field === 'item_id' && value) {
                        const selectedItem = items.find((i) => i.id === value);
                        if (selectedItem) {
                            updated.item_name = selectedItem.name;
                            updated.item_description = selectedItem.description || selectedItem.name;
                            updated.unit_price = selectedItem.price;
                            updated.uom = selectedItem.uom || 'EA';
                        }
                    }

                    // Calculate totals
                    const gross = updated.quantity * updated.unit_price;

                    if (field === 'disc_percent') {
                        updated.disc_amount = gross * (updated.disc_percent / 100);
                    } else if (field === 'quantity' || field === 'unit_price') {
                        updated.disc_amount = gross * (updated.disc_percent / 100);
                    }

                    updated.total_price = gross - updated.disc_amount;

                    return updated;
                }
                return item;
            })
        );
    };

    const calculateTotals = () => {
        let subtotal = 0;
        lineItems.forEach(item => {
            subtotal += item.total_price;
        });

        const headerDiscount = formData.discount_amount || 0;
        const taxableAmount = subtotal - headerDiscount;
        const gstAmount = taxableAmount * (formData.gst_rate / 100);
        const total = taxableAmount + gstAmount;

        return { subtotal, headerDiscount, gstAmount, total };
    };

    // Terms selection handlers
    const toggleTerm = (termId: string) => {
        setSelectedTermIds(prev =>
            prev.includes(termId)
                ? prev.filter(id => id !== termId)
                : [...prev, termId]
        );
    };

    const toggleCategory = (category: TermCategory) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const selectAllInCategory = (category: TermCategory) => {
        const categoryTermIds = availableTerms.filter(t => t.category === category).map(t => t.id);
        setSelectedTermIds(prev => [...new Set([...prev, ...categoryTermIds])]);
    };

    const deselectAllInCategory = (category: TermCategory) => {
        const categoryTermIds = availableTerms.filter(t => t.category === category).map(t => t.id);
        setSelectedTermIds(prev => prev.filter(id => !categoryTermIds.includes(id)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !formData.customer_id) return;

        setLoading(true);
        try {
            const totals = calculateTotals();

            const quotationData = {
                customer_id: formData.customer_id,
                date: formData.date,
                validity_date: formData.valid_until,
                subject: formData.subject,
                subtotal: totals.subtotal,
                discount_amount: totals.headerDiscount,
                gst_rate: formData.gst_rate,
                total_amount: totals.total,
            };

            let quotationId = id;

            if (isEditMode && id) {
                // Update existing
                const { error } = await supabase
                    .from('quotations')
                    .update(quotationData)
                    .eq('id', id);
                if (error) throw error;

                // Delete existing items
                await supabase.from('quotation_items').delete().eq('quotation_id', id);
                // Delete existing selected terms
                await supabase.from('quotation_selected_terms').delete().eq('quotation_id', id);
            } else {
                // Create new
                const { data, error: insertError } = await supabase
                    .from('quotations')
                    .insert([{
                        ...quotationData,
                        quotation_number: 'CNK-Q-' + Date.now(),
                        status: 'draft'
                    }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                quotationId = data.id;
            }

            // Insert items
            if (quotationId) {
                const itemsToInsert = lineItems.map(item => ({
                    quotation_id: quotationId,
                    item_description: item.item_description,
                    quantity: item.quantity,
                    uom: item.uom,
                    unit_price: item.unit_price,
                    disc_percent: item.disc_percent,
                    disc_amount: item.disc_amount,
                    total_price: item.total_price
                }));

                const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;

                // Insert selected terms
                if (selectedTermIds.length > 0) {
                    const termsToInsert = selectedTermIds.map(termId => ({
                        quotation_id: quotationId,
                        term_id: termId
                    }));
                    const { error: termsError } = await supabase.from('quotation_selected_terms').insert(termsToInsert);
                    if (termsError) throw termsError;
                }
            }

            showToast(`Quotation ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            navigate('/quotations');

        } catch (error: any) {
            console.error('Error saving quotation:', error);
            showToast(error.message || 'Failed to save quotation', 'error');
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    // Group terms by category
    const termsByCategory = TERM_CATEGORIES.reduce((acc, category) => {
        acc[category] = availableTerms.filter(t => t.category === category);
        return acc;
    }, {} as Record<TermCategory, QuotationTerm[]>);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/quotations')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Quotation</h1>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                <Card>
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                        Basic Information
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Customer <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.customer_id}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                    className="w-full pl-4 pr-10 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-all shadow-sm hover:border-blue-400"
                                    required
                                >
                                    <option value="">Select Customer</option>
                                    {customers.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                            {customer.company_name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400 placeholder:text-gray-400"
                                placeholder="e.g. Quotation for Project X"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Valid Until
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={formData.valid_until}
                                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400"
                                />
                            </div>
                        </div>
                    </div>
                </Card>


                <Card>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Line Items
                        </h2>
                        <Button type="button" onClick={addLineItem} variant="secondary" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Item
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 text-left">
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 min-w-[200px]">Items</th>
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 w-24">QTY</th>
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 w-24">UOM</th>
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 w-32">Price</th>
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 w-24">Disc %</th>
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 w-32 text-right">Total</th>
                                    <th className="py-3 px-2 text-sm font-medium text-gray-700 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lineItems.map((item) => (
                                    <tr key={item.id} className="group hover:bg-gray-50/50">
                                        <td className="py-3 px-2 space-y-2">
                                            <div className="relative">
                                                <select
                                                    value={item.item_id}
                                                    onChange={(e) => updateLineItem(item.id, 'item_id', e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                                >
                                                    <option value="">Select Item...</option>
                                                    {items.map((i) => (
                                                        <option key={i.id} value={i.id}>
                                                            {i.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                            <textarea
                                                value={item.item_description}
                                                onChange={(e) => updateLineItem(item.id, 'item_description', e.target.value)}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-y"
                                                placeholder="Description..."
                                                required
                                            />
                                        </td>
                                        <td className="py-3 px-2 align-top">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td className="py-3 px-2 align-top">
                                            <div className="relative">
                                                <select
                                                    value={item.uom}
                                                    onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                                                    className="w-full pl-3 pr-8 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                                >
                                                    <option value="EA">EA</option>
                                                    <option value="Lot">Lot</option>
                                                    <option value="Nos">Nos</option>
                                                    <option value="PCS">PCS</option>
                                                </select>
                                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 align-top">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-6 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    step="0.01"
                                                    required
                                                />
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 align-top">
                                            <input
                                                type="number"
                                                value={item.disc_percent}
                                                onChange={(e) => updateLineItem(item.id, 'disc_percent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                        </td>
                                        <td className="py-3 px-2 align-top text-right font-medium text-gray-900">
                                            ${item.total_price.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-2 align-top text-right">
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(item.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                                                disabled={lineItems.length === 1}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                                Terms & Conditions
                            </h2>
                            {availableTerms.length === 0 ? (
                                <p className="text-gray-500 text-sm">No terms available.</p>
                            ) : (
                                <div className="space-y-3">
                                    {TERM_CATEGORIES.map(category => {
                                        const categoryTerms = termsByCategory[category] || [];
                                        if (categoryTerms.length === 0) return null;

                                        const isExpanded = expandedCategories.includes(category);
                                        const selectedCount = categoryTerms.filter(t => selectedTermIds.includes(t.id)).length;
                                        const allSelected = selectedCount === categoryTerms.length;

                                        return (
                                            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                                    onClick={() => toggleCategory(category)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                                        <span className="font-medium text-sm text-gray-900">{category}</span>
                                                        <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                                            {selectedCount}/{categoryTerms.length}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            allSelected ? deselectAllInCategory(category) : selectAllInCategory(category);
                                                        }}
                                                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                                                    >
                                                        {allSelected ? 'None' : 'All'}
                                                    </button>
                                                </div>

                                                {isExpanded && (
                                                    <div className="p-3 space-y-2 bg-white border-t border-gray-100">
                                                        {categoryTerms.map(term => (
                                                            <div key={term.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer" onClick={() => toggleTerm(term.id)}>
                                                                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTermIds.includes(term.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                                                    {selectedTermIds.includes(term.id) && <Check className="w-3 h-3 text-white" />}
                                                                </div>
                                                                <div className="text-sm">
                                                                    {term.title && <span className="font-medium text-gray-900 block">{term.title}</span>}
                                                                    <span className="text-gray-600 leading-relaxed text-xs">{term.content}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="w-full md:w-80 space-y-6">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                                Summary
                            </h2>

                            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span className="font-medium text-gray-900">${totals.subtotal.toFixed(2)}</span>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-gray-200">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Discount Amount ($)</label>
                                        <input
                                            type="number"
                                            value={formData.discount_amount}
                                            onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">GST Rate (%)</label>
                                        <input
                                            type="number"
                                            value={formData.gst_rate}
                                            onChange={(e) => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-200 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Tax ({formData.gst_rate}%)</span>
                                        <span className="font-medium text-gray-900">${((totals.subtotal - formData.discount_amount) * (formData.gst_rate / 100)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-lg font-bold">
                                        <span className="text-gray-900">Total</span>
                                        <span className="text-blue-600">${totals.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="flex gap-4 justify-end pt-4">
                    <Button type="button" variant="secondary" onClick={() => navigate('/quotations')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading || !formData.customer_id}>
                        {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Quotation' : 'Create Quotation')}
                    </Button>
                </div>
            </form>
        </div >
    );
};
