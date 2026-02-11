import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, FolderPlus, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, QuotationTerm, TermCategory } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const TermsConditions = () => {
    const { showToast } = useToast();
    const [terms, setTerms] = useState<QuotationTerm[]>([]);
    const [categories, setCategories] = useState<TermCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');

    // Category management states
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [formData, setFormData] = useState({
        category_id: '',
        title: '',
        content: '',
        sort_order: 0,
        is_active: true
    });

    useEffect(() => {
        fetchCategories();
        fetchTerms();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('term_categories')
                .select('*')
                .order('sort_order');

            if (error) throw error;
            setCategories(data || []);
        } catch (error: any) {
            console.error('Error fetching categories:', error);
            showToast('Failed to load categories', 'error');
        }
    };

    const fetchTerms = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('quotation_terms')
                .select('*')
                .order('category')
                .order('sort_order');

            if (error) throw error;
            setTerms(data || []);
        } catch (error: any) {
            console.error('Error fetching terms:', error);
            showToast('Failed to load terms', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            category_id: categories[0]?.id || '',
            title: '',
            content: '',
            sort_order: 0,
            is_active: true
        });
        setEditingId(null);
        setShowAddForm(false);
    };

    const handleEdit = (term: QuotationTerm) => {
        setFormData({
            category_id: term.category_id || '',
            title: term.title || '',
            content: term.content,
            sort_order: term.sort_order,
            is_active: term.is_active
        });
        setEditingId(term.id);
        setShowAddForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim()) {
            showToast('Content is required', 'error');
            return;
        }
        if (!formData.category_id) {
            showToast('Category is required', 'error');
            return;
        }

        try {
            // Get category name for legacy field
            const category = categories.find(c => c.id === formData.category_id);

            const termData = {
                category_id: formData.category_id,
                category: category?.name || '',
                title: formData.title.trim() || null,
                content: formData.content.trim(),
                sort_order: formData.sort_order,
                is_active: formData.is_active
            };

            if (editingId) {
                const { error } = await supabase
                    .from('quotation_terms')
                    .update(termData)
                    .eq('id', editingId);
                if (error) throw error;
                showToast('Term updated successfully', 'success');
            } else {
                const { error } = await supabase
                    .from('quotation_terms')
                    .insert([termData]);
                if (error) throw error;
                showToast('Term created successfully', 'success');
            }

            resetForm();
            fetchTerms();
        } catch (error: any) {
            console.error('Error saving term:', error);
            showToast(error.message || 'Failed to save term', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this term?')) return;

        try {
            const { error } = await supabase
                .from('quotation_terms')
                .delete()
                .eq('id', id);
            if (error) throw error;
            showToast('Term deleted successfully', 'success');
            fetchTerms();
        } catch (error: any) {
            console.error('Error deleting term:', error);
            showToast(error.message || 'Failed to delete term', 'error');
        }
    };

    const toggleActive = async (term: QuotationTerm) => {
        try {
            const { error } = await supabase
                .from('quotation_terms')
                .update({ is_active: !term.is_active })
                .eq('id', term.id);
            if (error) throw error;
            showToast(`Term ${term.is_active ? 'disabled' : 'enabled'}`, 'success');
            fetchTerms();
        } catch (error: any) {
            console.error('Error toggling term:', error);
            showToast('Failed to update term', 'error');
        }
    };

    // Category CRUD handlers
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            showToast('Category name is required', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('term_categories')
                .insert([{
                    name: newCategoryName.trim(),
                    sort_order: categories.length + 1
                }]);

            if (error) throw error;
            showToast('Category created successfully', 'success');
            setNewCategoryName('');
            setShowAddCategoryForm(false);
            fetchCategories();
        } catch (error: any) {
            console.error('Error creating category:', error);
            showToast(error.message || 'Failed to create category', 'error');
        }
    };

    const handleEditCategory = (category: TermCategory) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
    };

    const handleSaveCategory = async (id: string) => {
        if (!editingCategoryName.trim()) {
            showToast('Category name is required', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('term_categories')
                .update({ name: editingCategoryName.trim() })
                .eq('id', id);

            if (error) throw error;

            // Also update all terms using this category
            const { error: termsError } = await supabase
                .from('quotation_terms')
                .update({ category: editingCategoryName.trim() })
                .eq('category_id', id);

            if (termsError) console.error('Error updating terms:', termsError);

            showToast('Category updated successfully', 'success');
            setEditingCategoryId(null);
            setEditingCategoryName('');
            fetchCategories();
            fetchTerms();
        } catch (error: any) {
            console.error('Error updating category:', error);
            showToast(error.message || 'Failed to update category', 'error');
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        // Check if category is in use
        const termsUsingCategory = terms.filter(t => t.category_id === id);
        if (termsUsingCategory.length > 0) {
            showToast(`Cannot delete "${name}": ${termsUsingCategory.length} term(s) using this category`, 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

        try {
            const { error } = await supabase
                .from('term_categories')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('Category deleted successfully', 'success');
            fetchCategories();
        } catch (error: any) {
            console.error('Error deleting category:', error);
            showToast(error.message || 'Failed to delete category', 'error');
        }
    };

    // Group terms by category
    const groupedTerms = categories.reduce((acc, category) => {
        acc[category.id] = terms.filter(t => t.category_id === category.id);
        return acc;
    }, {} as Record<string, QuotationTerm[]>);

    const filteredCategories = selectedCategory === 'all'
        ? categories
        : categories.filter(c => c.id === selectedCategory);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading terms...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Terms & Conditions</h1>
                    <p className="text-gray-600 mt-1">Manage quotation terms and conditions templates</p>
                </div>
                <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
                    <Plus className="w-4 h-4" />
                    Add Term
                </Button>
            </div>

            {/* Category Management Section */}
            <Card className="bg-purple-50 border-purple-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowAddCategoryForm(true)}
                        disabled={showAddCategoryForm}
                    >
                        <FolderPlus className="w-4 h-4" />
                        Add Category
                    </Button>
                </div>

                {/* Add Category Form */}
                {showAddCategoryForm && (
                    <div className="mb-4 p-3 bg-white rounded-lg border border-purple-300">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                                placeholder="Enter category name..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                autoFocus
                            />
                            <Button size="sm" onClick={handleAddCategory}>
                                <Check className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => {
                                setShowAddCategoryForm(false);
                                setNewCategoryName('');
                            }}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Categories List */}
                <div className="flex flex-wrap gap-2">
                    {categories.map(category => {
                        const count = groupedTerms[category.id]?.length || 0;
                        return (
                            <div
                                key={category.id}
                                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-purple-200 shadow-sm"
                            >
                                {editingCategoryId === category.id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editingCategoryName}
                                            onChange={(e) => setEditingCategoryName(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory(category.id)}
                                            className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleSaveCategory(category.id)}
                                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingCategoryId(null);
                                                setEditingCategoryName('');
                                            }}
                                            className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="font-medium text-gray-900">{category.name}</span>
                                        <span className="text-xs text-gray-500">({count})</span>
                                        <button
                                            onClick={() => handleEditCategory(category)}
                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(category.id, category.name)}
                                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Filter by category */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    All Categories
                </button>
                {categories.map(category => (
                    <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === category.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {category.name} ({groupedTerms[category.id]?.length || 0})
                    </button>
                ))}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {editingId ? 'Edit Term' : 'Add New Term'}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category *
                                </label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="input w-full bg-white"
                                    required
                                >
                                    <option value="">Select category...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="input w-full bg-white"
                                    placeholder="e.g., Payment Plan: Progressive"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sort Order
                                </label>
                                <input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                    className="input w-full bg-white"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Content *
                            </label>
                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                className="input w-full bg-white min-h-[100px]"
                                required
                                placeholder="Enter the term content..."
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4"
                            />
                            <label htmlFor="is_active" className="text-sm text-gray-700">
                                Active (available for selection in quotations)
                            </label>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="secondary" onClick={resetForm}>
                                <X className="w-4 h-4" />
                                Cancel
                            </Button>
                            <Button type="submit">
                                <Save className="w-4 h-4" />
                                {editingId ? 'Update' : 'Save'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Terms List by Category */}
            {filteredCategories.map(category => {
                const categoryTerms = groupedTerms[category.id] || [];
                if (categoryTerms.length === 0 && selectedCategory !== 'all') return null;

                return (
                    <Card key={category.id}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">{category.name}</h2>
                            <span className="text-sm text-gray-500">
                                {categoryTerms.length} term{categoryTerms.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {categoryTerms.length === 0 ? (
                            <p className="text-gray-500 italic">No terms in this category</p>
                        ) : (
                            <div className="space-y-3">
                                {categoryTerms.map((term, index) => (
                                    <div
                                        key={term.id}
                                        className={`p-4 rounded-lg border ${term.is_active
                                            ? 'bg-white border-gray-200'
                                            : 'bg-gray-100 border-gray-300 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-gray-400">
                                                        #{index + 1}
                                                    </span>
                                                    {term.title && (
                                                        <span className="font-semibold text-gray-900">
                                                            {term.title}
                                                        </span>
                                                    )}
                                                    {!term.is_active && (
                                                        <span className="px-2 py-0.5 text-xs rounded bg-gray-300 text-gray-600">
                                                            Disabled
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-700 whitespace-pre-wrap">
                                                    {term.content}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => toggleActive(term)}
                                                    className={`p-2 rounded ${term.is_active
                                                        ? 'text-green-600 hover:bg-green-50'
                                                        : 'text-gray-400 hover:bg-gray-200'
                                                        }`}
                                                    title={term.is_active ? 'Disable' : 'Enable'}
                                                >
                                                    <div className={`w-4 h-4 rounded-full border-2 ${term.is_active
                                                        ? 'bg-green-500 border-green-500'
                                                        : 'border-gray-400'
                                                        }`} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(term)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(term.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                );
            })}

            {terms.length === 0 && !showAddForm && (
                <Card className="text-center py-12">
                    <p className="text-gray-500 mb-4">No terms & conditions found</p>
                    <Button onClick={() => setShowAddForm(true)}>
                        <Plus className="w-4 h-4" />
                        Add Your First Term
                    </Button>
                </Card>
            )}
        </div>
    );
};
