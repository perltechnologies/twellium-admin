import React, { useState, useEffect } from 'react';
import { Card, DataTable, Button, Badge, Input, ConfirmationModal } from '../../components/ui';
import {
    Layers,
    Settings,
    Edit,
    Trash2,
    Plus,
    RefreshCw,
    X,
    Hash
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const StageManagement = () => {
    const [stages, setStages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStage, setEditingStage] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        display_name: '',
        barcode_prefix: ''
    });

    const fetchStages = async () => {
        setLoading(true);
        try {
            const res = await inventoryApi.getStages();
            // Assuming res.data.data or res.data is the list
            setStages(res.data.data || res.data || []);
        } catch (err) {
            toast.error("Failed to load stages");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStages();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStage) {
                await inventoryApi.updateStage(editingStage.id, formData);
                toast.success("Stage updated successfully");
            } else {
                await inventoryApi.createStage(formData);
                toast.success("Stage created successfully");
            }
            setIsModalOpen(false);
            setEditingStage(null);
            setFormData({ name: '', display_name: '', barcode_prefix: '' });
            fetchStages();
        } catch (err) {
            toast.error(err.response?.data?.message || "Operation failed");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this stage?")) return;
        try {
            await inventoryApi.deleteStage(id);
            toast.success("Stage deleted");
            fetchStages();
        } catch (err) {
            toast.error("Failed to delete stage");
        }
    };

    const columns = [
        {
            header: 'Internal Name',
            accessor: 'name',
            render: (r) => <span className="font-mono font-bold text-slate-400">{r.name}</span>
        },
        {
            header: 'Display Name',
            accessor: 'display_name',
            render: (r) => <span className="font-bold text-slate-900 dark:text-slate-100">{r.display_name}</span>
        },
        {
            header: 'Prefix',
            accessor: 'barcode_prefix',
            render: (r) => (
                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-100 dark:border-blue-500/20 w-fit">
                    <Hash size={14} />
                    <span className="font-mono font-black">{r.barcode_prefix}</span>
                </div>
            )
        },
        {
            header: 'Actions',
            accessor: 'id',
            render: (r) => (
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="p-2"
                        onClick={() => {
                            setEditingStage(r);
                            setFormData({
                                name: r.name,
                                display_name: r.display_name,
                                barcode_prefix: r.barcode_prefix
                            });
                            setIsModalOpen(true);
                        }}
                    >
                        <Edit size={14} />
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="p-2"
                        onClick={() => handleDelete(r.id)}
                    >
                        <Trash2 size={14} />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl">
                        <Layers className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Production Stages</h1>
                        <p className="text-sm text-slate-500">Define stages and their corresponding barcode identifier prefixes</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" className="gap-2" onClick={fetchStages}>
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Button
                        className="gap-2 h-11 px-6 shadow-indigo-500/20 shadow-xl bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                            setEditingStage(null);
                            setFormData({ name: '', display_name: '', barcode_prefix: '' });
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={18} />
                        Add New Stage
                    </Button>
                </div>
            </div>

            <Card className="p-0 overflow-hidden">
                <DataTable
                    columns={columns}
                    data={stages}
                    isLoading={loading}
                />
            </Card>

            {/* Manage Stage Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                                <h3 className="text-xl font-bold">{editingStage ? 'Edit Stage' : 'Create New Stage'}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Internal Name</label>
                                    <Input
                                        placeholder="e.g., TRANSIT"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                        required
                                        className="font-mono"
                                    />
                                    <p className="text-[10px] text-slate-400 italic">Unique identifier used by the backend</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Display Name</label>
                                    <Input
                                        placeholder="e.g., In Transit"
                                        value={formData.display_name}
                                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Barcode Prefix</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                                        <Input
                                            placeholder="e.g., T"
                                            value={formData.barcode_prefix}
                                            onChange={(e) => setFormData({ ...formData, barcode_prefix: e.target.value.toUpperCase().slice(0, 1) })}
                                            required
                                            className="pl-10 font-black"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic">Single character prefix for barcodes in this stage</p>
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" className="w-full h-12 text-lg">
                                        {editingStage ? 'Update Stage' : 'Create Stage'}
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

export default StageManagement;
