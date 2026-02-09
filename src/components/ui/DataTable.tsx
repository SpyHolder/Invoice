import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (row: T) => React.ReactNode;
    sortable?: boolean;
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    searchPlaceholder?: string;
    onRowClick?: (row: T) => void;
    itemsPerPage?: number;
    actions?: (row: T) => React.ReactNode;
    isLoading?: boolean;
}

export function DataTable<T extends { id?: string | number }>({
    columns,
    data,
    searchPlaceholder = 'Search...',
    onRowClick,
    itemsPerPage = 10,
    actions,
    isLoading = false
}: DataTableProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: keyof T | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Simple robust search
    const filteredData = data.filter((item) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();

        // Search in all accessor keys
        return columns.some((col) => {
            if (!col.accessorKey) return false;
            const value = item[col.accessorKey];
            return String(value ?? '').toLowerCase().includes(term);
        });
    });

    // Sort
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue > bValue ? 1 : -1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    // Pagination
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

    const handleSort = (key: keyof T) => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-gray-200 rounded w-full max-w-sm"></div>
                <div className="h-64 bg-gray-100 rounded border border-gray-200"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                />
            </div>

            {/* Table */}
            <div className="overflow-hidden bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold tracking-wider border-b border-gray-200">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        className={`px-6 py-3 cursor-pointer select-none group whitespace-nowrap ${col.className || ''}`}
                                        onClick={() => col.sortable && col.accessorKey && handleSort(col.accessorKey)}
                                    >
                                        <div className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                                            {col.header}
                                            {col.sortable && col.accessorKey && (
                                                <span className="inline-flex flex-col ml-1 w-3">
                                                    {sortConfig.key === col.accessorKey ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                                                    ) : (
                                                        <ArrowUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                {actions && <th className="px-6 py-3 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {paginatedData.length > 0 ? (
                                paginatedData.map((row, rowIndex) => (
                                    <tr
                                        key={row.id || rowIndex}
                                        className={`hover:bg-blue-50/50 transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
                                        onClick={() => onRowClick && onRowClick(row)}
                                    >
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex} className={`px-6 py-4 whitespace-nowrap ${col.className || ''}`}>
                                                {col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey] ?? '') : '')}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {actions(row)}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="w-8 h-8 text-gray-300" />
                                            <p className="text-base font-medium">No results found</p>
                                            <p className="text-xs text-gray-400">Try adjusting your search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 pt-2 gap-4">
                    <div className="text-gray-500">
                        Showing <span className="font-medium text-gray-900">{startIndex + 1}</span> to <span className="font-medium text-gray-900">{Math.min(startIndex + itemsPerPage, sortedData.length)}</span> of <span className="font-medium text-gray-900">{sortedData.length}</span> entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            aria-label="Previous Page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 text-gray-700 font-medium">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            aria-label="Next Page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
