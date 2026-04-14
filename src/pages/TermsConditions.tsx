import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Editor } from '@tinymce/tinymce-react';
import '../lib/tinymce';

export const TermsConditions = () => {
    const { showToast } = useToast();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchDefaultTerms();
    }, []);

    const fetchDefaultTerms = async () => {
        setLoading(true);
        try {
            const data = await api.get<any>('/terms/default');
            if (data) {
                setContent(data.content || '');
            }
        } catch (error: any) {
            console.error('Error fetching default terms:', error);
            showToast('Failed to load default terms', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/terms/default', { content });
            showToast('Default terms saved successfully', 'success');
        } catch (error: any) {
            console.error('Error saving terms:', error);
            showToast(error.message || 'Failed to save terms', 'error');
        } finally {
            setSaving(false);
        }
    };

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
                    <p className="text-gray-600 mt-1">
                        Manage default terms and conditions template for quotations and purchase orders
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <Card>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Default Terms & Conditions Content
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    This content will be used as the default terms & conditions when creating new quotations and purchase orders.
                    You can edit it per-document when creating each quotation or PO.
                </p>
                <Editor
                    licenseKey="gpl"
                    value={content}
                    onEditorChange={(newContent) => setContent(newContent)}
                    init={{
                        height: 600,
                        menubar: false,
                        plugins: [
                            'advlist', 'lists', 'link', 'table', 'wordcount', 'autolink', 'nonbreaking'
                        ],
                        nonbreaking_force_tab: true,
                        toolbar:
                            'undo redo | blocks fontsize forecolor | ' +
                            'bold italic underline strikethrough | ' +
                            'bullist numlist indent outdent | ' +
                            'table link | ' +
                            'removeformat',
                        table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
                        content_style: 'body { font-family: Arial, sans-serif; font-size: 12px; }',
                        branding: false,
                        promotion: false,
                    }}
                />
            </Card>

            {/* Preview Section */}
            {content && (
                <Card>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
                    <div
                        className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                </Card>
            )}
        </div>
    );
};
