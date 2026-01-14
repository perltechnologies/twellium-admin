import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, AlertTriangle, Layers, User, Calendar, Box, Package, FastForward } from 'lucide-react';
import { Button, Card, DataTable } from '../../components/ui';
import { productionApi } from '../../api/production';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, icon: Icon, color }) => (
    <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-center justify-between">
        <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color.replace('text-', 'text-emerald-600 dark:text-emerald-400 ').replace('text-emerald-400', '')}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-xl bg-opacity-10 dark:bg-opacity-10 bg-slate-100 dark:bg-slate-800`}>
            <Icon className={`h-5 w-5 ${color}`} />
        </div>
    </Card>
);

const DetailRow = ({ label, value }) => (
    <div className="flex flex-col py-2 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
        <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
        <span className="text-slate-900 dark:text-slate-200 font-medium mt-1">{value !== null && value !== undefined ? value : '-'}</span>
    </div>
);

const SectionHeader = ({ title, icon: Icon }) => (
    <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
    </div>
);

const MaterialsView = ({ materials }) => {
    if (!materials || materials.length === 0) return <div className="text-slate-500 text-center py-8">No materials recorded</div>;

    return (
        <div className="space-y-8">
            {materials.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        {group.material_type === 'Petline' ? (
                            <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                            <Box className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        )}
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {group.material_type} Materials
                        </h3>
                    </div>

                    {group.material_type === 'Petline' && (
                        <PetlineMaterialsGroup items={group.data} />
                    )}

                    {group.material_type === 'Canline' && (
                        <CanlineMaterialsGroup items={group.data} />
                    )}
                </div>
            ))}
        </div>
    );
};

const PetlineMaterialsGroup = ({ items }) => {
    // Group items by their specific petline_type
    const groups = {
        preform: items.filter(i => i.petline_type === 'preform').map(i => i.data),
        caps: items.filter(i => i.petline_type === 'caps').map(i => i.data),
        labels: items.filter(i => i.petline_type === 'labels').map(i => i.data),
        shrink: items.filter(i => i.petline_type === 'shrink').map(i => i.data),
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            {/* Preforms Section */}
            {groups.preform.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-4 border border-slate-200 dark:border-slate-800/50">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Preforms</h4>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Cage #', accessor: 'cage_number' },
                            { header: 'Size (g)', accessor: 'preform_size_value' },
                            { header: 'Color', accessor: 'preform_color_name' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Qty/Cage', accessor: 'quantity_per_cage_value' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.preform}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}

            {/* Caps Section */}
            {groups.caps.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-4 border border-slate-200 dark:border-slate-800/50">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Caps</h4>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Box #', accessor: 'box_number' },
                            { header: 'Type', accessor: 'cap_type_name' },
                            { header: 'Color', accessor: 'cap_color_name' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Qty/Box', accessor: 'quantity_per_box_value' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.caps}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}

            {/* Labels Section */}
            {groups.labels.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-4 border border-slate-200 dark:border-slate-800/50">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Labels / Sleeves</h4>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Roll #', accessor: 'roll_number' },
                            { header: 'Name', accessor: 'label_sleeve_name_value' },
                            { header: 'Size', accessor: 'product_size_name' },
                            { header: 'Net Wt', accessor: 'roll_net_weight' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.labels}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}

            {/* Shrink Section */}
            {groups.shrink.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-4 border border-slate-200 dark:border-slate-800/50">
                    <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Shrink Wrap</h4>
                    <DataTable
                        columns={[
                            { header: 'Batch', accessor: 'batch_number' },
                            { header: 'Roll #', accessor: 'roll_number' },
                            { header: 'Name', accessor: 'shrink_name_value' },
                            { header: 'Pack Size', accessor: 'pack_size_name' },
                            { header: 'Net Wt', accessor: 'roll_net_weight' },
                            { header: 'Supplier', accessor: 'supplier_name' },
                            { header: 'Infeed Time', accessor: 'material_infeed_time' },
                        ]}
                        data={groups.shrink}
                        isLoading={false}
                        pagination={null}
                    />
                </div>
            )}
        </div>
    );
};

const CanlineMaterialsGroup = ({ items }) => {
    return (
        <div className="bg-slate-50 dark:bg-slate-950/30 rounded-lg p-4 border border-slate-200 dark:border-slate-800/50">
            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Usage Records</h4>
            <DataTable
                columns={[
                    { header: 'Date', accessor: 'date_created', render: r => new Date(r.date_created).toLocaleString() },
                    { header: 'Empty Cans', accessor: 'empty_quantity' },
                    { header: 'Lids', accessor: 'lid_quantity' },
                    { header: 'Cartons', accessor: 'carton_quantity' },
                ]}
                data={items}
                isLoading={false}
                pagination={null}
            />
        </div>
    );
};

const StoppageLogsView = ({ logs }) => {
    if (!logs || logs.length === 0) return <div className="text-slate-500 text-center py-8">No stoppage logs recorded</div>;

    return (
        <div className="space-y-4">
            {logs.map((log) => (
                <div key={log.id} className="bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-800/50 overflow-hidden">
                    {/* Header Summary */}
                    <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 items-center bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800/50">
                        <div>
                            <span className="text-slate-500 text-xs uppercase block mb-1">Hour</span>
                            <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span className="text-slate-900 dark:text-slate-200 font-medium">Hour {log.hour_index}</span>
                            </div>
                            <span className="text-xs text-slate-500 ml-5">{log.log_time}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs uppercase block mb-1">Efficiency</span>
                            <div className="flex items-center gap-2">
                                <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{log.efficiency}%</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs uppercase block mb-1">Downtime</span>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-amber-600 dark:text-amber-400 font-medium">{log.downtime_minutes} min</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs uppercase block mb-1">Output</span>
                            <div className="flex items-center gap-2">
                                <Layers className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span className="text-blue-600 dark:text-blue-400 font-medium">{log.bottles_produced?.toLocaleString()}</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500 text-xs uppercase block mb-1">Logged By</span>
                            <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-slate-400" />
                                <span className="text-slate-700 dark:text-slate-300 text-sm truncate max-w-[100px]" title={log.created_by?.full_name}>
                                    {log.created_by?.full_name || log.created_by?.username}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Details & Incidents */}
                    <div className="p-4 space-y-4">
                        {log.comments && (
                            <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/20 p-3 rounded border border-slate-200 dark:border-slate-800/30">
                                <span className="font-semibold text-slate-700 dark:text-slate-500 mr-2 uppercase text-xs">Comments:</span>
                                {log.comments}
                            </div>
                        )}

                        {log.incidents && log.incidents.length > 0 ? (
                            <div className="mt-2">
                                <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                    <AlertTriangle className="h-3 w-3" />
                                    Incidents
                                </h5>
                                <div className="grid grid-cols-1 gap-2">
                                    {log.incidents.map((inc, i) => (
                                        <div key={i} className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-800/50 flex items-start gap-2">
                                            <span className="text-slate-400 dark:text-slate-600 mt-0.5">•</span>
                                            {inc.incident_description}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-600 italic">No incidents recorded for this period.</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

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
        { id: 'materials', label: 'Materials', count: report.materials?.length || 0 }, // Materials is an array of groups, count might be misleading if just groups, but OK for now.
        { id: 'stoppages', label: 'Stoppages', count: report.stoppage_logs?.length || 0 },
        { id: 'meters', label: 'Meter Readings', count: report.meter_readings?.length || 0 },
        { id: 'workers', label: 'Workers', count: report.workers?.length || 0 },
    ];

    const getStatusColor = (status) => {
        switch (status?.toUpperCase()) {

            case 'COMPLETED': return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
            case 'PENDING': return 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
            case 'IN_PROGRESS': return 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
            default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
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
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
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
                <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                    <SectionHeader title="Product Details" icon={Package} />
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        <DetailRow label="Product Name" value={report.product_name} />
                        <DetailRow label="PET Name" value={report.pet_name} />
                        <DetailRow label="Bottle Size" value={report.bottle_size} />
                        <DetailRow label="Bottles / Pack" value={report.bottles_per_pack} />
                        <DetailRow label="Line" value={`Line ${report.line}`} />
                        <DetailRow label="Shift" value={report.shift_name} />
                        <DetailRow label="Packs Per Pallet" value={report.packs_per_pallet} />
                    </div>
                </Card>

                {/* Production Metrics */}
                <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
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
                <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
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
                <Card className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                    <SectionHeader title="Remarks & Summary" icon={Box} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {report.remarks && (
                            <div>
                                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-2">Remarks</span>
                                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-slate-950/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800/50">
                                    {report.remarks}
                                </p>
                            </div>
                        )}
                        {report.summary_text && (
                            <div>
                                <span className="text-slate-500 text-xs uppercase tracking-wider block mb-2">Summary Text</span>
                                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed bg-slate-50 dark:bg-slate-950/30 p-3 rounded-lg border border-slate-200 dark:border-slate-800/50">
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
            <Card className="min-h-[400px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-800">
                    <div className="flex overflow-x-auto hide-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-4 text-sm font-medium transition-colors relative whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-800/30'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/20'
                                    }`}
                            >
                                {tab.label}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-500/20' : 'bg-slate-200 dark:bg-slate-800'
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
                        <MaterialsView materials={report.materials} />
                    )}

                    {activeTab === 'stoppages' && (
                        <StoppageLogsView logs={report.stoppage_logs} />
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
