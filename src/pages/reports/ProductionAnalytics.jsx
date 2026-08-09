import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell } from 'recharts';
import { PieChart, Pie } from 'recharts';
import { exportToExcel, exportChartToPDF } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const PET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const OEE_TARGET = 85;

const getStatusConfig = (value, target = OEE_TARGET) => {
    if (value >= target) return { color: 'success', bgClass: 'bg-success-subtle', textClass: 'text-success', label: 'Good' };
    if (value >= target - 15) return { color: 'warning', bgClass: 'bg-warning-subtle', textClass: 'text-warning', label: 'Fair' };
    return { color: 'danger', bgClass: 'bg-danger-subtle', textClass: 'text-danger', label: 'Poor' };
};

const defaultPets = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];
const normalizePet = (name) => {
    const num = (name || '').toLowerCase().match(/pet\s*(\d+)/);
    return num ? `Pet ${num[1]}` : name;
};

const ProductionAnalytics = () => {
    const { filters } = useFilters();
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('output');
    const [viewMode, setViewMode] = useState('chart');
    const [timeRange, setTimeRange] = useState('week');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.pet) params.pet = filters.pet;

            // Only use filter dates when user explicitly set them (timeRange === 'custom')
            if (timeRange === 'custom') {
                if (filters.log_date) {
                    params.start_date = filters.log_date;
                    params.end_date = filters.log_date;
                } else if (filters.start_date && filters.end_date) {
                    params.start_date = filters.start_date;
                    params.end_date = filters.end_date;
                }
            }

            // Default to timeRange-based dates
            if (!params.start_date) {
                const now = new Date();
                if (timeRange === 'week') {
                    const dayOfWeek = now.getDay();
                    const sunday = new Date(now);
                    sunday.setDate(now.getDate() - dayOfWeek);
                    params.start_date = sunday.toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                } else if (timeRange === 'month') {
                    params.start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                } else if (timeRange === 'quarter') {
                    const quarter = Math.floor(now.getMonth() / 3);
                    params.start_date = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                } else {
                    // fallback to week
                    const dayOfWeek = now.getDay();
                    const sunday = new Date(now);
                    sunday.setDate(now.getDate() - dayOfWeek);
                    params.start_date = sunday.toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                }
            }

            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            setRawData(envelope);
        } catch (err) {
            console.error('Failed to fetch production analytics:', err);
            setRawData(null);
        } finally {
            setLoading(false);
        }
    }, [filters, timeRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const initialFilterRef = React.useRef(true);
    useEffect(() => {
        // Skip initial mount — DEFAULT_FILTERS has log_date=today which would override week
        if (initialFilterRef.current) {
            initialFilterRef.current = false;
            return;
        }
        if (filters.log_date || filters.start_date || filters.end_date) setTimeRange('custom');
    }, [filters.log_date, filters.start_date, filters.end_date]);

    const summaryData = rawData?.summary || {};
    const dailyBreakdown = rawData?.daily_breakdown || [];

    const dateRangeLabel = useMemo(() => {
        const f = rawData?.filters;
        if (!f) return '';
        return f.start_date === f.end_date ? f.start_date : `${f.start_date} to ${f.end_date}`;
    }, [rawData]);

    // Stats cards
    const stats = useMemo(() => {
        const s = summaryData;
        return {
            totalOutput: s.total_bottles_produced || s.total_bottles || 0,
            avgOee: s.oee || s.avg_efficiency || 0,
            avgAvail: s.avg_availability || 0,
            avgPerf: s.avg_performance || 0,
            avgQuality: s.avg_quality || 0,
            totalDowntime: s.total_downtime_minutes || s.total_downtime_mins || 0,
            reportCount: s.total_reports || 0,
            uniqueLines: defaultPets.length,
            oeeStatus: getStatusConfig(s.oee || s.avg_efficiency || 0),
        };
    }, [summaryData]);

    // Output by PET (pie chart)
    const outputByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = 0; });
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const name = normalizePet(p.pet_name);
                petMap[name] = (petMap[name] || 0) + (p.total_bottles_produced || p.total_bottles || 0);
            });
        });
        return Object.entries(petMap).map(([name, value]) => ({ name, value })).filter(p => p.value > 0);
    }, [dailyBreakdown]);

    // Output by shift
    const outputByShift = useMemo(() => {
        const shiftMap = {};
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const shift = p.shift || 'Unknown';
                shiftMap[shift] = (shiftMap[shift] || 0) + (p.total_bottles_produced || p.total_bottles || 0);
            });
        });
        return Object.entries(shiftMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [dailyBreakdown]);

    // Helper: get total output from a daily breakdown entry
    const getDayOutput = (day) => {
        if (!day) return 0;
        // Try top-level fields first
        if (day.total_bottles_produced) return day.total_bottles_produced;
        if (day.total_bottles) return day.total_bottles;
        if (day.total_output) return day.total_output;
        // Fallback: sum from pet entries
        const pets = (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can'));
        if (pets.length > 0) {
            return pets.reduce((sum, p) => sum + (p.total_bottles_produced || p.total_bottles || 0), 0);
        }
        return 0;
    };

    // Daily output trend - show all dates in range, fill gaps with 0
    const dailyOutputData = useMemo(() => {
        const f = rawData?.filters;
        if (!f?.start_date || !f?.end_date) return dailyBreakdown.map(day => ({ date: day.date.slice(5), output: getDayOutput(day), oee: day.oee || day.avg_efficiency || 0 }));

        // Generate all dates in the range
        const allDates = [];
        const start = new Date(f.start_date);
        const end = new Date(f.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            allDates.push(new Date(d).toISOString().split('T')[0]);
        }

        // Index API data by date
        const dayMap = {};
        dailyBreakdown.forEach(day => { dayMap[day.date] = day; });

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        return allDates.map(date => {
            const day = dayMap[date];
            const d = new Date(date);
            const label = `${date.slice(5)} ${dayNames[d.getDay()]}`;
            return {
                date: label,
                output: getDayOutput(day),
                oee: day?.oee || day?.avg_efficiency || 0,
            };
        });
    }, [dailyBreakdown, rawData]);

    // Efficiency by PET
    const efficiencyByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = { sum: 0, count: 0 }; });
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (!petMap[name]) petMap[name] = { sum: 0, count: 0 };
                petMap[name].sum += p.efficiency || p.oee || 0;
                petMap[name].count += 1;
            });
        });
        return Object.entries(petMap)
            .map(([name, v]) => ({ name, efficiency: v.count > 0 ? (v.sum / v.count).toFixed(1) : '0.0' }))
            .sort((a, b) => parseFloat(b.efficiency) - parseFloat(a.efficiency));
    }, [dailyBreakdown]);

    // Downtime by PET
    const downtimeByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = 0; });
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const name = normalizePet(p.pet_name);
                petMap[name] = (petMap[name] || 0) + (p.total_downtime_minutes || 0);
            });
        });
        return Object.entries(petMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [dailyBreakdown]);

    // Table data
    const tableData = useMemo(() => {
        const rows = [];
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                rows.push({
                    Date: day.date,
                    'PET Line': normalizePet(p.pet_name),
                    Shift: p.shift || '-',
                    Output: p.total_bottles_produced || p.total_bottles || 0,
                    OEE: `${(p.oee || 0).toFixed(1)}%`,
                    Availability: `${(p.availability || 0).toFixed(1)}%`,
                    Quality: `${(p.quality || 0).toFixed(1)}%`,
                    Performance: `${(p.performance || 0).toFixed(1)}%`,
                    Downtime: `${p.total_downtime_minutes || 0} min`,
                });
            });
        });
        return rows;
    }, [dailyBreakdown]);

    const handleExportExcel = () => {
        exportToExcel(tableData, `production_analytics_${dateRangeLabel.replace(/ to /g, '_')}`, 'Production Analytics');
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded shadow-lg border" style={{ minWidth: 150 }}>
                    <p className="fw-bold mb-2 border-bottom pb-2">{label}</p>
                    {payload.map((entry, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center mb-1">
                            <span className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                                <span>{entry.name}:</span>
                            </span>
                            <span className="fw-medium ms-2">
                                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-0">Production Analytics</h4>
                    <small className="text-muted">Production output, efficiency, and performance analytics</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                    <div className="btn-group btn-group-sm" role="group">
                        <button className={`btn ${timeRange === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('week')}>Week</button>
                        <button className={`btn ${timeRange === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('month')}>Month</button>
                        <button className={`btn ${timeRange === 'quarter' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('quarter')}>Quarter</button>
                    </div>
                    <button className="btn btn-outline-secondary btn-sm" onClick={fetchData}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('chart')}>
                            <i className="ti ti-chart-line me-1"></i>Chart
                        </button>
                        <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('table')}>
                            <i className="ti ti-table me-1"></i>Table
                        </button>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={handleExportExcel}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            <FilterInputs />

            {/* Stats Cards */}
            <div className="row row-gap-3 mb-4">
                {loading ? (
                    [1,2,3,4].map(i => (
                        <div key={i} className="col-xl-3 col-sm-6">
                            <div className="card border-top border-secondary border-3 mb-0 h-100">
                                <div className="card-body d-flex align-items-center justify-content-center" style={{ minHeight: 120 }}>
                                    <span className="spinner-border text-primary" role="status" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-primary border-3 mb-0 h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Total Output</p>
                                        <span className="badge bg-primary-subtle text-primary">Output</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.totalOutput.toLocaleString()}</h2>
                                    <small className="text-muted">{stats.reportCount} reports</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className={`card border-top border-${stats.oeeStatus.color} border-3 mb-0 h-100`}>
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Average OEE</p>
                                        <span className={`badge ${stats.oeeStatus.bgClass} ${stats.oeeStatus.textClass}`}>{stats.oeeStatus.label}</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgOee.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 6 }}>
                                        <div className={`progress-bar bg-${stats.oeeStatus.color}`} style={{ width: `${Math.min(stats.avgOee, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0 h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Availability</p>
                                        <span className="badge bg-success-subtle text-success">A</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgAvail.toFixed(1)}%</h2>
                                    <small className="text-muted">Performance: {stats.avgPerf.toFixed(1)}% | Quality: {stats.avgQuality.toFixed(1)}%</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0 h-100">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Total Downtime</p>
                                        <span className="badge bg-info-subtle text-info">{stats.uniqueLines} Lines</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.totalDowntime.toLocaleString()} min</h2>
                                    <small className="text-muted">{(stats.totalDowntime / Math.max(stats.reportCount, 1)).toFixed(1)} min avg/report</small>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {viewMode === 'chart' ? (
                <>
                    {/* Production Overview Chart */}
                    <div className="card mb-4">
                        <div className="card-header">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="mb-0">Production Overview</h6>
                                    <small className="text-muted">Daily output and OEE trends {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                </div>
                                <ul className="nav nav-pills mb-0" role="tablist">
                                    <li className="nav-item">
                                        <button className={`nav-link ${activeTab === 'output' ? 'active' : ''} btn-sm`} onClick={() => setActiveTab('output')}>
                                            <i className="ti ti-chart-bar me-1"></i>Output
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button className={`nav-link ${activeTab === 'efficiency' ? 'active' : ''} btn-sm`} onClick={() => setActiveTab('efficiency')}>
                                            <i className="ti ti-gauge me-1"></i>Efficiency
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button className={`nav-link ${activeTab === 'comparison' ? 'active' : ''} btn-sm`} onClick={() => setActiveTab('comparison')}>
                                            <i className="ti ti-arrows-exchange me-1"></i>Comparison
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
                            ) : dailyOutputData.length === 0 ? (
                                <p className="text-center text-muted py-5 mb-0">No data available</p>
                            ) : (
                                <>
                                    {activeTab === 'output' && (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <AreaChart data={dailyOutputData}>
                                                <defs>
                                                    <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area type="monotone" dataKey="output" stroke="#3b82f6" fill="url(#outputGradient)" name="Output (pcs)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                    {activeTab === 'efficiency' && (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <BarChart data={efficiencyByPet}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                <Tooltip formatter={(v) => [`${v}%`, 'OEE']} />
                                                <ReferenceLine y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" label={{ value: `Target ${OEE_TARGET}%`, position: 'right', fill: '#22c55e', fontSize: 11 }} />
                                                <Bar dataKey="efficiency" radius={[4, 4, 0, 0]} name="OEE %">
                                                    {efficiencyByPet.map((entry, idx) => {
                                                        const eff = parseFloat(entry.efficiency);
                                                        return <Cell key={idx} fill={eff >= 85 ? '#22c55e' : eff >= 70 ? '#f59e0b' : '#ef4444'} />;
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                    {activeTab === 'comparison' && (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <LineChart data={dailyOutputData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} yAxisId="left" tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                                <YAxis tick={{ fontSize: 12 }} yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <ReferenceLine yAxisId="right" y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" />
                                                <Line type="monotone" dataKey="output" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Output (pcs)" yAxisId="left" />
                                                <Line type="monotone" dataKey="oee" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="OEE %" yAxisId="right" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Distribution Charts */}
                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Output Distribution by PET Line</h6>
                                    <small className="text-muted">Total production per line</small>
                                </div>
                                <div className="card-body">
                                    {outputByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5">No data</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie data={outputByPet} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value"
                                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                        {outputByPet.map((_, idx) => <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => [v.toLocaleString(), 'Output']} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3">
                                                {outputByPet.map((pet, idx) => (
                                                    <div key={pet.name} className="d-flex align-items-center justify-content-between mb-2">
                                                        <span><i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>{pet.name}</span>
                                                        <span className="text-muted">{pet.value.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Downtime by PET Line</h6>
                                    <small className="text-muted">Total downtime minutes per line</small>
                                </div>
                                <div className="card-body">
                                    {downtimeByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5">No data</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={downtimeByPet} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" tick={{ fontSize: 12 }} />
                                                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 11 }} />
                                                <Tooltip formatter={(v) => [`${v} min`, 'Downtime']} />
                                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} name="Minutes" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Performers */}
                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">Line Performance Ranking</h6>
                            <small className="text-muted">Lines ranked by Performance</small>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Rank</th>
                                            <th>PET Line</th>
                                            <th>Performance</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {efficiencyByPet.map((pet, idx) => {
                                            const eff = parseFloat(pet.efficiency);
                                            const status = getStatusConfig(eff);
                                            return (
                                                <tr key={pet.name}>
                                                    <td><span className={`avatar avatar-xs rounded-circle ${idx === 0 ? 'bg-warning text-white' : 'bg-light'}`}>#{idx + 1}</span></td>
                                                    <td className="fw-medium">{pet.name}</td>
                                                    <td>{pet.efficiency}%</td>
                                                    <td><span className={`badge ${status.bgClass} ${status.textClass}`}>{status.label}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* Table View */
                <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between">
                        <div>
                            <h6 className="mb-0">Detailed Production Records</h6>
                            <small className="text-muted">{tableData.length} records {dateRangeLabel && `(${dateRangeLabel})`}</small>
                        </div>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive" style={{ maxHeight: 500 }}>
                            <table className="table table-sm mb-0">
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th>Date</th>
                                        <th>PET Line</th>
                                        <th>Shift</th>
                                        <th className="text-end">Output</th>
                                        <th>OEE</th>
                                        <th>Availability</th>
                                        <th>Quality</th>
                                        <th>Performance</th>
                                        <th>Downtime</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={9} className="text-center py-4"><span className="spinner-border text-primary" /></td></tr>
                                    ) : tableData.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center text-muted py-4">No data available</td></tr>
                                    ) : tableData.map((row, idx) => {
                                        const oeeVal = parseFloat(row.OEE);
                                        const status = getStatusConfig(oeeVal);
                                        return (
                                            <tr key={idx}>
                                                <td className="fw-medium">{row.Date}</td>
                                                <td>{row['PET Line']}</td>
                                                <td><span className="badge bg-secondary-subtle text-secondary">{row.Shift}</span></td>
                                                <td className="text-end fw-medium">{(row.Output || 0).toLocaleString()}</td>
                                                <td><span className={`badge ${status.bgClass} ${status.textClass}`}>{row.OEE}</span></td>
                                                <td>{row.Availability}</td>
                                                <td>{row.Quality}</td>
                                                <td>{row.Performance}</td>
                                                <td>{row.Downtime}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductionAnalytics;
