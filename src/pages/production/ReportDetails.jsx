import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, AlertTriangle, Layers } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { productionApi } from '../../api/production';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <Card className="p-4 border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div>
            <p className="text-slate-400 text-sm mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
            <Icon className={`h-5 w-5 ${color}`} />
        </div>
    </Card>
);

const ReportDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('runs');

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await productionApi.getReport(id);
                setReport(res.data); // Assuming response unwraps data correctly or api returns {data: {...}}
            } catch (err) {
                console.error("Failed to load report", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading details...</div>;
    if (!report) return <div className="p-8 text-center text-red-400">Report not found</div>;

    const tabs = [
        { id: 'runs', label: 'Production Runs' },
        { id: 'batches', label: 'Syrup Batches' },
        { id: 'materials', label: 'Materials' },
        { id: 'stoppages', label: 'Stoppages' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/dashboard/production')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                            {report.report_code}
                            <span className="text-sm px-2 py-1 rounded bg-slate-800 text-slate-400 font-normal">
                                {new Date(report.production_date).toLocaleDateString()}
                            </span>
                        </h1>
                    </div>
                </div>
                <Button variant="secondary" onClick={() => navigate(`/dashboard/production/${id}/edit`)}>
                    Edit Report
                </Button>
            </div>

            {/* High Level Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Output"
                    value={(report.total_bottles_produced || 0).toLocaleString()}
                    icon={Layers}
                    color="text-emerald-400"
                />
                <StatCard
                    title="Run Time"
                    value={`${report.total_production_time_hours || 0} hrs`}
                    icon={Clock}
                    color="text-blue-400"
                />
                <StatCard
                    title="Efficiency"
                    value={`${report.efficiency || 0}%`}
                    icon={Activity}
                    color="text-indigo-400"
                />
                <StatCard
                    title="Downtime"
                    value={`${report.total_downtime_minutes || 0} min`}
                    icon={AlertTriangle}
                    color="text-amber-400"
                />
            </div>

            {/* Tabbed Content Area */}
            <Card className="min-h-[400px] border-slate-800 bg-slate-900/50 overflow-hidden">
                <div className="border-b border-slate-800">
                    <div className="flex">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-4 text-sm font-medium transition-colors relative ${activeTab === tab.id
                                        ? 'text-blue-400 bg-slate-800/30'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                                    }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-6">
                    {/* Placeholder Content for Tabs */}
                    <div className="text-center py-12 text-slate-500">
                        <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No content available for {tabs.find(t => t.id === activeTab)?.label} yet.</p>
                        <Button variant="outline" className="mt-4">
                            Add {tabs.find(t => t.id === activeTab)?.label.slice(0, -1)}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ReportDetails;
