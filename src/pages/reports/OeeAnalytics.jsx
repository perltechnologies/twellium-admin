import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell } from 'recharts';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const PET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const OEE_TARGET = 85;

const defaultPets = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];
const normalizePet = (name) => {
    const num = (name || '').toLowerCase().match(/pet\s*(\d+)/);
    return num ? `Pet ${num[1]}` : name;
};

const getStatusConfig = (value) => {
    if (value >= OEE_TARGET) return { color: 'success', bgClass: 'bg-success-subtle', textClass: 'text-success', label: 'World Class' };
    if (value >= 70) return { color: 'warning', bgClass: 'bg-warning-subtle', textClass: 'text-warning', label: 'Typical' };
    return { color: 'danger', bgClass: 'bg-danger-subtle', textClass: 'text-danger', label: 'Needs Improvement' };
};

const OeeAnalytics = () => {
    const { filters } = useFilters();
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('chart');
    const [timeRange, setTimeRange] = useState('week');
    const initialFilterRef = useRef(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.pet) params.pet = filters.pet;

            if (timeRange === 'custom') {
                if (filters.log_date) {
                    params.start_date = filters.log_date;
                    params.end_date = filters.log_date;
                } else if (filters.start_date && filters.end_date) {
                    params.start_date = filters.start_date;
                    params.end_date = filters.end_date;
                }
            }

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
            console.error('Failed to fetch OEE analytics:', err);
            setRawData(null);
        } finally {
            setLoading(false);
        }
    }, [filters, timeRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (initialFilterRef.current) { initialFilterRef.current = false; return; }
        if (filters.log_date || filters.start_date || filters.end_date) setTimeRange('custom');
    }, [filters.log_date, filters.start_date, filters.end_date]);

    const summaryData = rawData?.summary || {};
    const dailyBreakdown = rawData?.daily_breakdown || [];

    const dateRangeLabel = useMemo(() => {
        const f = rawData?.filters;
        if (!f) return '';
        return f.start_date === f.end_date ? f.start_date : `${f.start_date} to ${f.end_date}`;
    }, [rawData]);

    // OEE components from summary
    const oeeComponents = useMemo(() => ({
        oee: summaryData.oee || summaryData.avg_efficiency || 0,
        availability: summaryData.avg_availability || 0,
        performance: summaryData.avg_performance || 0,
        quality: summaryData.avg_quality || 0,
    }), [summaryData]);

    // OEE by PET
    const oeeByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = { oee: 0, avail: 0, perf: 0, qual: 0, count: 0 }; });
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (!petMap[name]) petMap[name] = { oee: 0, avail: 0, perf: 0, qual: 0, count: 0 };
                petMap[name].oee += p.oee || p.efficiency || 0;
                petMap[name].avail += p.availability || 0;
                petMap[name].perf += p.performance || 0;
                petMap[name].qual += p.quality || 0;
                petMap[name].count += 1;
            });
        });
        return Object.entries(petMap).map(([name, v]) => ({
            pet: name,
            oee: v.count > 0 ? v.oee / v.count : 0,
            availability: v.count > 0 ? v.avail / v.count : 0,
            performance: v.count > 0 ? v.perf / v.count : 0,
            quality: v.count > 0 ? v.qual / v.count : 0,
            count: v.count,
        })).sort((a, b) => {
            const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [dailyBreakdown]);

    // Daily OEE trend (all dates in range)
    const dailyOeeTrend = useMemo(() => {
        const f = rawData?.filters;
        if (!f?.start_date || !f?.end_date) return [];
        const allDates = [];
        const start = new Date(f.start_date);
        const end = new Date(f.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            allDates.push(new Date(d).toISOString().split('T')[0]);
        }
        const dayMap = {};
        dailyBreakdown.forEach(day => { dayMap[day.date] = day; });
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return allDates.map(date => {
            const day = dayMap[date];
            const d = new Date(date);
            const label = `${date.slice(5)} ${dayNames[d.getDay()]}`;
            return {
                date: label,
                oee: day?.oee || day?.avg_efficiency || 0,
                availability: day?.avg_availability || 0,
                performance: day?.avg_performance || 0,
                quality: day?.avg_quality || 0,
            };
        });
    }, [dailyBreakdown, rawData]);

    // OEE trend per PET (line chart)
    const oeePerPetTrend = useMemo(() => {
        const f = rawData?.filters;
        if (!f?.start_date || !f?.end_date) return [];
        const allDates = [];
        const start = new Date(f.start_date);
        const end = new Date(f.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            allDates.push(new Date(d).toISOString().split('T')[0]);
        }
        const dayMap = {};
        dailyBreakdown.forEach(day => { dayMap[day.date] = day; });
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return allDates.map(date => {
            const day = dayMap[date];
            const d = new Date(date);
            const row = { date: `${date.slice(5)} ${dayNames[d.getDay()]}` };
            if (day?.pets) {
                const petOee = {};
                day.pets.forEach(p => {
                    const name = normalizePet(p.pet_name);
                    if (!petOee[name]) petOee[name] = { sum: 0, count: 0 };
                    petOee[name].sum += p.oee || p.efficiency || 0;
                    petOee[name].count += 1;
                });
                defaultPets.forEach(pet => {
                    row[pet] = petOee[pet] ? parseFloat((petOee[pet].sum / petOee[pet].count).toFixed(1)) : null;
                });
            } else {
                defaultPets.forEach(pet => { row[pet] = null; });
            }
            return row;
        });
    }, [dailyBreakdown, rawData]);

    // Radar chart data
    const radarData = useMemo(() => ([
        { metric: 'OEE', value: oeeComponents.oee, fullMark: 100 },
        { metric: 'Availability', value: oeeComponents.availability, fullMark: 100 },
        { metric: 'Performance', value: oeeComponents.performance, fullMark: 100 },
        { metric: 'Quality', value: oeeComponents.quality, fullMark: 100 },
    ]), [oeeComponents]);

    // Table data
    const tableData = useMemo(() => {
        const rows = [];
        dailyBreakdown.forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                rows.push({
                    Date: day.date,
                    Pet: normalizePet(p.pet_name),
                    Shift: p.shift || '-',
                    OEE: (p.oee || 0).toFixed(1),
                    Availability: (p.availability || 0).toFixed(1),
                    Performance: (p.performance || 0).toFixed(1),
                    Quality: (p.quality || 0).toFixed(1),
                    Output: p.total_bottles_produced || 0,
                    Downtime: `${p.total_downtime_minutes || 0} min`,
                });
            });
        });
        return rows;
    }, [dailyBreakdown]);

    const handleExport = () => {
        exportToExcel(tableData, `OEE_Analytics_${dateRangeLabel.replace(/ to /g, '_')}`, 'OEE Analytics');
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded shadow-lg border" style={{ minWidth: 150 }}>
                    <p className="fw-bold mb-2 border-bottom pb-2">{label}</p>
                    {payload.filter(p => p.value !== null).map((entry, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center mb-1">
                            <span className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                                <span>{entry.name}:</span>
                            </span>
                            <span className="fw-medium ms-2">{typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : entry.value}</span>
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
                    <h4 className="mb-0">OEE Analytics</h4>
                    <small className="text-muted">Overall Equipment Effectiveness analysis</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${timeRange === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('week')}>Week</button>
                        <button className={`btn ${timeRange === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('month')}>Month</button>
                        <button className={`btn ${timeRange === 'quarter' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('quarter')}>Quarter</button>
                    </div>
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('chart')}>
                            <i className="ti ti-chart-line me-1"></i>Chart
                        </button>
                        <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('table')}>
                            <i className="ti ti-table me-1"></i>Table
                        </button>
                    </div>
                    <button onClick={handleExport} className="btn btn-success btn-sm">
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={fetchData}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                </div>
            </div>

            <FilterInputs />

            {/* OEE Summary Cards */}
            <div className="row g-3 mb-4">
                {loading ? (
                    [1,2,3,4].map(i => (
                        <div key={i} className="col-xl-3 col-sm-6">
                            <div className="card mb-0 h-100"><div className="card-body d-flex align-items-center justify-content-center" style={{ minHeight: 100 }}><span className="spinner-border text-primary" /></div></div>
                        </div>
                    ))
                ) : (
                    <>
                        <div className="col-xl-3 col-sm-6">
                            <div className={`card border-top border-${getStatusConfig(oeeComponents.oee).color} border-3 mb-0 h-100`}>
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">OEE</p>
                                        <span className={`badge ${getStatusConfig(oeeComponents.oee).bgClass} ${getStatusConfig(oeeComponents.oee).textClass}`}>{getStatusConfig(oeeComponents.oee).label}</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{oeeComponents.oee.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 6 }}><div className={`progress-bar bg-${getStatusConfig(oeeComponents.oee).color}`} style={{ width: `${Math.min(oeeComponents.oee, 100)}%` }} /></div>
                                    <small className="text-muted mt-1 d-block">Target: {OEE_TARGET}%</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0 h-100">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-2">Availability</p>
                                    <h2 className="mb-1 fs-16 fw-bold">{oeeComponents.availability.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 6 }}><div className="progress-bar bg-info" style={{ width: `${Math.min(oeeComponents.availability, 100)}%` }} /></div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-warning border-3 mb-0 h-100">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-2">Performance</p>
                                    <h2 className="mb-1 fs-16 fw-bold">{oeeComponents.performance.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 6 }}><div className="progress-bar bg-warning" style={{ width: `${Math.min(oeeComponents.performance, 100)}%` }} /></div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0 h-100">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-2">Quality</p>
                                    <h2 className="mb-1 fs-16 fw-bold">{oeeComponents.quality.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 6 }}><div className="progress-bar bg-success" style={{ width: `${Math.min(oeeComponents.quality, 100)}%` }} /></div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {viewMode === 'chart' ? (
                <>
                    {/* OEE Trend - A, P, Q components */}
                    <div className="card mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">OEE Components Trend</h6>
                            <small className="text-muted">Daily Availability, Performance, Quality {dateRangeLabel && `(${dateRangeLabel})`}</small>
                        </div>
                        <div className="card-body">
                            {dailyOeeTrend.length === 0 ? (
                                <p className="text-center text-muted py-5">No data available</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={350}>
                                    <LineChart data={dailyOeeTrend} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <ReferenceLine y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" label={{ value: `Target ${OEE_TARGET}%`, position: 'right', fill: '#22c55e', fontSize: 11 }} />
                                        <Line type="monotone" dataKey="oee" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} name="OEE" />
                                        <Line type="monotone" dataKey="availability" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Availability" />
                                        <Line type="monotone" dataKey="performance" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Performance" />
                                        <Line type="monotone" dataKey="quality" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Quality" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* OEE per PET trend */}
                    <div className="card mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">OEE by PET Line (Daily)</h6>
                            <small className="text-muted">Per-line OEE trend across the period</small>
                        </div>
                        <div className="card-body">
                            {oeePerPetTrend.length === 0 ? (
                                <p className="text-center text-muted py-5">No data available</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={350}>
                                    <LineChart data={oeePerPetTrend} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                        <YAxis domain={[40, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <ReferenceLine y={OEE_TARGET} stroke="#94a3b8" strokeDasharray="5 5" />
                                        {defaultPets.map((pet, idx) => (
                                            <Line key={pet} type="monotone" dataKey={pet} stroke={PET_COLORS[idx]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="row mb-4">
                        {/* OEE by PET bar chart */}
                        <div className="col-lg-7">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Average OEE by PET Line</h6>
                                    <small className="text-muted">Ranked by OEE performance</small>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={320}>
                                        <BarChart data={oeeByPet} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0]?.payload;
                                                        if (!data) return null;
                                                        return (
                                                            <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', minWidth: 180 }}>
                                                                <p style={{ fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>{data.pet}</p>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ color: '#8b5cf6' }}>● OEE:</span>
                                                                    <span style={{ fontWeight: 600 }}>{data.oee.toFixed(1)}%</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ color: '#06b6d4' }}>● Availability:</span>
                                                                    <span style={{ fontWeight: 600 }}>{data.availability.toFixed(1)}%</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ color: '#f59e0b' }}>● Performance:</span>
                                                                    <span style={{ fontWeight: 600 }}>{data.performance.toFixed(1)}%</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <span style={{ color: '#22c55e' }}>● Quality:</span>
                                                                    <span style={{ fontWeight: 600 }}>{data.quality.toFixed(1)}%</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>
                                                                    <span>Reports:</span>
                                                                    <span>{data.count}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <ReferenceLine y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" />
                                            <Bar dataKey="oee" name="OEE %" radius={[4, 4, 0, 0]}>
                                                {oeeByPet.map((entry, idx) => (
                                                    <Cell key={idx} fill={entry.oee >= 85 ? '#22c55e' : entry.oee >= 70 ? '#f59e0b' : '#ef4444'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        {/* Radar chart */}
                        <div className="col-lg-5">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">OEE Components Overview</h6>
                                    <small className="text-muted">A × P × Q breakdown</small>
                                </div>
                                <div className="card-body d-flex align-items-center justify-content-center">
                                    <ResponsiveContainer width="100%" height={320}>
                                        <RadarChart data={radarData}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                                            <Tooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0]?.payload;
                                                        if (!data) return null;
                                                        return (
                                                            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', minWidth: 140 }}>
                                                                <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{data.metric}</p>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ color: '#8b5cf6' }}>● Value:</span>
                                                                    <span style={{ fontWeight: 600 }}>{data.value.toFixed(1)}%</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Radar name="Current" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Per-PET breakdown table */}
                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">OEE Breakdown by PET Line</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>PET Line</th>
                                            <th className="text-center">OEE</th>
                                            <th className="text-center">Availability</th>
                                            <th className="text-center">Performance</th>
                                            <th className="text-center">Quality</th>
                                            <th className="text-center">Reports</th>
                                            <th className="text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {oeeByPet.map(pet => {
                                            const status = getStatusConfig(pet.oee);
                                            return (
                                                <tr key={pet.pet}>
                                                    <td className="fw-medium">{pet.pet}</td>
                                                    <td className="text-center fw-bold" style={{ color: pet.oee >= 85 ? '#22c55e' : pet.oee >= 70 ? '#d97706' : '#dc2626' }}>{pet.oee.toFixed(1)}%</td>
                                                    <td className="text-center">{pet.availability.toFixed(1)}%</td>
                                                    <td className="text-center">{pet.performance.toFixed(1)}%</td>
                                                    <td className="text-center">{pet.quality.toFixed(1)}%</td>
                                                    <td className="text-center">{pet.count}</td>
                                                    <td className="text-center"><span className={`badge ${status.bgClass} ${status.textClass}`}>{status.label}</span></td>
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
                            <h6 className="mb-0">Detailed OEE Records</h6>
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
                                        <th className="text-center">OEE</th>
                                        <th className="text-center">Availability</th>
                                        <th className="text-center">Performance</th>
                                        <th className="text-center">Quality</th>
                                        <th className="text-end">Output</th>
                                        <th className="text-end">Downtime</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center text-muted py-4">No data available</td></tr>
                                    ) : tableData.map((row, idx) => {
                                        const oee = parseFloat(row.OEE);
                                        const status = getStatusConfig(oee);
                                        return (
                                            <tr key={idx}>
                                                <td className="fw-medium">{row.Date}</td>
                                                <td>{row.Pet}</td>
                                                <td><span className="badge bg-secondary-subtle text-secondary">{row.Shift}</span></td>
                                                <td className="text-center"><span className={`badge ${status.bgClass} ${status.textClass} fw-bold`}>{row.OEE}%</span></td>
                                                <td className="text-center">{row.Availability}%</td>
                                                <td className="text-center">{row.Performance}%</td>
                                                <td className="text-center">{row.Quality}%</td>
                                                <td className="text-end">{(row.Output || 0).toLocaleString()}</td>
                                                <td className="text-end">{row.Downtime}</td>
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

export default OeeAnalytics;
