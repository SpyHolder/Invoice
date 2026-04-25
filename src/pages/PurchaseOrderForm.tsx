import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, FolderPlus, ChevronDown, FileText, Truck, MapPin, Package, Search, User, ArrowRightLeft, Building2, ExternalLink, CalendarPlus, Tag, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Item, Partner } from '../types';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { Editor } from '@tinymce/tinymce-react';
import '../lib/tinymce';

// ── Interfaces ──────────────────────────────────────────

interface POLineItem {
    id: string;
    section_subject: string;
    item_id: string;
    item_code: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface ItemSection {
    subject: string;
    items: POLineItem[];
}

interface VendorSnapshot {
    company_name: string;
    attn_name: string;
    address: string;
    phone: string;
    email: string;
}

interface BillShipSnapshot {
    bill_to: string;
    bill_address: string;
}

interface WorkingAreaSnapshot {
    name: string;
    address: string;
    contact_person: string;
    phone: string;
}

interface WorkingArea {
    id: string;
    name: string;
    address: string;
    contact_person: string;
    phone: string;
}

// ── Component ───────────────────────────────────────────

export const PurchaseOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [vendors, setVendors] = useState<Partner[]>([]);
    const [workingAreas, setWorkingAreas] = useState<WorkingArea[]>([]);
    const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
    const [quotationsWithPO, setQuotationsWithPO] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // ── PO Details ──
    const [formData, setFormData] = useState({
        vendor_id: '',
        po_number: '',
        date: new Date().toISOString().split('T')[0],
        quote_ref: '',
        po_terms: 'Refer to Payment Below',
        shipping_info: 'Ship Via: FCA \u2013 To Working Site.\nIncoterm: DAP',
        delivery_address: '',
        doc_address: '',
        subject: '',
        notes: '',
        status: 'pending',
        gst_rate: 9,
    });

    // ── Snapshots ──
    const [vendorSnapshot, setVendorSnapshot] = useState<VendorSnapshot>({
        company_name: '', attn_name: '', address: '', phone: '', email: '',
    });

    const [billShipSnapshot, setBillShipSnapshot] = useState<BillShipSnapshot>({
        bill_to: 'To: Finance',
        bill_address: '60 Paya Lebar Road\n#08-45A Paya Lebar Square\nSingapore 409051',
    });

    const [workingAreaId, setWorkingAreaId] = useState('');
    const [workingAreaSnapshot, setWorkingAreaSnapshot] = useState<WorkingAreaSnapshot>({
        name: '', address: '', contact_person: '', phone: '',
    });

    // ── Sections (was groups) ──
    const [sections, setSections] = useState<ItemSection[]>([
        { subject: 'Default', items: [] }
    ]);
    const [newSectionSubject, setNewSectionSubject] = useState('');

    // ── Terms ──
    const [termsContent, setTermsContent] = useState('');

    // ── Item Picker ──
    const [showItemPicker, setShowItemPicker] = useState(false);
    const [itemPickerSearch, setItemPickerSearch] = useState('');
    const [itemPickerSelected, setItemPickerSelected] = useState<Map<string, { qty: number }>>(new Map());
    const [itemPickerSection, setItemPickerSection] = useState('Default');

    // ── (Backlog replaced by dropdown auto-fill) ──

    // ── Selection for bulk actions ──
    const [selectedPOItems, setSelectedPOItems] = useState<Set<string>>(new Set());

