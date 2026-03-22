import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, AlertCircle } from 'lucide-react';
import { productionApi } from '../../api/production';
import { usersApi } from '../../api/users';

const ReportForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        production_date: new Date().toISOString().split('T')[0],
        report_code: '',
        pet: '',
        line: '',
        shift: '',
        supervisor: '',
        product_name: '',
        bottle_size: '',
        bottles_per_pack: '',
        packs_per_pallet: '',
        line_speed: '',
        start_time: '',
        end_time: '',
        remarks: '',
    });

    const [pets, setPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [petsRes, shiftsRes, usersRes] = await Promise.all([
                    productionApi.getPets({ page_size: 100 }),
                    productionApi.getShifts({ page_size: 100 }),
                    usersApi.getUsers(),
                ]);

                const getResults = (res) => {
                    const d = res.data;
                    if (Array.isArray(d)) return d;
                    if (d?.data?.results) return d.data.results;
                    if (d?.results) return d.results;
                    if (d?.data && Array.isArray(d.data)) return d.data;
                    return [];
                };

                setPets(getResults(petsRes));
                setShifts(getResults(shiftsRes));
                setUsers(getResults(usersRes));

                if (isEditMode) {
                    const res = await productionApi.getReport(id);
                    const r = res.data?.data || res.data;
                    setFormData({
                        production_date: r.production_date || '',
                        report_code: r.report_code || '',
                        pet: r.pet ?? '',
                        line: r.line ?? '',
                        shift: r.shift ?? '',
                        supervisor: r.supervisor ?? '',
                        product_name: r.product_name || '',
                        bottle_size: r.bottle_size || '',
                        bottles_per_pack: r.bottles_per_pack ?? '',
                        packs_per_pallet: r.packs_per_pallet ?? '',
                        line_speed: r.line_speed ?? '',
                        start_time: r.start_time || '',
                        end_time: r.end_time || '',
                        remarks: r.remarks || '',
                    });
                }
            } catch (err) {
                console.error('Failed to load form data:', err);
                setError('Failed to load form dependencies. Please refresh.');
            } finally {
                setInitialLoading(false);
            }
        };
        loadData();
    }, [id, isEditMode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const payload = { ...formData };
            // Clean optional numeric fields
            ['line', 'bottles_per_pack', 'packs_per_pallet', 'line_speed'].forEach(k => {
                if (payload[k] === '') payload[k] = null;
                else if (payload[k] != null) payload[k] = Number(payload[k]);
            });
            if (!payload.report_code) payload.report_code = `RPT-${Date.now()}`;
            if (!payload.start_time) delete payload.start_time;
            if (!payload.end_time) delete payload.end_time;

            if (isEditMode) {
                await productionApi.updateReport(id, payload);
            } else {
                await productionApi.createReport(payload);
            }
            navigate('/dashboard/production');
        } catch (err) {
            console.error('Failed to save report:', err);
            const detail = err.response?.data;
            if (detail && typeof detail === 'object') {
                const msgs = Object.entries(detail)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
                setError(msgs || 'Failed to save. Please check your inputs.');
            } else {
                setError('Failed to save. Please check your inputs.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) return <div className="p-5 text-center text-muted">Loading form...</div>;

    return (
        <>
            {/* Header */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard/production')}
                                className="btn btn-link p-0 mb-2 text-decoration-none"
                            >
                                <i className="ti ti-arrow-left me-2"></i>
                                Back to Production Reports
                            </button>
                            <h4 className="mb-2">
                                {isEditMode ? 'Edit Production Report' : 'Create New Report'}
                            </h4>
                            <p className="text-muted small mb-0">
                                {isEditMode
                                    ? 'Update production report details, timing, and line configuration.'
                                    : 'Set up a new production report with line, shift, and product details.'}
                            </p>
                        </div>
                        <span className={`badge ${isEditMode ? 'bg-soft-warning text-warning' : 'bg-soft-primary text-primary'}`}>
                            <i className={`ti ${isEditMode ? 'ti-edit' : 'ti-file-plus'} me-1`}></i>
                            {isEditMode ? 'Editing Mode' : 'New Report'}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger d-flex align-items-center mb-4">
                    <AlertCircle className="h-5 w-5 me-2 flex-shrink-0" />
                    <div className="flex-grow-1">{error}</div>
                    <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Report Identification */}
                <div className="card mb-4">
                    <div className="card-header bg-soft-primary">
                        <h5 className="mb-1 text-primary">
                            <i className="ti ti-file-description me-2"></i>Report Identification
                        </h5>
                        <small className="text-muted">Core report info — date, code, and production line</small>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label">Production Date <span className="text-danger">*</span></label>
                                <input
                                    type="date"
                                    name="production_date"
                                    value={formData.production_date}
                                    onChange={handleChange}
                                    className="form-control"
                                    required
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Report Code</label>
                                <input
                                    type="text"
                                    name="report_code"
                                    value={formData.report_code}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="Auto-generated if empty"
                                    disabled={isEditMode}
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">PET Line <span className="text-danger">*</span></label>
                                <select
                                    name="pet"
                                    value={formData.pet}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select PET Line</option>
                                    {pets.sort((a, b) => {
                                        const aName = (a.pet_name || '').toLowerCase();
                                        const bName = (b.pet_name || '').toLowerCase();
                                        if (aName.includes('can') && !bName.includes('can')) return 1;
                                        if (!aName.includes('can') && bName.includes('can')) return -1;
                                        const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                                        const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                                        return aNum - bNum;
                                    }).map(p => (
                                        <option key={p.id} value={p.id}>{p.pet_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shift & Personnel */}
                <div className="card mb-4">
                    <div className="card-header bg-soft-info">
                        <h5 className="mb-1 text-info">
                            <i className="ti ti-users me-2"></i>Shift & Personnel
                        </h5>
                        <small className="text-muted">Assign shift, supervisor, and line number</small>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label">Shift <span className="text-danger">*</span></label>
                                <select
                                    name="shift"
                                    value={formData.shift}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select Shift</option>
                                    {shifts.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.start_time} – {s.end_time})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Supervisor <span className="text-danger">*</span></label>
                                <select
                                    name="supervisor"
                                    value={formData.supervisor}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select Supervisor</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name || u.username} {u.role ? `(${u.role})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Line Number</label>
                                <input
                                    type="number"
                                    name="line"
                                    value={formData.line}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 1"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product & Packaging */}
                <div className="card mb-4">
                    <div className="card-header bg-soft-success">
                        <h5 className="mb-1 text-success">
                            <i className="ti ti-package me-2"></i>Product & Packaging
                        </h5>
                        <small className="text-muted">Product identity and packaging configuration</small>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">Product Name</label>
                                <input
                                    type="text"
                                    name="product_name"
                                    value={formData.product_name}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. Coca-Cola 500ml"
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Bottle Size</label>
                                <input
                                    type="text"
                                    name="bottle_size"
                                    value={formData.bottle_size}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 500ml"
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Bottles per Pack</label>
                                <input
                                    type="number"
                                    name="bottles_per_pack"
                                    value={formData.bottles_per_pack}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 12"
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Packs per Pallet</label>
                                <input
                                    type="number"
                                    name="packs_per_pallet"
                                    value={formData.packs_per_pallet}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 100"
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Line Speed</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="line_speed"
                                    value={formData.line_speed}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="Bottles per hour"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timing & Notes */}
                <div className="card mb-4">
                    <div className="card-header bg-soft-warning">
                        <h5 className="mb-1 text-warning">
                            <i className="ti ti-clock me-2"></i>Timing & Notes
                        </h5>
                        <small className="text-muted">Production window and any additional remarks</small>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">Start Time</label>
                                <input
                                    type="time"
                                    name="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                    className="form-control"
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">End Time</label>
                                <input
                                    type="time"
                                    name="end_time"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                    className="form-control"
                                />
                            </div>
                            <div className="col-12">
                                <label className="form-label">Remarks</label>
                                <textarea
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleChange}
                                    rows="3"
                                    className="form-control"
                                    placeholder="Optional notes for shift handover, context, or follow-up."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/production')}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? (
                            <span className="spinner-border spinner-border-sm me-2"></span>
                        ) : (
                            <Save className="h-4 w-4 me-2" />
                        )}
                        {isEditMode ? 'Update Report' : 'Create Report'}
                    </button>
                </div>
            </form>
        </>
    );
};

export default ReportForm;
