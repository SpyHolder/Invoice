import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase, QuotationTerm, TERM_CATEGORIES, TermCategory } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export const TermsConditions = () => {
    const { showToast } = useToast();
    const [terms, setTerms] = useState<QuotationTerm[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<TermCategory | 'all'>('all');

    const [formData, setFormData] = useState({
        category: 'Remarks' as TermCategory,
        title: '',
        content: '',
        sort_order: 0,
        is_active: true
    });

    useEffect(() => {
        fetchTerms();
    }, []);

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
            category: 'Remarks',
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
            category: term.category as TermCategory,
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

        try {
            const termData = {
                category: formData.category,
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

    // Group terms by category
    const groupedTerms = TERM_CATEGORIES.reduce((acc, category) => {
        acc[category] = terms.filter(t => t.category === category);
        return acc;
    }, {} as Record<TermCategory, QuotationTerm[]>);

    const filteredCategories = selectedCategory === 'all'
        ? TERM_CATEGORIES
        : [selectedCategory];

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
                {TERM_CATEGORIES.map(category => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        {category} ({groupedTerms[category]?.length || 0})
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
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value as TermCategory })}
                                    className="input w-full bg-white"
                                    required
                                >
                                    {TERM_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
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
                const categoryTerms = groupedTerms[category] || [];
                if (categoryTerms.length === 0 && selectedCategory !== 'all') return null;

                return (
                    <Card key={category}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
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
