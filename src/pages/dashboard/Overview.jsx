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
    Label,
    LabelList
} from 'recharts';
import { Factory, AlertTriangle, Clock, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { productionApi } from '../../api/production';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';

const colorMap = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', decorImg: '/img/icons/elemnt-01.svg' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-600 dark:text-red-400', decorImg: '/img/icons/elemnt-04.svg' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-600 dark:text-amber-400', decorImg: '/img/icons/elemnt-03.svg' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-600 dark:text-green-400', decorImg: '/img/icons/elemnt-02.svg' },
};

const StatCard = ({ title, value, subtext, icon: Icon, color, delay, trend }) => {
    const c = colorMap[color] || colorMap.blue;
    const isUp = trend === 'up';
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.5 }}
            className="flex"
        >
            <Card className="flex-1 mb-0 relative overflow-hidden">
                <div className="p-5 relative z-[1]">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-[#707070] dark:text-[#828997] mb-1">{title}</p>
                            <h2 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff] mb-1">{value}</h2>
                            {subtext && (
                                <p className={`text-13 mb-0 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                                    {isUp ? (
                                        <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                    ) : (
                                        <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                    )}
                                    <span className="text-[#707070] dark:text-[#828997]">{subtext}</span>
                                </p>
                            )}
                        </div>
                        <span className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${c.bg} border ${c.border}`}>
                            <Icon className={`h-4 w-4 ${c.text}`} />
                        </span>
                    </div>
                </div>
                <img src={c.decorImg} alt="" className="absolute top-0 left-0 w-auto h-auto" />
            </Card>
        </motion.div>
    );
};


const OEEBarChart = ({ title, data, color, tooltipPrefix, gridColor, textColor, bgColor, borderColor }) => (
    <Card className="flex flex-col min-h-[500px]">
        <div className="px-5 py-4 border-b border-[#e2e8f0] dark:border-[#161641]">
            <h3 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">{title}</h3>
        </div>
        <div className="p-5">
        <div className="flex-1 w-full min-h-[400px]">
            {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 30, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: textColor, fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: textColor, fontSize: 12 }}
                            domain={[0, 100]}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: bgColor, borderColor: borderColor, borderRadius: '8px', color: textColor }}
                            formatter={(value) => [`${value}%`, tooltipPrefix]}
                        />
                        <Bar
                            dataKey="value"
                            fill={color}
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                            animationDuration={1500}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                            ))}
                            <LabelList dataKey="value" position="top" fill={color} formatter={(val) => `${val}%`} fontSize={12} fontWeight="bold" />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-[#9d9d9d] text-sm border-2 border-dashed border-[#e2e8f0] dark:border-[#161641] rounded-lg">
                    Select a PET to view data
                </div>
            )}
        </div>
        </div>
    </Card>
);


