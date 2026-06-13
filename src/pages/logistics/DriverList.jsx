import React, { useState, useEffect } from 'react';
import { Card, DataTable, Button, Input } from '../../components/ui';
import { User, Plus, Search, Phone, CreditCard, Trash2, Edit3, X, Loader2 } from 'lucide-react';
import { logisticsApi } from '../../api/logistics';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { Select } from '../../components/ui/base';

const DriverList = () => {
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [driverToDelete, setDriverToDelete] = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        license_number: '',
        phone_number: '',
        current_vehicle: ''
    });

    const fetchDrivers = async () => {
        setLoading(true);
        try {
            const res = await logisticsApi.getDrivers({ search, page });
            setDrivers(res.data.data || []);
            setPagination({
                count: res.data.count,
                next: res.data.next,
                previous: res.data.previous
            });
        } catch (err) {
            console.error(err);
            toast.error("Failed to load drivers");
        } finally {
            setLoading(false);
        }
    };

    const fetchVehicles = async () => {
        try {
            const res = await logisticsApi.getVehicles({ page_size: 100 });
            setVehicles(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchDrivers();
    }, [search, page]);

    useEffect(() => {
        fetchVehicles();
    }, []);

    const handleOpenModal = (driver = null) => {
        if (driver) {
            setEditingDriver(driver);
            setFormData({
                name: driver.name || '',
                license_number: driver.license_number || '',
                phone_number: driver.phone_number || '',
                current_vehicle: driver.current_vehicle || ''
            });
        } else {
            setEditingDriver(null);
            setFormData({
                name: '',
                license_number: '',
                phone_number: '',
                current_vehicle: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            if (editingDriver) {
                await logisticsApi.updateDriver(editingDriver.id, formData);
                toast.success("Driver updated successfully");
            } else {
                await logisticsApi.createDriver(formData);
                toast.success("Driver added successfully");
            }
            setIsModalOpen(false);
            fetchDrivers();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save driver");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!driverToDelete) return;
        setIsDeleting(true);
        try {
            await logisticsApi.deleteDriver(driverToDelete.id);
            toast.success("Driver deleted successfully");
            setDriverToDelete(null);
            fetchDrivers();
        } catch (err) {
            toast.error("Failed to delete driver");
        } finally {
            setIsDeleting(false);
        }
    };

    const columns = [
        {
            header: 'Full Name', accessor: 'name', render: (r) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600">
                        {r.name?.[0] || '?'}
                    </div>
                    <span className="font-bold">{r.name}</span>
                </div>
            )
        },
        {
            header: 'License No', accessor: 'license_number', render: (r) => (
                <div className="flex items-center gap-1 font-mono text-xs opacity-70">
                    <CreditCard size={14} />
                    {r.license_number}
                </div>
            )
        },
        {
            header: 'Phone', accessor: 'phone_number', render: (r) => (
                <div className="flex items-center gap-1 text-sm font-medium">
                    <Phone size={14} className="text-slate-400" />
                    {r.phone_number || 'N/A'}
                </div>
            )
        },
        {
            header: 'Vehicle', accessor: 'vehicle_plate', render: (r) => (
                <span className="font-mono text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded">
                    {r.vehicle_plate || 'NOT ASSIGNED'}
                </span>
            )
        },
        {
            header: 'Actions', accessor: 'id', render: (r) => (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenModal(r)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500 transition-colors">
                        <Edit3 size={16} />
                    </button>
                    <button onClick={() => setDriverToDelete(r)} className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
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
                    <div className="p-3 bg-amber-100 dark:bg-amber-500/10 rounded-2xl">
                        <User className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Drivers</h1>
                        <p className="text-sm text-slate-500 font-medium">Manage delivery personnel and vehicle assignments</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 h-11 px-6 shadow-amber-500/20 shadow-lg bg-amber-600 hover:bg-amber-700">
                    <Plus size={18} />
                    Add Driver
                </Button>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="p-4 border-b dark:border-slate-800 flex justify-end">
                    <div className="relative w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 group-focus-within:text-amber-500 transition-colors" />
                        <Input
                            placeholder="Search names, licenses..."
                            className="pl-10 h-11 focus:ring-amber-500/20 focus:border-amber-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <DataTable
                    columns={columns}
                    data={drivers}
                    isLoading={loading}
                />

                {/* Pagination Controls */}
                <div className="p-4 border-t dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="text-sm text-slate-500">
                        Total <span className="font-bold text-slate-900 dark:text-slate-100">{pagination.count}</span> drivers found
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
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-bold text-xs ring-2 ring-amber-500/10">
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
                                    <div className="p-2 bg-amber-100 dark:bg-amber-500/10 rounded-xl text-amber-600">
                                        <User size={20} />
                                    </div>
                                    <h3 className="text-lg font-black">{editingDriver ? 'Edit Driver' : 'Add New Driver'}</h3>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <Input
                                        label="Full Name"
                                        placeholder="Enter driver's name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="h-12"
                                    />
                                    <Input
                                        label="License Number"
                                        placeholder="e.g. LIC-XXXXX"
                                        value={formData.license_number}
                                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                                        required
                                        className="h-12"
                                    />
                                    <Input
                                        label="Phone Number"
                                        placeholder="Optional phone number"
                                        value={formData.phone_number}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                        className="h-12"
                                    />
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-400 ml-1">Assign Truck</label>
                                        <Select
                                            value={formData.current_vehicle}
                                            onChange={(e) => setFormData({ ...formData, current_vehicle: e.target.value })}
                                            className="h-12"
                                        >
                                            <option value="">No Vehicle Assigned</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.plate_number} ({v.model || 'Standard Truck'})
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center gap-3">
                                    <Button type="button" variant="ghost" className="flex-1 h-12" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="flex-1 h-12 bg-amber-600 hover:bg-amber-700" disabled={formLoading}>
                                        {formLoading ? <Loader2 className="animate-spin" /> : (editingDriver ? 'Save Changes' : 'Create Driver')}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={!!driverToDelete}
                onClose={() => setDriverToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Driver"
                message={`Are you sure you want to remove ${driverToDelete?.name}? This will also unassign them from their vehicle.`}
                confirmText="Delete Driver"
                isLoading={isDeleting}
            />
        </div>
    );
};

export default DriverList;
