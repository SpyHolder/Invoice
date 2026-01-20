import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';

interface PurchaseOrder {
    id: string;
    order_number: string;
    vendor_name: string;
    date: string;
    total_amount: number;
    status: string;
    notes: string;
    created_at: string;
}

interface PurchaseOrderItem {
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    amount: number;
}

export const ViewPurchaseOrder = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [po, setPo] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPOData();
    }, [id]);

    const fetchPOData = async () => {
        if (!id) return;

        setLoading(true);
        try {
            // Fetch purchase order
            const { data: poData, error: poError } = await supabase
                .from('purchase_orders')
                .select('*')
                .eq('id', id)
                .single();

            if (poError) throw poError;
            setPo(poData);

            // Fetch PO items
            const { data: itemsData, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('purchase_order_id', id)
                .order('id');

            if (itemsError) throw itemsError;
            setItems(itemsData || []);
        } catch (error) {
            console.error('Error fetching purchase order:', error);
            alert('Failed to load purchase order');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading purchase order...</div>
            </div>
        );
    }

    if (!po) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="text-gray-500 mb-4">Purchase order not found</div>
                <Button onClick={() => navigate('/purchase-orders')}>Back to Purchase Orders</Button>
            </div>
        );
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => navigate('/purchase-orders')}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Purchase Order Details</h1>
                        <p className="text-gray-600 mt-1">{po.order_number}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-purple-600 mb-2">PURCHASE ORDER</h2>
                        <p className="text-sm text-gray-600">PO Number:</p>
                        <p className="text-lg font-semibold">{po.order_number}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold text-gray-600">Status:</p>
                        <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${po.status === 'received'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                        >
                            {po.status}
                        </span>
                    </div>
                </div>

                {/* Vendor & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">VENDOR:</p>
                        <p className="text-lg font-semibold">{po.vendor_name}</p>
                    </div>
                    <div className="text-right">
                        <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-600">Date: </span>
                            <span className="text-sm">{formatDate(po.date)}</span>
                        </div>
                    </div>
                </div>

                {/* Line Items */}
                <table className="w-full mb-8">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-3 text-sm font-semibold">ITEM</th>
                            <th className="text-right py-3 text-sm font-semibold">QTY</th>
                            <th className="text-right py-3 text-sm font-semibold">UNIT PRICE</th>
                            <th className="text-right py-3 text-sm font-semibold">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200">
                                <td className="py-3">{item.item_name}</td>
                                <td className="py-3 text-right">{item.quantity}</td>
                                <td className="py-3 text-right">${item.unit_price.toFixed(2)}</td>
                                <td className="py-3 text-right font-semibold">${item.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Total */}
                <div className="flex justify-end mb-8">
                    <div className="w-80">
                        <div className="flex justify-between pt-3 border-t-2 border-gray-300">
                            <span className="text-xl font-bold">TOTAL:</span>
                            <span className="text-xl font-bold text-purple-600">${po.total_amount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {po.notes && (
                    <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">NOTES:</p>
                        <p className="text-sm text-gray-700">{po.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
