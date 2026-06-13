import React, { useState, useEffect } from 'react';
import { Card, DataTable, Button, Input } from '../../components/ui';
import { Truck, Plus, Search, Gauge, Trash2, Edit3, X, Loader2 } from 'lucide-react';
import { logisticsApi } from '../../api/logistics';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

const VehicleList = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [vehicleToDelete, setVehicleToDelete] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    const [formData, setFormData] = useState({
        plate_number: '',
        capacity: ''
    });

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const res = await logisticsApi.getVehicles({ search, page });
            setVehicles(res.data.data || []);
            setPagination({
                count: res.data.count,
                next: res.data.next,
                previous: res.data.previous
            });
        } catch (err) {
            console.error(err);
            toast.error("Failed to load vehicles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, [search, page]);

    const handleOpenModal = (vehicle = null) => {
        if (vehicle) {
            setEditingVehicle(vehicle);
            setFormData({
                plate_number: vehicle.plate_number || '',
                capacity: vehicle.capacity || ''
            });
        } else {
            setEditingVehicle(null);
            setFormData({
                plate_number: '',
                capacity: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (editingVehicle) {
                await logisticsApi.updateVehicle(editingVehicle.id, formData);
                toast.success("Vehicle updated successfully");
            } else {
                await logisticsApi.createVehicle(formData);
                toast.success("Vehicle registered successfully");
            }
            setIsModalOpen(false);
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save vehicle");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!vehicleToDelete) return;
        setIsDeleting(true);
        try {
            await logisticsApi.deleteVehicle(vehicleToDelete.id);
            toast.success("Vehicle removed successfully");
            setVehicleToDelete(null);
            fetchVehicles();
        } catch (err) {
            toast.error("Failed to delete vehicle");
        } finally {
            setIsDeleting(false);
        }
    };

    const columns = [
        {
            header: 'Plate Number', accessor: 'plate_number', render: (r) => (
                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded border border-blue-100 dark:border-blue-500/20">{r.plate_number}</span>
            )
        },
        {
            header: 'Capacity (Tons)', accessor: 'capacity', render: (r) => (
                <div className="flex items-center gap-1">
                    <Gauge size={14} className="text-slate-400" />
                    <span className="font-medium">{r.capacity}</span>
                </div>
            )
        },
        {
            header: 'Status', accessor: 'status', render: (r) => (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${r.status === 'AVAILABLE'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-amber-50 text-amber-600 border-amber-200'
                    }`}>
                    {r.status || 'AVAILABLE'}
                </span>
            )
        },
        {
            header: 'Actions', accessor: 'id', render: (r) => (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenModal(r)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 transition-colors">
                        <Edit3 size={16} />
                    </button>
                    <button onClick={() => setVehicleToDelete(r)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-500/10 rounded-2xl">
                        <Truck className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Vehicles</h1>
                        <p className="text-sm text-slate-500 font-medium">Manage fleet for product dispatch</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 h-11 px-6 shadow-blue-500/20 shadow-lg bg-blue-600 hover:bg-blue-700">
                    <Plus size={18} />
                    Register Vehicle
                </Button>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b dark:border-slate-800 flex justify-end">
                    <div className="relative w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search plate numbers..."
                            className="pl-10 h-11 focus:ring-blue-500/20 focus:border-blue-500"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>
                <DataTable
                    columns={columns}
                    data={vehicles}
                    isLoading={loading}
                />

                {/* Pagination Controls */}
                <div className="p-4 border-t dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="text-sm text-slate-500">
                        Total <span className="font-bold text-slate-900 dark:text-slate-100">{pagination.count}</span> vehicles in fleet
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!pagination.previous || loading}
                            onClick={() => setPage(page - 1)}
                            className="h-9 px-4"
                        >
                            Previous
                        </Button>
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/10">
                            {page}
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!pagination.next || loading}
                            onClick={() => setPage(page + 1)}
                            className="h-9 px-4"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative"
                        >
                            <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-xl text-blue-600">
                                        <Truck size={20} />
                                    </div>
                                    <h3 className="text-lg font-black">{editingVehicle ? 'Edit Vehicle' : 'Register Vehicle'}</h3>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <Input
                                        label="Plate Number"
                                        placeholder="e.g. GS-1234-22"
                                        value={formData.plate_number}
                                        onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                                        required
                                        className="h-12 uppercase font-bold tracking-wider"
                                    />
                                    <Input
                                        label="Capacity (Tons)"
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 15.5"
                                        value={formData.capacity}
                                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                        required
                                        className="h-12"
                                    />
                                </div>

                                <div className="pt-4 flex items-center gap-3">
                                    <Button type="button" variant="ghost" className="flex-1 h-12" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" disabled={formLoading}>
                                        {formLoading ? <Loader2 className="animate-spin" /> : (editingVehicle ? 'Update Vehicle' : 'Register Vehicle')}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={!!vehicleToDelete}
                onClose={() => setVehicleToDelete(null)}
                onConfirm={handleDelete}
                title="Remove Vehicle"
                message={`Are you sure you want to remove truck ${vehicleToDelete?.plate_number}? This action cannot be undone if there are no linked active shipments.`}
                confirmText="Remove Vehicle"
                variant="destructive"
                isLoading={isDeleting}
            />
        </div>
    );
};

export default VehicleList;
