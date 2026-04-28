import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, ChevronDown, Building2, CreditCard, ShoppingCart, Copy } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Partner, Item, BankAccount } from '../types';
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
    item_name: string;
    item_description: string;
    quantity: number;
    unit_price: number;
    disc_percent: number;
    disc_amount: number;
    uom: string;
    total_price: number;
    needs_procurement: boolean;
}

interface ProcurementItem {
    id: string;
    item_id: string;
    item_code: string;
    description: string;
    quantity: number;
    uom: string;
    unit_price: number;
    total: number;
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

    // Bank details
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [editingBank, setEditingBank] = useState<Partial<BankAccount> | null>(null);
    const [showBankForm, setShowBankForm] = useState(false);

    // Add multiple items popover
    const [showAddMultiple, setShowAddMultiple] = useState(false);
    const [addCount, setAddCount] = useState(1);
    const addMultipleRef = useRef<HTMLDivElement>(null);

    // Procurement items (PO items modal)
    const [procurementItems, setProcurementItems] = useState<ProcurementItem[]>([]);
    const [showProcurementModal, setShowProcurementModal] = useState(false);

    // Single contact field (plain string)
    const [contact, setContact] = useState('');

    // Customer snapshot (editable, like vendor snapshot in PO)
    const [customerSnapshot, setCustomerSnapshot] = useState<{
        company_name: string; attn_name: string; address: string; phone: string; email: string;
    }>({ company_name: '', attn_name: '', address: '', phone: '', email: '' });

    // Multi-phone for snapshot
    const [snapshotPhones, setSnapshotPhones] = useState<string[]>(['']);
    const addSnapshotPhone = () => setSnapshotPhones(prev => [...prev, '']);
    const removeSnapshotPhone = (idx: number) => {
        if (snapshotPhones.length <= 1) return;
        setSnapshotPhones(prev => prev.filter((_, i) => i !== idx));
    };
    const updateSnapshotPhone = (idx: number, val: string) => {
        setSnapshotPhones(prev => prev.map((p, i) => i === idx ? val : p));
    };
    const parsePhoneFromDB = (phone: string | null | undefined): string[] => {
        if (!phone) return [''];
        try {
            const parsed = JSON.parse(phone);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* plain string */ }
        return [phone];
    };

