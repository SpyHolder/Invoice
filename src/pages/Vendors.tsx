import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { supabase, Partner } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const Vendors = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [vendors, setVendors] = useState<Partner[]>([]);
    const [filteredVendors, setFilteredVendors] = useState<Partner[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Partner | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        company_name: '',
        attn_name: '',
        email: '',
        phone: '',
        address: '',
    });

    useEffect(() => {
        fetchVendors();
    }, [user]);

    useEffect(() => {
        const filtered = vendors.filter(v =>
            v.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.attn_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredVendors(filtered);
    }, [vendors, searchQuery]);

    const fetchVendors = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('partners')
            .select('*')
            .eq('type', 'vendor')
            .order('company_name');

        if (!error && data) {
            setVendors(data);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const vendorData = {
            company_name: formData.company_name,
            attn_name: formData.attn_name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            type: 'vendor',
        };

        try {
            if (editingVendor) {
                const { error } = await supabase.from('partners').update(vendorData).eq('id', editingVendor.id);
                if (error) throw error;
                showToast('Vendor updated successfully!', 'success');
            } else {
                const { error } = await supabase.from('partners').insert([vendorData]);
                if (error) throw error;
                showToast('Vendor added successfully!', 'success');
            }
            setIsModalOpen(false);
            resetForm();
            await fetchVendors();
        } catch (error: any) {
            console.error('Error saving vendor:', error);
            showToast(error.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (vendor: Partner) => {
        setEditingVendor(vendor);
        setFormData({
            company_name: vendor.company_name,
            attn_name: vendor.attn_name || '',
            email: vendor.email || '',
            phone: vendor.phone || '',
            address: vendor.address || '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Delete vendor "${name}"?`)) {
            try {
                const { error } = await supabase.from('partners').delete().eq('id', id);
                if (error) throw error;
                showToast('Vendor deleted', 'success');
                await fetchVendors();
            } catch (error: any) {
                showToast(error.message, 'error');
            }
        }
    };

    const resetForm = () => {
        setFormData({ company_name: '', attn_name: '', email: '', phone: '', address: '' });
        setEditingVendor(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
                    <p className="text-gray-600 mt-1">Manage your supply partners</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4" /> Add Vendor
                </Button>
            </div>

            <Card>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search vendors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input bg-white pl-10"
                    />
                </div>
            </Card>

            <Card>
                {loading ? <p className="text-center py-8">Loading...</p> : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th>Contact Person</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVendors.map(v => (
                                    <tr key={v.id}>
                                        <td className="font-medium">{v.company_name}</td>
                                        <td>{v.attn_name || '-'}</td>
                                        <td>{v.email || '-'}</td>
                                        <td>{v.phone || '-'}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEdit(v)} className="text-blue-600"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(v.id, v.company_name)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVendor ? 'Edit Vendor' : 'Add Vendor'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Company Name" value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} required />
                    <Input label="Contact Person" value={formData.attn_name} onChange={e => setFormData({ ...formData, attn_name: e.target.value })} />
                    <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    <Input label="Address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                    <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
