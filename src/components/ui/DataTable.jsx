import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Edit,
    Trash2,
    Eye,
    Download,
    FileSpreadsheet,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Card } from './base';

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
    activeFilters = {},
    enableExport = false,
    exportFilename = 'export',
    onExport
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (onSearch) onSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, onSearch]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    return (
        <div className="space-y-4">
            {/* Table Actions */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 dark:text-slate-100 text-sm cursor-pointer transition-all duration-200"
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

                {/* Export Button */}
                {enableExport && (
                    <div className="relative ml-auto">
                        <Button
                            variant="secondary"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Export
                        </Button>
                        <AnimatePresence>
                            {showExportMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 overflow-hidden"
                                >
                                    <button
                                        onClick={() => {
                                            if (onExport) {
                                                onExport('excel');
                                            }
                                            setShowExportMenu(false);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                        Excel
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onExport) {
                                                onExport('csv');
                                            }
                                            setShowExportMenu(false);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        CSV
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Table Container */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-5 py-3.5 font-semibold tracking-wide">
                                        {col.header}
                                    </th>
                                ))}
                                {(onEdit || onDelete || onView) && (
                                    <th className="px-5 py-3.5 text-right font-semibold tracking-wide">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {isLoading ? (
                                // Loading Skeletons
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((_, j) => (
                                            <td key={j} className="px-5 py-3.5">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                                            </td>
                                        ))}
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-8 ml-auto"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : (!data || !Array.isArray(data) || data.length === 0) ? (
                                // Empty State
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <Search className="h-8 w-8 text-slate-400" />
                                            </div>
                                            <p className="text-base font-medium">No records found</p>
                                            <p className="text-sm mt-1">Try adjusting your search or filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                // Data Rows
                                data.map((row, rowIndex) => (
                                    <motion.tr
                                        key={row.id || rowIndex}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: rowIndex * 0.03 }}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                    >
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex} className="px-5 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                                {col.render ? col.render(row) : row[col.accessor]}
                                            </td>
                                        ))}
                                        {(onEdit || onDelete || onView) && (
                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {onView && (
                                                        <button
                                                            onClick={() => onView(row)}
                                                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onEdit && (
                                                        <button
                                                            onClick={() => onEdit(row)}
                                                            className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-400 hover:text-green-600 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {onDelete && (
                                                        <button
                                                            onClick={() => onDelete(row)}
                                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
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
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium text-slate-700 dark:text-slate-300">
                                {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalCount)}
                            </span> to <span className="font-medium text-slate-700 dark:text-slate-300">
                                {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}
                            </span> of <span className="font-medium text-slate-700 dark:text-slate-300">{pagination.totalCount}</span> results
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                className="px-3 py-2 h-9 text-sm"
                                disabled={!pagination.hasPrev}
                                onClick={() => onPageChange(pagination.prev)}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                            <Button
                                variant="secondary"
                                className="px-3 py-2 h-9 text-sm"
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
