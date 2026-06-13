import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { productionApi } from '../../../api/production';

const StoppageLogForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);

    // Dropdown Data
    const [reports, setReports] = useState([]);
    const [pets, setPets] = useState([]);
    const [downtimeCategories, setDowntimeCategories] = useState([]);
    const [downtimeSubCategories, setDowntimeSubCategories] = useState([]);

    const [formData, setFormData] = useState({
        report: '',
        pet: '',
        hour_index: '',
        minute_index: '',
        efficiency: '',
        downtime_minutes: '',
        bottles_produced: '',
        start_time: '',
        end_time: '',
        manual_time: false,
        comments: '',
        incidents: []
    });

    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch Dependencies
                const [reportsRes, petsRes, dtCatsRes, dtSubCatsRes] = await Promise.all([
                    productionApi.getReports({ page_size: 100 }), // Get recent reports
                    productionApi.getPets({ page_size: 100 }),
                    productionApi.getDowntimeCategories({ page_size: 100 }),
                    productionApi.getDowntimeSubCategories({ page_size: 1000 })
                ]);

                const getResults = (res) => {
                    const data = res.data;
                    if (Array.isArray(data)) return data;
                    if (data.results) return data.results;
                    if (data.data?.results) return data.data.results;
                    if (data.data) return data.data; // fallback
                    return [];
                };

                setReports(getResults(reportsRes));
                setPets(getResults(petsRes));
                setDowntimeCategories(getResults(dtCatsRes));
                setDowntimeSubCategories(getResults(dtSubCatsRes));


                if (isEditMode) {
                    const logRes = await productionApi.getStoppage(id);
                    const log = logRes.data?.data || logRes.data;
                    setFormData({
                        report: log.report,
                        pet: log.pet,
                        hour_index: log.hour_index ?? '',
                        minute_index: log.minute_index ?? '',
                        efficiency: log.efficiency ?? '',
                        downtime_minutes: log.downtime_minutes ?? '',
                        bottles_produced: log.bottles_produced ?? '',
                        start_time: log.start_time || '',
                        end_time: log.end_time || '',
                        manual_time: log.manual_time || false,
                        comments: log.comments || '',
                        incidents: (log.incidents || []).map(inc => ({
                            id: inc.id,
                            incident_description: inc.incident_description || '',
                            incident_time: inc.incident_time || '',
                            incident_duration: inc.incident_duration || '',
                            incident_category: inc.incident_category || '',
                            downtime_category: inc.downtime_category || '',
                            sub_downtime_category: inc.sub_downtime_category || '',
                        }))
                    });
                }
            } catch (err) {
                console.error("Failed to load data", err);
                setError("Failed to load necessary data");
            } finally {
                setInitialLoading(false);
            }
        };
        loadData();
    }, [id, isEditMode]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const FieldError = ({ name }) => {
        const errs = fieldErrors[name];
        if (!errs) return null;
        const msg = Array.isArray(errs) ? errs.join(', ') : errs;
        return <div className="invalid-feedback d-block">{msg}</div>;
    };

    // Incident Management
    const addIncident = () => {
        setFormData(prev => ({
            ...prev,
            incidents: [...prev.incidents, {
                incident_description: '',
                incident_time: '',
                downtime_category: '', // ID
                sub_downtime_category: '' // ID
            }]
        }));
    };

    const removeIncident = (index) => {
        const incident = formData.incidents[index];
        if (isEditMode && incident.id) {
            Swal.fire({
                icon: 'warning',
                title: 'Remove Incident',
                text: 'Are you sure you want to remove this incident?',
                showCancelButton: true,
                confirmButtonText: 'Yes, remove',
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        await productionApi.removeIncident(id, { id: incident.id });
                        setFormData(prev => ({
                            ...prev,
                            incidents: prev.incidents.filter((_, i) => i !== index)
                        }));
                        await Swal.fire({ icon: 'success', title: 'Removed!', timer: 1500, showConfirmButton: false });
                    } catch (err) {
                        console.error('Failed to remove incident', err);
                        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to remove incident.' });
                    }
                }
            });
            return;
        }
        setFormData(prev => ({
            ...prev,
            incidents: prev.incidents.filter((_, i) => i !== index)
        }));
    };

    const getFilteredSubCategories = (categoryId) => {
        if (!categoryId) return [];
        return downtimeSubCategories.filter(sub => String(sub.category) === String(categoryId));
    };

    const handleIncidentChange = (index, field, value) => {
        const newIncidents = [...formData.incidents];
        newIncidents[index] = { ...newIncidents[index], [field]: value };
        setFormData(prev => ({ ...prev, incidents: newIncidents }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setFieldErrors({});

        try {
            const payload = {
                pet: formData.pet ? parseInt(formData.pet) : null,
                hour_index: formData.hour_index !== '' ? parseInt(formData.hour_index) : null,
                minute_index: formData.minute_index !== '' ? parseInt(formData.minute_index) : null,
                downtime_minutes: formData.downtime_minutes !== '' ? parseInt(formData.downtime_minutes) : null,
                bottles_produced: formData.bottles_produced !== '' ? parseInt(formData.bottles_produced) : null,
                efficiency: formData.efficiency ? formData.efficiency.toString() : null,
                start_time: formData.start_time || null,
                end_time: formData.end_time || null,
                manual_time: formData.manual_time || false,
                comments: formData.comments || null,
            };

            if (isEditMode) {
                console.log(`[PATCH /production/stoppages/${id}/] Request Body:`, JSON.stringify(payload, null, 2));
                await productionApi.updateStoppage(id, payload);

                // Add new incidents only
                const newIncidents = formData.incidents.filter(inc => !inc.id);
                for (const inc of newIncidents) {
                    await productionApi.addIncident(id, {
                        incident_description: inc.incident_description || null,
                        incident_time: inc.incident_time || null,
                        incident_duration: inc.incident_duration || null,
                        incident_category: inc.incident_category ? parseInt(inc.incident_category) : null,
                        downtime_category: inc.downtime_category ? parseInt(inc.downtime_category) : null,
                        sub_downtime_category: inc.sub_downtime_category ? parseInt(inc.sub_downtime_category) : null,
                    });
                }
            } else {
                payload.report = formData.report ? parseInt(formData.report) : null;
                payload.incidents = formData.incidents.map(inc => ({
                    incident_description: inc.incident_description || null,
                    incident_time: inc.incident_time || null,
                    incident_duration: inc.incident_duration || null,
                    incident_category: inc.incident_category ? parseInt(inc.incident_category) : null,
                    downtime_category: inc.downtime_category ? parseInt(inc.downtime_category) : null,
                    sub_downtime_category: inc.sub_downtime_category ? parseInt(inc.sub_downtime_category) : null,
                }));
                await productionApi.createStoppage(payload);
            }
            await Swal.fire({
                icon: 'success',
                title: 'Saved!',
                text: isEditMode ? 'Stoppage log updated successfully!' : 'Stoppage log created successfully!',
                timer: 2000,
                showConfirmButton: false
            });
            if (!isEditMode) {
                navigate('/dashboard/production/stoppages');
            }
        } catch (err) {
            console.error("Failed to save stoppage log", err);
            const respData = err.response?.data;
            if (respData) {
                // Format 1: { message, data: { field: [errors] } }
                if (respData.data && typeof respData.data === 'object' && !Array.isArray(respData.data)) {
                    setFieldErrors(respData.data);
                    setError(respData.message || "Please fix the validation errors below.");
                // Format 2: DRF direct { field: [errors] } (no wrapper)
                } else if (typeof respData === 'object' && !respData.message && !Array.isArray(respData)) {
                    const possibleFields = Object.keys(respData).filter(k => 
                        Array.isArray(respData[k]) || typeof respData[k] === 'string'
                    );
                    if (possibleFields.length > 0) {
                        const errors = {};
                        possibleFields.forEach(k => { errors[k] = respData[k]; });
                        setFieldErrors(errors);
                        setError("Please fix the validation errors below.");
                    } else {
                        setError("Failed to save. Please check your inputs.");
                    }
                } else {
                    setError(respData.message || respData.detail || "Failed to save. Please check your inputs.");
                }
            } else {
                setError("Failed to save. Please check your inputs.");
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
                        <div>
                            <button 
                                type="button"
                                onClick={() => navigate('/dashboard/production/stoppages')} 
                                className="btn btn-link p-0 mb-2 text-decoration-none"
                            >
                                <i className="ti ti-arrow-left me-2"></i>
                                Back to Stoppage Logs
                            </button>
                            <h4 className="mb-2">
                                {isEditMode ? 'Edit Stoppage Log' : 'Create Stoppage Log'}
                            </h4>
                            <p className="text-muted small mb-0">
                                Record line downtime and incident details for accurate tracking and reporting.
                            </p>
                        </div>
                        <span className={`badge ${isEditMode ? 'bg-soft-warning text-warning' : 'bg-soft-primary text-primary'}`}>
                            <i className="ti ti-clock me-1"></i>
                            {isEditMode ? 'Editing Mode' : 'New Entry'}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger d-flex align-items-start mb-4">
                    <AlertCircle className="h-5 w-5 me-2 flex-shrink-0 mt-1" />
                    <div>
                        <strong>{error}</strong>
                        {Object.keys(fieldErrors).length > 0 && (
                            <ul className="mb-0 mt-1 ps-3">
                                {Object.entries(fieldErrors).map(([field, errs]) => (
                                    <li key={field} className="small">
                                        <strong>{field}</strong>: {Array.isArray(errs) ? (typeof errs[0] === 'object' ? `${errs.length} error(s)` : errs.join(', ')) : errs}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Log Details Card */}
                <div className="card mb-4">
                    <div className="card-header bg-soft-primary">
                        <h5 className="mb-1 text-primary">Log Details</h5>
                        <small className="text-muted">Fill core stoppage metrics and production context</small>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">Report <span className="text-danger">*</span></label>
                                <select
                                    name="report"
                                    value={formData.report}
                                    onChange={handleChange}
                                    className={`form-select${fieldErrors.report ? ' is-invalid' : ''}`}
                                    required
                                    disabled={isEditMode}
                                >
                                    <option value="">Select Report</option>
                                    {reports.map(r => (
                                        <option key={r.id} value={r.id}>{r.report_code} - {r.shift_name}</option>
                                    ))}
                                </select>
                                {isEditMode && <small className="text-muted">Report cannot be changed after creation</small>}
                                <FieldError name="report" />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">PET <span className="text-danger">*</span></label>
                                <select
                                    name="pet"
                                    value={formData.pet}
                                    onChange={handleChange}
                                    className={`form-select${fieldErrors.pet ? ' is-invalid' : ''}`}
                                    required
                                >
                                    <option value="">Select PET</option>
                                    {pets.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name || p.pet_name}
                                        </option>
                                    ))}
                                </select>
                                <FieldError name="pet" />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Hour Index <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    name="hour_index"
                                    value={formData.hour_index}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.hour_index ? ' is-invalid' : ''}`}
                                    placeholder="e.g. 1"
                                    required
                                />
                                <FieldError name="hour_index" />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Minute Index</label>
                                <input
                                    type="number"
                                    name="minute_index"
                                    value={formData.minute_index}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.minute_index ? ' is-invalid' : ''}`}
                                    placeholder="e.g. 30"
                                />
                                <FieldError name="minute_index" />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Efficiency (%) <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="efficiency"
                                    value={formData.efficiency}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.efficiency ? ' is-invalid' : ''}`}
                                    placeholder="e.g. 95.5"
                                    required
                                />
                                <FieldError name="efficiency" />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Downtime (Minutes) <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    name="downtime_minutes"
                                    value={formData.downtime_minutes}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.downtime_minutes ? ' is-invalid' : ''}`}
                                    placeholder="0"
                                    required
                                />
                                <FieldError name="downtime_minutes" />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Bottles Produced <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    name="bottles_produced"
                                    value={formData.bottles_produced}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.bottles_produced ? ' is-invalid' : ''}`}
                                    placeholder="0"
                                    required
                                />
                                <FieldError name="bottles_produced" />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Start Time</label>
                                <input
                                    type="time"
                                    name="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.start_time ? ' is-invalid' : ''}`}
                                />
                                <FieldError name="start_time" />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">End Time</label>
                                <input
                                    type="time"
                                    name="end_time"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                    className={`form-control${fieldErrors.end_time ? ' is-invalid' : ''}`}
                                />
                                <FieldError name="end_time" />
                            </div>

                            <div className="col-md-6 d-flex align-items-center">
                                <div className="form-check">
                                    <input
                                        type="checkbox"
                                        name="manual_time"
                                        checked={formData.manual_time}
                                        onChange={(e) => setFormData(prev => ({ ...prev, manual_time: e.target.checked }))}
                                        className="form-check-input"
                                        id="manualTimeCheck"
                                    />
                                    <label className="form-check-label" htmlFor="manualTimeCheck">Manual Time Entry</label>
                                </div>
                            </div>

                            <div className="col-12">
                                <label className="form-label">Comments</label>
                                <textarea
                                    name="comments"
                                    value={formData.comments}
                                    onChange={handleChange}
                                    rows="3"
                                    className={`form-control${fieldErrors.comments ? ' is-invalid' : ''}`}
                                    placeholder="Optional notes for shift handover, context, or follow-up."
                                />
                                <FieldError name="comments" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Incidents Card */}
                <div className="card mb-4">
                    <div className="card-header bg-soft-warning d-flex align-items-center justify-content-between">
                        <div>
                            <h5 className="mb-1 text-warning">Downtime Incidents</h5>
                            <small className="text-muted">Attach specific downtime events with categories and durations</small>
                        </div>
                        <button type="button" className="btn btn-warning btn-sm" onClick={addIncident}>
                            <Plus className="h-4 w-4 me-1" />
                            Add Incident
                        </button>
                    </div>
                    <div className="card-body">
                        {fieldErrors.incidents && (
                            <div className="alert alert-danger py-2 mb-3">
                                {Array.isArray(fieldErrors.incidents)
                                    ? fieldErrors.incidents.map((err, i) => (
                                        typeof err === 'object'
                                            ? <div key={i}>Incident {i + 1}: {Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')}</div>
                                            : <div key={i}>{err}</div>
                                    ))
                                    : fieldErrors.incidents}
                            </div>
                        )}
                        <div className="vstack gap-3">
                            {formData.incidents.map((incident, index) => (
                                <div key={index} className="card border-warning">
                                    <div className="card-body">
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <span className="badge bg-soft-warning text-warning">
                                                <i className="ti ti-alert-triangle me-1"></i>
                                                Incident {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeIncident(index)}
                                                className="btn btn-sm btn-outline-danger"
                                                title="Remove incident"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label small">Description <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    value={incident.incident_description}
                                                    onChange={(e) => handleIncidentChange(index, 'incident_description', e.target.value)}
                                                    placeholder="Describe what happened..."
                                                    className="form-control"
                                                    required
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small">Time</label>
                                                <input
                                                    type="time"
                                                    value={incident.incident_time}
                                                    onChange={(e) => handleIncidentChange(index, 'incident_time', e.target.value)}
                                                    className="form-control"
                                                />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label small">Duration (min)</label>
                                                <input
                                                    type="number"
                                                    value={incident.incident_duration || ''}
                                                    onChange={(e) => handleIncidentChange(index, 'incident_duration', e.target.value)}
                                                    placeholder="Minutes"
                                                    className="form-control"
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label small">Downtime Category</label>
                                                <select
                                                    value={incident.downtime_category}
                                                    onChange={(e) => handleIncidentChange(index, 'downtime_category', e.target.value)}
                                                    className="form-select"
                                                >
                                                    <option value="">Select Category...</option>
                                                    {downtimeCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="col-md-6">
                                                <label className="form-label small">Sub-Category</label>
                                                <select
                                                    value={incident.sub_downtime_category}
                                                    onChange={(e) => handleIncidentChange(index, 'sub_downtime_category', e.target.value)}
                                                    className="form-select"
                                                    disabled={!incident.downtime_category}
                                                >
                                                    <option value="">Select Sub-Category...</option>
                                                    {getFilteredSubCategories(incident.downtime_category).map(sub => (
                                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {formData.incidents.length === 0 && (
                                <div className="border border-dashed rounded p-4 text-center bg-light">
                                    <p className="text-muted small mb-2">No incidents added yet.</p>
                                    <p className="text-muted small mb-3">Use "Add Incident" to attach downtime events to this stoppage log.</p>
                                    <button type="button" className="btn btn-outline-warning btn-sm" onClick={addIncident}>
                                        <Plus className="h-4 w-4 me-1" />
                                        Add First Incident
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* Form Actions */}
                <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/production/stoppages')}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? (
                            <span className="spinner-border spinner-border-sm me-2"></span>
                        ) : (
                            <Save className="h-4 w-4 me-2" />
                        )}
                        {isEditMode ? 'Update Log' : 'Save Log'}
                    </button>
                </div>
            </form>
        </>
    );
};

export default StoppageLogForm;
