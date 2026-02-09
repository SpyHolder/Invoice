import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, LayoutDashboard, FileText, FileCheck, ShoppingCart, Package, Users, Building2, ScrollText, ChevronDown, ChevronUp, Database } from 'lucide-react';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
    const location = useLocation();
    const [dataMasterOpen, setDataMasterOpen] = useState(() => {
        const dataMasterPaths = ['/items', '/customers', '/vendors', '/terms'];
        return dataMasterPaths.some(path => location.pathname === path);
    });

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/invoices', icon: FileText, label: 'Invoices' },
        { to: '/quotations', icon: FileCheck, label: 'Quotations' },
        { to: '/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders' },
    ];

    const dataMasterItems = [
        { to: '/items', icon: Package, label: 'Items' },
        { to: '/customers', icon: Users, label: 'Customers' },
        { to: '/vendors', icon: Building2, label: 'Vendors' },
        { to: '/terms', icon: ScrollText, label: 'Terms & Conditions' },
    ];

    const isDataMasterActive = dataMasterItems.some(item => location.pathname === item.to);

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                onClick={onClose}
            ></div>

            {/* Menu */}
            <aside className="fixed top-0 left-0 bottom-0 w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white z-50 lg:hidden animate-slide-in">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
                    <h1 className="text-xl font-bold">Business Suite</h1>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="px-4 py-6 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}

                    {/* Data Master Dropdown */}
                    <div className="pt-2">
                        <button
                            onClick={() => setDataMasterOpen(!dataMasterOpen)}
                            className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${isDataMasterActive
                                    ? 'bg-blue-600/30 text-white'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Database className="w-5 h-5" />
                                <span className="font-medium">Data Master</span>
                            </div>
                            {dataMasterOpen ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </button>

                        {dataMasterOpen && (
                            <div className="mt-1 ml-4 space-y-1 border-l border-gray-700 pl-4">
                                {dataMasterItems.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm ${isActive
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                            }`
                                        }
                                    >
                                        <item.icon className="w-4 h-4" />
                                        <span>{item.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>
            </aside>
        </>
    );
};
