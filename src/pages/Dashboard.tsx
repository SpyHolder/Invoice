import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { DollarSign, FileText, AlertCircle, TrendingUp, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const Dashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingInvoices: 0,
        lowStockItems: 0,
        totalCustomers: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user) return;

            try {
                // Fetch total revenue from paid invoices
                const { data: paidInvoices } = await supabase
                    .from('invoices')
                    .select('total')
                    .eq('status', 'paid');

                const totalRevenue = paidInvoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;

                // Fetch pending invoices count
                const { count: pendingCount } = await supabase
                    .from('invoices')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'unpaid');

                // Fetch low stock items count (items where stock <= min_stock)
                // Note: PostgREST can't compare two columns directly, so we fetch and filter in JS
                const { data: allItems } = await supabase
                    .from('items')
                    .select('stock, min_stock');

                const lowStockCount = allItems?.filter(item =>
                    item.stock <= item.min_stock
                ).length || 0;

                // Fetch total customers
                const { count: customersCount } = await supabase
                    .from('customers')
                    .select('*', { count: 'exact', head: true });

                setStats({
                    totalRevenue,
                    pendingInvoices: pendingCount || 0,
                    lowStockItems: lowStockCount || 0,
                    totalCustomers: customersCount || 0,
                });
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    const statCards = [
        {
            title: 'Total Revenue',
            value: `$${stats.totalRevenue.toFixed(2)}`,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
        },
        {
            title: 'Pending Invoices',
            value: stats.pendingInvoices,
            icon: FileText,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            title: 'Low Stock Items',
            value: stats.lowStockItems,
            icon: AlertCircle,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
        },
        {
            title: 'Total Customers',
            value: stats.totalCustomers,
            icon: TrendingUp,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
        },
    ];

    const quickActions = [
        { title: 'New Invoice', link: '/invoices', icon: FileText },
        { title: 'New Quotation', link: '/quotations', icon: FileText },
        { title: 'Add Item', link: '/items', icon: Plus },
        { title: 'Add Customer', link: '/customers', icon: Plus },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Welcome back! Here's your business overview.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat) => (
                    <Card key={stat.title}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">{stat.title}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-2">
                                    {loading ? '...' : stat.value}
                                </p>
                            </div>
                            <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickActions.map((action) => (
                        <Link
                            key={action.title}
                            to={action.link}
                            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200"
                        >
                            <action.icon className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-gray-900">{action.title}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Low Stock Alert */}
            {stats.lowStockItems > 0 && (
                <Card className="bg-red-50 border-red-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
                            <p className="text-sm text-red-700 mt-1">
                                You have {stats.lowStockItems} item(s) that are running low on stock.{' '}
                                <Link to="/items" className="underline font-medium">
                                    View items
                                </Link>
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
