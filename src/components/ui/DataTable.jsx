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
import { cn, Button, Input, Card } from './index'; // Importing from index.js where we perform exports

export const DataTable = ({
    columns,
    data,
    isLoading,
    pagination,
    onPageChange,
    onSearch,
    onEdit,
    onDelete,
    onView,
    searchPlaceholder = "Search..."
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (onSearch) onSearch(value);
    };

    return (
        <div className="space-y-4">
            {/* Table Actions */}
            <div className="flex justify-between items-center">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={handleSearch}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Table Container */}
            <Card className="overflow-hidden border border-slate-800 bg-slate-900/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-6 py-4 font-medium tracking-wider">
                                        {col.header}
                                    </th>
                                ))}
                                {(onEdit || onDelete || onView) && (
                                    <th className="px-6 py-4 text-right">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {isLoading ? (
                                // Loading Skeletons
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className="h-4 bg-slate-800 rounded w-24"></div>
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-right">
                                            <div className="h-4 bg-slate-800 rounded w-8 ml-auto"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : (!data || !Array.isArray(data) || data.length === 0) ? (
                                // Empty State
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-500">
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
                                        className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-slate-300">
                                                {col.render ? col.render(row) : row[col.accessor]}
                                            </td>
                                        ))}
                                        {(onEdit || onDelete || onView) && (
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {onView && (
                                                        <button
                                                            onClick={() => onView(row)}
                                                            className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(row)}
                                                            className="p-2 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => onDelete(row)}
                                                            className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
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
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-medium text-slate-300">
                                {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalCount)}
                            </span> to <span className="font-medium text-slate-300">
                                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}
                            </span> of <span className="font-medium text-slate-300">{pagination.totalCount}</span> results
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
