import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, MapPin } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface WorkingArea {
    id: string;
    name: string;
    address: string;
    contact_person: string;
    phone: string;
}

export const WorkingAreas = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [areas, setAreas] = useState<WorkingArea[]>([]);
    const [filteredAreas, setFilteredAreas] = useState<WorkingArea[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<WorkingArea | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_person: '',
        phone: '',
    });

    useEffect(() => {
        fetchAreas();
    }, [user]);

    useEffect(() => {
        const filtered = areas.filter(a =>
            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredAreas(filtered);
    }, [areas, searchQuery]);

    const fetchAreas = async () => {
        if (!user) return;
        try {
            const data = await api.get<WorkingArea[]>('/working-areas');
            setAreas(data);
        } catch (error) {
            console.error('Error fetching working areas:', error);
            showToast('Failed to fetch working areas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (editingArea) {
                await api.put(`/working-areas/${editingArea.id}`, formData);
                showToast('Working area updated successfully!', 'success');
            } else {
                await api.post('/working-areas', formData);
                showToast('Working area added successfully!', 'success');
            }
            setIsModalOpen(false);
            resetForm();
            await fetchAreas();
        } catch (error: any) {
            console.error('Error saving working area:', error);
            showToast(error.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (area: WorkingArea) => {
        setEditingArea(area);
        setFormData({
            name: area.name,
            address: area.address || '',
            contact_person: area.contact_person || '',
            phone: area.phone || '',
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Delete working area "${name}"?`)) {
            try {
                await api.delete(`/working-areas/${id}`);
                showToast('Working area deleted successfully!', 'success');
                await fetchAreas();
            } catch (error: any) {
                showToast(error.message, 'error');
            }
        }
    };

    const resetForm = () => {
        setFormData({ name: '', address: '', contact_person: '', phone: '' });
        setEditingArea(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Working Areas</h1>
                    <p className="text-gray-600 mt-1">Manage your working sites and delivery locations</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4" /> Add Working Area
                </Button>
            </div>

            <Card>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search working areas..."
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
                                    <th>Name</th>
                                    <th>Address</th>
                                    <th>Contact Person</th>
                                    <th>Phone</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAreas.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-400">
                                            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p>No working areas found.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAreas.map(a => (
                                        <tr key={a.id}>
                                            <td className="font-medium">{a.name}</td>
                                            <td className="whitespace-pre-line max-w-xs truncate">{a.address || '-'}</td>
                                            <td>{a.contact_person || '-'}</td>
                                            <td>{a.phone || '-'}</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleEdit(a)} className="text-blue-600 hover:text-blue-800 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(a.id, a.name)} className="text-red-600 hover:text-red-800 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingArea ? 'Edit Working Area' : 'Add Working Area'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Site Name *" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Samsung Electronics Site A" />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] text-sm"
                            placeholder="Full site address..."
                        />
                    </div>
                    <Input label="Contact Person" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} placeholder="On-site contact name" />
                    <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone number" />
                    <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
