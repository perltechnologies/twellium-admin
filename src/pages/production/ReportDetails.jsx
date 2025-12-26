import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, AlertTriangle, Layers, User, Calendar, Box, Package, FastForward } from 'lucide-react';
import { Button, Card, DataTable } from '../../components/ui';
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

const DetailRow = ({ label, value }) => (
    <div className="flex flex-col py-2 border-b border-slate-800/50 last:border-0">
        <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
        <span className="text-slate-200 font-medium mt-1">{value !== null && value !== undefined ? value : '-'}</span>
    </div>
);

const SectionHeader = ({ title, icon: Icon }) => (
    <div className="flex items-center gap-2 mb-4 text-blue-400">
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
    </div>
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
                setReport(res.data.data);
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
        { id: 'runs', label: 'Production Runs', count: report.runs?.length || 0 },
        { id: 'batches', label: 'Syrup Batches', count: report.batches?.length || 0 },
        { id: 'materials', label: 'Materials', count: report.materials?.length || 0 },
        { id: 'stoppages', label: 'Stoppages', count: report.stoppage_logs?.length || 0 },
        { id: 'meters', label: 'Meter Readings', count: report.meter_readings?.length || 0 },
        { id: 'workers', label: 'Workers', count: report.workers?.length || 0 },
    ];

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {
            case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'PENDING': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

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
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-100">
                                {report.report_code}
                            </h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(report.status)}`}>
                                {report.status}
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm mt-1">
                            {new Date(report.production_date).toLocaleDateString()} • {report.shift_name}
                        </p>
                    </div>
                </div>
                <Button variant="secondary" onClick={() => navigate(`/dashboard/production/${id}/edit`)}>
                    Edit Report
                </Button>
            </div>

            {/* General Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Product & Line Info */}
                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <SectionHeader title="Product Details" icon={Package} />
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        <DetailRow label="Product Name" value={report.product_name} />
                        <DetailRow label="PET Name" value={report.pet_name} />
                        <DetailRow label="Bottle Size" value={report.bottle_size} />
                        <DetailRow label="Bottles / Pack" value={report.bottles_per_pack} />
                        <DetailRow label="Line" value={`Line ${report.line}`} />
                        <DetailRow label="Shift" value={report.shift_name} />
                    </div>
                </Card>

                {/* Production Metrics */}
                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <SectionHeader title="Metrics & Counters" icon={Activity} />
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        <DetailRow label="Total Bottles" value={report.total_bottles_produced?.toLocaleString()} />
                        <DetailRow label="Total Packs" value={report.total_packs?.toLocaleString()} />
                        <DetailRow label="Total Pallets" value={report.total_pallets?.toLocaleString()} />
                        <DetailRow label="Line Speed" value={report.line_speed} />
                        <DetailRow label="Counter Start" value={report.counter_start?.toLocaleString()} />
                        <DetailRow label="Counter End" value={report.counter_end?.toLocaleString()} />
                    </div>
                </Card>

                {/* Timing & Personnel */}
                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <SectionHeader title="Timing & Team" icon={Clock} />
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        <DetailRow label="Start Time" value={report.start_time} />
                        <DetailRow label="End Time" value={report.end_time} />
                        <DetailRow label="Prod. Time" value={`${report.total_production_time_hours ?? 0} hrs`} />
                        <DetailRow label="Downtime" value={`${report.total_downtime_minutes ?? 0} min`} />
                        <DetailRow label="Supervisor" value={report.supervisor_name} />
                        <DetailRow label="Prod. Manager" value={report.production_manager || '-'} />
                    </div>
                </Card>
            </div>

            {/* Remarks Section */}
            {(report.remarks || report.summary_text) && (
                <Card className="p-5 border-slate-800 bg-slate-900/50">
                    <SectionHeader title="Remarks & Summary" icon={Box} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {report.remarks && (
                            <div>
                                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-2">Remarks</span>
                                <p className="text-slate-300 text-sm leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                                    {report.remarks}
                                </p>
                            </div>
                        )}
                        {report.summary_text && (
                            <div>
                                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-2">Summary Text</span>
                                <p className="text-slate-300 text-sm leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                                    {report.summary_text}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* High Level Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Output"
                    value={(report.total_bottles_produced || 0).toLocaleString()}
                    icon={Layers}
                    color="text-emerald-400"
                />
                <StatCard
                    title="Production Time"
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

            {/* Tabbed Detailed Content */}
            <Card className="min-h-[400px] border-slate-800 bg-slate-900/50 overflow-hidden">
                <div className="border-b border-slate-800">
                    <div className="flex overflow-x-auto hide-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-4 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                                    ? 'text-blue-400 bg-slate-800/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                                    }`}
                            >
                                {tab.label}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-500/20' : 'bg-slate-800'
                                    }`}>
                                    {tab.count}
                                </span>
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
                    {activeTab === 'runs' && (
                        <DataTable
                            columns={[
                                { header: 'ID', accessor: 'id' },
                                { header: 'Start Time', accessor: 'start_time' },
                                { header: 'End Time', accessor: 'end_time' },
                                { header: 'Duration', accessor: 'duration_minutes', render: row => `${row.duration_minutes || 0} min` },
                                { header: 'Bottles Produced', accessor: 'bottles_produced', render: row => row.bottles_produced?.toLocaleString() },
                            ]}
                            data={report.runs}
                            isLoading={false}
                        />
                    )}

                    {activeTab === 'batches' && (
                        <DataTable
                            columns={[
                                { header: 'Batch #', accessor: 'batch_number' },
                                { header: 'Syrup Liters', accessor: 'syrup_liters', render: row => `${row.syrup_liters} L` },
                                { header: 'Start Time', accessor: 'start_time' },
                            ]}
                            data={report.batches}
                            isLoading={false}
                        />
                    )}

                    {activeTab === 'materials' && (
                        <DataTable
                            columns={[
                                { header: 'Type', accessor: 'material_type' },
                                { header: 'Used Qty', accessor: 'used_quantity', render: row => `${row.used_quantity} ${row.unit || ''}` },
                                { header: 'Loss Qty', accessor: 'loss_quantity' },
                                { header: 'Loss %', accessor: 'loss_percentage', render: row => `${row.loss_percentage}%` },
                            ]}
                            data={report.materials}
                            isLoading={false}
                        />
                    )}

                    {activeTab === 'stoppages' && (
                        <DataTable
                            columns={[
                                { header: 'Reason', accessor: 'reason' },
                                { header: 'Start', accessor: 'start_time' },
                                { header: 'End', accessor: 'end_time' },
                                { header: 'Duration', accessor: 'duration_minutes', render: row => `${row.duration_minutes} min` },
                                { header: 'Comments', accessor: 'comments' },
                            ]}
                            data={report.stoppage_logs}
                            isLoading={false}
                        />
                    )}

                    {activeTab === 'meters' && (
                        <DataTable
                            columns={[
                                { header: 'Type', accessor: 'reading_type' },
                                { header: 'Start', accessor: 'start_reading' },
                                { header: 'End', accessor: 'end_reading' },
                                { header: 'Difference', accessor: 'reading_difference' },
                                { header: 'Consump.', accessor: 'total_consumed' },
                            ]}
                            data={report.meter_readings}
                            isLoading={false}
                        />
                    )}

                    {activeTab === 'workers' && (
                        <DataTable
                            columns={[
                                { header: 'Name', accessor: 'user', render: row => row.user?.full_name || row.user?.username },
                                { header: 'Role', accessor: 'user', render: row => row.user?.role },
                                { header: 'Company', accessor: 'user', render: row => row.user?.company_name },
                                { header: 'Present', accessor: 'present', render: row => row.present ? 'Yes' : 'No' },
                            ]}
                            data={report.workers}
                            isLoading={false}
                        />
                    )}
                </div>
            </Card>
        </div>
    );
};

export default ReportDetails;
