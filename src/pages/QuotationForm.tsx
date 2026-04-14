import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, ChevronDown } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Partner, Item } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { Editor } from '@tinymce/tinymce-react';
import '../lib/tinymce';

// Helper: add N days to a date string (YYYY-MM-DD)
const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

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

    // Terms content
    const [termsContent, setTermsContent] = useState('');

    const [formData, setFormData] = useState({
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subject: '',
        contact: '',
        rfq_ref_no: '',
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

    // Checkbox state for multi-select
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const toggleSelectItem = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === lineItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(lineItems.map(i => i.id)));
        }
    };

    const deleteSelectedItems = () => {
        if (selectedItems.size === 0) return;
        const remaining = lineItems.filter(i => !selectedItems.has(i.id));
        // Always keep at least one item
        if (remaining.length === 0) {
            showToast('Cannot delete all items. At least one item is required.', 'error');
            return;
        }
        setLineItems(remaining);
        setSelectedItems(new Set());
        showToast(`Deleted ${selectedItems.size} item(s)`, 'success');
    };

    useEffect(() => {
        const init = async () => {
            fetchCustomers();
            const masterItems = await fetchItems();
            const params = new URLSearchParams(window.location.search);
            const duplicateId = params.get('duplicate');
            if (id) {
                setIsEditMode(true);
                await loadQuotation(id, false, masterItems);
            } else if (duplicateId) {
                await loadQuotation(duplicateId, true, masterItems);
            } else {
                // Load default terms for new quotation
                loadDefaultTerms();
            }
        };
        init();
    }, [id]);

    const fetchCustomers = async () => {
        const data = await api.get<Partner[]>('/partners?type=customer');
        if (data) setCustomers(data);
    };

    const fetchItems = async () => {
        const data = await api.get<Item[]>('/items');
        if (data) {
            setItems(data);
            return data;
        }
        return [];
    };

    const loadDefaultTerms = async () => {
        try {
            const data = await api.get<any>('/terms/default');
            if (data) {
                setTermsContent(data.content || '');
            }
        } catch (error) {
            console.error('Error loading default terms:', error);
        }
    };

    const loadQuotation = async (quotationId: string, isDuplicate = false, masterItems: Item[] = []) => {
        setLoading(true);
        try {
            const quotation = await api.get<any>(`/quotations/${quotationId}`);

            if (quotation) {
                setFormData({
                    customer_id: quotation.customer_id,
                    date: isDuplicate ? new Date().toISOString().split('T')[0] : new Date(quotation.date).toISOString().split('T')[0],
                    valid_until: isDuplicate ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : (quotation.validity_date ? new Date(quotation.validity_date).toISOString().split('T')[0] : ''),
                    subject: quotation.subject || '',
                    contact: quotation.contact || '',
                    rfq_ref_no: quotation.rfq_ref_no || '',
                    discount_amount: quotation.discount_amount,
                    gst_rate: quotation.gst_rate,
                });

                if (quotation.items && quotation.items.length > 0) {
                    const loadedItems = quotation.items.map((item: any, index: number) => {
                        let matchedItemId = item.item_id || '';

                        // Auto-match if item_id is missing or doesn't match items list
                        if (!matchedItemId || !masterItems.find(i => i.id == matchedItemId)) {
                            const match = masterItems.find(i =>
                                (i.name && item.item_name && String(i.name).toLowerCase() === String(item.item_name).toLowerCase()) ||
                                (i.name && item.item_description && String(i.name).toLowerCase() === String(item.item_description).toLowerCase())
                            );
                            if (match) {
                                matchedItemId = match.id;
                            }
                        }

                        return {
                            id: `loaded-${index}`,
                            item_id: matchedItemId,
                            item_name: item.item_name || '',
                            item_description: item.item_description || '',
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            disc_percent: item.disc_percent,
                            disc_amount: item.disc_amount,
                            uom: item.uom || 'EA',
                            total_price: item.total_price,
                        };
                    });
                    setLineItems(loadedItems);
                }

                if (quotation.selected_terms) {
                    // Legacy: ignore old selected_terms
                }

                // Load terms_content
                setTermsContent(quotation.terms_content || '');
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



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !formData.customer_id) return;

        setLoading(true);
        try {
            const totals = calculateTotals();

            const itemsToSubmit = lineItems.map(item => ({
                item_id: item.item_id || null,
                item_description: item.item_description,
                quantity: item.quantity,
                uom: item.uom,
                unit_price: item.unit_price,
                disc_percent: item.disc_percent,
                disc_amount: item.disc_amount,
                total_price: item.total_price
            }));

            const quotationData = {
                customer_id: formData.customer_id,
                date: formData.date,
                validity_date: formData.valid_until,
                subject: formData.subject,
                contact: formData.contact,
                rfq_ref_no: formData.rfq_ref_no,
                subtotal: totals.subtotal,
                discount_amount: totals.headerDiscount,
                gst_rate: formData.gst_rate,
                total_amount: totals.total,
                total: totals.total,
                items: itemsToSubmit,
                terms_content: termsContent
            };

            if (isEditMode && id) {
                await api.put(`/quotations/${id}`, quotationData);
            } else {
                const quoteNum = 'CNK-Q-' + Date.now();
                await api.post('/quotations', {
                    ...quotationData,
                    quotation_number: quoteNum,
                    quote_number: quoteNum,
                    status: 'draft'
                });
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
                            <SearchableSelect
                                value={formData.customer_id}
                                onChange={(val) => setFormData({ ...formData, customer_id: val })}
                                options={customers.map(c => ({ label: c.company_name, value: c.id }))}
                                placeholder="Select Customer"
                                className="w-full"
                            />
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
                                Contact
                            </label>
                            <input
                                type="text"
                                value={formData.contact}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400 placeholder:text-gray-400"
                                placeholder="e.g. 085272124268"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                RFQ Ref No
                            </label>
                            <input
                                type="text"
                                value={formData.rfq_ref_no}
                                onChange={(e) => setFormData({ ...formData, rfq_ref_no: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400 placeholder:text-gray-400"
                                placeholder="e.g. RFQ-55777"
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
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="date"
                                        value={formData.valid_until}
                                        onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, valid_until: addDays(formData.date || new Date().toISOString().split('T')[0], 30) })}
                                    className="px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all whitespace-nowrap"
                                >
                                    +30 Days
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>


                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                            Line Items
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{lineItems.length}</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            {selectedItems.size > 0 && (
                                <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg animate-in fade-in duration-200">
                                    <span className="text-xs font-medium text-red-700">{selectedItems.size} selected</span>
                                    <button
                                        type="button"
                                        onClick={deleteSelectedItems}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded hover:bg-red-200 transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Delete
                                    </button>
                                </div>
                            )}
                            <Button type="button" onClick={addLineItem} variant="secondary" size="sm">
                                <Plus className="w-4 h-4 mr-1" />
                                Add Item
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-visible border border-gray-200 rounded-lg">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/80 text-left">
                                    <th className="py-2 px-2 w-10">
                                        <input
                                            type="checkbox"
                                            checked={lineItems.length > 0 && selectedItems.size === lineItems.length}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="py-2 px-1.5 text-xs font-medium text-gray-500 uppercase min-w-[180px]">Items</th>
                                    <th className="py-2 px-1.5 text-xs font-medium text-gray-500 uppercase w-20">QTY</th>
                                    <th className="py-2 px-1.5 text-xs font-medium text-gray-500 uppercase w-20">UOM</th>
                                    <th className="py-2 px-1.5 text-xs font-medium text-gray-500 uppercase w-28">Price</th>
                                    <th className="py-2 px-1.5 text-xs font-medium text-gray-500 uppercase w-20">Disc %</th>
                                    <th className="py-2 px-1.5 text-xs font-medium text-gray-500 uppercase w-28 text-right">Total</th>
                                    <th className="py-2 px-1.5 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lineItems.map((item) => (
                                    <tr key={item.id} className={`group hover:bg-gray-50/50 transition-colors ${selectedItems.has(item.id) ? 'bg-blue-50/40' : ''}`}>
                                        <td className="py-1.5 px-2 align-top">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.has(item.id)}
                                                onChange={() => toggleSelectItem(item.id)}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer mt-2"
                                            />
                                        </td>
                                        <td className="py-1.5 px-1.5">
                                            <div className="space-y-1">
                                                <SearchableSelect
                                                    value={item.item_id}
                                                    onChange={(val) => updateLineItem(item.id, 'item_id', val)}
                                                    options={items.map(i => ({ label: i.name, value: i.id }))}
                                                    placeholder="Select Item..."
                                                    className="w-full text-xs"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.item_description}
                                                    onChange={(e) => updateLineItem(item.id, 'item_description', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-white text-gray-900 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Description..."
                                                    required
                                                />
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1.5 align-top">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1.5 bg-white text-gray-900 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td className="py-1.5 px-1.5 align-top">
                                            <div className="relative">
                                                <select
                                                    value={item.uom}
                                                    onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                                                    className="w-full pl-2 pr-7 py-1.5 bg-white text-gray-900 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                                >
                                                    <option value="EA">EA</option>
                                                    <option value="Lot">Lot</option>
                                                    <option value="Nos">Nos</option>
                                                    <option value="PCS">PCS</option>
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1.5 align-top">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                                <input
                                                    type="number"
                                                    value={item.unit_price}
                                                    onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-5 pr-2 py-1.5 bg-white text-gray-900 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    step="0.01"
                                                    required
                                                />
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-1.5 align-top">
                                            <input
                                                type="number"
                                                value={item.disc_percent}
                                                onChange={(e) => updateLineItem(item.id, 'disc_percent', parseFloat(e.target.value) || 0)}
                                                className="w-full px-2 py-1.5 bg-white text-gray-900 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                        </td>
                                        <td className="py-1.5 px-1.5 align-top text-right text-xs font-medium text-gray-900">
                                            ${item.total_price.toFixed(2)}
                                        </td>
                                        <td className="py-1.5 px-1.5 align-top text-right">
                                            <button
                                                type="button"
                                                onClick={() => removeLineItem(item.id)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                                                disabled={lineItems.length === 1}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
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
                            <Editor
                                licenseKey="gpl"
                                value={termsContent}
                                onEditorChange={(newContent) => setTermsContent(newContent)}
                                init={{
                                    height: 400,
                                    menubar: false,
                                    plugins: ['advlist', 'lists', 'link', 'table', 'autolink', 'nonbreaking'],
                                    nonbreaking_force_tab: true,
                                    toolbar:
                                        'undo redo | blocks fontsize forecolor | ' +
                                        'bold italic underline strikethrough | ' +
                                        'bullist numlist indent outdent | ' +
                                        'table link | removeformat',
                                    table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
                                    content_style: 'body { font-family: Arial, sans-serif; font-size: 12px; }',
                                    branding: false,
                                    promotion: false,
                                }}
                            />
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

                <div className="flex gap-4 justify-end pt-6 border-t border-gray-200 mt-8 sticky bottom-0 bg-gray-50/80 backdrop-blur-sm p-4 -mx-4 -mb-4 rounded-b-lg">
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
