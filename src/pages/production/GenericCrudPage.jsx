import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { DataTable, Button, Input, Card, ConfirmationModal } from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';

const GenericCrudPage = ({
    title,
    columns,
    api,
    formFields,
    transformPayload,
    onAdd,
    onEdit
}) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(15);
    const [totalCount, setTotalCount] = useState(0);
    const [paginationLinks, setPaginationLinks] = useState({ next: null, previous: null });

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { page: currentPage, page_size: pageSize };
            const res = await api.list(params);

            // Handle different possible response structures
            // 1. DRF Standard: { count: 100, results: [...] }
            // 2. Wrapped: { data: [...] } or { data: { results: [...] } }
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
                count = responseData.count || responseData.total || responseData.data.length;
                next = responseData.next;
                previous = responseData.previous;
            } else if (responseData.data?.results && Array.isArray(responseData.data.results)) {
                listData = responseData.data.results;
                count = responseData.data.count || responseData.data.results.length;
                next = responseData.data.next;
                previous = responseData.data.previous;
            }

            setData(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });
        } catch (err) {
            console.error("Failed to fetch data", err);
            // Optional: toast error
        } finally {
            setLoading(false);
        }
    };

    // Reset pagination when switching modules (title changes)
    useEffect(() => {
        setCurrentPage(1);
    }, [title]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, title]); // Re-fetch when page or title (module) changes

    const handlePageChange = (newPage) => {
        if (newPage > 0) {
            setCurrentPage(newPage);
        }
    };

    const handleCreate = () => {
        if (onAdd) {
            onAdd();
            return;
        }
        setCurrentItem(null);
        setFormData({});
        setIsModalOpen(true);
    };

    const handleEditInternal = (item) => {
        if (onEdit) {
            onEdit(item);
            return;
        }
        setCurrentItem(item);
        setFormData(item);
        setIsModalOpen(true);
    };

    const handleDelete = (item) => {
        setItemToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            await api.delete(itemToDelete.id);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            fetchData();
        } catch (err) {
            console.error("Failed to delete", err);
        } finally {
            setDeleting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = transformPayload ? transformPayload(formData) : formData;
            if (currentItem) {
                await api.update(currentItem.id, payload);
            } else {
                await api.create(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            console.error("Failed to save", err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
                <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-500">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={data}
                isLoading={loading}
                searchPlaceholder={`Search ${title}...`}
                onEdit={handleEditInternal}
                onDelete={handleDelete}
                pagination={{
                    currentPage,
                    pageSize,
                    totalCount,
                    // Derive next/prev existence from API links
                    hasNext: !!paginationLinks.next,
                    hasPrev: !!paginationLinks.previous,
                    // Pass next/prev page numbers for the simple DataTable handler we have
                    next: currentPage + 1,
                    prev: currentPage - 1
                }}
                onPageChange={handlePageChange}
            />

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message="Are you sure you want to delete this item? This action cannot be undone."
                confirmText="Delete"
                isLoading={deleting}
            />

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="flex justify-between items-center p-4 border-b border-slate-800">
                                <h2 className="text-lg font-semibold text-slate-100">
                                    {currentItem ? 'Edit Item' : 'Create New Item'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                                {formFields.map((field) => (
                                    <div key={field.name} className="space-y-1">
                                        <label className="text-sm font-medium text-slate-400">
                                            {field.label}
                                        </label>
                                        <Input
                                            name={field.name}
                                            type={field.type || "text"}
                                            value={formData[field.name] || ''}
                                            onChange={handleChange}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-500" disabled={submitting}>
                                        {submitting ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GenericCrudPage;