    const [formData, setFormData] = useState({
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subject: '',
        rfq_ref_no: '',
        discount_amount: 0,
        gst_rate: 0,
        project_schedule_date: '',
        quote_number: '',
        quotation_number: '',
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
            needs_procurement: false,
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
        if (remaining.length === 0) {
            showToast('Cannot delete all items. At least one item is required.', 'error');
            return;
        }
        setLineItems(remaining);
        setSelectedItems(new Set());
        showToast(`Deleted ${selectedItems.size} item(s)`, 'success');
    };

    // Close add-multiple popover on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (addMultipleRef.current && !addMultipleRef.current.contains(e.target as Node)) {
                setShowAddMultiple(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const init = async () => {
            fetchCustomers();
            const masterItems = await fetchItems();
            fetchBankAccounts();
            const params = new URLSearchParams(window.location.search);
            const duplicateId = params.get('duplicate');
            if (id) {
                setIsEditMode(true);
                await loadQuotation(id, false, masterItems);
            } else if (duplicateId) {
                await loadQuotation(duplicateId, true, masterItems);
            } else {
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

    const fetchBankAccounts = async () => {
        try {
            const data = await api.get<BankAccount[]>('/companies/bank/all');
            if (data) setBankAccounts(data);
        } catch (e) {
            console.error('Error fetching bank accounts:', e);
        }
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
                    rfq_ref_no: quotation.rfq_ref_no || '',
                    discount_amount: quotation.discount_amount,
                    gst_rate: quotation.gst_rate,
                    project_schedule_date: quotation.project_schedule_date ? new Date(quotation.project_schedule_date).toISOString().split('T')[0] : '',
                    quote_number: isDuplicate ? '' : quotation.quote_number || quotation.quotation_number,
                    quotation_number: isDuplicate ? '' : quotation.quotation_number || quotation.quote_number,
                });

                // Restore customer snapshot
                if (quotation.customer_snapshot) {
                    const snap = typeof quotation.customer_snapshot === 'string' ? JSON.parse(quotation.customer_snapshot) : quotation.customer_snapshot;
                    setCustomerSnapshot(snap);
                    // Restore multi-phone state from snapshot
                    setSnapshotPhones(parsePhoneFromDB(snap.phone));
                } else if (quotation.customer_id) {
                    // Fallback: populate from master (fetch directly since customers state may not be loaded yet)
                    try {
                        const cust = await api.get<any>(`/partners/${quotation.customer_id}`);
                        if (cust) {
                            setCustomerSnapshot({
                                company_name: cust.company_name || '',
                                attn_name: cust.attn_name || '',
                                address: cust.address || '',
                                phone: cust.phone || '',
                                email: cust.email || '',
                            });
                            setSnapshotPhones(parsePhoneFromDB(cust.phone));
                        }
                    } catch (e) {
                        console.error('Error fetching customer for snapshot fallback', e);
                    }
                }

                if (quotation.contact) {
                    try {
                        const parsed = JSON.parse(quotation.contact);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            // Legacy JSON array — take first value
                            setContact(parsed[0]?.value || parsed[0]?.name || '');
                        } else {
                            setContact(quotation.contact);
                        }
                    } catch {
                        // Plain string
                        setContact(quotation.contact);
                    }
                }

                if (quotation.items && quotation.items.length > 0) {
                    const loadedItems = quotation.items.map((item: any, index: number) => {
                        let matchedItemId = item.item_id || '';

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
                            needs_procurement: item.needs_procurement || false,
                        };
                    });
                    setLineItems(loadedItems);
                }

                if (quotation.selected_terms) {
                    // Legacy: ignore old selected_terms
                }

                // Load terms_content
                setTermsContent(quotation.terms_content || '');

                // Load procurement items
                if (quotation.procurement_items && quotation.procurement_items.length > 0) {
                    setProcurementItems(quotation.procurement_items.map((pi: any, idx: number) => ({
                        id: `proc-${idx}`,
                        item_id: pi.item_id || '',
                        item_code: pi.item_code || '',
                        description: pi.description || '',
                        quantity: pi.quantity || 1,
                        uom: pi.uom || 'EA',
                        unit_price: pi.unit_price || 0,
                        total: pi.total || 0,
                    })));
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

    const addLineItems = (count: number) => {
        const newItems: LineItem[] = [];
        for (let i = 0; i < count; i++) {
            newItems.push({
                id: (Date.now() + i).toString(),
                item_id: '',
                item_name: '',
                item_description: '',
                quantity: 1,
                unit_price: 0,
                disc_percent: 0,
                disc_amount: 0,
                uom: 'EA',
                total_price: 0,
                needs_procurement: false,
            });
        }
        setLineItems([...lineItems, ...newItems]);
        setShowAddMultiple(false);
        setAddCount(1);
        if (count > 1) showToast(`Added ${count} item rows`, 'success');
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

    // Bank account management
    const handleSaveBank = async () => {
        if (!editingBank) return;
        try {
            if (editingBank.id) {
                await api.put(`/companies/bank/${editingBank.id}`, editingBank);
                showToast('Bank account updated', 'success');
            } else {
                await api.post('/companies/bank', { ...editingBank, is_primary: bankAccounts.length === 0 });
                showToast('Bank account created', 'success');
            }
            fetchBankAccounts();
            setEditingBank(null);
            setShowBankForm(false);
        } catch (e: any) {
            showToast(e.message || 'Failed to save bank', 'error');
        }
    };

    const handleDeleteBank = async (bankId: string) => {
        if (!confirm('Delete this bank account?')) return;
        try {
            await api.delete(`/companies/bank/${bankId}`);
            showToast('Bank account deleted', 'success');
            fetchBankAccounts();
        } catch (e: any) {
            showToast(e.message || 'Failed to delete', 'error');
        }
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
                total_price: item.total_price,
                item_name: item.item_name || null,
                needs_procurement: item.needs_procurement || false,
            }));

            const quotationData: any = {
                customer_id: formData.customer_id,
                date: formData.date,
                validity_date: formData.valid_until,
                subject: formData.subject,
                contact: contact,
                rfq_ref_no: formData.rfq_ref_no,
                subtotal: totals.subtotal,
                discount_amount: totals.headerDiscount,
                gst_rate: formData.gst_rate,
                total_amount: totals.total,
                total: totals.total,
                items: itemsToSubmit,
                procurement_items: procurementItems.map(pi => ({
                    item_id: pi.item_id || null,
                    item_code: pi.item_code || '',
                    description: pi.description || '',
                    quantity: pi.quantity || 1,
                    uom: pi.uom || 'EA',
                    unit_price: pi.unit_price || 0,
                    total: pi.total || 0,
                })),
                terms_content: termsContent,
                project_schedule_date: formData.project_schedule_date || null,
                quote_number: formData.quote_number,
                quotation_number: formData.quotation_number,
                customer_snapshot: {
                    ...customerSnapshot,
                    phone: JSON.stringify(snapshotPhones.filter(p => p.trim())),
                },
            };

            if (isEditMode && id) {
                // Preserve current status on edit
                const current = await api.get<any>(`/quotations/${id}`);
                quotationData.status = current?.status || 'draft';
                quotationData.customer_po_number = current?.customer_po_number || null;
                await api.put(`/quotations/${id}`, quotationData);
            } else {
                const quoteNum = 'CNK-Q-' + Date.now();
                await api.post('/quotations', {
                    ...quotationData,
                    status: 'draft',
                    quotation_number: quoteNum,
                    quote_number: quoteNum,
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
                <Button type="button" variant="secondary" onClick={() => setShowProcurementModal(true)}>
                    <ShoppingCart className="w-4 h-4" />
                    PO Items
                    {procurementItems.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs font-bold bg-orange-500 text-white rounded-full">{procurementItems.length}</span>
                    )}
                </Button>
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
                                onChange={(val) => {
                                    setFormData({ ...formData, customer_id: val });
                                    // Auto-fill customer snapshot
                                    const selectedCustomer = customers.find(c => c.id === val);
                                    if (selectedCustomer) {
                                        setCustomerSnapshot({
                                            company_name: selectedCustomer.company_name || '',
                                            attn_name: selectedCustomer.attn_name || '',
                                            address: selectedCustomer.address || '',
                                            phone: selectedCustomer.phone || '',
                                            email: selectedCustomer.email || '',
                                        });
                                        setSnapshotPhones(parsePhoneFromDB(selectedCustomer.phone));
                                    }
                                }}
                                options={customers.map(c => ({ label: c.company_name, value: c.id }))}
                                placeholder="Select Customer"
                                className="w-full"
                            />
                            {formData.customer_id && (
                                <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Company</label>
                                            <input type="text" value={customerSnapshot.company_name} onChange={e => setCustomerSnapshot(p => ({ ...p, company_name: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Attn</label>
                                            <input type="text" value={customerSnapshot.attn_name} onChange={e => setCustomerSnapshot(p => ({ ...p, attn_name: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Address</label>
                                            <textarea value={customerSnapshot.address} onChange={e => setCustomerSnapshot(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-gray-500 text-xs font-medium uppercase">Phone</label>
                                                <button type="button" onClick={addSnapshotPhone} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors">
                                                    <Plus className="w-2.5 h-2.5" /> Add Phone
                                                </button>
                                            </div>
                                            <div className="space-y-1.5">
                                                {snapshotPhones.map((phone, idx) => (
                                                    <div key={idx} className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-gray-400 w-3 text-center shrink-0">{idx + 1}</span>
                                                        <input type="text" value={phone} onChange={e => updateSnapshotPhone(idx, e.target.value)} className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. 021-333-2222" />
                                                        <button type="button" onClick={() => removeSnapshotPhone(idx)} className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 shrink-0" disabled={snapshotPhones.length === 1}>
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Email</label>
                                            <input type="text" value={customerSnapshot.email} onChange={e => setCustomerSnapshot(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                </div>
                            )}
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

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Contact
                            </label>
                            <input
                                type="text"
                                value={contact}
                                onChange={(e) => setContact(e.target.value)}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400 placeholder:text-gray-400"
                                placeholder="Contact person / phone / email"
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Project Schedule Date
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="date"
                                        value={formData.project_schedule_date}
                                        onChange={(e) => setFormData({ ...formData, project_schedule_date: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, project_schedule_date: addDays(formData.date || new Date().toISOString().split('T')[0], 30) })}
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
                            {/* Add items with count selector */}
                            <div className="relative" ref={addMultipleRef}>
                                <div className="flex">
                                    <Button type="button" onClick={() => addLineItems(1)} variant="secondary" size="sm">
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add Item
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddMultiple(!showAddMultiple)}
                                        className="ml-0.5 px-1.5 py-1.5 text-gray-500 bg-gray-100 border border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors -ml-px"
                                    >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {showAddMultiple && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 w-56">
                                        <p className="text-xs font-medium text-gray-500 mb-2">Add multiple rows</p>
                                        <div className="flex gap-1.5 mb-2">
                                            {[1, 3, 5, 10].map(n => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => addLineItems(n)}
                                                    className="flex-1 px-2 py-1.5 text-xs font-semibold border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                                >
                                                    +{n}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="number"
                                                min="1"
                                                max="50"
                                                value={addCount}
                                                onChange={e => setAddCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="Custom..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => addLineItems(addCount)}
                                                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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

                {/* Bank Details Section */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="w-1 h-6 bg-green-600 rounded-full"></span>
                            <CreditCard className="w-5 h-5 text-green-600" />
                            Bank Details
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{bankAccounts.length}</span>
                        </h2>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => { setEditingBank({ bank_name: '', bank_address: '', account_number: '', swift_code: '', branch_code: '', paynow_uen: '' }); setShowBankForm(true); }}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Bank
                        </Button>
                    </div>

                    {bankAccounts.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No bank accounts configured yet.</p>
                            <p className="text-xs mt-1">Add bank details that will appear on printed quotations.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Bank Name</th>
                                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Account No</th>
                                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Swift</th>
                                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">PayNow</th>
                                        <th className="py-2 px-3 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {bankAccounts.map(bank => (
                                        <tr key={bank.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-2 px-3 font-medium text-gray-900">
                                                {bank.bank_name}
                                                {bank.is_primary && <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Primary</span>}
                                            </td>
                                            <td className="py-2 px-3 text-gray-600">{bank.account_number}</td>
                                            <td className="py-2 px-3 text-gray-600">{bank.swift_code}</td>
                                            <td className="py-2 px-3 text-gray-600">{bank.branch_code}</td>
                                            <td className="py-2 px-3 text-gray-600">{bank.paynow_uen}</td>
                                            <td className="py-2 px-3">
                                                <div className="flex gap-1">
                                                    <button type="button" onClick={() => { setEditingBank(bank); setShowBankForm(true); }} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteBank(bank.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Bank Form Modal */}
                    {showBankForm && editingBank && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                                <h3 className="text-lg font-semibold mb-4">{editingBank.id ? 'Edit' : 'Add'} Bank Account</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                        <input type="text" value={editingBank.bank_name || ''} onChange={e => setEditingBank({ ...editingBank, bank_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. UOB Serangoon Central" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Address</label>
                                        <input type="text" value={editingBank.bank_address || ''} onChange={e => setEditingBank({ ...editingBank, bank_address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Bank address" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                            <input type="text" value={editingBank.account_number || ''} onChange={e => setEditingBank({ ...editingBank, account_number: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Swift Code</label>
                                            <input type="text" value={editingBank.swift_code || ''} onChange={e => setEditingBank({ ...editingBank, swift_code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
                                            <input type="text" value={editingBank.branch_code || ''} onChange={e => setEditingBank({ ...editingBank, branch_code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">PayNow UEN</label>
                                            <input type="text" value={editingBank.paynow_uen || ''} onChange={e => setEditingBank({ ...editingBank, paynow_uen: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <Button type="button" variant="secondary" onClick={() => { setShowBankForm(false); setEditingBank(null); }}>Cancel</Button>
                                    <Button type="button" onClick={handleSaveBank}>Save</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Procurement Items Modal */}
                {showProcurementModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <ShoppingCart className="w-5 h-5 text-orange-600" />
                                        Procurement Items (PO)
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-0.5">Items yang akan masuk ke Purchase Order saat Create PO</p>
                                </div>
                                <button type="button" onClick={() => setShowProcurementModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {/* Actions Row */}
                                <div className="flex items-center gap-2 mb-4">
                                    <Button type="button" variant="secondary" size="sm" onClick={() => {
                                        setProcurementItems(prev => [...prev, {
                                            id: `proc-${Date.now()}`,
                                            item_id: '',
                                            item_code: '',
                                            description: '',
                                            quantity: 1,
                                            uom: 'EA',
                                            unit_price: 0,
                                            total: 0,
                                        }]);
                                    }}>
                                        <Plus className="w-4 h-4" /> Add Item
                                    </Button>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => {
                                        const imported: ProcurementItem[] = lineItems.map((li, idx) => ({
                                            id: `imp-${Date.now()}-${idx}`,
                                            item_id: li.item_id || '',
                                            item_code: '',
                                            description: li.item_description || li.item_name || '',
                                            quantity: li.quantity,
                                            uom: li.uom || 'EA',
                                            unit_price: li.unit_price || 0,
                                            total: li.total_price || (li.quantity * li.unit_price),
                                        }));
                                        setProcurementItems(prev => [...prev, ...imported]);
                                        showToast(`Imported ${imported.length} item(s) from line items`, 'success');
                                    }}>
                                        <Copy className="w-4 h-4" /> Import from Line Items
                                    </Button>
                                    {procurementItems.length > 0 && (
                                        <Button type="button" variant="secondary" size="sm" onClick={() => { setProcurementItems([]); showToast('All procurement items cleared', 'info'); }}>
                                            <Trash2 className="w-4 h-4" /> Clear All
                                        </Button>
                                    )}
                                </div>

                                {procurementItems.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Belum ada procurement items.</p>
                                        <p className="text-xs mt-1">Tambah item manual atau import dari Line Items.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                                    <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Qty</th>
                                                    <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase w-20">UOM</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Unit Price</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Total</th>
                                                    <th className="py-2 px-3 w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {procurementItems.map((pi, idx) => (
                                                    <tr key={pi.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="py-2 px-3 text-gray-400 text-center">{idx + 1}</td>
                                                        <td className="py-2 px-3">
                                                            <div className="space-y-1">
                                                                <SearchableSelect
                                                                    value={pi.item_id}
                                                                    onChange={(val) => {
                                                                        const selectedItem = items.find(i => i.id === val);
                                                                        setProcurementItems(prev => prev.map(p => p.id === pi.id ? {
                                                                            ...p,
                                                                            item_id: val,
                                                                            item_code: selectedItem?.item_code || '',
                                                                            description: selectedItem?.name || p.description,
                                                                            unit_price: selectedItem?.price || p.unit_price,
                                                                            total: (selectedItem?.price || p.unit_price) * p.quantity,
                                                                        } : p));
                                                                    }}
                                                                    options={items.map(i => ({ label: `${i.item_code ? i.item_code + ' - ' : ''}${i.name}`, value: i.id }))}
                                                                    placeholder="Select or leave empty..."
                                                                    className="w-full min-w-[140px]"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={pi.item_code}
                                                                    onChange={(e) => setProcurementItems(prev => prev.map(p => p.id === pi.id ? { ...p, item_code: e.target.value } : p))}
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    placeholder="Item Code (manual)"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="text"
                                                                value={pi.description}
                                                                onChange={(e) => setProcurementItems(prev => prev.map(p => p.id === pi.id ? { ...p, description: e.target.value } : p))}
                                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
                                                                placeholder="Description"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="number"
                                                                value={pi.quantity}
                                                                onChange={(e) => {
                                                                    const qty = parseFloat(e.target.value) || 0;
                                                                    setProcurementItems(prev => prev.map(p => p.id === pi.id ? { ...p, quantity: qty, total: qty * p.unit_price } : p));
                                                                }}
                                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                min="0"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <select
                                                                value={pi.uom}
                                                                onChange={(e) => setProcurementItems(prev => prev.map(p => p.id === pi.id ? { ...p, uom: e.target.value } : p))}
                                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            >
                                                                {['EA', 'SET', 'LOT', 'PCS', 'M', 'KG', 'L', 'BOX', 'ROLL', 'UNIT'].map(u => (
                                                                    <option key={u} value={u}>{u}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <input
                                                                type="number"
                                                                value={pi.unit_price}
                                                                onChange={(e) => {
                                                                    const price = parseFloat(e.target.value) || 0;
                                                                    setProcurementItems(prev => prev.map(p => p.id === pi.id ? { ...p, unit_price: price, total: p.quantity * price } : p));
                                                                }}
                                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                min="0" step="0.01"
                                                            />
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-medium text-gray-900">
                                                            ${pi.total.toFixed(2)}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => setProcurementItems(prev => prev.filter(p => p.id !== pi.id))}
                                                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Procurement Total */}
                                {procurementItems.length > 0 && (
                                    <div className="flex justify-end mt-4">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 w-64">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-600">Total Items</span>
                                                <span className="font-medium">{procurementItems.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm font-bold mt-1 pt-1 border-t border-orange-200">
                                                <span className="text-gray-900">Grand Total</span>
                                                <span className="text-orange-600">${procurementItems.reduce((sum, p) => sum + p.total, 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                                <Button type="button" variant="secondary" onClick={() => setShowProcurementModal(false)}>Close</Button>
                            </div>
                        </div>
                    </div>
                )}

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
