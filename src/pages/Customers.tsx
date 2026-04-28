import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users, Search, Phone } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Partner } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const Customers = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Partner[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Partner[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partner | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        company_name: '',
        attn_name: '',
        email: '',
        address: '',
    });

    // Multi-phone support
    const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);

    const addPhoneNumber = () => setPhoneNumbers(prev => [...prev, '']);
    const removePhoneNumber = (idx: number) => {
        if (phoneNumbers.length <= 1) return;
        setPhoneNumbers(prev => prev.filter((_, i) => i !== idx));
    };
    const updatePhoneNumber = (idx: number, val: string) => {
        setPhoneNumbers(prev => prev.map((p, i) => i === idx ? val : p));
    };

    // Parse phone from DB (could be JSON array or plain string)
    const parsePhoneFromDB = (phone: string | null | undefined): string[] => {
        if (!phone) return [''];
        try {
            const parsed = JSON.parse(phone);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { /* plain string */ }
        return [phone];
    };

    useEffect(() => {
        fetchCustomers();
    }, [user]);

    useEffect(() => {
        const filtered = customers.filter(customer =>
            customer.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.attn_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.phone?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredCustomers(filtered);
    }, [customers, searchQuery]);

    const fetchCustomers = async () => {
        if (!user) return;

        try {
            const data = await api.get<Partner[]>('/partners?type=customer');
            setCustomers(data);
        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('Failed to fetch customers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);

        const customerData = {
            company_name: formData.company_name,
            attn_name: formData.attn_name,
            email: formData.email || '',
            phone: JSON.stringify(phoneNumbers.filter(p => p.trim())),
            address: formData.address || '',
            type: 'customer',
        };

        try {
            if (editingCustomer) {
                await api.put(`/partners/${editingCustomer.id}`, customerData);
                showToast('Customer updated successfully!', 'success');
            } else {
                await api.post('/partners', customerData);
                showToast('Customer added successfully!', 'success');
            }

            setIsModalOpen(false);
            resetForm();
            await fetchCustomers();
        } catch (error: any) {
            console.error('Error saving customer:', error);
            showToast(error.message || 'Failed to save customer. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (customer: Partner) => {
        setEditingCustomer(customer);
        setFormData({
            company_name: customer.company_name,
            attn_name: customer.attn_name || '',
            email: customer.email || '',
            address: customer.address || '',
        });
        setPhoneNumbers(parsePhoneFromDB(customer.phone));
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, customerName: string) => {
        if (confirm(`Are you sure you want to delete "${customerName}"? This action cannot be undone.`)) {
            try {
                await api.delete(`/partners/${id}`);
                showToast('Customer deleted successfully!', 'success');
                await fetchCustomers();
            } catch (error: any) {
                console.error('Error deleting customer:', error);
                showToast(error.message || 'Failed to delete customer.', 'error');
            }
        }
    };

    const resetForm = () => {
        setFormData({ company_name: '', attn_name: '', email: '', address: '' });
        setPhoneNumbers(['']);
        setEditingCustomer(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
                    <p className="text-gray-600 mt-1">Manage your customer database</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4" />
                    Add Customer
                </Button>
            </div>

            {/* Search Bar */}
            <Card>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input bg-white pl-10"
                    />
                </div>
            </Card>

            <Card>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : filteredCustomers.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        {searchQuery ? (
                            <p className="text-gray-600">No customers found matching "{searchQuery}"</p>
                        ) : (
                            <p className="text-gray-600">No customers yet. Add your first customer!</p>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th>Contact</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id}>
                                        <td className="font-medium">{customer.company_name}</td>
                                        <td className="text-gray-600">{customer.attn_name || '-'}</td>
                                        <td className="text-gray-600">{customer.email || '-'}</td>
                                        <td className="text-gray-600">
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(customer.phone || '[]');
                                                    if (Array.isArray(parsed)) return parsed.filter(Boolean).join(', ') || '-';
                                                } catch { /* plain string */ }
                                                return customer.phone || '-';
                                            })()}
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(customer)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id, customer.company_name)}
                                                    className="text-red-600 hover:text-red-800"
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

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Company Name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        required
                    />
                    <Input
                        label="Contact Person"
                        value={formData.attn_name}
                        onChange={(e) => setFormData({ ...formData, attn_name: e.target.value })}
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                <Phone className="w-4 h-4 text-gray-400" />
                                Phone Numbers
                            </label>
                            <button
                                type="button"
                                onClick={addPhoneNumber}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Add Phone
                            </button>
                        </div>
                        <div className="space-y-2">
                            {phoneNumbers.map((phone, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-4 text-center shrink-0">{idx + 1}</span>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => updatePhoneNumber(idx, e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm hover:border-blue-400 placeholder:text-gray-400"
                                        placeholder="e.g. 021-333-2222"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePhoneNumber(idx)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 shrink-0"
                                        disabled={phoneNumbers.length === 1}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Input
                        label="Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                    <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1" disabled={submitting}>
                            {submitting ? 'Saving...' : (editingCustomer ? 'Update' : 'Add')} Customer
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => { setIsModalOpen(false); resetForm(); }}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
