import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, FileCheck, ShoppingCart, Package, Users, Building2, Truck } from 'lucide-react';

export const Sidebar = () => {
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/invoices', icon: FileText, label: 'Invoices' },
        { to: '/quotations', icon: FileCheck, label: 'Quotations' },
        { to: '/delivery-orders', icon: Truck, label: 'Delivery Orders' },
        { to: '/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders' },
        { to: '/items', icon: Package, label: 'Items' },
        { to: '/customers', icon: Users, label: 'Customers' },
    ];

    return (
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
            <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
                <Building2 className="w-8 h-8 text-blue-400" />
                <div>
                    <h1 className="text-xl font-bold">Business Suite</h1>
                    <p className="text-xs text-gray-400">ERP Management</p>
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
};
