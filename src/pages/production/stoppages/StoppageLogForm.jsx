import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '../../../components/ui';
import { productionApi } from '../../../api/production';
import { motion, AnimatePresence } from 'framer-motion';

const StoppageLogForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);

    // Dropdown Data
    const [reports, setReports] = useState([]);
    const [pets, setPets] = useState([]);

    const [formData, setFormData] = useState({
        report: '',
        pet: '',
        hour_index: '',
        efficiency: '',
        downtime_minutes: '',
        bottles_produced: '',
        comments: '',
        incidents: [] // Array of { incident_description: '' }
    });

    const [error, setError] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch Dependencies
                const [reportsRes, petsRes] = await Promise.all([
                    productionApi.getReports({ page_size: 100 }), // Get recent reports
                    productionApi.getPets({ page_size: 100 })
                ]);

                // Helper to extract results array from varied API responses
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

                // If Edit Mode, Fetch Existing Log
                if (isEditMode) {
                    const logRes = await productionApi.getStoppage(id);
                    const log = logRes.data.data;
                    setFormData({
                        report: log.report,
                        pet: log.pet,
                        hour_index: log.hour_index,
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
            incidents: [...prev.incidents, { incident_description: '' }]
        }));
    };

    const removeIncident = (index) => {
        setFormData(prev => ({
            ...prev,
            incidents: prev.incidents.filter((_, i) => i !== index)
        }));
    };

    const handleIncidentChange = (index, value) => {
        const newIncidents = [...formData.incidents];
        newIncidents[index] = { ...newIncidents[index], incident_description: value };
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
                downtime_minutes: parseInt(formData.downtime_minutes),
                bottles_produced: parseInt(formData.bottles_produced),
                efficiency: formData.efficiency.toString(), // API expects string usually for decimal
                // Ensure incidents structure matches API expectation
                incidents: formData.incidents.map(inc => ({
                    incident_description: inc.incident_description,
                    // If editing, preserve ID if it exists? 
                    // The API requirement shows new incidents being added. 
                    // For PUT/PATCH, we might need to be careful. 
                    // Assuming API handles replacement or we send complete list.
                    // Based on "Add stoppage log" payload, sturcture is { incident_description, stoppage_log }
                    // We just send description here, backend likely handles association
                }))
            };

            // Clean up payload (incidents sometimes need stoppage_log id if updating existing, 
            // but often nested serializers handle this. Following request payload structure)

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

    if (initialLoading) return <div className="p-8 text-center text-slate-500">Loading form...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/dashboard/production/stoppages')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-2xl font-bold text-slate-100">
                    {isEditMode ? 'Edit Stoppage Log' : 'New Stoppage Log'}
                </h1>
            </div>

            {error && (
                <div className="bg-red-500/10 text-red-400 p-4 rounded-lg flex items-center gap-2 border border-red-500/20">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="p-6 border-slate-800 bg-slate-900/50 space-y-4">
                    <h3 className="text-lg font-medium text-slate-200 border-b border-slate-800 pb-2">Log Details</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">Report</label>
                            <select
                                name="report"
                                value={formData.report}
                                onChange={handleChange}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                required
                            >
                                <option value="">Select Report</option>
                                {reports.map(r => (
                                    <option key={r.id} value={r.id}>{r.report_code} - {r.shift_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">PET</label>
                            <select
                                name="pet"
                                value={formData.pet}
                                onChange={handleChange}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                required
                            >
                                <option value="">Select PET</option>
                                {pets.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">Hour Index</label>
                            <Input
                                type="number"
                                name="hour_index"
                                value={formData.hour_index}
                                onChange={handleChange}
                                placeholder="e.g. 1"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">Efficiency (%)</label>
                            <Input
                                type="number"
                                step="0.01"
                                name="efficiency"
                                value={formData.efficiency}
                                onChange={handleChange}
                                placeholder="e.g. 95.5"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">Downtime (Minutes)</label>
                            <Input
                                type="number"
                                name="downtime_minutes"
                                value={formData.downtime_minutes}
                                onChange={handleChange}
                                placeholder="0"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-400">Bottles Produced</label>
                            <Input
                                type="number"
                                name="bottles_produced"
                                value={formData.bottles_produced}
                                onChange={handleChange}
                                placeholder="0"
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-400">Comments</label>
                        <textarea
                            name="comments"
                            value={formData.comments}
                            onChange={handleChange}
                            rows="3"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                            placeholder="Optional comments..."
                        />
                    </div>
                </Card>

                <Card className="p-6 border-slate-800 bg-slate-900/50 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-lg font-medium text-slate-200">Incidents</h3>
                        <Button type="button" variant="ghost" onClick={addIncident} className="text-blue-400 hover:text-blue-300">
                            <Plus className="h-4 w-4 mr-1" /> Add Incident
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <AnimatePresence>
                            {formData.incidents.map((incident, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex gap-2 items-center"
                                >
                                    <Input
                                        value={incident.incident_description}
                                        onChange={(e) => handleIncidentChange(index, e.target.value)}
                                        placeholder="Describe the incident..."
                                        className="flex-1"
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => removeIncident(index)}
                                        className="text-red-400 hover:bg-red-500/10 p-2 h-auto"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {formData.incidents.length === 0 && (
                            <p className="text-sm text-slate-600 italic">No incidents added.</p>
                        )}
                    </div>
                </Card>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={() => navigate('/dashboard/production/stoppages')}>
                        Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-500 w-32" isLoading={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Log
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default StoppageLogForm;
