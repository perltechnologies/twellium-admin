import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Trash2, Edit3, X, Loader2, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { workersApi } from '../../api/workers';
import { productionApi } from '../../api/production';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmationModal } from '../../components/ui';

const WorkerList = () => {
    const [workers, setWorkers] = useState([]);
    const [workerGroups, setWorkerGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWorker, setEditingWorker] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [workerToDelete, setWorkerToDelete] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [filterGroup, setFilterGroup] = useState('');

    // Attendance tracking from reports
    const [attendanceMap, setAttendanceMap] = useState({}); // { workerId: { present, report_code } }
    const [attendanceDate, setAttendanceDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '',
        surname: '',
        other_name: '',
        company: '',
        worker_group: ''
    });

    const fetchWorkers = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, page_size: 10 };
            if (filterGroup) params.worker_group = filterGroup;

            const res = await workersApi.getWorkers(params);
            const resData = res.data;
            const list = Array.isArray(resData?.data) ? resData.data
                       : Array.isArray(resData?.results) ? resData.results
                       : Array.isArray(resData) ? resData : [];
            setWorkers(list);
            setPagination({
                count: resData?.count || list.length,
                next: resData?.next || null,
                previous: resData?.previous || null
            });
        } catch (err) {
            console.error(err);
            toast.error("Failed to load workers");
        } finally {
            setLoading(false);
        }
    }, [page, filterGroup]);

    const fetchWorkerGroups = async () => {
        try {
            const res = await workersApi.getWorkerGroups({ page_size: 100 });
            const resData = res.data;
            const list = Array.isArray(resData?.data) ? resData.data
                       : Array.isArray(resData?.results) ? resData.results
                       : Array.isArray(resData) ? resData : [];
            setWorkerGroups(list);
        } catch (err) {
            console.error('Failed to load worker groups:', err);
        }
    };

    // Fetch attendance from production reports for the selected date
    const fetchAttendance = useCallback(async () => {
        if (!attendanceDate) return;
        setAttendanceLoading(true);
        try {
            const res = await productionApi.getReports({ production_date: attendanceDate, page_size: 50 });
            const resData = res.data;
            const reports = Array.isArray(resData?.data) ? resData.data
                          : Array.isArray(resData?.results) ? resData.results
                          : Array.isArray(resData) ? resData : [];

            // Build attendance map from all reports for the date
            const map = {};
            reports.forEach(report => {
                const reportWorkers = report.workers || [];
                reportWorkers.forEach(rw => {
                    const wId = rw.worker_id || rw.worker?.id;
                    if (wId) {
                        map[wId] = {
                            present: rw.present,
                            report_code: report.report_code,
                            worker_name: rw.worker_name || `${rw.worker?.first_name || ''} ${rw.worker?.surname || ''}`.trim(),
                            worker_group_name: rw.worker_group_name
                        };
                    }
                });
            });
            setAttendanceMap(map);
        } catch (err) {
            console.error('Failed to load attendance:', err);
        } finally {
            setAttendanceLoading(false);
        }
    }, [attendanceDate]);

    useEffect(() => {
        fetchWorkerGroups();
    }, []);

    useEffect(() => {
        fetchWorkers();
    }, [fetchWorkers]);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            const payload = {
                first_name: formData.first_name,
                surname: formData.surname,
                other_name: formData.other_name || null,
                company: formData.company ? parseInt(formData.company) : null,
                worker_group: formData.worker_group ? parseInt(formData.worker_group) : null
            };

            if (editingWorker) {
                await workersApi.updateWorker(editingWorker.id, payload);
                toast.success("Worker updated successfully");
            } else {
                await workersApi.createWorker(payload);
                toast.success("Worker added successfully");
            }
            closeModal();
            fetchWorkers();
        } catch (err) {
            console.error(err);
            toast.error(editingWorker ? "Failed to update worker" : "Failed to add worker");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!workerToDelete) return;
        setIsDeleting(true);
        try {
            await workersApi.deleteWorker(workerToDelete.id);
            toast.success("Worker deleted");
            setWorkerToDelete(null);
            fetchWorkers();
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete worker");
        } finally {
            setIsDeleting(false);
        }
    };

    const openEditModal = (worker) => {
        setEditingWorker(worker);
        setFormData({
            first_name: worker.first_name || '',
            surname: worker.surname || '',
            other_name: worker.other_name || '',
            company: worker.company || '',
            worker_group: worker.worker_group || ''
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingWorker(null);
        setFormData({ first_name: '', surname: '', other_name: '', company: '', worker_group: '' });
    };

    // Client-side search filter
    const filteredWorkers = search
        ? workers.filter(w => {
            const fullName = `${w.first_name || ''} ${w.surname || ''} ${w.other_name || ''}`.toLowerCase();
            const company = (w.company_name || '').toLowerCase();
            const group = (w.worker_group_name || '').toLowerCase();
            const q = search.toLowerCase();
            return fullName.includes(q) || company.includes(q) || group.includes(q);
        })
        : workers;

    // Attendance stats
    const presentCount = Object.values(attendanceMap).filter(a => a.present === true).length;
    const absentCount = Object.values(attendanceMap).filter(a => a.present === false).length;
    const totalTracked = Object.keys(attendanceMap).length;

    return (
        <div>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div>
                    <h4 className="mb-1 fw-bold">Workers</h4>
                    <p className="text-muted mb-0">Worker records and attendance tracking</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary d-flex align-items-center gap-2">
                    <Plus size={16} />
                    Add Worker
                </button>
            </div>

            {/* Stats */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body py-3">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Total Workers</p>
                                    <h4 className="mb-0 fw-bold">{pagination.count || workers.length}</h4>
                                </div>
                                <div className="avatar bg-soft-primary rounded-circle p-2">
                                    <Users size={20} className="text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body py-3">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Present</p>
                                    <h4 className="mb-0 fw-bold text-success">{presentCount}</h4>
                                </div>
                                <div className="avatar bg-soft-success rounded-circle p-2">
                                    <CheckCircle size={20} className="text-success" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body py-3">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Absent</p>
                                    <h4 className="mb-0 fw-bold text-danger">{absentCount}</h4>
                                </div>
                                <div className="avatar bg-soft-danger rounded-circle p-2">
                                    <XCircle size={20} className="text-danger" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body py-3">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Tracked Today</p>
                                    <h4 className="mb-0 fw-bold text-info">{totalTracked}</h4>
                                </div>
                                <div className="avatar bg-soft-info rounded-circle p-2">
                                    <Calendar size={20} className="text-info" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-0 py-3">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <h6 className="mb-0 fw-semibold">Worker Directory</h6>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="position-relative">
                                <Search size={14} className="position-absolute top-50 translate-middle-y ms-2 text-muted" />
                                <input
                                    type="text"
                                    className="form-control form-control-sm ps-4"
                                    placeholder="Search workers..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ width: 170 }}
                                />
                            </div>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: 'auto' }}
                                value={filterGroup}
                                onChange={(e) => { setFilterGroup(e.target.value); setPage(1); }}
                            >
                                <option value="">All Groups</option>
                                {workerGroups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                            <div className="d-flex align-items-center gap-1">
                                <Calendar size={14} className="text-muted" />
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={attendanceDate}
                                    onChange={(e) => setAttendanceDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    title="Attendance date"
                                    style={{ width: 140 }}
                                />
                            </div>
                            {attendanceLoading && (
                                <Loader2 size={14} className="spin text-primary" />
                            )}
                        </div>
                    </div>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <Loader2 size={24} className="spin text-primary" />
                            <p className="text-muted mt-2 mb-0">Loading workers...</p>
                        </div>
                    ) : filteredWorkers.length === 0 ? (
                        <div className="text-center py-5">
                            <Users size={48} className="text-muted mb-3" />
                            <h6 className="text-muted">No workers found</h6>
                            <p className="text-muted mb-3">Add workers to track assignments and attendance.</p>
                            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">
                                <Plus size={14} className="me-1" />
                                Add First Worker
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="fw-semibold text-muted fs-13 py-3 px-3">#</th>
                                        <th className="fw-semibold text-muted fs-13 py-3 px-3">Name</th>
                                        <th className="fw-semibold text-muted fs-13 py-3 px-3">Role (Group)</th>
                                        <th className="fw-semibold text-muted fs-13 py-3 px-3">Company</th>
                                        <th className="fw-semibold text-muted fs-13 py-3 px-3">Present</th>
                                        <th className="fw-semibold text-muted fs-13 py-3 px-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredWorkers.map((worker, idx) => {
                                        const attendance = attendanceMap[worker.id];
                                        const isPresent = attendance?.present;
                                        const hasAttendance = attendance !== undefined;

                                        return (
                                            <tr key={worker.id || idx}>
                                                <td className="py-3 px-3">
                                                    <span className="text-muted">{(page - 1) * 10 + idx + 1}</span>
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="avatar avatar-sm bg-soft-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                                                            <span className="text-primary fw-bold" style={{ fontSize: 12 }}>
                                                                {(worker.first_name?.[0] || '').toUpperCase()}{(worker.surname?.[0] || '').toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="fw-semibold d-block">
                                                                {worker.first_name} {worker.surname}
                                                            </span>
                                                            {worker.other_name && (
                                                                <small className="text-muted">{worker.other_name}</small>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3">
                                                    {worker.worker_group_name ? (
                                                        <span className="badge bg-soft-info text-info rounded-pill px-3 py-1">
                                                            {worker.worker_group_name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    {worker.company_name || <span className="text-muted">—</span>}
                                                </td>
                                                <td className="py-3 px-3">
                                                    {hasAttendance ? (
                                                        <span className={`badge ${isPresent ? 'bg-soft-success text-success' : 'bg-soft-danger text-danger'} rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1`}>
                                                            {isPresent ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                            {isPresent ? 'Yes' : 'No'}
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-soft-secondary text-secondary rounded-pill px-3 py-1">
                                                            N/A
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <div className="d-flex gap-1">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => openEditModal(worker)}
                                                            title="Edit"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => setWorkerToDelete(worker)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {/* Pagination */}
                {pagination.count > 0 && (
                    <div className="card-footer bg-transparent border-0 py-3">
                        <div className="d-flex align-items-center justify-content-between">
                            <small className="text-muted">
                                Showing {filteredWorkers.length} of {pagination.count} workers
                            </small>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    disabled={!pagination.previous}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                >
                                    Previous
                                </button>
                                <span className="btn btn-sm btn-light disabled">Page {page}</span>
                                <button
                                    className="btn btn-outline-primary btn-sm"
                                    disabled={!pagination.next}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal d-block"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="modal-dialog modal-dialog-centered"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-content border-0 shadow">
                                <div className="modal-header border-0">
                                    <h5 className="modal-title fw-bold">
                                        {editingWorker ? 'Edit Worker' : 'Add Worker'}
                                    </h5>
                                    <button className="btn btn-sm btn-outline-light" onClick={closeModal}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <form onSubmit={handleSubmit}>
                                    <div className="modal-body">
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label fw-semibold">First Name <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={formData.first_name}
                                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                                    required
                                                    placeholder="First name"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label fw-semibold">Surname <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={formData.surname}
                                                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                                                    required
                                                    placeholder="Surname"
                                                />
                                            </div>
                                        </div>
                                        <div className="mb-3 mt-3">
                                            <label className="form-label fw-semibold">Other Name</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={formData.other_name}
                                                onChange={(e) => setFormData({ ...formData, other_name: e.target.value })}
                                                placeholder="Other name (optional)"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">Worker Group (Role)</label>
                                            <select
                                                className="form-select"
                                                value={formData.worker_group}
                                                onChange={(e) => setFormData({ ...formData, worker_group: e.target.value })}
                                            >
                                                <option value="">Select group...</option>
                                                {workerGroups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name} {g.pet_name ? `(${g.pet_name})` : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="modal-footer border-0">
                                        <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={formLoading}>
                                            {formLoading && <Loader2 size={14} className="spin" />}
                                            {editingWorker ? 'Update' : 'Add Worker'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation */}
            <ConfirmationModal
                isOpen={!!workerToDelete}
                onClose={() => setWorkerToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Worker"
                message={`Are you sure you want to delete "${workerToDelete?.first_name} ${workerToDelete?.surname}"? This action cannot be undone.`}
                confirmText="Delete"
                loading={isDeleting}
                variant="danger"
            />
        </div>
    );
};

export default WorkerList;
