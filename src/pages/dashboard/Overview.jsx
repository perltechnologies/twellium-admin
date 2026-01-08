import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, DataTable, ConfirmationModal } from '../../components/ui';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { Factory, AlertTriangle, TrendingUp, Clock, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { productionApi } from '../../api/production';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';

const StatCard = ({ title, value, subtext, icon: Icon, color, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.5 }}
        >
            <Card className="p-6 h-full flex items-start justify-between hover:border-emerald-500/30 transition-colors group">
                <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">{value}</h3>
                    {subtext && <p className="text-xs text-slate-500 dark:text-slate-400">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-xl bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-500 group-hover:bg-${color}-200 dark:group-hover:bg-${color}-500/20 transition-colors`}>
                    <Icon className="h-6 w-6" />
                </div>
            </Card>
        </motion.div>
    );
};

const Overview = () => {
    const [stats, setStats] = useState({
        totalOutput: 0,
        activePets: 0,
        totalDowntime: 0,
        runningReports: 0
    });
    const [charts, setCharts] = useState({
        outputByPet: [],
        downtimeByPet: []
    });
    const [recentReports, setRecentReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const { theme } = useTheme();
    const navigate = useNavigate();

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const isDark = theme === 'dark';
    const chartGridColor = isDark ? '#334155' : '#e2e8f0'; // slate-700 : slate-200
    const chartAxisColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 : slate-500
    const tooltipBg = isDark ? '#0f172a' : '#ffffff';
    const tooltipBorder = isDark ? '#1e293b' : '#e2e8f0';
    const tooltipText = isDark ? '#f1f5f9' : '#0f172a';

    const fetchData = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch Today's Reports (for Output and Active PETs)
            // 1. Fetch Today's Reports (for Output and Active PETs)
            const reportsRes = await productionApi.getReports({ production_date: today, page_size: 100 });
            const reports = reportsRes.data.data || reportsRes.data.results || [];

            // 2. Fetch Recent Reports (for Table)
            const recentReportsRes = await productionApi.getReports({ page_size: 10 });
            const recent = recentReportsRes.data.data || recentReportsRes.data.results || [];

            // 3. Fetch Today's Stoppages (for Downtime)
            const stoppagesRes = await productionApi.getStoppages({ log_date: today, page_size: 100 });
            const stoppages = stoppagesRes.data.data || stoppagesRes.data.results || [];

            // --- Calculations ---

            // Total Output
            const totalOutput = reports.reduce((sum, r) => sum + (r.total_bottles_produced || 0), 0);

            // Active PETs (Unique PETs in today's reports)
            const uniquePets = new Set(reports.map(r => r.pet_name).filter(Boolean));
            const activePetsCount = uniquePets.size;

            // Running Reports (Status = STARTED)
            const runningCount = reports.filter(r => r.status === 'STARTED').length;

            // Total Downtime
            const totalDowntime = stoppages.reduce((sum, s) => sum + (s.downtime_minutes || 0), 0);

            // Chart: Output by PET
            const outputMap = {};
            reports.forEach(r => {
                const pet = r.pet_name || 'Unknown';
                outputMap[pet] = (outputMap[pet] || 0) + (r.total_bottles_produced || 0);
            });
            const outputByPetData = Object.entries(outputMap).map(([name, value]) => ({ name, value }));

            // Chart: Downtime by PET
            const downtimeMap = {};
            stoppages.forEach(s => {
                const pet = s.pet_name || 'Unknown';
                downtimeMap[pet] = (downtimeMap[pet] || 0) + (s.downtime_minutes || 0);
            });
            const downtimeByPetData = Object.entries(downtimeMap).map(([name, value]) => ({ name, value }));


            setStats({
                totalOutput,
                activePets: activePetsCount,
                totalDowntime,
                runningReports: runningCount
            });
            setCharts({
                outputByPet: outputByPetData,
                downtimeByPet: downtimeByPetData
            });
            setRecentReports(recent);

        } catch (err) {
            console.error("Failed to load dashboard data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const reportColumns = [
        { header: 'Code', accessor: 'report_code', render: (r) => <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">{r.report_code}</span> },
        { header: 'Date', accessor: 'production_date', render: (r) => format(new Date(r.production_date), 'MMM dd') },
        { header: 'PET', accessor: 'pet_name' },
        { header: 'Shift', accessor: 'shift_name' },
        {
            header: 'Output',
            accessor: 'total_bottles_produced',
            render: (r) => <span className="text-emerald-600 dark:text-emerald-400 font-medium">{r.total_bottles_produced?.toLocaleString()}</span>
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (r) => (
                <span className={`text-xs px-2 py-1 rounded border ${r.status === 'STARTED' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' :
                    r.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                    {r.status}
                </span>
            )
        }
    ];

    const handleView = (row) => {
        navigate(`/dashboard/production/${row.id}`);
    };

    const handleEdit = (row) => {
        navigate(`/dashboard/production/${row.id}/edit`);
    };

    const handleDelete = (row) => {
        setItemToDelete(row);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            await productionApi.deleteReport(itemToDelete.id);
            setDeleteModalOpen(false);
            setItemToDelete(null);
            fetchData(); // Refresh data
        } catch (err) {
            console.error("Failed to delete report", err);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Factory Overview</h1>
                    <p className="text-slate-500 dark:text-slate-400">Real-time production insights for today</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium border border-emerald-500/20 animate-pulse">
                        Live Data
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Output (Today)"
                    value={stats.totalOutput.toLocaleString()}
                    subtext="Bottles produced today"
                    icon={TrendingUp}
                    color="emerald"
                    delay={1}
                />
                <StatCard
                    title="Active PET Lines"
                    value={stats.activePets}
                    subtext={`${stats.runningReports} shifts currently started`}
                    icon={Factory}
                    color="blue"
                    delay={2}
                />
                <StatCard
                    title="Total Downtime"
                    value={`${stats.totalDowntime} min`}
                    subtext="Recorded stoppages today"
                    icon={Clock}
                    color="red"
                    delay={3}
                />
                <StatCard
                    title="Recent Reports"
                    value={recentReports.length}
                    subtext="Latest submissions"
                    icon={FileText}
                    color="amber"
                    delay={4}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Card className="p-6 h-[400px]">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-6">Today's Output by PET</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={charts.outputByPet}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                                <XAxis dataKey="name" stroke={chartAxisColor} tick={{ fill: chartAxisColor }} />
                                <YAxis stroke={chartAxisColor} tick={{ fill: chartAxisColor }} />
                                <Tooltip
                                    cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                                    contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }}
                                    itemStyle={{ color: tooltipText }}
                                />
                                <Bar dataKey="value" name="Bottles" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="p-6 h-[400px]">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-6">Today's Downtime by PET (min)</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={charts.downtimeByPet}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                                <XAxis dataKey="name" stroke={chartAxisColor} tick={{ fill: chartAxisColor }} />
                                <YAxis stroke={chartAxisColor} tick={{ fill: chartAxisColor }} />
                                <Tooltip
                                    cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                                    contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }}
                                    itemStyle={{ color: tooltipText }}
                                />
                                <Bar dataKey="value" name="Minutes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </motion.div>
            </div>

            {/* Recent Reports Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Production Reports</h2>
                    </div>
                </div>
                <DataTable
                    columns={reportColumns}
                    data={recentReports}
                    isLoading={loading}
                    pagination={null} // Hide pagination for this summary view
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </motion.div>

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message={`Are you sure you want to delete report ${itemToDelete?.report_code}? This action cannot be undone.`}
                confirmText="Delete"
                isLoading={deleting}
            />
        </div>
    );
};

export default Overview;
