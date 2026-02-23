import React, { useState, useEffect } from 'react';
import { Card, Button, CardHeader, CardBody } from '../../components/ui';
import { productionApi } from '../../api/production';
import { Clock, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useTheme } from '../../context/ThemeContext';

const DowntimeBreakdown = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await productionApi.getReports({ page_size: 1000 });
            const data = res.data?.data?.results || res.data?.results || res.data?.data || [];
            setReports(data);
        } catch (err) {
            console.error('Failed to fetch reports', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateDowntimeStats = () => {
        let totalMechanical = 0;
        let totalPlanned = 0;
        let totalUnplanned = 0;
        let totalOther = 0;
        const categoryBreakdown = {};

        reports.forEach(report => {
            if (report.stoppage_logs) {
                report.stoppage_logs.forEach(log => {
                    if (log.incidents) {
                        log.incidents.forEach(inc => {
                            const catName = inc.downtime_category_name || 'Uncategorized';
                            const duration = inc.incident_duration || 0;

                            // Category breakdown
                            if (!categoryBreakdown[catName]) {
                                categoryBreakdown[catName] = 0;
                            }
                            categoryBreakdown[catName] += duration;

                            // Type breakdown
                            if (catName.toLowerCase().includes('mechanical')) {
                                totalMechanical += duration;
                            } else if (catName.toLowerCase().includes('planned')) {
                                totalPlanned += duration;
                            } else if (catName.toLowerCase().includes('unplanned')) {
                                totalUnplanned += duration;
                            } else {
                                totalOther += duration;
                            }
                        });
                    }
                });
            }
        });

        const categoryData = Object.entries(categoryBreakdown)
            .map(([name, minutes]) => ({ name, minutes }))
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 10);

        const typeData = [
            { name: 'Mechanical', value: totalMechanical, color: '#ef4444' },
            { name: 'Planned', value: totalPlanned, color: '#3b82f6' },
            { name: 'Unplanned', value: totalUnplanned, color: '#f59e0b' },
            { name: 'Other', value: totalOther, color: '#64748b' }
        ].filter(item => item.value > 0);

        return {
            totalMechanical,
            totalPlanned,
            totalUnplanned,
            totalOther,
            categoryData,
            typeData,
            totalDowntime: totalMechanical + totalPlanned + totalUnplanned + totalOther
        };
    };

    const stats = calculateDowntimeStats();

    const cardColorMap = {
        red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400', decorImg: '/img/icons/elemnt-04.svg' },
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', decorImg: '/img/icons/elemnt-01.svg' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', decorImg: '/img/icons/elemnt-03.svg' },
        slate: { bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800', text: 'text-gray-600 dark:text-gray-400', decorImg: '/img/icons/elemnt-01.svg' },
    };

    const StatCard = ({ title, value, icon: Icon, cardColor }) => {
        const c = cardColorMap[cardColor] || cardColorMap.blue;
        return (
            <Card className="relative overflow-hidden mb-0">
                <div className="p-5 relative z-[1]">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-[#707070] dark:text-[#828997] mb-1">{title}</p>
                            <h2 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff] mb-1">{value} min</h2>
                            <p className="text-13 text-[#9d9d9d] mb-0">
                                {stats.totalDowntime > 0 ? ((value / stats.totalDowntime) * 100).toFixed(1) : 0}% of total
                            </p>
                        </div>
                        <span className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${c.bg} border ${c.border}`}>
                            <Icon className={`h-4 w-4 ${c.text}`} />
                        </span>
                    </div>
                </div>
                <img src={c.decorImg} alt="" className="absolute top-0 left-0 w-auto h-auto" />
            </Card>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Loading downtime data...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Downtime Breakdown</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Analysis of downtime by category and type
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <Button onClick={fetchReports}>Apply</Button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Mechanical Downtime"
                    value={stats.totalMechanical}
                    icon={AlertTriangle}
                    cardColor="red"
                />
                <StatCard
                    title="Planned Downtime"
                    value={stats.totalPlanned}
                    icon={Clock}
                    cardColor="blue"
                />
                <StatCard
                    title="Unplanned Downtime"
                    value={stats.totalUnplanned}
                    icon={AlertTriangle}
                    cardColor="amber"
                />
                <StatCard
                    title="Other Downtime"
                    value={stats.totalOther}
                    icon={TrendingUp}
                    cardColor="slate"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Breakdown Bar Chart */}
                <Card>
                    <CardHeader>Top 10 Downtime Categories</CardHeader>
                    <CardBody className="pb-0">
                        <div className="h-80">
                            {stats.categoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.categoryData} layout="vertical" margin={{ left: 100 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                        <XAxis type="number" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                                            width={90}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                                borderRadius: '8px'
                                            }}
                                            formatter={(value) => [`${value} min`, 'Duration']}
                                        />
                                        <Bar dataKey="minutes" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400">
                                    No data available
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>

                {/* Type Breakdown Pie Chart */}
                <Card>
                    <CardHeader>Downtime by Type</CardHeader>
                    <CardBody className="pb-0">
                        <div className="h-80">
                            {stats.typeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.typeData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {stats.typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                                border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                                borderRadius: '8px'
                                            }}
                                            formatter={(value) => [`${value} min`, 'Duration']}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400">
                                    No data available
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Detailed Table */}
            <Card>
                <CardHeader>Detailed Breakdown</CardHeader>
                <CardBody>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Category</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Duration (min)</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.categoryData.map((item, idx) => (
                                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                    <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100">{item.name}</td>
                                    <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100 text-right font-medium">{item.minutes}</td>
                                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 text-right">
                                        {((item.minutes / stats.totalDowntime) * 100).toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardBody>
            </Card>
        </div>
    );
};

export default DowntimeBreakdown;
