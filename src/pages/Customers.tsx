import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users, Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { supabase, Customer } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const Customers = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
    });

    useEffect(() => {
        fetchCustomers();
    }, [user]);

    useEffect(() => {
        const filtered = customers.filter(customer =>
            customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.address?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredCustomers(filtered);
    }, [customers, searchQuery]);

    const fetchCustomers = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setCustomers(data);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);

        const customerData = {
            name: formData.name,
            email: formData.email || '',
            phone: formData.phone || '',
            address: formData.address || '',
        };

        try {
            if (editingCustomer) {
                const { error } = await supabase.from('customers').update(customerData).eq('id', editingCustomer.id);
                if (error) throw error;
                showToast('Customer updated successfully!', 'success');
            } else {
                const { error } = await supabase.from('customers').insert([customerData]);
                if (error) throw error;
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

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name,
            email: customer.email || '',
            phone: customer.phone || '',
            address: customer.address || '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, customerName: string) => {
        if (confirm(`Are you sure you want to delete "${customerName}"? This action cannot be undone.`)) {
            try {
                const { error } = await supabase.from('customers').delete().eq('id', id);
                if (error) throw error;
                showToast('Customer deleted successfully!', 'success');
                await fetchCustomers();
            } catch (error: any) {
                console.error('Error deleting customer:', error);
                showToast(error.message || 'Failed to delete customer.', 'error');
            }
        }
    };

    const resetForm = () => {
        setFormData({ name: '', email: '', phone: '', address: '' });
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
                        placeholder="Search customers by name, email, phone, or address..."
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
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Address</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((customer) => (
                                    <tr key={customer.id}>
                                        <td className="font-medium">{customer.name}</td>
                                        <td className="text-gray-600">{customer.email || '-'}</td>
                                        <td className="text-gray-600">{customer.phone || '-'}</td>
                                        <td className="text-gray-600">{customer.address || '-'}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(customer)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(customer.id, customer.name)}
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
                        label="Customer Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                    <Input
                        label="Phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
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