    // ── Move modal ──
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveTargetSection, setMoveTargetSection] = useState('');

    // ── Assign Item Code modal ──
    const [showAssignCodeModal, setShowAssignCodeModal] = useState(false);
    const [assignCodeValue, setAssignCodeValue] = useState('');

    // ── Move Item Code modal ──
    const [showMoveCodeModal, setShowMoveCodeModal] = useState(false);
    const [moveCodeValue, setMoveCodeValue] = useState('');

    // ── Helpers ──

    const toggleSelectPOItem = (itemId: string) => {
        setSelectedPOItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
            return next;
        });
    };

    const deleteSelectedPOItems = () => {
        if (selectedPOItems.size === 0) return;
        setSections(prev => prev.map(s => ({
            ...s, items: s.items.filter(i => !selectedPOItems.has(i.id))
        })));
        showToast(`Deleted ${selectedPOItems.size} item(s)`, 'success');
        setSelectedPOItems(new Set());
    };

    const moveSelectedItems = () => {
        if (selectedPOItems.size === 0 || !moveTargetSection) return;

        // Collect selected items from all sections
        const movedItems: POLineItem[] = [];
        const updatedSections = sections.map(s => {
            const kept: POLineItem[] = [];
            s.items.forEach(item => {
                if (selectedPOItems.has(item.id)) {
                    movedItems.push({ ...item, section_subject: moveTargetSection });
                } else {
                    kept.push(item);
                }
            });
            return { ...s, items: kept };
        });

        // Add moved items to target section
        const finalSections = updatedSections.map(s => {
            if (s.subject === moveTargetSection) {
                return { ...s, items: [...s.items, ...movedItems] };
            }
            return s;
        });

        setSections(finalSections);
        setSelectedPOItems(new Set());
        setShowMoveModal(false);
        showToast(`Moved ${movedItems.length} item(s) to "${moveTargetSection}"`, 'success');
    };

    // ── Item Code Bulk Actions ──

    const assignCodeToSelected = () => {
        if (selectedPOItems.size === 0 || !assignCodeValue.trim()) return;
        setSections(prev => prev.map(s => ({
            ...s, items: s.items.map(item =>
                selectedPOItems.has(item.id) ? { ...item, item_code: assignCodeValue.trim() } : item
            )
        })));
        showToast(`Assigned code "${assignCodeValue.trim()}" to ${selectedPOItems.size} item(s)`, 'success');
        setSelectedPOItems(new Set());
        setShowAssignCodeModal(false);
        setAssignCodeValue('');
    };

    const moveCodeForSelected = () => {
        if (selectedPOItems.size === 0 || !moveCodeValue.trim()) return;
        setSections(prev => prev.map(s => ({
            ...s, items: s.items.map(item =>
                selectedPOItems.has(item.id) ? { ...item, item_code: moveCodeValue.trim() } : item
            )
        })));
        showToast(`Moved ${selectedPOItems.size} item(s) to code "${moveCodeValue.trim()}"`, 'success');
        setSelectedPOItems(new Set());
        setShowMoveCodeModal(false);
        setMoveCodeValue('');
    };

    const clearItemCode = (subject: string, itemId: string) => {
        setSections(prev => prev.map(s => s.subject === subject ? {
            ...s, items: s.items.map(item => item.id === itemId ? { ...item, item_code: '' } : item)
        } : s));
    };

    // Get all unique item_codes across all sections for the "Move to Code" picker
    const allItemCodes = Array.from(new Set(
        sections.flatMap(s => s.items.map(i => i.item_code).filter(Boolean))
    ));

    // Sort items within each section by item_code (grouped)
    const getSortedItems = (items: POLineItem[]) => {
        return [...items].sort((a, b) => {
            // Items with codes come first, grouped together
            if (a.item_code && !b.item_code) return -1;
            if (!a.item_code && b.item_code) return 1;
            return a.item_code.localeCompare(b.item_code);
        });
    };

    // ── Init ──

    useEffect(() => {
        const init = async () => {
            fetchVendors();
            fetchWorkingAreas();
            fetchQuotationsWithProcurement();
            const masterItems = await fetchInventoryItems();
            const searchParams = new URLSearchParams(window.location.search);
            const duplicateId = searchParams.get('duplicate');
            const quotationId = searchParams.get('quotation_id');
            if (id) {
                setIsEditMode(true);
                await loadPurchaseOrder(id, false, masterItems);
            } else if (duplicateId) {
                await loadPurchaseOrder(duplicateId, true, masterItems);
            } else if (quotationId) {
                await loadItemsFromQuotation(quotationId, masterItems);
            } else {
                loadDefaultTerms();
                loadCompanyDefaults();
            }
        };
        init();
    }, [id]);

    const fetchVendors = async () => {
        const data = await api.get<Partner[]>('/partners?type=vendor');
        if (data) setVendors(data);
    };

    const fetchWorkingAreas = async () => {
        const data = await api.get<WorkingArea[]>('/working-areas');
        if (data) setWorkingAreas(data);
    };

    const fetchInventoryItems = async () => {
        const data = await api.get<Item[]>('/items');
        if (data) { setInventoryItems(data); return data; }
        return [];
    };

    const loadDefaultTerms = async () => {
        try {
            const data = await api.get<any>('/terms/default');
            if (data) setTermsContent(data.content || '');
        } catch (e) { console.error('Error loading default terms:', e); }
    };

    const fetchQuotationsWithProcurement = async () => {
        try {
            const allQ = await api.get<any[]>('/quotations');
            if (allQ) {
                // Only show confirmed quotations that have procurement items
                const withProcurement = allQ.filter(q => q.status === 'confirmed' && Number(q.procurement_item_count) > 0);
                setQuotationsWithPO(withProcurement);
            }
        } catch (e) { console.error('Error fetching quotations:', e); }
    };

    const handleQuoteRefSelect = async (quotationId: string) => {
        if (!quotationId) {
            setFormData(prev => ({ ...prev, quote_ref: '' }));
            return;
        }
        try {
            const fullQ = await api.get<any>(`/quotations/${quotationId}`);
            if (!fullQ) return;

            setFormData(prev => ({
                ...prev,
                quote_ref: fullQ.quote_number || fullQ.quotation_number || '',
                subject: fullQ.subject || prev.subject,
            }));

            // Auto-fill items only from procurement_items (no fallback to regular items)
            const procItems = fullQ.procurement_items;

            if (procItems && procItems.length > 0) {
                const poItems: POLineItem[] = procItems.map((item: any, idx: number) => ({
                    id: `qref-${Date.now()}-${idx}`,
                    section_subject: 'Default',
                    item_id: item.item_id || '',
                    item_code: item.item_code || '',
                    description: item.description || item.item_name || '',
                    quantity: item.quantity || 1,
                    unit_price: item.unit_price || 0,
                    total: (item.quantity || 0) * (item.unit_price || 0),
                }));
                setSections([{ subject: 'Default', items: poItems }]);
                showToast(`Loaded ${poItems.length} procurement items from Quotation`, 'success');
            } else {
                showToast('No procurement items found in this quotation', 'info');
            }
        } catch (e: any) {
            console.error(e);
            showToast('Failed to load quotation items', 'error');
        }
    };

    const loadCompanyDefaults = async () => {
        try {
            const companies = await api.get<any[]>('/companies');
            if (companies && companies.length > 0) {
                const co = companies[0];
                setBillShipSnapshot({
                    bill_to: 'To: Finance',
                    bill_address: co.address || '60 Paya Lebar Road\n#08-45A Paya Lebar Square\nSingapore 409051',
                });
            }
        } catch (e) { console.error('Error loading company:', e); }
    };

    // ── Vendor Selection ──

    const handleVendorSelect = (vendorId: string) => {
        setFormData(prev => ({ ...prev, vendor_id: vendorId }));
        const vendor = vendors.find(v => v.id === vendorId);
        if (vendor) {
            setVendorSnapshot({
                company_name: vendor.company_name || '',
                attn_name: vendor.attn_name || '',
                address: vendor.address || '',
                phone: vendor.phone || '',
                email: vendor.email || '',
            });
        }
    };

    // ── Working Area Selection ──

    const handleWorkingAreaSelect = (waId: string) => {
        setWorkingAreaId(waId);
        const wa = workingAreas.find(w => w.id === waId);
        if (wa) {
            setWorkingAreaSnapshot({
                name: wa.name || '',
                address: wa.address || '',
                contact_person: wa.contact_person || '',
                phone: wa.phone || '',
            });
        }
    };

    // ── Load PO ──

    const loadPurchaseOrder = async (poId: string, isDuplicate = false, _masterItems: Item[] = []) => {
        setLoading(true);
        try {
            const po = await api.get<any>(`/purchase-orders/${poId}`);
            if (!po) throw new Error('PO not found');

            setFormData({
                vendor_id: po.vendor_id || '',
                po_number: isDuplicate ? '' : po.po_number,
                date: isDuplicate ? new Date().toISOString().split('T')[0] : (po.date ? new Date(po.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
                quote_ref: po.quote_ref || '',
                po_terms: 'Refer to Payment Below',
                shipping_info: po.shipping_info || '',
                delivery_address: po.delivery_address || '',
                doc_address: '',
                subject: po.notes?.includes('Subject:') ? po.notes.split('Subject:')[1]?.split('\n')[0]?.trim() : '',
                notes: po.notes || '',
                status: isDuplicate ? 'pending' : po.status,
                gst_rate: po.tax && po.subtotal ? Math.round((po.tax / po.subtotal) * 100) : 9,
            });

            // Restore snapshots
            if (po.vendor_snapshot) {
                setVendorSnapshot(typeof po.vendor_snapshot === 'string' ? JSON.parse(po.vendor_snapshot) : po.vendor_snapshot);
            } else if (po.vendor_id) {
                // Fallback: populate from master
                const vendor = (await api.get<Partner[]>('/partners?type=vendor'))?.find(v => v.id === po.vendor_id);
                if (vendor) {
                    setVendorSnapshot({
                        company_name: vendor.company_name || '', attn_name: vendor.attn_name || '',
                        address: vendor.address || '', phone: vendor.phone || '', email: vendor.email || '',
                    });
                }
            }

            if (po.bill_ship_snapshot) {
                setBillShipSnapshot(typeof po.bill_ship_snapshot === 'string' ? JSON.parse(po.bill_ship_snapshot) : po.bill_ship_snapshot);
            } else {
                loadCompanyDefaults();
            }

            if (po.working_area_snapshot) {
                setWorkingAreaSnapshot(typeof po.working_area_snapshot === 'string' ? JSON.parse(po.working_area_snapshot) : po.working_area_snapshot);
            }

            // Parse items into sections
            const items = po.items;
            if (items && items.length > 0) {
                const sectionMap: Record<string, POLineItem[]> = { 'Default': [] };

                items.forEach((item: any, idx: number) => {
                    const match = item.description?.match(/^\[([^\]]+)\]\s*/);
                    let sectionSubject = 'Default';
                    let desc = item.description;

                    if (match) {
                        sectionSubject = match[1];
                        desc = item.description.replace(match[0], '');
                    }

                    if (!sectionMap[sectionSubject]) sectionMap[sectionSubject] = [];

                    sectionMap[sectionSubject].push({
                        id: item.id || `loaded-${idx}`,
                        section_subject: sectionSubject,
                        item_id: item.item_id || '',
                        item_code: item.item_code || '',
                        description: desc || '',
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.total
                    });
                });

                const newSections = Object.entries(sectionMap).map(([subject, sItems]) => ({ subject, items: sItems }));
                setSections(newSections.length > 0 ? newSections : [{ subject: 'Default', items: [] }]);
            }

            setTermsContent(po.terms_content || '');
        } catch (error: any) {
            console.error(error);
            showToast('Failed to load PO', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Load from Quotation ──

    const loadItemsFromQuotation = async (quotationId: string, masterItems: Item[] = []) => {
        setLoading(true);
        try {
            const quotation = await api.get<any>(`/quotations/${quotationId}`);
            if (!quotation) throw new Error('Quotation not found');

            setFormData(prev => ({
                ...prev,
                quote_ref: quotation.quote_number || quotation.quotation_number || '',
                subject: quotation.subject || '',
            }));

            const sourceItems = (quotation.procurement_items && quotation.procurement_items.length > 0)
                ? quotation.procurement_items.map((pi: any) => ({
                    item_description: pi.description, item_name: pi.description,
                    item_id: pi.item_id, item_code: pi.item_code,
                    quantity: pi.quantity, unit_price: pi.unit_price,
                }))
                : quotation.items;

            if (sourceItems && sourceItems.length > 0) {
                const poItems: POLineItem[] = sourceItems.map((item: any, idx: number) => {
                    let matchedItemId = item.item_id || '';
                    if (!matchedItemId) {
                        const mItem = masterItems.find(i =>
                            (i.name && item.item_description && String(i.name).toLowerCase() === String(item.item_description).toLowerCase()) ||
                            (i.name && item.item_name && String(i.name).toLowerCase() === String(item.item_name).toLowerCase())
                        );
                        if (mItem) matchedItemId = mItem.id;
                    }
                    const matchedMaster = masterItems.find(i => i.id === matchedItemId);
                    return {
                        id: `q-${idx}`,
                        section_subject: 'Default',
                        item_id: matchedItemId,
                        item_code: matchedMaster?.item_code || item.item_code || '',
                        description: item.item_description || item.item_name || item.description || '',
                        quantity: item.quantity,
                        unit_price: item.unit_price || 0,
                        total: (item.quantity || 0) * (item.unit_price || 0),
                    };
                });
                setSections([{ subject: 'Default', items: poItems }]);
                showToast(`Loaded ${poItems.length} items from Quotation`, 'success');
            }

            loadDefaultTerms();
            loadCompanyDefaults();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Failed to load quotation', 'error');
            loadDefaultTerms();
            loadCompanyDefaults();
        } finally {
            setLoading(false);
        }
    };

    // ── (Quotation Backlog removed—auto-fill via dropdown now) ──

    // ── Section Management ──

    const addSection = () => {
        if (!newSectionSubject.trim()) return;
        if (sections.some(s => s.subject.toLowerCase() === newSectionSubject.trim().toLowerCase())) {
            showToast('Subject already exists', 'error');
            return;
        }
        setSections([...sections, { subject: newSectionSubject.trim(), items: [] }]);
        setNewSectionSubject('');
    };

    const removeSection = (subject: string) => {
        if (sections.length <= 1) return;
        setSections(sections.filter(s => s.subject !== subject));
    };

    const updateSectionSubject = (oldSubject: string, newSubject: string) => {
        setSections(prev => prev.map(s =>
            s.subject === oldSubject
                ? { ...s, subject: newSubject, items: s.items.map(i => ({ ...i, section_subject: newSubject })) }
                : s
        ));
    };

    // ── Item Management ──

    const addItemToSection = (subject: string) => {
        setSections(prev => prev.map(s => {
            if (s.subject === subject) {
                return { ...s, items: [...s.items, {
                    id: Date.now().toString(),
                    section_subject: subject,
                    item_id: '', item_code: '', description: '',
                    quantity: 1, unit_price: 0, total: 0
                }] };
            }
            return s;
        }));
    };

    const removeItem = (subject: string, itemId: string) => {
        setSections(prev => prev.map(s => s.subject === subject ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s));
    };

    const updateItem = (subject: string, itemId: string, field: keyof POLineItem, value: any) => {
        setSections(prev => prev.map(s => {
            if (s.subject === subject) {
                return {
                    ...s,
                    items: s.items.map(item => {
                        if (item.id === itemId) {
                            const updated = { ...item, [field]: value };
                            if (field === 'item_id' && value) {
                                const invItem = inventoryItems.find(i => i.id === value);
                                if (invItem) {
                                    updated.item_code = invItem.item_code || '';
                                    updated.description = invItem.name + (invItem.description ? ` - ${invItem.description}` : '');
                                    updated.unit_price = invItem.price;
                                }
                            }
                            updated.total = updated.quantity * updated.unit_price;
                            return updated;
                        }
                        return item;
                    })
                };
            }
            return s;
        }));
    };

    // ── Calculations ──

    const calculateSubtotal = () => sections.reduce((acc, s) => acc + s.items.reduce((sum, i) => sum + i.total, 0), 0);
    const calculateGST = () => (calculateSubtotal() * formData.gst_rate) / 100;
    const calculateTotal = () => calculateSubtotal() + calculateGST();
    const getSectionSubtotal = (subject: string) => {
        const section = sections.find(s => s.subject === subject);
        return section ? section.items.reduce((sum, i) => sum + i.total, 0) : 0;
    };
    const getGroupLetter = (idx: number) => String.fromCharCode(65 + idx);
    const totalItemCount = sections.reduce((sum, s) => sum + s.items.length, 0);

    // ── Item Picker ──

    const openItemPicker = (sectionSubject: string = 'Default') => {
        setItemPickerSection(sectionSubject);
        setItemPickerSearch('');
        setItemPickerSelected(new Map());
        setShowItemPicker(true);
    };

    const toggleItemPickerItem = (itemId: string) => {
        setItemPickerSelected(prev => {
            const next = new Map(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.set(itemId, { qty: 1 });
            return next;
        });
    };

    const updateItemPickerQty = (itemId: string, qty: number) => {
        setItemPickerSelected(prev => {
            const next = new Map(prev);
            if (next.has(itemId)) next.set(itemId, { qty: Math.max(1, qty) });
            return next;
        });
    };

    const addSelectedInventoryItems = () => {
        if (itemPickerSelected.size === 0) { showToast('Select at least one item', 'error'); return; }

        const newItems: POLineItem[] = [];
        itemPickerSelected.forEach((data, itemId) => {
            const invItem = inventoryItems.find(i => i.id === itemId);
            if (invItem) {
                newItems.push({
                    id: `inv-${Date.now()}-${itemId}`,
                    section_subject: itemPickerSection,
                    item_id: invItem.id,
                    item_code: invItem.item_code || '',
                    description: invItem.name + (invItem.description ? ` - ${invItem.description}` : ''),
                    quantity: data.qty,
                    unit_price: invItem.price || 0,
                    total: data.qty * (invItem.price || 0),
                });
            }
        });

        const sectionExists = sections.some(s => s.subject === itemPickerSection);
        if (sectionExists) {
            setSections(prev => prev.map(s =>
                s.subject === itemPickerSection ? { ...s, items: [...s.items, ...newItems] } : s
            ));
        } else {
            setSections(prev => [...prev, { subject: itemPickerSection, items: newItems }]);
        }

        showToast(`Added ${newItems.length} item(s) from inventory`, 'success');
        setShowItemPicker(false);
    };

    const filteredPickerItems = inventoryItems.filter(item => {
        if (!itemPickerSearch) return true;
        const q = itemPickerSearch.toLowerCase();
        return item.name?.toLowerCase().includes(q) || item.item_code?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
    });

    // ── Submit ──

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const subtotal = calculateSubtotal();
            const tax = calculateGST();
            const total = calculateTotal();

            const notesWithMeta = [
                formData.subject ? `Subject: ${formData.subject}` : '',
                formData.notes
            ].filter(Boolean).join('\n');

            const allItems: any[] = [];
            sections.forEach(s => {
                s.items.forEach(item => {
                    allItems.push({
                        item_id: item.item_id || null,
                        item_code: item.item_code,
                        description: s.subject !== 'Default' ? `[${s.subject}] ${item.description}` : item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.total
                    });
                });
            });

            const poPayload = {
                vendor_id: formData.vendor_id,
                po_number: formData.po_number || `PO-${Date.now()}`,
                date: formData.date,
                quote_ref: formData.quote_ref,
                shipping_info: formData.shipping_info,
                delivery_address: formData.delivery_address,
                notes: notesWithMeta,
                status: formData.status || 'pending',
                subtotal, tax, total,
                items: allItems,
                terms_content: termsContent,
                vendor_snapshot: vendorSnapshot,
                bill_ship_snapshot: billShipSnapshot,
                working_area_snapshot: workingAreaSnapshot,
            };

            if (isEditMode && id) {
                await api.put(`/purchase-orders/${id}`, poPayload);
            } else {
                await api.post<any>('/purchase-orders', poPayload);
            }

            showToast('Purchase Order saved', 'success');
            navigate('/purchase-orders');
        } catch (error: any) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Render ──

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/purchase-orders')} className="hover:bg-gray-100">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit' : 'Create'} Purchase Order</h1>
                        <p className="text-sm text-gray-500">{isEditMode ? `Updating PO: ${formData.po_number}` : 'Create a new purchase order'}</p>
                    </div>
                </div>
                {isEditMode && (
                    <Badge variant={formData.status === 'confirmed' ? 'success' : formData.status === 'received' ? 'info' : formData.status === 'cancelled' ? 'danger' : 'warning'}>
                        {formData.status.toUpperCase()}
                    </Badge>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Row 1: General Info + Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* General Info */}
                        <Card>
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">General Information</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">PO Date *</label>
                                    <div className="flex items-center gap-2">
                                        <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required
                                            className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        <button type="button" onClick={() => {
                                            const d = new Date(formData.date || Date.now());
                                            d.setDate(d.getDate() + 30);
                                            setFormData(prev => ({ ...prev, date: d.toISOString().split('T')[0] }));
                                        }} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap">
                                            <CalendarPlus className="w-3.5 h-3.5" /> +30 days
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quote Reference</label>
                                    <SearchableSelect
                                        value={quotationsWithPO.find(q => q.quote_number === formData.quote_ref || q.quotation_number === formData.quote_ref)?.id || ''}
                                        onChange={handleQuoteRefSelect}
                                        options={quotationsWithPO.map(q => ({ label: `${q.quote_number || q.quotation_number} - ${q.subject || ''}`.trim(), value: q.id }))}
                                        placeholder="Select Quotation..."
                                    />
                                    {formData.quote_ref && (
                                        <p className="text-xs text-gray-500 mt-1">Ref: {formData.quote_ref}</p>
                                    )}
                                </div>
                                <Input label="Payment Terms" value={formData.po_terms} onChange={e => setFormData({ ...formData, po_terms: e.target.value })} placeholder="e.g. 30 Days Net" />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <div className="relative">
                                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                                            <option value="pending">Pending</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="received">Received</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"><ChevronDown className="w-4 h-4" /></div>
                                    </div>
                                </div>
                                <Input label="GST Rate (%)" type="number" min="0" max="100" value={formData.gst_rate} onChange={e => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) || 0 })} />
                                <Input label="Subject / Project" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} placeholder="e.g. PROJECT: HANWHA CCTV SYSTEM" />
                            </div>
                        </Card>

                        {/* Vendor */}
                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <User className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Vendor</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Vendor *</label>
                                    <SearchableSelect value={formData.vendor_id} onChange={handleVendorSelect}
                                        options={vendors.map(v => ({ label: v.company_name, value: v.id }))} placeholder="Select Vendor..." />
                                </div>
                                {formData.vendor_id && (
                                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Company</label>
                                                <input type="text" value={vendorSnapshot.company_name} onChange={e => setVendorSnapshot(p => ({ ...p, company_name: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Attn</label>
                                                <input type="text" value={vendorSnapshot.attn_name} onChange={e => setVendorSnapshot(p => ({ ...p, attn_name: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Address</label>
                                                <textarea value={vendorSnapshot.address} onChange={e => setVendorSnapshot(p => ({ ...p, address: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]" />
                                            </div>
                                            <div>
                                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Phone</label>
                                                <input type="text" value={vendorSnapshot.phone} onChange={e => setVendorSnapshot(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                            </div>
                                            <div>
                                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Email</label>
                                                <input type="text" value={vendorSnapshot.email} onChange={e => setVendorSnapshot(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Right: Summary + Shipping */}
                    <div className="space-y-6">
                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Summary</h2>
                            </div>
                            <div className="space-y-3">
                                {sections.filter(s => s.items.length > 0).map((s, idx) => (
                                    <div key={s.subject} className="flex justify-between text-sm text-gray-600">
                                        <span>{getGroupLetter(idx)} - {s.subject}</span>
                                        <span>{getSectionSubtotal(s.subject).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-gray-100 my-2 pt-2">
                                    <div className="flex justify-between text-sm font-medium text-gray-900 mb-1"><span>Subtotal</span><span>{calculateSubtotal().toFixed(2)}</span></div>
                                    <div className="flex justify-between text-sm text-gray-600 mb-2"><span>GST ({formData.gst_rate}%)</span><span>{calculateGST().toFixed(2)}</span></div>
                                    <div className="flex justify-between text-lg font-bold text-blue-600 border-t border-gray-200 pt-2"><span>Total</span><span>SGD {calculateTotal().toFixed(2)}</span></div>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <Truck className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Shipping Info</h2>
                            </div>
                            <textarea value={formData.shipping_info} onChange={e => setFormData({ ...formData, shipping_info: e.target.value })}
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                                placeholder="Ship Via: FCA &#10;Incoterm: DAP" />
                        </Card>
                    </div>
                </div>

                {/* Row 2: Bill & Ship + Working Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bill & Ship - Static form with defaults, NO dropdown */}
                    <Card>
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Bill & Ship to Documentation</h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">To</label>
                                <input type="text" value={billShipSnapshot.bill_to} onChange={e => setBillShipSnapshot(p => ({ ...p, bill_to: e.target.value }))}
                                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="To: Finance" />
                            </div>
                            <div>
                                <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Address</label>
                                <textarea value={billShipSnapshot.bill_address} onChange={e => setBillShipSnapshot(p => ({ ...p, bill_address: e.target.value }))}
                                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                                    placeholder={"60 Paya Lebar Road\n#08-45A Paya Lebar Square\nSingapore 409051"} />
                            </div>
                        </div>
                    </Card>

                    {/* Working Area - Dropdown + editable fields */}
                    <Card>
                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Working Site / Delivery</h2>
                            </div>
                            <button type="button" onClick={() => window.open('/working-areas', '_blank')}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                                <ExternalLink className="w-3 h-3" /> Manage Sites
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Working Area</label>
                                <SearchableSelect value={workingAreaId} onChange={handleWorkingAreaSelect}
                                    options={workingAreas.map(wa => ({ label: wa.name, value: wa.id }))} placeholder="Select Working Area..." />
                            </div>
                            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="md:col-span-2">
                                        <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Site Name</label>
                                        <input type="text" value={workingAreaSnapshot.name} onChange={e => setWorkingAreaSnapshot(p => ({ ...p, name: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Samsung Site A" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Address</label>
                                        <textarea value={workingAreaSnapshot.address} onChange={e => setWorkingAreaSnapshot(p => ({ ...p, address: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]" placeholder="Full site address..." />
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Contact Person</label>
                                        <input type="text" value={workingAreaSnapshot.contact_person} onChange={e => setWorkingAreaSnapshot(p => ({ ...p, contact_person: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="On-site contact" />
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs font-medium uppercase block mb-1">Phone</label>
                                        <input type="text" value={workingAreaSnapshot.phone} onChange={e => setWorkingAreaSnapshot(p => ({ ...p, phone: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Phone number" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Items Section — FULL WIDTH */}
                <Card>
                    <div className="mb-6 pb-4 border-b border-gray-100">
                        {/* Row 1: Title + Item count */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-800">Items by Subject</h2>
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{totalItemCount} items</span>
                            </div>
                        </div>
                        {/* Row 2: Actions — wrapped properly */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedPOItems.size > 0 && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg flex-wrap">
                                    <span className="text-xs font-medium text-red-700">{selectedPOItems.size} selected</span>
                                    <button type="button" onClick={deleteSelectedPOItems} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded hover:bg-red-200 transition-colors">
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                    <button type="button"
                                        onClick={() => { setMoveTargetSection(sections[0]?.subject || ''); setShowMoveModal(true); }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded hover:bg-blue-200 transition-colors">
                                        <ArrowRightLeft className="w-3 h-3" /> Move Section
                                    </button>
                                    <button type="button"
                                        onClick={() => { setAssignCodeValue(''); setShowAssignCodeModal(true); }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-600 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors">
                                        <Tag className="w-3 h-3" /> Assign Code
                                    </button>
                                    <button type="button"
                                        onClick={() => { setMoveCodeValue(''); setShowMoveCodeModal(true); }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-purple-600 bg-purple-100 rounded hover:bg-purple-200 transition-colors">
                                        <ArrowRightLeft className="w-3 h-3" /> Move Code
                                    </button>
                                </div>
                            )}
                            <Button type="button" onClick={() => openItemPicker('Default')} variant="secondary" size="sm"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                <Package className="w-4 h-4" /> Add from Inventory
                            </Button>
                            <div className="flex items-center gap-2">
                                <input type="text" value={newSectionSubject} onChange={e => setNewSectionSubject(e.target.value)}
                                    placeholder="New subject..." className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSection(); } }} />
                                <Button type="button" onClick={addSection} variant="secondary" size="sm">
                                    <FolderPlus className="w-4 h-4" /> Add Subject
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Flat table with inline subject headers */}
                    <div className="border border-gray-300 rounded-lg overflow-visible">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-700 text-white text-xs uppercase">
                                    <th className="py-2.5 px-2 w-10"></th>
                                    <th className="py-2.5 px-3 text-left w-12">No</th>
                                    <th className="py-2.5 px-3 text-left w-36">Item Code</th>
                                    <th className="py-2.5 px-3 text-left">Description</th>
                                    <th className="py-2.5 px-3 text-center w-20">QTY</th>
                                    <th className="py-2.5 px-3 text-right w-32">Unit Price (SGD)</th>
                                    <th className="py-2.5 px-3 text-right w-32">Total (SGD)</th>
                                    <th className="py-2.5 px-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sections.map((section, sIdx) => (
                                    <> 
                                        {/* Subject Header Row (like Invoice) */}
                                        <tr key={`section-${section.subject}`} className="bg-blue-50 border-t-2 border-blue-300">
                                            <td className="py-2 px-2"></td>
                                            <td className="py-2 px-3 font-bold text-blue-800">{getGroupLetter(sIdx)}</td>
                                            <td colSpan={5} className="py-2 px-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-blue-700 font-semibold text-xs uppercase">Subject:</span>
                                                    <input type="text" value={section.subject}
                                                        onChange={e => updateSectionSubject(section.subject, e.target.value)}
                                                        className="flex-1 px-2 py-1 bg-white border border-blue-200 rounded text-sm font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                                    <button type="button" onClick={() => addItemToSection(section.subject)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
                                                        <Plus className="w-3 h-3" /> Add Item
                                                    </button>
                                                    <button type="button" onClick={() => openItemPicker(section.subject)}
                                                        className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-0.5">
                                                        <Package className="w-3 h-3" /> From Inventory
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                {sections.length > 1 && (
                                                    <button type="button" onClick={() => removeSection(section.subject)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {section.items.length === 0 ? (
                                            <tr key={`empty-${section.subject}`} className="border-t border-gray-100">
                                                <td colSpan={8} className="py-6 text-center text-gray-400 text-xs italic">
                                                    No items yet. Click "Add Item" or "From Inventory" above.
                                                </td>
                                            </tr>
                                        ) : (
                                            (() => {
                                                const sorted = getSortedItems(section.items);
                                                let prevCode = '';
                                                return sorted.map((item, iIdx) => {
                                                    const isNewGroup = item.item_code && item.item_code !== prevCode;
                                                    const isSameGroup = item.item_code && item.item_code === prevCode;
                                                    prevCode = item.item_code;
                                                    return (
                                                        <tr key={item.id} className={`border-t transition-colors ${
                                                            selectedPOItems.has(item.id) ? 'bg-blue-50/40' : 
                                                            item.item_code ? (isNewGroup ? 'border-t-2 border-t-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/50' : 'bg-emerald-50/20 hover:bg-emerald-50/40 border-gray-100') : 
                                                            'border-gray-100 hover:bg-gray-50/50'
                                                        }`} style={item.item_code ? { borderLeft: '3px solid #10b981' } : {}}>
                                                            <td className="py-1.5 px-2 text-center">
                                                                <input type="checkbox" checked={selectedPOItems.has(item.id)} onChange={() => toggleSelectPOItem(item.id)}
                                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                                            </td>
                                                            <td className="py-1.5 px-3 text-gray-500 text-center">{iIdx + 1}</td>
                                                            <td className="py-1.5 px-3">
                                                                {item.item_code ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className={`flex-1 px-2 py-1.5 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-600 ${isSameGroup ? 'opacity-40' : ''}`}>
                                                                            {isSameGroup ? '' : item.item_code}
                                                                        </span>
                                                                        <button type="button" onClick={() => clearItemCode(section.subject, item.id)}
                                                                            className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Clear item code">
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <input type="text" value={item.item_code} onChange={e => updateItem(section.subject, item.id, 'item_code', e.target.value)}
                                                                        className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono" placeholder="Item code..." />
                                                                )}
                                                            </td>
                                                            <td className="py-1.5 px-3">
                                                                <textarea value={item.description} onChange={e => updateItem(section.subject, item.id, 'description', e.target.value)}
                                                                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[32px]"
                                                                    placeholder="Item description..." rows={1} />
                                                            </td>
                                                            <td className="py-1.5 px-3">
                                                                <input type="number" value={item.quantity} onChange={e => updateItem(section.subject, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" min="0" />
                                                            </td>
                                                            <td className="py-1.5 px-3">
                                                                <input type="number" value={item.unit_price} onChange={e => updateItem(section.subject, item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500" min="0" step="0.01" />
                                                            </td>
                                                            <td className="py-1.5 px-3 text-right font-semibold text-gray-900 text-xs whitespace-nowrap">
                                                                {item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="py-1.5 px-3 text-center">
                                                                <button type="button" onClick={() => removeItem(section.subject, item.id)}
                                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })()
                                        )}

                                        {section.items.length > 0 && (
                                            <tr key={`subtotal-${section.subject}`} className="border-t border-gray-200 bg-gray-50/50">
                                                <td colSpan={6} className="py-2 px-3 text-right text-xs font-medium text-gray-600">
                                                    {getGroupLetter(sIdx)} - {section.subject} Subtotal
                                                </td>
                                                <td className="py-2 px-3 text-right text-sm font-bold text-gray-900">
                                                    {getSectionSubtotal(section.subject).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Terms & Notes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-l-4 border-l-purple-500">
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Terms & Conditions</h2>
                        </div>
                        <Editor licenseKey="gpl" value={termsContent} onEditorChange={(c) => setTermsContent(c)}
                            init={{ height: 400, menubar: false,
                                plugins: ['advlist', 'lists', 'link', 'table', 'autolink', 'nonbreaking'],
                                nonbreaking_force_tab: true,
                                toolbar: 'undo redo | blocks fontsize forecolor | bold italic underline strikethrough | bullist numlist indent outdent | table link | removeformat',
                                content_style: 'body { font-family: Arial, sans-serif; font-size: 12px; }',
                                branding: false, promotion: false,
                            }} />
                    </Card>
                    <Card>
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Notes</h2>
                        </div>
                        <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] text-sm" placeholder="Additional notes..." />
                    </Card>
                </div>

                {/* ── Modals ── */}

                {/* Move Items Modal */}
                {showMoveModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                                Move {selectedPOItems.size} Item(s) to Section
                            </h3>
                            <select value={moveTargetSection} onChange={e => setMoveTargetSection(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
                                {sections.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
                            </select>
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="secondary" onClick={() => setShowMoveModal(false)}>Cancel</Button>
                                <Button type="button" onClick={moveSelectedItems}>Move Items</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assign Item Code Modal */}
                {showAssignCodeModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Tag className="w-5 h-5 text-emerald-600" />
                                Assign Item Code
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">Assign a code to {selectedPOItems.size} selected item(s). Coded items are grouped together in the table and print preview.</p>
                            <input type="text" value={assignCodeValue} onChange={e => setAssignCodeValue(e.target.value)}
                                placeholder="e.g. QNO-6012R" autoFocus
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono mb-4"
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); assignCodeToSelected(); } }} />
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="secondary" onClick={() => setShowAssignCodeModal(false)}>Cancel</Button>
                                <Button type="button" onClick={assignCodeToSelected} disabled={!assignCodeValue.trim()}>Assign</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Move Item Code Modal */}
                {showMoveCodeModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-purple-600" />
                                Move to Item Code
                            </h3>
                            <p className="text-sm text-gray-500 mb-3">Move {selectedPOItems.size} selected item(s) to a different item code group.</p>
                            {allItemCodes.length > 0 && (
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">EXISTING CODES</label>
                                    <div className="flex flex-wrap gap-1">
                                        {allItemCodes.map(code => (
                                            <button key={code} type="button" onClick={() => setMoveCodeValue(code)}
                                                className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${moveCodeValue === code ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                                {code}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <input type="text" value={moveCodeValue} onChange={e => setMoveCodeValue(e.target.value)}
                                placeholder="Enter new or pick existing code" autoFocus
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono mb-4" />
                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="secondary" onClick={() => setShowMoveCodeModal(false)}>Cancel</Button>
                                <Button type="button" onClick={moveCodeForSelected} disabled={!moveCodeValue.trim()}>Move</Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Item Picker Modal */}
                {showItemPicker && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Package className="w-5 h-5 text-blue-600" /> Select Items from Inventory
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Adding to: <span className="font-medium text-gray-700">{itemPickerSection}</span>
                                    </p>
                                </div>
                                <button type="button" onClick={() => setShowItemPicker(false)} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="text" value={itemPickerSearch} onChange={e => setItemPickerSearch(e.target.value)}
                                        placeholder="Search items by name, code, or category..." autoFocus
                                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Add to:</label>
                                    <select value={itemPickerSection} onChange={e => setItemPickerSection(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        {sections.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                {filteredPickerItems.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">{itemPickerSearch ? 'No items match.' : 'No items.'}</p>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="py-2 px-3 text-center w-10">
                                                        <input type="checkbox"
                                                            checked={filteredPickerItems.length > 0 && filteredPickerItems.every(i => itemPickerSelected.has(i.id))}
                                                            onChange={() => {
                                                                const all = filteredPickerItems.every(i => itemPickerSelected.has(i.id));
                                                                setItemPickerSelected(prev => {
                                                                    const next = new Map(prev);
                                                                    filteredPickerItems.forEach(i => { if (all) next.delete(i.id); else if (!next.has(i.id)) next.set(i.id, { qty: 1 }); });
                                                                    return next;
                                                                });
                                                            }}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" />
                                                    </th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase w-24">Price</th>
                                                    <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Stock</th>
                                                    <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredPickerItems.map(item => {
                                                    const isSel = itemPickerSelected.has(item.id);
                                                    const selData = itemPickerSelected.get(item.id);
                                                    return (
                                                        <tr key={item.id} className={`hover:bg-gray-50 cursor-pointer ${isSel ? 'bg-blue-50/50' : ''}`}
                                                            onClick={() => toggleItemPickerItem(item.id)}>
                                                            <td className="py-2 px-3 text-center">
                                                                <input type="checkbox" checked={isSel} onChange={() => toggleItemPickerItem(item.id)}
                                                                    onClick={e => e.stopPropagation()} className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" />
                                                            </td>
                                                            <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item.item_code || '-'}</td>
                                                            <td className="py-2 px-3">
                                                                <div className="font-medium text-gray-900">{item.name}</div>
                                                                {item.description && <div className="text-xs text-gray-500 truncate max-w-[250px]">{item.description}</div>}
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {item.category ? <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{item.category}</span> : <span className="text-gray-300">-</span>}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-medium text-gray-900">${item.price?.toFixed(2) || '0.00'}</td>
                                                            <td className="py-2 px-3 text-center">
                                                                <span className={`text-xs font-medium ${item.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>{item.stock}</span>
                                                            </td>
                                                            <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                                {isSel ? (
                                                                    <input type="number" value={selData?.qty || 1} onChange={e => updateItemPickerQty(item.id, parseInt(e.target.value) || 1)}
                                                                        className="w-16 px-2 py-1 border border-blue-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50" min="1" />
                                                                ) : <span className="text-gray-300">-</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                                <div className="text-sm text-gray-500">
                                    {filteredPickerItems.length} shown
                                    {itemPickerSelected.size > 0 && <span className="ml-2 text-blue-600 font-medium">&bull; {itemPickerSelected.size} selected</span>}
                                </div>
                                <div className="flex gap-3">
                                    <Button type="button" variant="secondary" onClick={() => setShowItemPicker(false)}>Cancel</Button>
                                    <Button type="button" onClick={addSelectedInventoryItems} disabled={itemPickerSelected.size === 0}>
                                        <Plus className="w-4 h-4" /> Add {itemPickerSelected.size || ''} Item{itemPickerSelected.size !== 1 ? 's' : ''}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}



                {/* Submit */}
                <div className="flex gap-4 justify-end pt-6 border-t border-gray-200 mt-8 sticky bottom-0 bg-gray-50/80 backdrop-blur-sm p-4 -mx-4 -mb-4 rounded-b-lg">
                    <Button type="button" variant="ghost" onClick={() => navigate('/purchase-orders')} className="hover:bg-gray-200">Cancel</Button>
                    <Button type="submit" disabled={loading} size="lg" className="px-8 shadow-lg shadow-blue-500/20">
                        {loading && <div className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {loading ? 'Saving Order...' : 'Save Purchase Order'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
