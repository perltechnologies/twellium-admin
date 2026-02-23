import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Edit,
    Trash2,
    Eye,
    MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, Button, Input, Card } from './base';

export const DataTable = ({
    columns = [],
    data = [],
    isLoading,
    pagination,
    onPageChange,
    onSearch,
    onEdit,
    onDelete,
    onView,
    searchPlaceholder = "Search...",
    filters = [],
    onFilterChange,
    activeFilters = {}
}) => {
    const [searchTerm, setSearchTerm] = useState('');



    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (onSearch) onSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    return (
        <div className="space-y-4">
            {/* Table Actions */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={handleSearch}
                        className="pl-10"
                    />
                </div>

                {/* Render Filters */}
                {filters.map(filter => (
                    <div key={filter.name} className="w-48">
                        {filter.type === 'select' ? (
                            <select
                                value={activeFilters[filter.name] || ''}
                                onChange={(e) => onFilterChange(filter.name, e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-[#0c0c20] border border-[#e2e8f0] dark:border-[#161641] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-[#1f2020] dark:text-[#d9dcff] text-sm"
                            >
                                <option value="">All {filter.label}</option>
                                {filter.options.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ) : filter.type === 'date' ? (
                            <Input
                                type="date"
                                value={activeFilters[filter.name] || ''}
                                onChange={(e) => onFilterChange(filter.name, e.target.value)}
                                placeholder={filter.label}
                            />
                        ) : (
                            <Input
                                value={activeFilters[filter.name] || ''}
                                onChange={(e) => onFilterChange(filter.name, e.target.value)}
                                placeholder={filter.label}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Table Container */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-[#707070] dark:text-[#828997] uppercase bg-[#f7f8f9] dark:bg-[#0c0c20] border-b border-[#e2e8f0] dark:border-[#161641]">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-5 py-3.5 font-medium tracking-wider">
                                        {col.header}
                                    </th>
                                ))}
                                {(onEdit || onDelete || onView) && (
                                    <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#161641]">
                            {isLoading ? (
                                // Loading Skeletons
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((_, j) => (
                                            <td key={j} className="px-5 py-3.5">
                                                <div className="h-4 bg-[#e2e8f0] dark:bg-[#161641] rounded w-24"></div>
                                            </td>
                                        ))}
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="h-4 bg-[#e2e8f0] dark:bg-[#161641] rounded w-8 ml-auto"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : (!data || !Array.isArray(data) || data.length === 0) ? (
                                // Empty State
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-[#9d9d9d]">
                                        No records found
                                    </td>
                                </tr>
                            ) : (
                                // Data Rows
                                data.map((row, rowIndex) => (
                                    <motion.tr
                                        key={row.id || rowIndex}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: rowIndex * 0.05 }}
                                        className="hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20] transition-colors group"
                                    >
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex} className="px-5 py-3.5 whitespace-nowrap text-[#707070] dark:text-[#d9dcff]">
                                                {col.render ? col.render(row) : row[col.accessor]}
                                            </td>
                                        ))}
                                        {(onEdit || onDelete || onView) && (
                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {onView && (
                                                        <button
                                                            onClick={() => onView(row)}
                                                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 text-[#9d9d9d] hover:text-blue-600 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(row)}
                                                            className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/10 text-[#9d9d9d] hover:text-green-600 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => onDelete(row)}
                                                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 text-[#9d9d9d] hover:text-red-500 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && (
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#e2e8f0] dark:border-[#161641]">
                        <div className="text-13 text-[#707070]">
                            Showing <span className="font-medium text-[#1f2020] dark:text-[#d9dcff]">
                                {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalCount)}
                            </span> to <span className="font-medium text-[#1f2020] dark:text-[#d9dcff]">
                                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}
                            </span> of <span className="font-medium text-[#1f2020] dark:text-[#d9dcff]">{pagination.totalCount}</span> results
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="px-2 py-1 h-8 text-xs"
                                disabled={!pagination.hasPrev}
                                onClick={() => onPageChange(pagination.prev)}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                            <Button
                                variant="secondary"
                                className="px-2 py-1 h-8 text-xs"
                                disabled={!pagination.hasNext}
                                onClick={() => onPageChange(pagination.next)}
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
