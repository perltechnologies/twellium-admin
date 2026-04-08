import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { exportToExcel, exportChartToPDF } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const OEE_TARGET = 85;

const getWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);
    return { start: sunday, end: saturday };
};

const formatDateShort = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getStatusConfig = (value, target = OEE_TARGET) => {
    if (value >= target) return { color: 'success', bgClass: 'bg-success-subtle', textClass: 'text-success', label: 'World Class' };
    if (value >= target - 15) return { color: 'warning', bgClass: 'bg-warning-subtle', textClass: 'text-warning', label: 'Typical' };
    return { color: 'danger', bgClass: 'bg-danger-subtle', textClass: 'text-danger', label: 'Improvement Needed' };
};

const OeeAnalytics = () => {
    const { filters } = useFilters();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);
    const [chartType, setChartType] = useState('line');
    const [viewMode, setViewMode] = useState('chart');
    const [timeRange, setTimeRange] = useState('week');

    useEffect(() => {
        productionApi.getPets({ page_size: 100 })
            .then(res => setPets((res.data.data || []).filter(p => !p.pet_name?.toLowerCase().includes('can'))))
            .catch(err => console.error('Failed to load pets:', err));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.pet) params.pet_id = filters.pet;
            if (filters.shift) params.shift_name = filters.shift;
            
            // Always use timeRange for data fetching if set, ignore manual date filters for fetching
            if (timeRange && timeRange !== 'all') {
                const now = new Date();
                let startDate, endDate;
                
                if (timeRange === 'week') {
                    const dayOfWeek = now.getDay();
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - dayOfWeek);
                    startDate.setHours(6, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(6, 0, 59, 0);
                } else if (timeRange === 'month') {
                    // Current month from 1st to today
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    startDate.setHours(6, 0, 0, 0);
                    endDate = new Date(now);
                    endDate.setHours(6, 0, 59, 0);
                } else if (timeRange === 'quarter') {
                    // Current quarter
                    const quarter = Math.floor(now.getMonth() / 3);
                    startDate = new Date(now.getFullYear(), quarter * 3, 1);
                    startDate.setHours(6, 0, 0, 0);
                    endDate = new Date(now);
                    endDate.setHours(6, 0, 59, 0);
                }
                
                if (startDate && endDate) {
                    params.start_datetime = startDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                    params.end_datetime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                }
            } else if (filters.log_date) {
                const startDate = new Date(filters.log_date + 'T00:00:00Z');
                const endDate = new Date(filters.log_date + 'T23:59:59Z');
                params.start_datetime = startDate.toISOString();
                params.end_datetime = endDate.toISOString();
            } else if (filters.start_date && filters.end_date) {
                const startDate = new Date(filters.start_date + 'T00:00:00Z');
                const endDate = new Date(filters.end_date + 'T23:59:59Z');
                params.start_datetime = startDate.toISOString();
                params.end_datetime = endDate.toISOString();
            }
            
            const res = await productionApi.getStoppagesSummary(params);
            let reportData = res.data?.data?.data || res.data?.data || [];
            reportData = reportData.filter(r => !r.pet_name?.toLowerCase().includes('can'));
            
            // Extract production_date from report_code (e.g., "PR-2026-04-07-NIGHT" -> "2026-04-07")
            reportData = reportData.map(r => {
                let prodDate = r.production_date;
                if (!prodDate && r.report_code) {
                    const match = r.report_code.match(/PR-(\d{4}-\d{2}-\d{2})/);
                    if (match) prodDate = match[1];
                }
                return {
                    ...r,
                    production_date: prodDate || r.log_date
                };
            });
            
            // Don't filter by date when timeRange is active - let the chart show all dates with 0 for missing data
            
            reportData.sort((a, b) => new Date(a.production_date) - new Date(b.production_date));
            
            setData(reportData);
        } catch (err) {
            console.error('Failed to fetch OEE data:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [filters.pet, filters.shift, filters.log_date, filters.start_date, filters.end_date, timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // Reset timeRange when manual date filters are cleared
        if (!filters.log_date && !filters.start_date && !filters.end_date && timeRange === 'all') {
            setTimeRange('month');
        }
    }, [filters.log_date, filters.start_date, filters.end_date, timeRange]);

    const weekRange = useMemo(() => {
        if (timeRange !== 'week') return null;
        const { start, end } = getWeekRange();
        return `${formatDateShort(start)} - ${formatDateShort(end)}`;
    }, [timeRange]);

    const dateRangeLabel = useMemo(() => {
        if (weekRange) return weekRange;
        if (!data.length) return '';
        const dates = data.map(d => d.production_date).filter(Boolean);
        if (!dates.length) return '';
        const minDate = dates.reduce((a, b) => a < b ? a : b);
        const maxDate = dates.reduce((a, b) => a > b ? a : b);
        return `${minDate} to ${maxDate}`;
    }, [data, weekRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const selectedPetName = useMemo(() => {
        if (!filters.pet || !pets.length) return null;
        const pet = pets.find(p => p.id === parseInt(filters.pet));
        return pet?.pet_name || null;
    }, [filters.pet, pets]);

    const stats = useMemo(() => {
        if (!data.length) return { avgOee: 0, avgAvail: 0, avgQuality: 0, avgPerf: 0, bestOee: 0, worstOee: 0, totalOutput: 0, totalDowntime: 0, oeeStatus: null, isSingleDate: false };
        
        const uniqueDates = new Set(data.map(d => d.production_date?.slice(0, 10))).size;
        const isSingleDate = uniqueDates === 1 || filters.log_date;
        
        const oees = data.map(d => parseFloat(d.efficiency) || d.metrics?.oee || 0);
        const avails = data.map(d => d.metrics?.availability || 0);
        const qualities = data.map(d => d.metrics?.quality || 0);
        const perfs = data.map(d => d.metrics?.performance || 0);
        const avgOee = oees.reduce((a, b) => a + b, 0) / oees.length;
        
        const bestOee = Math.max(...oees);
        const worstOee = Math.min(...oees);
        const bestPet = data.find(d => (parseFloat(d.efficiency) || d.metrics?.oee || 0) === bestOee)?.pet_name || '';
        const worstPet = data.find(d => (parseFloat(d.efficiency) || d.metrics?.oee || 0) === worstOee)?.pet_name || '';
        
        return {
            avgOee,
            avgAvail: avails.reduce((a, b) => a + b, 0) / avails.length,
            avgQuality: qualities.reduce((a, b) => a + b, 0) / qualities.length,
            avgPerf: perfs.reduce((a, b) => a + b, 0) / perfs.length,
            bestOee,
            worstOee,
            bestPet,
            worstPet,
            totalOutput: data.reduce((sum, d) => sum + (d.bottles_produced || d.total_bottles_produced || d.metrics?.details?.total_output_pcs || 0), 0),
            totalDowntime: data.reduce((sum, d) => sum + (d.downtime_minutes || d.metrics?.details?.total_downtime_mins || 0), 0),
            oeeStatus: getStatusConfig(avgOee),
            isSingleDate,
            reportCount: data.length
        };
    }, [data, filters.log_date]);

    const trendData = useMemo(() => {
        if (!data.length) return [];
        
        let minDate, maxDate;
        
        if (timeRange === 'week') {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            // If before 6am, use previous day for week calculation
            if (currentTime < '06:00') {
                now.setDate(now.getDate() - 1);
            }
            const dayOfWeek = now.getDay();
            minDate = new Date(now);
            minDate.setDate(now.getDate() - dayOfWeek);
            minDate.setHours(0, 0, 0, 0);
            maxDate = new Date(minDate);
            maxDate.setDate(minDate.getDate() + 6);
        } else if (timeRange === 'month') {
            const now = new Date();
            minDate = new Date(now.getFullYear(), now.getMonth(), 1);
            maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (timeRange === 'quarter') {
            const now = new Date();
            const currentQuarter = Math.floor(now.getMonth() / 3);
            minDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            maxDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
        } else {
            const dates = data.map(d => d.production_date).filter(Boolean);
            if (!dates.length) return [];
            minDate = new Date(Math.min(...dates.map(d => new Date(d))));
            maxDate = new Date(Math.max(...dates.map(d => new Date(d))));
        }
        
        const allDates = [];
        for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
            allDates.push(new Date(d).toISOString().split('T')[0]);
        }
        
        const grouped = {};
        data.forEach(d => {
            const date = d.production_date?.slice(0, 10) || '';
            if (!grouped[date]) grouped[date] = { oee: 0, availability: 0, quality: 0, performance: 0, count: 0 };
            grouped[date].oee += parseFloat(d.efficiency) || d.metrics?.oee || 0;
            grouped[date].availability += d.metrics?.availability || 0;
            grouped[date].quality += d.metrics?.quality || 0;
            grouped[date].performance += d.metrics?.performance || 0;
            grouped[date].count += 1;
        });
        
        return allDates.map(date => ({
            date: date.slice(5, 10),
            fullDate: date,
            oee: grouped[date] ? (grouped[date].oee / grouped[date].count).toFixed(1) : '0.0',
            availability: grouped[date] ? (grouped[date].availability / grouped[date].count).toFixed(1) : '0.0',
            quality: grouped[date] ? (grouped[date].quality / grouped[date].count).toFixed(1) : '0.0',
            performance: grouped[date] ? (grouped[date].performance / grouped[date].count).toFixed(1) : '0.0'
        }));
    }, [data, timeRange, filters]);

    const byPetData = useMemo(() => {
        const allPets = {};
        
        // Only show PETs that have data
        data.forEach(d => {
            const pet = d.pet_name || 'Unknown';
            if (!allPets[pet]) allPets[pet] = { oee: 0, avail: 0, quality: 0, perf: 0, count: 0 };
            allPets[pet].oee += parseFloat(d.efficiency) || d.metrics?.oee || 0;
            allPets[pet].avail += d.metrics?.availability || 0;
            allPets[pet].quality += d.metrics?.quality || 0;
            allPets[pet].perf += d.metrics?.performance || 0;
            allPets[pet].count += 1;
        });
        
        return Object.entries(allPets).map(([name, vals]) => ({
            name,
            oee: vals.count > 0 ? (vals.oee / vals.count).toFixed(1) : '0.0',
            availability: vals.count > 0 ? (vals.avail / vals.count).toFixed(1) : '0.0',
            quality: vals.count > 0 ? (vals.quality / vals.count).toFixed(1) : '0.0',
            performance: vals.count > 0 ? (vals.perf / vals.count).toFixed(1) : '0.0'
        })).sort((a, b) => parseFloat(b.oee) - parseFloat(a.oee));
    }, [data]);

    const radarData = useMemo(() => {
        return [
            { metric: 'OEE', value: stats.avgOee, fullMark: 100 },
            { metric: 'Availability', value: stats.avgAvail, fullMark: 100 },
            { metric: 'Quality', value: stats.avgQuality, fullMark: 100 },
            { metric: 'Performance', value: stats.avgPerf, fullMark: 100 }
        ];
    }, [stats]);

    const dailyOeeData = useMemo(() => {
        if (!data.length) return [];
        
        // Determine date range based on time range selection
        let minDate, maxDate;
        
        if (timeRange === 'week') {
            // Always show full week from Sunday to Saturday when week is selected
            const now = new Date();
            const dayOfWeek = now.getDay();
            minDate = new Date(now);
            minDate.setDate(now.getDate() - dayOfWeek);
            minDate.setHours(0, 0, 0, 0);
            maxDate = new Date(minDate);
            maxDate.setDate(minDate.getDate() + 6);
        } else if (!filters.log_date && !filters.start_date && !filters.end_date) {
            const now = new Date();
            if (timeRange === 'month') {
                // Show full month
                minDate = new Date(now.getFullYear(), now.getMonth(), 1);
                maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            } else {
                // Use actual data range
                const dates = data.map(d => d.production_date).filter(Boolean);
                if (!dates.length) return [];
                minDate = new Date(Math.min(...dates.map(d => new Date(d))));
                maxDate = new Date(Math.max(...dates.map(d => new Date(d))));
            }
        } else {
            // Use actual data range
            const dates = data.map(d => d.production_date).filter(Boolean);
            if (!dates.length) return [];
            minDate = new Date(Math.min(...dates.map(d => new Date(d))));
            maxDate = new Date(Math.max(...dates.map(d => new Date(d))));
        }
        
        // Create all dates in range
        const allDates = [];
        for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
            allDates.push(new Date(d).toISOString().split('T')[0]);
        }
        
        // Group existing data
        const grouped = {};
        data.forEach(d => {
            const date = d.production_date?.slice(0, 10) || '';
            if (!grouped[date]) grouped[date] = { oee: 0, count: 0, output: 0 };
            grouped[date].oee += parseFloat(d.efficiency) || d.metrics?.oee || 0;
            grouped[date].output += d.bottles_produced || d.total_bottles_produced || d.metrics?.details?.total_output_pcs || 0;
            grouped[date].count += 1;
        });
        
        // Fill all dates with data or zeros
        return allDates.map(date => ({
            date: date.slice(5, 10),
            avgOee: grouped[date] ? (grouped[date].oee / grouped[date].count).toFixed(1) : '0.0',
            output: grouped[date] ? grouped[date].output : 0
        }));
    }, [data, timeRange, filters]);

    const oeeDistribution = useMemo(() => {
        const ranges = { 'Below 60%': 0, '60-70%': 0, '70-80%': 0, '80-85%': 0, '85-90%': 0, 'Above 90%': 0 };
        data.forEach(d => {
            const oee = parseFloat(d.efficiency) || d.metrics?.oee || 0;
            if (oee < 60) ranges['Below 60%']++;
            else if (oee < 70) ranges['60-70%']++;
            else if (oee < 80) ranges['70-80%']++;
            else if (oee < 85) ranges['80-85%']++;
            else if (oee < 90) ranges['85-90%']++;
            else ranges['Above 90%']++;
        });
        return Object.entries(ranges).map(([name, value]) => ({ name, value }));
    }, [data]);

    const getOeeStatus = (value) => {
        if (value >= 85) return { color: 'success', label: 'World Class' };
        if (value >= 70) return { color: 'warning', label: 'Typical' };
        return { color: 'danger', label: 'Improvement Needed' };
    };

    const tableData = useMemo(() => {
        return data.map(d => ({
            Date: d.production_date?.slice(0, 10) || '',
            'PET Line': d.pet_name || 'Unknown',
            Shift: d.shift_name || '-',
            OEE: `${(parseFloat(d.efficiency) || d.metrics?.oee || 0).toFixed(1)}%`,
            Availability: `${(d.metrics?.availability || 0).toFixed(1)}%`,
            Quality: `${(d.metrics?.quality || 0).toFixed(1)}%`,
            Performance: `${(d.metrics?.performance || 0).toFixed(1)}%`,
            Output: d.bottles_produced || d.total_bottles_produced || d.metrics?.details?.total_output_pcs || 0,
            Downtime: `${d.downtime_minutes || d.metrics?.details?.total_downtime_mins || 0} min`
        }));
    }, [data]);

    const byPetTableData = useMemo(() => {
        return byPetData.map((d, idx) => ({
            Rank: idx + 1,
            'PET Line': d.name,
            OEE: `${d.oee}%`,
            Availability: `${d.availability}%`,
            Quality: `${d.quality}%`,
            Performance: `${d.perf}%`
        }));
    }, [byPetData]);

    const handleExportExcel = () => {
        const combined = [...tableData, ...[{}], ...byPetTableData.map(d => ({ ...d, 'PET Line': `Summary: ${d['PET Line']}` }))];
        const title = `OEE Analytics (${dateRangeLabel})`;
        exportToExcel(combined, `oee_analytics_${new Date().toISOString().slice(0, 10)}`, 'OEE Analytics', title);
    };

    const handleExportPDF = async () => {
        const chartIds = ['oee-trend-chart', 'oee-distribution-chart', 'oee-breakdown-chart', 'oee-radar-chart'];
        for (const id of chartIds) {
            if (document.getElementById(id)) {
                await exportChartToPDF(id, `oee_${id}`, id.replace(/-/g, ' ').replace(/oee /g, '').toUpperCase());
            }
        }
    };

    const exportChart = async (chartId, filename) => {
        if (document.getElementById(chartId)) {
            const title = `${chartId.replace(/-/g, ' ').toUpperCase()} (${dateRangeLabel})`;
            await exportChartToPDF(chartId, `${filename}_${dateRangeLabel.replace(/ to /g, '_')}`, title);
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded shadow-lg border" style={{ minWidth: 160 }}>
                    <p className="fw-bold mb-2 border-bottom pb-2">{label}</p>
                    {payload.map((entry, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center mb-1">
                            <span className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                                <span>{entry.name}:</span>
                            </span>
                            <span className="fw-medium ms-2">{typeof entry.value === 'number' ? `${entry.value}%` : entry.value}</span>
                        </div>
                    ))}
                    {payload.some(p => p.dataKey === 'avgOee' || p.name?.includes('OEE')) && (
                        <div className="mt-2 pt-2 border-top">
                            <span className="text-muted small">Target: {OEE_TARGET}%</span>
                        </div>
                    )}
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
                    <small className="text-muted">Overall Equipment Effectiveness analysis and trends</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                    <div className="btn-group btn-group-sm" role="group">
                        <button type="button" className={`btn ${timeRange === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('week')}>Week</button>
                        <button type="button" className={`btn ${timeRange === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('month')}>Month</button>
                        <button type="button" className={`btn ${timeRange === 'quarter' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('quarter')}>Quarter</button>
                    </div>
                    <button className="btn btn-outline-secondary btn-sm" onClick={fetchData}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <div className="btn-group btn-group-sm">
                        <button type="button" className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('chart')}>
                            <i className="ti ti-chart-line me-1"></i>Chart
                        </button>
                        <button type="button" className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('table')}>
                            <i className="ti ti-table me-1"></i>Table
                        </button>
                    </div>
                    {viewMode === 'table' ? (
                        <button className="btn btn-success btn-sm" onClick={handleExportExcel}>
                            <i className="ti ti-file-spreadsheet me-1"></i>Export Excel
                        </button>
                    ) : (
                        <button className="btn btn-danger btn-sm" onClick={handleExportPDF}>
                            <i className="ti ti-file-type-pdf me-1"></i>Export PDF
                        </button>
                    )}
                </div>
            </div>

            <FilterInputs />

            {(filters.pet || filters.shift || filters.log_date || filters.start_date || filters.end_date) && (
                <div className="alert alert-info d-flex align-items-center mb-3" role="alert">
                    <i className="ti ti-filter me-2"></i>
                    <span>
                        Filtered by: {filters.pet && <strong>PET Line: {pets.find(p => p.id === parseInt(filters.pet))?.pet_name || filters.pet}</strong>}
                        {filters.pet && (filters.shift || filters.log_date || filters.start_date) && ' | '}
                        {filters.shift && <strong>Shift: {filters.shift}</strong>}
                        {filters.shift && (filters.log_date || filters.start_date) && ' | '}
                        {filters.log_date && <strong>Date: {filters.log_date}</strong>}
                        {filters.start_date && filters.end_date && <strong>Date Range: {filters.start_date} to {filters.end_date}</strong>}
                    </span>
                </div>
            )}

            <div className="row row-gap-3 mb-4">
                {loading ? (
                    <>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="col-xl-3 col-sm-6">
                                <div className="card border-top border-secondary border-3 mb-0 h-100">
                                    <div className="card-body d-flex align-items-center justify-content-center" style={{ minHeight: 120 }}>
                                        <span className="spinner-border text-primary" role="status" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <div className="col-xl-3 col-sm-6">
                            <div className={`card border-top border-${stats.oeeStatus?.color === 'success' ? 'success' : stats.oeeStatus?.color === 'warning' ? 'warning' : 'danger'} border-3 mb-0 h-100`}>
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Average OEE</p>
                                        <span className={`badge bg-${stats.oeeStatus?.bgClass?.replace('bg-', '')} text-${stats.oeeStatus?.color}`}>
                                            {stats.oeeStatus?.label || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <h2 className="mb-1 fs-16 fw-bold">{stats.avgOee.toFixed(1)}%</h2>
                                        <div className="progress w-50" style={{ height: 6 }} title={`Target: ${OEE_TARGET}%`}>
                                            <div className={`progress-bar bg-${stats.oeeStatus?.color}`} role="progressbar" style={{ width: `${Math.min(stats.avgOee, 100)}%` }} />
                                        </div>
                                    </div>
                                    <small className="text-muted">{selectedPetName || `Target: ${OEE_TARGET}%`}</small>
                                </div>
                            </div>
                        </div>
                {/* Component breakdown cards hidden - stoppages_summary only provides OEE */}
                {false && stats.isSingleDate ? (
                    <>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-primary border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Availability</p>
                                        <span className="badge bg-primary-subtle text-primary">A</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgAvail.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-primary" role="progressbar" style={{ width: `${Math.min(stats.avgAvail, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Performance</p>
                                        <span className="badge bg-success-subtle text-success">P</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgPerf.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(stats.avgPerf, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-warning border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Quality</p>
                                        <span className="badge bg-warning-subtle text-warning">Q</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgQuality.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-warning" role="progressbar" style={{ width: `${Math.min(stats.avgQuality, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Best OEE</p>
                                        <span className="badge bg-success-subtle text-success">Peak</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.bestOee.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(stats.bestOee, 100)}%` }} />
                                    </div>
                                    <small className="text-muted mt-1">{stats.bestPet || (selectedPetName || '')}</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-warning border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Worst OEE</p>
                                        <span className="badge bg-warning-subtle text-warning">Attention</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.worstOee.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-warning" role="progressbar" style={{ width: `${Math.min(stats.worstOee, 100)}%` }} />
                                    </div>
                                    <small className="text-muted mt-1">{stats.worstPet || (selectedPetName || '')}</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Total Output</p>
                                        <span className="badge bg-info-subtle text-info">{data.length} Reports</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.totalOutput.toLocaleString()}</h2>
                                    <small className="text-muted">{selectedPetName || 'pcs produced'}</small>
                                </div>
                            </div>
                        </div>
                    </>
                )}
                </>
            )}
            </div>

            {viewMode === 'chart' ? (
                <>
                    <div className="row mb-4">
                        <div className="col-lg-8">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">OEE Trend Over Time</h6>
                                        <small className="text-muted">Daily average OEE performance {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <div className="btn-group btn-group-sm">
                                            <button type="button" className={`btn ${chartType === 'line' ? 'btn-primary' : 'btn-light'}`} onClick={() => setChartType('line')}>Line</button>
                                            <button type="button" className={`btn ${chartType === 'area' ? 'btn-primary' : 'btn-light'}`} onClick={() => setChartType('area')}>Area</button>
                                            <button type="button" className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-light'}`} onClick={() => setChartType('bar')}>Bar</button>
                                        </div>
                                        <button className="btn btn-danger btn-sm" onClick={() => exportChart('oee-trend-chart', 'oee_trend')}>
                                            <i className="ti ti-file-type-pdf me-1"></i>Export
                                        </button>
                                    </div>
                                </div>
                                <div className="card-body" id="oee-trend-chart">
                                    {loading ? (
                                        <div className="text-center py-5"><span className="spinner-border text-primary" role="status" /></div>
                                    ) : dailyOeeData.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data available</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={350}>
                                            {chartType === 'area' ? (
                                                <AreaChart data={dailyOeeData}>
                                                    <defs>
                                                        <linearGradient id="oeeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(dailyOeeData.length / 10)} tickLine={false} label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} label={{ value: 'OEE (%)', angle: -90, position: 'insideLeft' }} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend />
                                                    <Area type="monotone" dataKey="avgOee" stroke="#3b82f6" fill="url(#oeeAreaGradient)" name="OEE %" />
                                                </AreaChart>
                                            ) : chartType === 'bar' ? (
                                                <BarChart data={dailyOeeData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(dailyOeeData.length / 10)} tickLine={false} label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} label={{ value: 'OEE (%)', angle: -90, position: 'insideLeft' }} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="avgOee" fill="#3b82f6" radius={[4, 4, 0, 0]} name="OEE %" />
                                                </BarChart>
                                            ) : (
                                                <LineChart data={dailyOeeData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(dailyOeeData.length / 10)} tickLine={false} label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} label={{ value: 'OEE (%)', angle: -90, position: 'insideLeft' }} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Line type="monotone" dataKey="avgOee" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="OEE %" />
                                                </LineChart>
                                            )}
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">OEE Distribution</h6>
                                        <small className="text-muted">Reports by OEE range {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('oee-distribution-chart', 'oee_distribution')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="oee-distribution-chart">
                                    {oeeDistribution.every(d => d.value === 0) ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <PieChart>
                                                    <Pie data={oeeDistribution} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                                                        {oeeDistribution.map((_, idx) => (
                                                            <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3">
                                                {oeeDistribution.filter(d => d.value > 0).map((range, idx) => (
                                                    <div key={range.name} className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="f-14">
                                                            <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[oeeDistribution.indexOf(range) % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                            {range.name}
                                                        </span>
                                                        <span className="badge bg-light text-dark">{range.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">OEE Breakdown by PET Line</h6>
                                        <small className="text-muted">Comparison across all production lines {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('oee-breakdown-chart', 'oee_breakdown')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="oee-breakdown-chart">
                                    {byPetData.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={byPetData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: 'OEE (%)', position: 'insideBottom', offset: -5 }} />
                                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} label={{ value: 'PET Line', angle: -90, position: 'insideLeft' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar dataKey="oee" fill="#3b82f6" name="OEE %" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">OEE Component Radar</h6>
                                        <small className="text-muted">Availability, Quality, Performance breakdown {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('oee-radar-chart', 'oee_radar')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="oee-radar-chart">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <RadarChart data={radarData}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                                            <Radar name="Current" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                            <Radar name="Target (85%)" dataKey="fullMark" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeDasharray="5 5" />
                                            <Tooltip />
                                            <Legend />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Detailed Trend Data</h6>
                                <small className="text-muted">All metrics over time ({data.length} reports) {dateRangeLabel && `- ${dateRangeLabel}`}</small>
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={() => exportChart('detailed-trend-chart', 'detailed_trend')}>
                                <i className="ti ti-file-type-pdf me-1"></i>Export
                            </button>
                        </div>
                        <div className="card-body p-0">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border text-primary" role="status" /></div>
                            ) : data.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="ti ti-chart-line fs-1 text-muted mb-3 d-block"></i>
                                    <p className="text-muted">No OEE data available</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart data={trendData}>
                                        <defs>
                                            <linearGradient id="oeeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(trendData.length / 10)} tickLine={false} label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Line type="monotone" dataKey="oee" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="OEE" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="card mb-4">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">OEE Summary by PET Line</h6>
                                <small className="text-muted">Average metrics per production line {dateRangeLabel && `(${dateRangeLabel})`}</small>
                            </div>
                            <button className="btn btn-success btn-sm" onClick={() => {
                                const petSummary = byPetData.map((pet, idx) => ({
                                    'Rank': idx + 1,
                                    'PET Line': pet.name,
                                    'OEE': pet.oee + '%',
                                    'Availability': pet.availability + '%',
                                    'Quality': pet.quality + '%',
                                    'Performance': pet.performance + '%'
                                }));
                                const title = `OEE Summary by PET Line (${dateRangeLabel})`;
                                exportToExcel(petSummary, `oee_summary_by_pet_${dateRangeLabel.replace(/ to /g, '_')}`, 'PET Summary', title);
                            }}>
                                <i className="ti ti-file-spreadsheet me-1"></i>Export
                            </button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0" style={{ fontSize: '0.875rem' }}>
                                    <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                        <tr>
                                            <th className="py-3 px-3 fw-semibold text-muted" style={{ width: '60px' }}>Rank</th>
                                            <th className="py-3 px-3 fw-semibold text-muted">PET Line</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">OEE</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Availability</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Quality</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Performance</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byPetData.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center text-muted py-4">No data available</td></tr>
                                        ) : (
                                            byPetData.map((pet, idx) => {
                                                const oee = parseFloat(pet.oee);
                                                const status = getStatusConfig(oee);
                                                return (
                                                    <tr key={pet.name} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className={`badge ${idx === 0 ? 'bg-primary' : 'bg-light text-dark'}`} style={{ fontSize: '0.75rem' }}>
                                                                #{idx + 1}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 fw-medium">{pet.name}</td>
                                                        <td className="py-3 px-3 text-end">{pet.oee}%</td>
                                                        <td className="py-3 px-3 text-end">{pet.availability}%</td>
                                                        <td className="py-3 px-3 text-end">{pet.quality}%</td>
                                                        <td className="py-3 px-3 text-end">{pet.performance}%</td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className={`badge bg-${status.bgClass?.replace('bg-', '')} text-${status.color}`} style={{ fontSize: '0.75rem' }}>
                                                                {status.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Detailed OEE Records</h6>
                                <small className="text-muted">{data.length} production records {dateRangeLabel && `(${dateRangeLabel})`}</small>
                            </div>
                            <button className="btn btn-success btn-sm" onClick={() => {
                                const title = `Detailed OEE Records (${dateRangeLabel})`;
                                exportToExcel(tableData, `detailed_oee_records_${dateRangeLabel.replace(/ to /g, '_')}`, 'OEE Records', title);
                            }}>
                                <i className="ti ti-file-spreadsheet me-1"></i>Export
                            </button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <table className="table table-sm mb-0" style={{ fontSize: '0.875rem' }}>
                                    <thead className="sticky-top" style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                        <tr>
                                            <th className="py-3 px-3 fw-semibold text-muted">Date</th>
                                            <th className="py-3 px-3 fw-semibold text-muted">PET Line</th>
                                            <th className="py-3 px-3 fw-semibold text-muted">Shift</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">OEE</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Availability</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Quality</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Performance</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Output</th>
                                            <th className="py-3 px-3 fw-semibold text-muted text-end">Downtime</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={9} className="text-center py-4"><span className="spinner-border text-primary" /></td></tr>
                                        ) : tableData.length === 0 ? (
                                            <tr><td colSpan={9} className="text-center text-muted py-4">No data available</td></tr>
                                        ) : (
                                            tableData.map((row, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                    <td className="py-2 px-3">{row.Date}</td>
                                                    <td className="py-2 px-3">{row['PET Line']}</td>
                                                    <td className="py-2 px-3">{row.Shift}</td>
                                                    <td className="py-2 px-3 text-end">{row.OEE}</td>
                                                    <td className="py-2 px-3 text-end">{row.Availability}</td>
                                                    <td className="py-2 px-3 text-end">{row.Quality}</td>
                                                    <td className="py-2 px-3 text-end">{row.Performance}</td>
                                                    <td className="py-2 px-3 text-end">{(row.Output || 0).toLocaleString()}</td>
                                                    <td className="py-2 px-3 text-end">{row.Downtime}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default OeeAnalytics;
