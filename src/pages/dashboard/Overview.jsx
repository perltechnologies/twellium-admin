import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui';
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
import { Factory, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import { motion } from 'framer-motion';

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

// Mock Data
const productionData = [
    { name: '06:00', bottles: 4000 },
    { name: '07:00', bottles: 3000 },
    { name: '08:00', bottles: 2000 },
    { name: '09:00', bottles: 2780 },
    { name: '10:00', bottles: 1890 },
    { name: '11:00', bottles: 2390 },
    { name: '12:00', bottles: 3490 },
];

const efficiencyData = [
    { name: 'Line 1', uv: 90 },
    { name: 'Line 2', uv: 85 },
    { name: 'Line 3', uv: 40 }, // Problematic
    { name: 'Line 4', uv: 95 },
];

const Overview = () => {
    const [reportCounts, setReportCounts] = useState({ running: 2, completed: 15 });

    // In a real scenario, we'd fetch this from the API here
    useEffect(() => {
        // fetch('/api/production/reports/stats')
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Factory Overview</h1>
                    <p className="text-slate-400">Real-time production insights</p>
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
                    title="Active Lines"
                    value="3/4"
                    subtext="Line 3 stopped for maintenance"
                    icon={Factory}
                    color="emerald"
                    delay={1}
                />
                <StatCard
                    title="Today's Production"
                    value="124,500"
                    subtext="+12% from yesterday"
                    icon={TrendingUp}
                    color="blue"
                    delay={2}
                />
                <StatCard
                    title="Stock Alerts"
                    value="2"
                    subtext="Low levels: Preforms, Labels"
                    icon={Package}
                    color="amber"
                    delay={3}
                />
                <StatCard
                    title="Critical Issues"
                    value="1"
                    subtext="OEE below threshold on Line 3"
                    icon={AlertTriangle}
                    color="red"
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
                        <h3 className="text-lg font-semibold text-slate-200 mb-6">Hourly Production Output</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={productionData}>
                                <defs>
                                    <linearGradient id="colorBottles" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Area type="monotone" dataKey="bottles" stroke="#10b981" fillOpacity={1} fill="url(#colorBottles)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <Card className="p-6 h-[400px]">
                        <h3 className="text-lg font-semibold text-slate-200 mb-6">Line Efficiency (OEE)</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={efficiencyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#1e293b' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                />
                                <Bar dataKey="uv" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default Overview;
