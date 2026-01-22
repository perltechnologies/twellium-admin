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
    PieChart,
    Pie,
    Cell,
    Legend,
    Label
} from 'recharts';
import { Factory, AlertTriangle, Clock, FileText } from 'lucide-react';
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

    // New State for Charts
    const [allReports, setAllReports] = useState([]);
    const [selectedPet, setSelectedPet] = useState('');
    const [petEfficiencyData, setPetEfficiencyData] = useState([]);

    const isDark = theme === 'dark';
    const chartGridColor = isDark ? '#334155' : '#e2e8f0'; // slate-700 : slate-200
    const tooltipBg = isDark ? '#0f172a' : '#ffffff';
    const tooltipBorder = isDark ? '#1e293b' : '#e2e8f0';
    const tooltipText = isDark ? '#f1f5f9' : '#0f172a';

    const COLORS_DOWNTIME = ['#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1']; // Blue, Amber, Violet, Cyan, Pink, Indigo
    const COLOR_EFFICIENCY = '#10b981'; // Emerald
    const COLOR_LOSS = '#ef4444'; // Red

    const petsList = [...new Set(allReports.map(r => r.pet_name).filter(Boolean))];

    const fetchData = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch Today's Reports (for Output and Active PETs)
            // 1. Fetch Today's Reports (for Output and Active PETs)
            const reportsRes = await productionApi.getReports({ production_date: today, page_size: 100 });
            const reports = reportsRes.data.data || reportsRes.data.results || [];
            setAllReports(reports);

            // Default select first pet if none selected
            if (!selectedPet && reports.length > 0) {
                const availablePets = [...new Set(reports.map(r => r.pet_name).filter(Boolean))];
                if (availablePets.length > 0) setSelectedPet(availablePets[0]);
            }

            // 2. Fetch Recent Reports (for Table)
            const recentReportsRes = await productionApi.getReports({ page_size: 10 });
            const recent = recentReportsRes.data.data || recentReportsRes.data.results || [];

            // 3. Calculate Downtime from Report Stoppage Logs
            // We iterate through reports and their nested stoppage_logs to ensure consistency with Efficiency calculations.
            let totalDowntimeCalc = 0;
            const downtimeMap = {};

            reports.forEach(report => {
                const pet = report.pet_name || 'Unknown';

                if (report.stoppage_logs && Array.isArray(report.stoppage_logs)) {
                    report.stoppage_logs.forEach(log => {
                        const minutes = log.downtime_minutes || 0;
                        if (minutes > 0) {
                            downtimeMap[pet] = (downtimeMap[pet] || 0) + minutes;
                            totalDowntimeCalc += minutes;
                        }
                    });
                }
            });

            const downtimeByPetData = Object.entries(downtimeMap).map(([name, value]) => ({ name, value }));

            // --- Calculations ---

            // Active PETs (Unique PETs in today's reports)
            const uniquePets = new Set(reports.map(r => r.pet_name).filter(Boolean));
            const activePetsCount = uniquePets.size;

            // Running Reports (Status = STARTED)
            const runningCount = reports.filter(r => r.status === 'STARTED').length;

            // Chart: Output by PET
            const outputMap = {};
            reports.forEach(r => {
                const pet = r.pet_name || 'Unknown';
                outputMap[pet] = (outputMap[pet] || 0) + (r.total_bottles_produced || 0);
            });
            const outputByPetData = Object.entries(outputMap).map(([name, value]) => ({ name, value }));

            setStats({
                activePets: activePetsCount,
                totalDowntime: totalDowntimeCalc,
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
        const interval = setInterval(fetchData, 300000); // Refresh every 5 mins
        return () => clearInterval(interval);
    }, []);

    // Calculate Efficiency Chart Data when selectedPet changes
    useEffect(() => {
        if (selectedPet && allReports.length > 0) {
            const petReports = allReports.filter(r => r.pet_name === selectedPet);

            if (petReports.length > 0) {
                // Calculate average efficiency from stoppage_logs
                // Logic: Flatten all stoppage_logs from all reports for this PET, extract valid efficiency numbers, and average them.
                let totalEfficiency = 0;
                let logCount = 0;

                petReports.forEach(report => {
                    if (report.stoppage_logs && Array.isArray(report.stoppage_logs)) {
                        report.stoppage_logs.forEach(log => {
                            const eff = parseFloat(log.efficiency);
                            // Include 0 efficiency logs as they represent full downtime
                            if (!isNaN(eff)) {
                                totalEfficiency += eff;
                                logCount++;
                            }
                        });
                    }
                });

                const avgEff = logCount > 0 ? totalEfficiency / logCount : 0;

                // Ensure values are sane (0-100)
                const effVal = Math.min(Math.max(avgEff, 0), 100);
                const downtimeVal = 100 - effVal;

                setPetEfficiencyData([
                    { name: 'Efficiency', value: Number(effVal.toFixed(1)) },
                    { name: 'Downtime', value: Number(downtimeVal.toFixed(1)) }
                ]);
            } else {
                setPetEfficiencyData([]);
            }
        }
    }, [selectedPet, allReports]);


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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard
                    title="Active PET Lines"
                    value={stats.activePets}
                    subtext={`${stats.runningReports} shifts currently started`}
                    icon={Factory}
                    color="blue"
                    delay={1}
                />
                <StatCard
                    title="Total Downtime"
                    value={`${stats.totalDowntime} min`}
                    subtext="Recorded stoppages today"
                    icon={Clock}
                    color="red"
                    delay={2}
                />
                <StatCard
                    title="Recent Reports"
                    value={recentReports.length}
                    subtext="Latest submissions"
                    icon={FileText}
                    color="amber"
                    delay={3}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Pet Efficiency Pie Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Card className="p-6 min-h-[400px] flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pet Efficiency</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Performance breakdown</p>
                            </div>
                            <select
                                value={selectedPet}
                                onChange={(e) => setSelectedPet(e.target.value)}
                                className="text-sm bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition font-medium"
                            >
                                {petsList.length === 0 && <option value="">No Data</option>}
                                {petsList.map(pet => (
                                    <option key={pet} value={pet}>{pet}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8 h-full">
                            {/* Chart */}
                            <div className="relative w-48 h-48 flex-shrink-0">
                                {petEfficiencyData.length > 0 ? (
                                    <div className="w-full h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={petEfficiencyData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    cornerRadius={4}
                                                    stroke="none"
                                                >
                                                    {petEfficiencyData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.name === 'Efficiency' ? COLOR_EFFICIENCY : COLOR_LOSS} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    cursor={false}
                                                    contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', color: tooltipText, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    itemStyle={{ color: tooltipText, fontWeight: 600 }}
                                                    formatter={(value) => [`${value}%`, '']}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Center Label */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Score</span>
                                            <span className={`text-2xl font-bold ${petEfficiencyData[0]?.value >= 80 ? 'text-emerald-500' : petEfficiencyData[0]?.value >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                {petEfficiencyData[0]?.value}%
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full rounded-full border-4 border-slate-100 dark:border-slate-800 border-dashed flex items-center justify-center">
                                        <span className="text-slate-400 text-xs">No Data</span>
                                    </div>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="flex-1 w-full space-y-4">
                                {petEfficiencyData.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3 group">
                                        <div
                                            className="w-1.5 h-10 rounded-full mt-1 flex-shrink-0 transition-all group-hover:scale-110"
                                            style={{ backgroundColor: item.name === 'Efficiency' ? COLOR_EFFICIENCY : COLOR_LOSS }}
                                        />
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{item.name}</p>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.value}%</h4>
                                                <span className="text-xs text-slate-500 dark:text-slate-500">
                                                    {item.name === 'Efficiency' ? 'Operational Time' : 'Lost Production Time'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {petEfficiencyData.length === 0 && (
                                    <p className="text-sm text-slate-400 italic">Select a PET with production data to view efficiency breakdown.</p>
                                )}
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* 2. All Pets Downtime Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="p-6 min-h-[400px] flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Downtime Contribution</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total Minutes Lost: {stats.totalDowntime}</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8 h-full">
                            {/* Chart */}
                            <div className="relative w-48 h-48 flex-shrink-0">
                                {charts.downtimeByPet.length > 0 ? (
                                    <div className="w-full h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={charts.downtimeByPet}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    cornerRadius={4}
                                                    stroke="none"
                                                >
                                                    {charts.downtimeByPet.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS_DOWNTIME[index % COLORS_DOWNTIME.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    cursor={false}
                                                    contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', color: tooltipText, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    itemStyle={{ color: tooltipText, fontWeight: 600 }}
                                                    formatter={(value) => [`${value} min`, 'Downtime']}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Center Label */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <AlertTriangle className="h-6 w-6 text-slate-300 dark:text-slate-600 mb-1" />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {stats.totalDowntime}m
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full h-full rounded-full border-4 border-slate-100 dark:border-slate-800 border-dashed flex items-center justify-center">
                                        <span className="text-slate-400 text-xs">No Downtime</span>
                                    </div>
                                )}
                            </div>

                            {/* Legend - Scrollable if many PETs */}
                            <div className="flex-1 w-full max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-4">
                                    {charts.downtimeByPet.length > 0 ? (
                                        charts.downtimeByPet
                                            .sort((a, b) => b.value - a.value) // Sort by highest downtime
                                            .map((item, index) => {
                                                const percentage = ((item.value / stats.totalDowntime) * 100).toFixed(1);
                                                return (
                                                    <div key={index} className="flex items-start gap-3 group">
                                                        <div
                                                            className="w-1.5 h-10 rounded-full mt-1 flex-shrink-0 transition-all group-hover:scale-110"
                                                            style={{ backgroundColor: COLORS_DOWNTIME[index % COLORS_DOWNTIME.length] }}
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{item.name}</p>
                                                                <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                                                    {percentage}%
                                                                </span>
                                                            </div>
                                                            <div className="flex items-baseline gap-2">
                                                                <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.value} <span className="text-xs font-normal text-slate-500">min</span></h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">No downtime recorded today. Great job!</p>
                                    )}
                                </div>
                            </div>
                        </div>
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
