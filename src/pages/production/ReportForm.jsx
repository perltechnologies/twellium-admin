import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button, Input, Card } from '../../components/ui';
import { productionApi } from '../../api/production';

const ReportForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        production_date: new Date().toISOString().split('T')[0],
        line: '',
        shift: '',
        supervisor: '', // In a real app, this might be auto-filled or a dropdown
        report_code: ''
    });

    const [lines, setLines] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const loadDependencies = async () => {
            try {
                const [linesRes, shiftsRes] = await Promise.all([
                    productionApi.getLines(),
                    productionApi.getShifts()
                ]);
                setLines(linesRes.data.data || []);
                setShifts(shiftsRes.data.data || []);
            } catch (err) {
                console.error("Failed to load dependencies", err);
            }
        };

        loadDependencies();

        if (isEditMode) {
            const fetchReport = async () => {
                try {
                    const res = await productionApi.getReport(id);
                    const data = res.data;
                    setFormData({
                        production_date: data.production_date,
                        line: data.line,
                        shift: data.shift,
                        supervisor: data.supervisor,
                        report_code: data.report_code,
                        packs_per_pallet: data.packs_per_pallet
                    });
                } catch (err) {
                    console.error("Failed to fetch report", err);
                }
            };
            fetchReport();
        }
    }, [id, isEditMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (isEditMode) {
                await productionApi.updateReport(id, formData);
            } else {
                // Generate a temp report code if not provided or handle in backend
                // For now, let's assume backend handles it or we send a placeholder
                const payload = { ...formData };
                if (!payload.report_code) payload.report_code = `RPT-${Date.now()}`;
                await productionApi.createReport(payload);
            }
            navigate('/dashboard/production');
        } catch (err) {
            console.error("Failed to save report", err);
            // Add error toast handling here ideally
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate('/dashboard/production')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {isEditMode ? 'Edit Production Report' : 'Create New Report'}
                </h1>
            </div>

            <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Production Date</label>
                            <Input
                                type="date"
                                name="production_date"
                                value={formData.production_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Report Code</label>
                            <Input
                                name="report_code"
                                value={formData.report_code}
                                onChange={handleChange}
                                placeholder="Auto-generated if empty"
                                disabled={isEditMode}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Line</label>
                            <select
                                name="line"
                                value={formData.line}
                                onChange={handleChange}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
                                required
                            >
                                <option value="">Select Line</option>
                                {lines.map(line => (
                                    <option key={line.id} value={line.id}>
                                        Line {line.line_number}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shift</label>
                            <select
                                name="shift"
                                value={formData.shift}
                                onChange={handleChange}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
                                required
                            >
                                <option value="">Select Shift</option>
                                {shifts.map(shift => (
                                    <option key={shift.id} value={shift.id}>
                                        {shift.name} ({shift.start_time} - {shift.end_time})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Supervisor ID</label>
                            <Input
                                type="number"
                                name="supervisor"
                                value={formData.supervisor}
                                onChange={handleChange}
                                placeholder="Enter User ID"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Packs Per Pallet</label>
                        <Input
                            type="number"
                            name="packs_per_pallet"
                            value={formData.packs_per_pallet || ''}
                            onChange={handleChange}
                            placeholder="Enter Packs Per Pallet"
                        />
                    </div>


                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/dashboard/production')}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="animate-spin mr-2">⟳</span>
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            {isEditMode ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div >
    );
};

export default ReportForm;
