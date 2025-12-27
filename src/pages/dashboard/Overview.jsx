import React, { useEffect, useState } from 'react';
import { Card, DataTable } from '../../components/ui';
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

const StatCard = ({ title, value, subtext, icon: Icon, color, delay }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.5 }}
        >
            <Card className="p-6 h-full flex items-start justify-between hover:border-emerald-500/30 transition-colors group">
                <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-100 mb-2">{value}</h3>
                    {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500 group-hover:bg-${color}-500/20 transition-colors`}>
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch Today's Reports (for Output and Active PETs)
            const reportsRes = await productionApi.getReports({ production_date: today, page_size: 100 });
            const reports = reportsRes.data.results || reportsRes.data || [];

            // 2. Fetch Recent Reports (for Table) -> Re-using reports if < 10, else fetch separately or slice
            // Actually, let's just slice the reports we have if sorted by date, but API sort order might default. 
            // Let's ensure we get the latest 10 specifically for the table if we want general recent.
            // But the user asked for "first 10 production reports below". Assuming "recent".
            const recentReportsRes = await productionApi.getReports({ page_size: 10 });
            const recent = recentReportsRes.data.results || recentReportsRes.data || [];

            // 3. Fetch Today's Stoppages (for Downtime)
            const stoppagesRes = await productionApi.getStoppages({ log_date: today, page_size: 100 });
            const stoppages = stoppagesRes.data.results || stoppagesRes.data || [];

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
        { header: 'Code', accessor: 'report_code', render: (r) => <span className="font-mono text-blue-400">{r.report_code}</span> },
        { header: 'Date', accessor: 'production_date', render: (r) => format(new Date(r.production_date), 'MMM dd') },
        { header: 'PET', accessor: 'pet_name' },
        { header: 'Shift', accessor: 'shift_name' },
        {
            header: 'Output',
            accessor: 'total_bottles_produced',
            render: (r) => <span className="text-emerald-400">{r.total_bottles_produced?.toLocaleString()}</span>
        },
        {
            header: 'Status',
            accessor: 'status',
            render: (r) => (
                <span className={`text-xs px-2 py-1 rounded border ${r.status === 'STARTED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        r.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                    {r.status}
                </span>
            )
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Factory Overview</h1>
                    <p className="text-slate-400">Real-time production insights for today</p>
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
                        <h3 className="text-lg font-semibold text-slate-200 mb-6">Today's Output by PET</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={charts.outputByPet}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#1e293b' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
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
                        <h3 className="text-lg font-semibold text-slate-200 mb-6">Today's Downtime by PET (min)</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={charts.downtimeByPet}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#1e293b' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
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
                    <h2 className="text-xl font-bold text-slate-100">Recent Production Reports</h2>
                </div>
                <DataTable
                    columns={reportColumns}
                    data={recentReports}
                    isLoading={loading}
                    pagination={null} // Hide pagination for this summary view
                />
            </motion.div>
        </div>
    );
};

export default Overview;
