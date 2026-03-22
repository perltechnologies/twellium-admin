import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, AlertCircle } from 'lucide-react';
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
        minute_index: '', // NEW FIELD
        efficiency: '',
        downtime_minutes: '',
        bottles_produced: '',
        comments: '',
        incidents: [] // Array of { incident_description: '', incident_time: '', downtime_category: '', sub_downtime_category: '' }
    });

    const [error, setError] = useState('');

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
                    const log = logRes.data.data;
                    setFormData({
                        report: log.report,
                        pet: log.pet,
                        hour_index: log.hour_index,
                        minute_index: log.minute_index || '', // NEW FIELD
                        efficiency: log.efficiency,
                        downtime_minutes: log.downtime_minutes,
                        bottles_produced: log.bottles_produced,
                        comments: log.comments || '',
                        incidents: log.incidents || []
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

        try {
            const payload = {
                ...formData,
                hour_index: parseInt(formData.hour_index),
                minute_index: formData.minute_index ? parseInt(formData.minute_index) : null,
                downtime_minutes: parseInt(formData.downtime_minutes),
                bottles_produced: parseInt(formData.bottles_produced),
                efficiency: formData.efficiency.toString(), // API expects string usually for decimal
                // Ensure incidents structure matches API expectation
                incidents: formData.incidents.map(inc => ({
                    incident_description: inc.incident_description,
                    incident_time: inc.incident_time || null,
                    downtime_category: inc.downtime_category ? parseInt(inc.downtime_category) : null,
                    sub_downtime_category: inc.sub_downtime_category ? parseInt(inc.sub_downtime_category) : null,
                }))
            };



            if (isEditMode) {
                await productionApi.updateStoppage(id, payload);
            } else {
                await productionApi.createStoppage(payload);
            }
            navigate('/dashboard/production/stoppages');
        } catch (err) {
            console.error("Failed to save stoppage log", err);
            setError("Failed to save. Please check your inputs.");
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
                <div className="alert alert-danger d-flex align-items-center mb-4">
                    <AlertCircle className="h-5 w-5 me-2" />
                    {error}
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
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select Report</option>
                                    {reports.map(r => (
                                        <option key={r.id} value={r.id}>{r.report_code} - {r.shift_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">PET <span className="text-danger">*</span></label>
                                <select
                                    name="pet"
                                    value={formData.pet}
                                    onChange={handleChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="">Select PET</option>
                                    {pets.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name || p.pet_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Hour Index <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    name="hour_index"
                                    value={formData.hour_index}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 1"
                                    required
                                />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Minute Index</label>
                                <input
                                    type="number"
                                    name="minute_index"
                                    value={formData.minute_index}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 30"
                                />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Efficiency (%) <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="efficiency"
                                    value={formData.efficiency}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 95.5"
                                    required
                                />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label">Downtime (Minutes) <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    name="downtime_minutes"
                                    value={formData.downtime_minutes}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="0"
                                    required
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Bottles Produced <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    name="bottles_produced"
                                    value={formData.bottles_produced}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="0"
                                    required
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label">Comments</label>
                                <textarea
                                    name="comments"
                                    value={formData.comments}
                                    onChange={handleChange}
                                    rows="3"
                                    className="form-control"
                                    placeholder="Optional notes for shift handover, context, or follow-up."
                                />
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
