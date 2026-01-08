import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, FileText, Activity } from 'lucide-react';
import { DataTable, Button, Card, Input, ConfirmationModal } from '../../components/ui';
import { productionApi } from '../../api/production';
import { useAuth } from '../../context/AuthContext';

const ProductionList = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        production_date: '',
        status: '',
        search: '',
        page: 1,
        page_size: 15
    });
    const [totalCount, setTotalCount] = useState(0);
    const [paginationLinks, setPaginationLinks] = useState({ next: null, previous: null });

    // Delete State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchReports = async () => {
        setLoading(true);
        try {
            // Include pagination in params
            const params = {
                production_date: filters.production_date,
                status: filters.status,
                search: filters.search,
                page: filters.page,
                page_size: filters.page_size
            };
            const res = await productionApi.getReports(params);

            // Handle pagination response
            // Handle different possible response structures
            const responseData = res.data;
            let listData = [];
            let count = 0;
            let next = null;
            let previous = null;

            if (Array.isArray(responseData)) {
                listData = responseData;
                count = responseData.length;
            } else if (responseData.results && Array.isArray(responseData.results)) {
                listData = responseData.results;
                count = responseData.count || responseData.results.length;
                next = responseData.next;
                previous = responseData.previous;
            } else if (responseData.data && Array.isArray(responseData.data)) {
                listData = responseData.data;
                // Fix: Check for count/total explicitly
                count = responseData.count || responseData.total || responseData.data.length;
                next = responseData.next || (responseData.data.next); // Fallback if data is wrapped
                previous = responseData.previous || (responseData.data.previous);
            } else if (responseData.data?.results && Array.isArray(responseData.data.results)) {
                listData = responseData.data.results;
                count = responseData.data.count || responseData.data.results.length;
                next = responseData.data.next;
                previous = responseData.data.previous;
            }

            setReports(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });
        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchReports();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [filters]);

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const handleDelete = (item) => {
        setReportToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!reportToDelete) return;
        setDeleting(true);
        try {
            await productionApi.deleteReport(reportToDelete.id);
            setDeleteModalOpen(false);
            setReportToDelete(null);
            fetchReports();
        } catch (error) {
            console.error("Failed to delete report:", error);
        } finally {
            setDeleting(false);
        }
    };

    const handleView = (item) => {
        navigate(`/dashboard/production/${item.id}`);
    };

    const handleStatusChange = async (report, newStatus) => {
        try {
            await productionApi.updateStatus(report.id, newStatus);
            fetchReports(); // Refresh
        } catch (error) {
            console.error('Failed to update status', error);
        }
    };

    const handleSearch = (val) => {
        setFilters(prev => ({ ...prev, search: val }));
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const columns = [
        {
            header: 'Code',
            accessor: 'report_code',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{row.report_code}</span>
                </div>
            )
        },
        {
            header: 'Date',
            accessor: 'production_date',
            render: (row) => format(new Date(row.production_date), 'MMM dd, yyyy')
        },
        {
            header: 'PET',
            accessor: 'pet_name',
            render: (row) => row.pet_name || '-'
        },
        {
            header: 'Shift',
            accessor: 'shift_name',
            render: (row) => (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {row.shift_name}
                </span>
            )
        },
        {
            header: 'Output',
            accessor: 'total_bottles_produced',
            render: (row) => (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Activity className="h-3 w-3" />
                    <span className="font-medium">{row.total_bottles_produced?.toLocaleString() || 0}</span>
                </div>
            )
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (row) => {
                const status = row.status || 'STARTED';
                const styles = {
                    STARTED: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
                    COMPLETED: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
                    APPROVED: 'bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
                    DECLINED: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
                    INCOMPLETE: 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
                    IDLE: 'bg-gray-100 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-500/20',
                };
                // Simple dropdown for status change could be implemented here or a separate action
                return (
                    <select
                        value={status}
                        onClick={(e) => e.stopPropagation()} // Prevent row click
                        onChange={(e) => handleStatusChange(row, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border bg-transparent cursor-pointer focus:outline-none ${styles[status] || 'text-slate-500 dark:text-slate-400'} `}
                    >
                        {['STARTED', 'COMPLETED', 'APPROVED', 'DECLINED', 'INCOMPLETE', 'IDLE'].map(s => (
                            <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">{s}</option>
                        ))}
                    </select>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Production Reports
                    </h1>
                </div>
                <Button
                    onClick={() => navigate('/dashboard/production/new')}
                    className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Report
                </Button>
            </div>

            <div className="flex gap-4 items-center bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <Input
                    type="date"
                    value={filters.production_date}
                    onChange={(e) => setFilters(prev => ({ ...prev, production_date: e.target.value }))}
                    className="w-auto"
                />
                <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="px-3 py-2 bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                    <option value="">All Statuses</option>
                    {['STARTED', 'COMPLETED', 'APPROVED', 'DECLINED', 'INCOMPLETE', 'IDLE'].map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            <DataTable
                columns={columns}
                data={reports}
                isLoading={loading}
                onDelete={handleDelete}
                pagination={{
                    currentPage: filters.page,
                    pageSize: filters.page_size,
                    totalCount: totalCount,
                    hasNext: !!paginationLinks.next,
                    hasPrev: !!paginationLinks.previous,
                    next: filters.page + 1,
                    prev: filters.page - 1
                }}
                onPageChange={handlePageChange}
                searchPlaceholder="Search by Report Code..."
                onSearch={handleSearch}
                onEdit={(row) => navigate(`/dashboard/production/${row.id}/edit`)}
                onView={(row) => navigate(`/dashboard/production/${row.id}`)}
            />

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Report"
                message="Are you sure you want to delete this report? This action cannot be undone."
                confirmText="Delete Report"
                isLoading={deleting}
            />
        </div >
    );
};

export default ProductionList;
