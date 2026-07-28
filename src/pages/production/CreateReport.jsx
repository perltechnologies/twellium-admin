import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { productionApi } from '../../api/production';
import { usersApi } from '../../api/users';

const CreateReport = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;
    const [activeTab, setActiveTab] = useState('basic');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        production_date: new Date().toISOString().split('T')[0],
        report_code: '',
        line: '',
        pet: '',
        shift: '',
        supervisor: '',
        status: 'STARTED',
        bottle_size: '',
        bottles_per_pack: '',
        packs_per_pallet: '',
        line_speed: '',
        bottles_produced: '',
        start_time: '',
        end_time: '',
        remarks: ''
    });

    const [batches, setBatches] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [stoppages, setStoppages] = useState([]);
    const [meterReadings, setMeterReadings] = useState([]);

    // Lookup data
    const [pets, setPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [users, setUsers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [downtimeCategories, setDowntimeCategories] = useState([]);

    useEffect(() => {
        loadLookupData();
        if (isEditMode) {
            loadReportData();
        }
    }, [id]);

    const loadReportData = async () => {
        try {
            const res = await productionApi.getReport(id);
            const report = res.data?.data || res.data;
            
            setFormData({
                production_date: report.production_date || '',
                report_code: report.report_code || '',
                line: report.line ?? '',
                pet: report.pet ?? '',
                shift: report.shift ?? '',
                supervisor: report.supervisor ?? '',
                status: report.status || 'STARTED',
                bottle_size: report.bottle_size || '',
                bottles_per_pack: report.bottles_per_pack ?? '',
                packs_per_pallet: report.packs_per_pallet ?? '',
                line_speed: report.line_speed ?? '',
                bottles_produced: report.bottles_produced ?? report.total_bottles_produced ?? '',
                start_time: report.start_time?.slice(0, 5) || '',
                end_time: report.end_time?.slice(0, 5) || '',
                remarks: report.remarks || ''
            });

            setBatches((report.batches || []).map(b => ({
                batch_number: b.batch_number || '',
                syrup_liters: b.syrup_liters || '',
                start_time: b.start_time?.slice(0, 8) || ''
            })));

            setStoppages((report.stoppage_logs || []).map(s => ({
                id: s.id,
                start_time: s.start_time ? s.start_time.slice(0, 16) : new Date().toISOString().slice(0, 16),
                end_time: s.end_time ? s.end_time.slice(0, 16) : new Date().toISOString().slice(0, 16),
                downtime_minutes: s.downtime_minutes || 0,
                bottles_produced: s.bottles_produced ?? '',
                comments: s.comments || '',
                incidents: s.incidents || []
            })));

            setMeterReadings((report.meter_readings || []).map(m => ({
                reading_type: m.reading_type || 'CO2',
                start_reading: m.start_reading || '',
                end_reading: m.end_reading || '',
                remarks: m.remarks || ''
            })));
        } catch (err) {
            console.error('Failed to load report:', err);
            setError('Failed to load report data');
        } finally {
            setInitialLoading(false);
        }
    };

    const loadLookupData = async () => {
        try {
            const getResults = (res) => {
                const d = res.data;
                if (Array.isArray(d)) return d;
                if (d?.data?.results) return d.data.results;
                if (d?.results) return d.results;
                if (d?.data && Array.isArray(d.data)) return d.data;
                return [];
            };

            const [petsRes, shiftsRes, usersRes] = await Promise.all([
                productionApi.getPets({ page_size: 100 }).catch(() => ({ data: [] })),
                productionApi.getShifts({ page_size: 100 }).catch(() => ({ data: [] })),
                usersApi.getUsers().catch(() => ({ data: [] }))
            ]);
            
            setPets(getResults(petsRes).filter(p => !p.pet_name?.toLowerCase().includes('can')));
            setShifts(getResults(shiftsRes));
            setUsers(getResults(usersRes));

            // Load optional data
            try {
                const suppliersRes = await productionApi.getSuppliers({ page_size: 100 });
                setSuppliers(getResults(suppliersRes));
            } catch (e) {
                setSuppliers([]);
            }

            try {
                const downtimeRes = await productionApi.getDowntimeCategories({ page_size: 100 });
                setDowntimeCategories(getResults(downtimeRes));
            } catch (e) {
                setDowntimeCategories([]);
            }
        } catch (err) {
            console.error('Failed to load lookup data:', err);
            setError('Failed to load required form data. Please refresh the page.');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addBatch = () => {
        setBatches([...batches, {
            batch_number: '',
            syrup_liters: '',
            start_time: new Date().toTimeString().slice(0, 8)
        }]);
    };

    const removeBatch = (index) => {
        setBatches(batches.filter((_, i) => i !== index));
    };

    const updateBatch = (index, field, value) => {
        const updated = [...batches];
        updated[index][field] = value;
        setBatches(updated);
    };

    const addStoppage = () => {
        setStoppages([...stoppages, {
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            downtime_minutes: 0,
            bottles_produced: '',
            comments: '',
            incidents: []
        }]);
    };

    const removeStoppage = (index) => {
        setStoppages(stoppages.filter((_, i) => i !== index));
    };

    const updateStoppage = (index, field, value) => {
        const updated = [...stoppages];
        updated[index][field] = value;
        setStoppages(updated);
    };

    const addMeterReading = () => {
        setMeterReadings([...meterReadings, {
            reading_type: 'CO2',
            start_reading: '',
            end_reading: '',
            remarks: ''
        }]);
    };

    const removeMeterReading = (index) => {
        setMeterReadings(meterReadings.filter((_, i) => i !== index));
    };

    const updateMeterReading = (index, field, value) => {
        const updated = [...meterReadings];
        updated[index][field] = value;
        setMeterReadings(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const stoppageLogs = stoppages.map(s => {
                const log = {
                    id: s.id || null,
                    start_time: s.start_time?.includes('T') ? s.start_time.split('T')[1].slice(0, 5) : s.start_time?.slice(0, 5),
                    end_time: s.end_time?.includes('T') ? s.end_time.split('T')[1].slice(0, 5) : s.end_time?.slice(0, 5),
                    downtime_minutes: Number(s.downtime_minutes) || 0,
                    bottles_produced: s.bottles_produced !== '' ? Number(s.bottles_produced) : null,
                    comments: s.comments || '',
                    pet: formData.pet
                };
                const incidents = (s.incidents || []).filter(inc => inc.downtime_category || inc.incident_description).map(inc => {
                    const cleaned = {};
                    if (inc.incident_category) cleaned.incident_category = inc.incident_category;
                    if (inc.downtime_category) cleaned.downtime_category = inc.downtime_category;
                    if (inc.sub_downtime_category) cleaned.sub_downtime_category = inc.sub_downtime_category;
                    if (inc.incident_description) cleaned.incident_description = inc.incident_description;
                    if (inc.incident_time) cleaned.incident_time = inc.incident_time;
                    if (inc.incident_duration) cleaned.incident_duration = inc.incident_duration;
                    if (inc.category) cleaned.category = inc.category;
                    return cleaned;
                });
                if (incidents.length > 0) log.incidents = incidents;
                return log;
            });

            const reportPayload = {
                production_date: formData.production_date || null,
                report_code: formData.report_code || null,
                line: formData.line ? Number(formData.line) : null,
                pet: formData.pet ? Number(formData.pet) : null,
                shift: formData.shift ? Number(formData.shift) : null,
                supervisor: formData.supervisor ? Number(formData.supervisor) : null,
                status: formData.status || null,
                bottle_size: formData.bottle_size || null,
                bottles_per_pack: formData.bottles_per_pack || null,
                packs_per_pallet: formData.packs_per_pallet ? Number(formData.packs_per_pallet) : null,
                line_speed: formData.line_speed ? Number(formData.line_speed) : null,
                bottles_produced: formData.bottles_produced ? Number(formData.bottles_produced) : null,
                start_time: formData.start_time || null,
                end_time: formData.end_time || null,
                remarks: formData.remarks || null
            };

            if (isEditMode) {
                await productionApi.updateReport(id, reportPayload);
                // Update existing stoppages individually
                await Promise.all(stoppageLogs.filter(s => s.id).map(s =>
                    productionApi.updateStoppage(s.id, {
                        start_time: s.start_time,
                        end_time: s.end_time,
                        downtime_minutes: s.downtime_minutes,
                        bottles_produced: s.bottles_produced,
                        comments: s.comments
                    })
                ));
            } else {
                const payload = {
                    ...reportPayload,
                    stoppage_logs: stoppageLogs,
                    batches: batches.map(b => ({
                        batch_number: b.batch_number || '',
                        syrup_liters: b.syrup_liters || '',
                        start_time: b.start_time || null
                    })),
                    meter_readings: meterReadings.map(m => ({
                        reading_type: m.reading_type || null,
                        start_reading: m.start_reading || null,
                        end_reading: m.end_reading || null,
                        remarks: m.remarks || ''
                    })),
                    materials: [],
                    consumptions: [],
                    runs: [],
                    workers: []
                };
                if (!payload.report_code) {
                    const shift = shifts.find(s => s.id === Number(payload.shift));
                    payload.report_code = `PR-${payload.production_date}-${shift?.name || 'SHIFT'}`;
                }
                await productionApi.createReport(payload);
            }
            if (isEditMode) {
                setSuccess('Report updated successfully');
            } else {
                navigate('/dashboard/production');
            }
        } catch (err) {
            console.error('Failed to save report:', err?.response?.data || err);
            const detail = err.response?.data;
            if (detail && typeof detail === 'object') {
                const formatVal = (v) => {
                    if (Array.isArray(v)) return v.join(', ');
                    if (typeof v === 'object') return JSON.stringify(v);
                    return String(v);
                };
                const msgs = Object.entries(detail)
                    .map(([k, v]) => `${k}: ${formatVal(v)}`)
                    .join(' | ');
                setError(msgs || 'Failed to save report');
            } else {
                setError(err.message || 'Failed to save report');
            }
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Basic Info', icon: 'ti-file' },
        { id: 'batches', label: 'Batches', icon: 'ti-flask', count: batches.length },
        { id: 'stoppages', label: 'Stoppages', icon: 'ti-alert-circle', count: stoppages.length },
        { id: 'meters', label: 'Meter Readings', icon: 'ti-gauge', count: meterReadings.length }
    ];

    return (
        <div className="container-fluid p-4">
            {initialLoading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="card mb-4">
                        <div className="card-body">
                            <button onClick={() => navigate('/dashboard/production')} className="btn btn-link p-0 mb-2">
                                <i className="ti ti-arrow-left me-2"></i>Back
                            </button>
                            <h4 className="mb-1">{isEditMode ? 'Edit Production Report' : 'Create Production Report'}</h4>
                            <p className="text-muted mb-0">
                                {isEditMode ? 'Update production report details' : 'Complete production report with batches, stoppages, and readings'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger d-flex align-items-center mb-4">
                            <AlertCircle className="me-2" size={20} />
                            <div className="flex-grow-1">{error}</div>
                            <button className="btn-close" onClick={() => setError('')}></button>
                        </div>
                    )}
                    {success && (
                        <div className="alert alert-success d-flex align-items-center mb-4">
                            <div className="flex-grow-1">{success}</div>
                            <button className="btn-close" onClick={() => setSuccess('')}></button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                <div className="card">
                    <div className="card-header">
                        <ul className="nav nav-tabs card-header-tabs">
                            {tabs.map(tab => (
                                <li key={tab.id} className="nav-item">
                                    <button
                                        type="button"
                                        className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <i className={`ti ${tab.icon} me-2`}></i>
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span className="badge bg-primary ms-2">{tab.count}</span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="card-body">
                        {activeTab === 'basic' && (
                            <BasicInfoTab
                                formData={formData}
                                handleChange={handleChange}
                                pets={pets}
                                shifts={shifts}
                                users={users}
                            />
                        )}

                        {activeTab === 'batches' && (
                            <BatchesTab
                                batches={batches}
                                addBatch={addBatch}
                                removeBatch={removeBatch}
                                updateBatch={updateBatch}
                            />
                        )}

                        {activeTab === 'stoppages' && (
                            <StoppagesTab
                                stoppages={stoppages}
                                addStoppage={addStoppage}
                                removeStoppage={removeStoppage}
                                updateStoppage={updateStoppage}
                                downtimeCategories={downtimeCategories}
                            />
                        )}

                        {activeTab === 'meters' && (
                            <MeterReadingsTab
                                meterReadings={meterReadings}
                                addMeterReading={addMeterReading}
                                removeMeterReading={removeMeterReading}
                                updateMeterReading={updateMeterReading}
                            />
                        )}
                    </div>

                    <div className="card-footer">
                        <div className="d-flex justify-content-end gap-2">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/dashboard/production')}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <Save className="me-2" size={16} />}
                                {isEditMode ? 'Update Report' : 'Create Report'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
                </>
            )}
        </div>
    );
};

// Tab Components
const BasicInfoTab = ({ formData, handleChange, pets, shifts, users }) => (
    <div className="row g-3">
        <div className="col-md-4">
            <label className="form-label">Production Date <span className="text-danger">*</span></label>
            <input type="date" name="production_date" value={formData.production_date} onChange={handleChange} className="form-control" required />
        </div>
        <div className="col-md-4">
            <label className="form-label">Report Code</label>
            <input type="text" name="report_code" value={formData.report_code} onChange={handleChange} className="form-control" placeholder="Auto-generated" />
        </div>
        <div className="col-md-4">
            <label className="form-label">PET Line <span className="text-danger">*</span></label>
            <select name="pet" value={formData.pet} onChange={handleChange} className="form-select" required>
                <option value="">Select PET</option>
                {pets.map(p => <option key={p.id} value={p.id}>{p.pet_name}</option>)}
            </select>
        </div>
        <div className="col-md-4">
            <label className="form-label">Shift <span className="text-danger">*</span></label>
            <select name="shift" value={formData.shift} onChange={handleChange} className="form-select" required>
                <option value="">Select Shift</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>)}
            </select>
        </div>
        <div className="col-md-4">
            <label className="form-label">Supervisor <span className="text-danger">*</span></label>
            <select name="supervisor" value={formData.supervisor} onChange={handleChange} className="form-select" required>
                <option value="">Select Supervisor</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
            </select>
        </div>
        <div className="col-md-4">
            <label className="form-label">Line Number</label>
            <input type="number" name="line" value={formData.line} onChange={handleChange} className="form-control" />
        </div>
        <div className="col-md-4">
            <label className="form-label">Bottle Size</label>
            <input type="text" name="bottle_size" value={formData.bottle_size} onChange={handleChange} className="form-control" placeholder="e.g., 500ml" />
        </div>
        <div className="col-md-4">
            <label className="form-label">Bottles per Pack</label>
            <input type="number" name="bottles_per_pack" value={formData.bottles_per_pack} onChange={handleChange} className="form-control" />
        </div>
        <div className="col-md-4">
            <label className="form-label">Line Speed</label>
            <input type="number" name="line_speed" value={formData.line_speed} onChange={handleChange} className="form-control" placeholder="BPH" />
        </div>
        <div className="col-md-4">
            <label className="form-label">Bottles Produced</label>
            <input type="number" name="bottles_produced" value={formData.bottles_produced} onChange={handleChange} className="form-control" placeholder="Total bottles" />
        </div>
        <div className="col-md-6">
            <label className="form-label">Start Time</label>
            <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className="form-control" />
        </div>
        <div className="col-md-6">
            <label className="form-label">End Time</label>
            <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className="form-control" />
        </div>
        <div className="col-12">
            <label className="form-label">Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="3" className="form-control"></textarea>
        </div>
    </div>
);

const BatchesTab = ({ batches, addBatch, removeBatch, updateBatch }) => (
    <div>
        <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">Syrup Batches</h6>
            <button type="button" className="btn btn-sm btn-primary" onClick={addBatch}>
                <Plus size={16} className="me-1" />Add Batch
            </button>
        </div>
        {batches.length === 0 ? (
            <div className="text-center text-muted py-4">No batches added yet</div>
        ) : (
            <div className="row g-3">
                {batches.map((batch, index) => (
                    <div key={index} className="col-12">
                        <div className="card">
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label className="form-label">Batch Number</label>
                                        <input
                                            type="text"
                                            value={batch.batch_number}
                                            onChange={(e) => updateBatch(index, 'batch_number', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">Syrup Liters</label>
                                        <input
                                            type="number"
                                            value={batch.syrup_liters}
                                            onChange={(e) => updateBatch(index, 'syrup_liters', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">Start Time</label>
                                        <input
                                            type="time"
                                            value={batch.start_time}
                                            onChange={(e) => updateBatch(index, 'start_time', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-2 d-flex align-items-end">
                                        <button type="button" className="btn btn-outline-danger w-100" onClick={() => removeBatch(index)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const StoppagesTab = ({ stoppages, addStoppage, removeStoppage, updateStoppage, downtimeCategories }) => (
    <div>
        <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">Stoppage Logs</h6>
            <button type="button" className="btn btn-sm btn-primary" onClick={addStoppage}>
                <Plus size={16} className="me-1" />Add Stoppage
            </button>
        </div>
        {stoppages.length === 0 ? (
            <div className="text-center text-muted py-4">No stoppages recorded</div>
        ) : (
            <div className="row g-3">
                {stoppages.map((stoppage, index) => (
                    <div key={index} className="col-12">
                        <div className="card">
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label className="form-label">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            value={stoppage.start_time.slice(0, 16)}
                                            onChange={(e) => updateStoppage(index, 'start_time', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">End Time</label>
                                        <input
                                            type="datetime-local"
                                            value={stoppage.end_time.slice(0, 16)}
                                            onChange={(e) => updateStoppage(index, 'end_time', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label">Downtime (min)</label>
                                        <input
                                            type="number"
                                            value={stoppage.downtime_minutes}
                                            onChange={(e) => updateStoppage(index, 'downtime_minutes', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label">Bottles Produced</label>
                                        <input
                                            type="number"
                                            value={stoppage.bottles_produced || ''}
                                            onChange={(e) => updateStoppage(index, 'bottles_produced', e.target.value)}
                                            className="form-control"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="col-md-2 d-flex align-items-end gap-1">
                                        <input
                                            type="text"
                                            value={stoppage.comments}
                                            onChange={(e) => updateStoppage(index, 'comments', e.target.value)}
                                            className="form-control"
                                            placeholder="Comments"
                                        />
                                        <button type="button" className="btn btn-outline-danger flex-shrink-0" onClick={() => removeStoppage(index)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const MeterReadingsTab = ({ meterReadings, addMeterReading, removeMeterReading, updateMeterReading }) => (
    <div>
        <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">Meter Readings</h6>
            <button type="button" className="btn btn-sm btn-primary" onClick={addMeterReading}>
                <Plus size={16} className="me-1" />Add Reading
            </button>
        </div>
        {meterReadings.length === 0 ? (
            <div className="text-center text-muted py-4">No meter readings added</div>
        ) : (
            <div className="row g-3">
                {meterReadings.map((reading, index) => (
                    <div key={index} className="col-12">
                        <div className="card">
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <label className="form-label">Reading Type</label>
                                        <select
                                            value={reading.reading_type}
                                            onChange={(e) => updateMeterReading(index, 'reading_type', e.target.value)}
                                            className="form-select"
                                        >
                                            <option value="CO2">CO2</option>
                                            <option value="SYRUP">Syrup</option>
                                            <option value="WATER">Water</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">Start Reading</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={reading.start_reading}
                                            onChange={(e) => updateMeterReading(index, 'start_reading', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">End Reading</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={reading.end_reading}
                                            onChange={(e) => updateMeterReading(index, 'end_reading', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label">Remarks</label>
                                        <input
                                            type="text"
                                            value={reading.remarks}
                                            onChange={(e) => updateMeterReading(index, 'remarks', e.target.value)}
                                            className="form-control"
                                        />
                                    </div>
                                    <div className="col-md-1 d-flex align-items-end">
                                        <button type="button" className="btn btn-outline-danger w-100" onClick={() => removeMeterReading(index)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

export default CreateReport;
