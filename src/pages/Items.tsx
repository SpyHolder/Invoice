import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Package, Search } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { supabase, Item } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const Items = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [items, setItems] = useState<Item[]>([]);
    const [filteredItems, setFilteredItems] = useState<Item[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category: '',
        price: 0,
        description: '',
        stock: 0,
        min_stock: 10,
    });

    useEffect(() => {
        fetchItems();
    }, [user]);

    useEffect(() => {
        const filtered = items.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredItems(filtered);
    }, [items, searchQuery]);

    const fetchItems = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setItems(data);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);

        const itemData = {
            name: formData.name,
            sku: formData.sku || '',
            category: formData.category || '',
            description: formData.description || '',
            price: formData.price,
            stock: formData.stock,
            min_stock: formData.min_stock,
        };

        try {
            if (editingItem) {
                const { error } = await supabase.from('items').update(itemData).eq('id', editingItem.id);
                if (error) throw error;
                showToast('Item updated successfully!', 'success');
            } else {
                const { error } = await supabase.from('items').insert([itemData]);
                if (error) throw error;
                showToast('Item added successfully!', 'success');
            }

            setIsModalOpen(false);
            resetForm();
            await fetchItems();
        } catch (error: any) {
            console.error('Error saving item:', error);
            showToast(error.message || 'Failed to save item. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (item: Item) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            sku: item.sku || '',
            category: item.category || '',
            price: item.price,
            description: item.description || '',
            stock: item.stock,
            min_stock: item.min_stock,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, itemName: string) => {
        if (confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
            try {
                const { error } = await supabase.from('items').delete().eq('id', id);
                if (error) throw error;
                showToast('Item deleted successfully!', 'success');
                await fetchItems();
            } catch (error: any) {
                console.error('Error deleting item:', error);
                showToast(error.message || 'Failed to delete item.', 'error');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            sku: '',
            category: '',
            price: 0,
            description: '',
            stock: 0,
            min_stock: 10,
        });
        setEditingItem(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventory Items</h1>
                    <p className="text-gray-600 mt-1">Manage your products and services</p>
                </div>
                <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4" />
                    Add Item
                </Button>
            </div>

            {/* Search Bar */}
            <Card>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search items by name, SKU, or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
            </Card>

            <Card>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Loading...</p>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        {searchQuery ? (
                            <p className="text-gray-600">No items found matching "{searchQuery}"</p>
                        ) : (
                            <p className="text-gray-600">No items yet. Add your first item to get started!</p>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>SKU</th>
                                    <th>Category</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="font-medium">{item.name}</td>
                                        <td>{item.sku || '-'}</td>
                                        <td>{item.category || '-'}</td>
                                        <td>${item.price.toFixed(2)}</td>
                                        <td>
                                            <span
                                                className={`px-2 py-1 rounded text-sm ${item.stock <= item.min_stock
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-green-100 text-green-800'
                                                    }`}
                                            >
                                                {item.stock}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id, item.name)}
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
                title={editingItem ? 'Edit Item' : 'Add New Item'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Item Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                    <Input
                        label="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                    <Input
                        label="SKU"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                    <Input
                        label="Category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                    <Input
                        label="Price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                        required
                    />
                    <Input
                        label="Stock Quantity"
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                        required
                    />
                    <Input
                        label="Minimum Stock Level"
                        type="number"
                        value={formData.min_stock}
                        onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                        required
                    />
                    <div className="flex gap-2 pt-4">
                        <Button type="submit" className="flex-1" disabled={submitting}>
                            {submitting ? 'Saving...' : (editingItem ? 'Update' : 'Add')} Item
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