const Overview = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();


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
    const [allReports, setAllReports] = useState([]);
    const [loading, setLoading] = useState(true);


    const [selectedPet, setSelectedPet] = useState('');
    const [petEfficiencyData, setPetEfficiencyData] = useState([]);


    const [selectedOeePets, setSelectedOeePets] = useState([]);
    const [oeeData, setOeeData] = useState([]);


    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

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

            const today = format(new Date(), 'yyyy-MM-dd');

            const reportsRes = await productionApi.getReports({ production_date: today, page_size: 100 });
            const reports = reportsRes.data.data || reportsRes.data.results || [];
            setAllReports(reports);


            if (!selectedPet && reports.length > 0) {
                const availablePets = [...new Set(reports.map(r => r.pet_name).filter(Boolean))];
                if (availablePets.length > 0) setSelectedPet(availablePets[0]);
            }

            const recentReportsRes = await productionApi.getReports({ page_size: 10 });
            const recent = recentReportsRes.data.data || recentReportsRes.data.results || [];


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


            const uniquePets = new Set(reports.map(r => r.pet_name).filter(Boolean));
            const activePetsCount = uniquePets.size;


            const runningCount = reports.filter(r => r.status === 'STARTED').length;


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

    // OEE Logic Effect
    useEffect(() => {

        if (allReports.length > 0 && selectedOeePets.length === 0) {
            const available = [...new Set(allReports.map(r => r.pet_name).filter(Boolean))];
            if (available.length > 0) setSelectedOeePets([available[0]]);
        }
    }, [allReports]);

    useEffect(() => {
        if (selectedOeePets.length > 0 && allReports.length > 0) {
            const data = selectedOeePets.map(petName => {
                const petReports = allReports.filter(r => r.pet_name === petName);
                if (petReports.length === 0) return null;


                let sumPlannedTime = 0;
                let sumExternalDowntime = 0;

                let sumTotalBottlesProduced = 0;
                let sumWaste = 0;

                let sumFillerReading = 0;
                let sumLineSpeed = 0;
                let weightedProductionHours = 0;

                // Helper to safely get number or default 1
                const safeNum = (val, def = 1) => {
                    const parsed = parseFloat(val);
                    return isNaN(parsed) || parsed === 0 ? def : parsed; // User said "null values use default 1". Interpreting 0 as needing default too for denominators? 
                    // Actually, for raw values like downtime, 0 is valid. 
                    // But for multiplication/division denominators, we need safety.
                };

                // Safe Sum Helper (treats null/undefined as 0 for additive)
                const add = (acc, val) => acc + (parseFloat(val) || 0);

                petReports.forEach(r => {
                    // Availability
                    const prodHours = parseFloat(r.total_production_time_hours) || 1; // User: "null values use default 1"
                    sumPlannedTime += prodHours;

                    // Downtime from stoppage logs or root? 
                    // Using root `total_downtime_minutes` just in case, or calculating from logs like previous code?
                    // Previous code calculated `totalDowntimeCalc` from logs. Let's do same for consistency.
                    let rDowntime = 0;
                    if (r.stoppage_logs) {
                        r.stoppage_logs.forEach(l => rDowntime += (parseFloat(l.downtime_minutes) || 0));
                    }
                    sumExternalDowntime += rDowntime;

                    // Quality
                    // Formula: (Total Potential Bottles - WASTE) / Total Potential Bottles * 100
                    // Potential = total_bottles_produced (if null default 1)
                    const rBottles = parseFloat(r.total_bottles_produced) || 1;
                    sumTotalBottlesProduced += rBottles;

                    if (r.meter_readings) {
                        r.meter_readings.forEach(m => {
                            sumWaste = add(sumWaste, m.filler_rejects);
                            sumFillerReading = add(sumFillerReading, m.filter_reading);
                        });
                    }

                    // Performance
                    const rSpeed = parseFloat(r.line_speed) || 1;
                    // Denom: speed * hours
                    weightedProductionHours += (rSpeed * prodHours);
                });

                // 1. AVAILABILITY
                // Formula: (PLANNED TIME - EXT DOWNTIME HOURS) / PLANNED TIME * 100
                const downtimeHours = sumExternalDowntime / 60;
                let availability = ((sumPlannedTime - downtimeHours) / sumPlannedTime) * 100;

                // 2. QUALITY
                // Formula: (Total Potential - WASTE) / Total Potential * 100
                // Potential = total_bottles_produced
                const totalPotential = sumTotalBottlesProduced; // already defaulted to 1 if null per item
                let quality = ((totalPotential - sumWaste) / totalPotential) * 100;

                // 3. PERFORMANCE
                // Formula: filler reading / (speed * hours) * 100
                let performance = (sumFillerReading / weightedProductionHours) * 100;


                return {
                    pet: petName,
                    availability: Math.min(Math.max(availability || 0, 0), 100).toFixed(1),
                    quality: Math.min(Math.max(quality || 0, 0), 100).toFixed(1),
                    performance: Math.min(Math.max(performance || 0, 0), 100).toFixed(1),
                };
            }).filter(Boolean);

            setOeeData(data);
        } else {
            setOeeData([]);
        }
    }, [selectedOeePets, allReports]);

    const handleOeePetToggle = (pet) => {
        setSelectedOeePets(prev => {
            if (prev.includes(pet)) return prev.filter(p => p !== pet);
            return [...prev, pet];
        });
    };


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
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h4 className="text-base font-bold text-[#1f2020] dark:text-[#d9dcff] mb-1">Factory Overview</h4>
                    <p className="text-sm text-[#707070] dark:text-[#828997]">Real-time production insights for today</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium border border-green-200 dark:border-green-800 animate-pulse">
                        Live Data
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <StatCard
                    title="Active PET Lines"
                    value={stats.activePets}
                    subtext={`${stats.runningReports} shifts currently started`}
                    icon={Factory}
                    color="blue"
                    delay={1}
                    trend="up"
                />
                <StatCard
                    title="Total Downtime"
                    value={`${stats.totalDowntime} min`}
                    subtext="Recorded stoppages today"
                    icon={Clock}
                    color="red"
                    delay={2}
                    trend="down"
                />
                <StatCard
                    title="Recent Reports"
                    value={recentReports.length}
                    subtext="Latest submissions"
                    icon={FileText}
                    color="amber"
                    delay={3}
                    trend="up"
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
                    <Card className="min-h-[400px] flex flex-col">
                        <div className="px-5 py-4 border-b border-[#e2e8f0] dark:border-[#161641] flex items-center justify-between">
                            <div>
                                <h6 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">Pet Efficiency</h6>
                                <p className="text-13 text-[#9d9d9d]">Performance breakdown</p>
                            </div>
                            <select
                                value={selectedPet}
                                onChange={(e) => setSelectedPet(e.target.value)}
                                className="text-sm bg-[#f7f8f9] dark:bg-[#0c0c20] border border-[#e2e8f0] dark:border-[#161641] rounded-lg px-3 py-1.5 text-[#1f2020] dark:text-[#d9dcff] focus:ring-2 focus:ring-blue-500/30 cursor-pointer hover:bg-[#eef2f6] dark:hover:bg-[#161641] transition font-medium"
                            >
                                {petsList.length === 0 && <option value="">No Data</option>}
                                {petsList.map(pet => (
                                    <option key={pet} value={pet}>{pet}</option>
                                ))}
                            </select>
                        </div>

                        <div className="p-5 flex flex-col md:flex-row items-center gap-8 flex-1">
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
                                    <div className="w-full h-full rounded-full border-4 border-[#e2e8f0] dark:border-[#161641] border-dashed flex items-center justify-center">
                                        <span className="text-[#9d9d9d] text-xs">No Data</span>
                                    </div>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="flex-1 w-full space-y-3">
                                {petEfficiencyData.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3 group">
                                        <div
                                            className="w-1.5 h-10 rounded-full mt-1 flex-shrink-0 transition-all group-hover:scale-110"
                                            style={{ backgroundColor: item.name === 'Efficiency' ? COLOR_EFFICIENCY : COLOR_LOSS }}
                                        />
                                        <div>
                                            <p className="text-xs font-medium text-[#9d9d9d] uppercase tracking-wider mb-0.5">{item.name}</p>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">{item.value}%</h4>
                                                <span className="text-xs text-[#9d9d9d]">
                                                    {item.name === 'Efficiency' ? 'Operational Time' : 'Lost Production Time'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {petEfficiencyData.length === 0 && (
                                    <p className="text-sm text-[#9d9d9d] italic">Select a PET with production data to view efficiency breakdown.</p>
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
                    <Card className="min-h-[400px] flex flex-col">
                        <div className="px-5 py-4 border-b border-[#e2e8f0] dark:border-[#161641]">
                            <h6 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">Downtime Contribution</h6>
                            <p className="text-13 text-[#9d9d9d]">Total Minutes Lost: {stats.totalDowntime}</p>
                        </div>

                        <div className="p-5 flex flex-col md:flex-row items-center gap-8 flex-1">
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
                                    <div className="w-full h-full rounded-full border-4 border-[#e2e8f0] dark:border-[#161641] border-dashed flex items-center justify-center">
                                        <span className="text-[#9d9d9d] text-xs">No Downtime</span>
                                    </div>
                                )}
                            </div>

                            {/* Legend - Scrollable if many PETs */}
                            <div className="flex-1 w-full max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-3">
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
                                                    <p className="text-xs font-medium text-[#9d9d9d] uppercase tracking-wider mb-0.5">{item.name}</p>
                                                <span className="text-[10px] font-medium bg-[#f7f8f9] dark:bg-[#0c0c20] text-[#707070] dark:text-[#828997] px-1.5 py-0.5 rounded">
                                                                    {percentage}%
                                                                </span>
                                                            </div>
                                                            <div className="flex items-baseline gap-2">
                                                            <h4 className="text-base font-semibold text-[#1f2020] dark:text-[#d9dcff]">{item.value} <span className="text-xs font-normal text-[#9d9d9d]">min</span></h4>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <p className="text-sm text-[#9d9d9d] italic">No downtime recorded today. Great job!</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* ==================== OEE SECTION ==================== */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-base font-bold text-[#1f2020] dark:text-[#d9dcff] mb-1">OEE Metrics</h4>
                        <p className="text-sm text-[#707070] dark:text-[#828997]">Availability, Quality, and Performance Analysis</p>
                    </div>
                </div>

                {/* Pet Selector (Horizontal Scroll) */}
                <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                    <div className="flex items-center gap-2">
                        {petsList.map(pet => {
                            const isSelected = selectedOeePets.includes(pet);
                            return (
                                <button
                                    key={pet}
                                    onClick={() => handleOeePetToggle(pet)}
                                    className={`
                                        flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                                        ${isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white dark:bg-[#030318] text-[#707070] dark:text-[#828997] border-[#e2e8f0] dark:border-[#161641] hover:bg-[#f7f8f9] dark:hover:bg-[#0c0c20]'}
                                    `}
                                >
                                    {pet}
                                </button>
                            );
                        })}
                        {petsList.length === 0 && <span className="text-sm text-[#9d9d9d] italic">No PETs found for today</span>}
                    </div>
                </div>

                {/* OEE Charts Grid */}
                <div className="grid grid-cols-1 gap-8">
                    {/* Availability Chart */}
                    <OEEBarChart
                        title="Availability"
                        data={oeeData.map(d => ({ name: d.pet, value: d.availability }))}
                        color="#3b82f6" // blue
                        tooltipPrefix="Availability"
                        gridColor={chartGridColor}
                        textColor={tooltipText}
                        bgColor={tooltipBg}
                        borderColor={tooltipBorder}
                    />

                    {/* Quality Chart */}
                    <OEEBarChart
                        title="Quality"
                        data={oeeData.map(d => ({ name: d.pet, value: d.quality }))}
                        color="#10b981" // emerald
                        tooltipPrefix="Quality"
                        gridColor={chartGridColor}
                        textColor={tooltipText}
                        bgColor={tooltipBg}
                        borderColor={tooltipBorder}
                    />

                    {/* Performance Chart */}
                    <OEEBarChart
                        title="Performance"
                        data={oeeData.map(d => ({ name: d.pet, value: d.performance }))}
                        color="#f59e0b" // amber
                        tooltipPrefix="Performance"
                        gridColor={chartGridColor}
                        textColor={tooltipText}
                        bgColor={tooltipBg}
                        borderColor={tooltipBorder}
                    />
                </div>
            </div>

            {/* Recent Reports Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-bold text-[#1f2020] dark:text-[#d9dcff]">Recent Production Reports</h4>
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
        </div >
    );
};

export default Overview;
