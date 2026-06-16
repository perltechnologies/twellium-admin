import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { exportToExcel, exportChartToPDF } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';
import { buildFilterParams } from '../../utils/filterParams';

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const SHIFT_COLORS = { 'Morning': '#f59e0b', 'Afternoon': '#3b82f6', 'Night': '#8b5cf6', 'Day': '#22c55e' };
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
    if (value >= target) return { color: 'success', bgClass: 'bg-success-subtle', textClass: 'text-success', label: 'Good' };
    if (value >= target - 15) return { color: 'warning', bgClass: 'bg-warning-subtle', textClass: 'text-warning', label: 'Fair' };
    return { color: 'danger', bgClass: 'bg-danger-subtle', textClass: 'text-danger', label: 'Poor' };
};

const ProductionAnalytics = () => {
    const { filters } = useFilters();
    const [oeeData, setOeeData] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);
    const [activeTab, setActiveTab] = useState('output');
    const [viewMode, setViewMode] = useState('chart');
    const [timeRange, setTimeRange] = useState('week');

    useEffect(() => {
        productionApi.getPets({ page_size: 100 })
            .then(res => { const d = res.data?.data ?? res.data; setPets((Array.isArray(d) ? d : (d?.results || [])).filter(p => !p.pet_name?.toLowerCase().includes('can'))); })
            .catch(err => console.error('Failed to load pets:', err));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page_size: 1000 };
            const oeeParams = { page_size: 1000 };
            
            if (filters.pet) {
                params.pet = filters.pet;
                oeeParams.pet = filters.pet;
            }
            
            // Always use timeRange for data fetching if set, ignore manual date filters for fetching
            if (timeRange && timeRange !== 'all') {
                const now = new Date();
                const currentTime = now.toTimeString().slice(0, 5);
                // If before 6am, use previous day for calculations
                if (currentTime < '06:00') {
                    now.setDate(now.getDate() - 1);
                }
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
                    params.production_date_after = startDate.toISOString().split('T')[0];
                    params.production_date_before = endDate.toISOString().split('T')[0];
                    oeeParams.start_date = startDate.toISOString().split('T')[0];
                    oeeParams.end_date = endDate.toISOString().split('T')[0];
                }
            } else if (filters.log_date) {
                params.production_date = filters.log_date;
                oeeParams.start_date = filters.log_date;
                oeeParams.end_date = filters.log_date;
            } else if (filters.start_date && filters.end_date) {
                params.production_date_after = filters.start_date;
                params.production_date_before = filters.end_date;
                oeeParams.start_date = filters.start_date;
                oeeParams.end_date = filters.end_date;
            }
            
            const [oeeRes, reportsRes] = await Promise.all([
                productionApi.getOeeSummary(oeeParams),
                productionApi.getReports(params)
            ]);
            
            let oeeList = Array.isArray(oeeRes.data) ? oeeRes.data : (oeeRes.data?.data?.results || oeeRes.data?.data || oeeRes.data?.results || []);
            let reportsList = Array.isArray(reportsRes.data) ? reportsRes.data : (reportsRes.data?.data?.results || reportsRes.data?.data || reportsRes.data?.results || []);
            
            oeeList = oeeList.filter(r => !r.pet_name?.toLowerCase().includes('can'));
            reportsList = reportsList.filter(r => !r.pet_name?.toLowerCase().includes('can'));
            
            // Don't filter by date when timeRange is active - let the chart show all dates with 0 for missing data
            
            oeeList.sort((a, b) => new Date(a.production_date) - new Date(b.production_date));
            reportsList.sort((a, b) => new Date(b.production_date) - new Date(a.production_date));
            
            setOeeData(oeeList);
            setReports(reportsList);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }, [filters.pet, filters.log_date, filters.start_date, filters.end_date, timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // When manual date filters are applied, switch to 'all' mode so they take precedence
        if (filters.log_date || filters.start_date || filters.end_date) {
            setTimeRange('all');
        }
    }, [filters.log_date, filters.start_date, filters.end_date]);

    const weekRange = useMemo(() => {
        if (timeRange !== 'week') return null;
        const { start, end } = getWeekRange();
        return `${formatDateShort(start)} - ${formatDateShort(end)}`;
    }, [timeRange]);

    const dateRangeLabel = useMemo(() => {
        const allDates = [...reports.map(r => r.production_date), ...oeeData.map(r => r.production_date)].filter(Boolean);
        if (!allDates.length) return '';
        const minDate = allDates.reduce((a, b) => a < b ? a : b);
        const maxDate = allDates.reduce((a, b) => a > b ? a : b);
        return minDate === maxDate ? minDate : `${minDate} to ${maxDate}`;
    }, [reports, oeeData]);

    const stats = useMemo(() => {
        if (!reports.length) return { totalOutput: 0, avgOutput: 0, reportCount: 0, avgOee: 0, totalDowntime: 0, uniqueLines: 0, oeeStatus: null, isSingleDate: false, avgAvail: 0, avgQuality: 0, avgPerf: 0 };
        
        const allDates = [...reports.map(r => r.production_date), ...oeeData.map(r => r.production_date)].filter(Boolean);
        const uniqueDates = new Set(allDates.map(d => d?.slice(0, 10))).size;
        const isSingleDate = uniqueDates === 1 || filters.log_date;
        
        const totalOutput = reports.reduce((sum, r) => sum + (r.total_bottles_produced || r.bottles_produced || r.metrics?.details?.total_output_pcs || 0), 0);
        const totalDowntime = oeeData.reduce((sum, r) => sum + (r.metrics?.details?.total_downtime_mins || 0), 0);
        const totalOee = oeeData.reduce((sum, r) => sum + (r.metrics?.oee || 0), 0);
        const avgOee = oeeData.length > 0 ? totalOee / oeeData.length : 0;
        
        const totalAvail = oeeData.reduce((sum, r) => sum + (r.metrics?.availability || 0), 0);
        const totalQuality = oeeData.reduce((sum, r) => sum + (r.metrics?.quality || 0), 0);
        const totalPerf = oeeData.reduce((sum, r) => sum + (r.metrics?.performance || 0), 0);
        
        return {
            totalOutput,
            avgOutput: Math.round(totalOutput / reports.length),
            reportCount: reports.length,
            avgOee,
            totalDowntime,
            uniqueLines: new Set([...reports.map(r => r.pet_name), ...oeeData.map(r => r.pet_name)]).size,
            oeeStatus: getStatusConfig(avgOee),
            isSingleDate,
            avgAvail: oeeData.length > 0 ? totalAvail / oeeData.length : 0,
            avgQuality: oeeData.length > 0 ? totalQuality / oeeData.length : 0,
            avgPerf: oeeData.length > 0 ? totalPerf / oeeData.length : 0
        };
    }, [reports, oeeData, filters.log_date]);

    const outputByPet = useMemo(() => {
        const grouped = {};
        [...reports, ...oeeData].forEach(r => {
            const pet = r.pet_name || 'Unknown';
            const output = r.total_bottles_produced || r.bottles_produced || r.metrics?.details?.total_output_pcs || 0;
            if (!grouped[pet]) grouped[pet] = 0;
            grouped[pet] += output;
        });
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [reports, oeeData]);

    const outputByShift = useMemo(() => {
        const grouped = {};
        [...reports, ...oeeData].forEach(r => {
            const shift = r.shift_name || 'Unknown';
            const output = r.total_bottles_produced || r.bottles_produced || r.metrics?.details?.total_output_pcs || 0;
            if (!grouped[shift]) grouped[shift] = 0;
            grouped[shift] += output;
        });
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [reports, oeeData]);

    const dailyOutputData = useMemo(() => {
        const allData = [...reports, ...oeeData];
        if (!allData.length) return [];
        
        // Determine date range
        let minDate, maxDate;
        
        if (timeRange === 'week') {
            // Show full week from Sunday to Saturday
            const now = new Date();
            const dayOfWeek = now.getDay();
            minDate = new Date(now);
            minDate.setDate(now.getDate() - dayOfWeek);
            minDate.setHours(0, 0, 0, 0);
            maxDate = new Date(minDate);
            maxDate.setDate(minDate.getDate() + 6);
        } else if (timeRange === 'month') {
            // Show full month
            const now = new Date();
            minDate = new Date(now.getFullYear(), now.getMonth(), 1);
            maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (timeRange === 'quarter') {
            // Show full quarter
            const now = new Date();
            const currentQuarter = Math.floor(now.getMonth() / 3);
            minDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            maxDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
        } else {
            // Use actual data range
            const dates = allData.map(r => r.production_date).filter(Boolean);
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
        allData.forEach(r => {
            const date = r.production_date?.slice(0, 10) || '';
            const output = r.total_bottles_produced || r.bottles_produced || r.metrics?.details?.total_output_pcs || 0;
            if (!grouped[date]) grouped[date] = { output: 0, count: 0 };
            grouped[date].output += output;
            grouped[date].count += 1;
        });
        
        // Fill all dates
        return allDates.map(date => ({
            date: date.slice(5, 10),
            output: grouped[date] ? grouped[date].output : 0,
            count: grouped[date] ? grouped[date].count : 0
        }));
    }, [reports, oeeData, timeRange, filters]);

    const dailyOeeData = useMemo(() => {
        if (!oeeData.length) return [];
        
        // Determine date range
        let minDate, maxDate;
        
        if (timeRange === 'week') {
            // Show full week from Sunday to Saturday
            const now = new Date();
            const dayOfWeek = now.getDay();
            minDate = new Date(now);
            minDate.setDate(now.getDate() - dayOfWeek);
            minDate.setHours(0, 0, 0, 0);
            maxDate = new Date(minDate);
            maxDate.setDate(minDate.getDate() + 6);
        } else if (timeRange === 'month') {
            // Show full month
            const now = new Date();
            minDate = new Date(now.getFullYear(), now.getMonth(), 1);
            maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (timeRange === 'quarter') {
            // Show full quarter
            const now = new Date();
            const currentQuarter = Math.floor(now.getMonth() / 3);
            minDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            maxDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
        } else {
            // Use actual data range
            const dates = oeeData.map(r => r.production_date).filter(Boolean);
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
        oeeData.forEach(r => {
            const date = r.production_date?.slice(0, 10) || '';
            if (!grouped[date]) grouped[date] = { oee: 0, count: 0 };
            grouped[date].oee += r.metrics?.oee || 0;
            grouped[date].count += 1;
        });
        
        // Fill all dates
        return allDates.map(date => ({
            date: date.slice(5, 10),
            oee: grouped[date] ? (grouped[date].oee / grouped[date].count).toFixed(1) : '0.0'
        }));
    }, [oeeData, timeRange, filters]);

    const combinedDailyData = useMemo(() => {
        const merged = {};
        dailyOutputData.forEach(d => { merged[d.date] = { ...d, date: d.date }; });
        dailyOeeData.forEach(d => { 
            if (merged[d.date]) merged[d.date].oee = d.oee;
        });
        return Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
    }, [dailyOutputData, dailyOeeData]);

    const downtimeByPet = useMemo(() => {
        const grouped = {};
        oeeData.forEach(r => {
            const pet = r.pet_name || 'Unknown';
            const downtime = r.metrics?.details?.total_downtime_mins || 0;
            if (!grouped[pet]) grouped[pet] = 0;
            grouped[pet] += downtime;
        });
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [oeeData]);

    const efficiencyByPet = useMemo(() => {
        const grouped = {};
        oeeData.forEach(r => {
            const pet = r.pet_name || 'Unknown';
            if (!grouped[pet]) grouped[pet] = { oee: 0, count: 0 };
            grouped[pet].oee += r.metrics?.oee || 0;
            grouped[pet].count += 1;
        });
        return Object.entries(grouped)
            .map(([name, vals]) => ({ name, efficiency: (vals.oee / vals.count).toFixed(1) }))
            .sort((a, b) => parseFloat(b.efficiency) - parseFloat(a.efficiency));
    }, [oeeData]);

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
                                {typeof entry.value === 'number' ? (
                                    entry.name.includes('%') ? `${entry.value}%` : entry.value.toLocaleString()
                                ) : entry.value}
                            </span>
                        </div>
                    ))}
                    {payload.some(p => p.dataKey === 'oee' || p.name?.includes('OEE')) && (
                        <div className="mt-2 pt-2 border-top">
                            <span className="text-muted small">Target: {OEE_TARGET}%</span>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    const tableData = useMemo(() => {
        return [...reports, ...oeeData].map(r => ({
            Date: r.production_date?.slice(0, 10) || '',
            'PET Line': r.pet_name || 'Unknown',
            Shift: r.shift_name || '-',
            Output: r.total_bottles_produced || r.bottles_produced || r.metrics?.details?.total_output_pcs || 0,
            OEE: `${(r.metrics?.oee || 0).toFixed(1)}%`,
            Availability: `${(r.metrics?.availability || 0).toFixed(1)}%`,
            Quality: `${(r.metrics?.quality || 0).toFixed(1)}%`,
            Performance: `${(r.metrics?.performance || 0).toFixed(1)}%`,
            Downtime: `${r.metrics?.details?.total_downtime_mins || 0} min`
        }));
    }, [reports, oeeData]);

    const handleExportExcel = () => {
        exportToExcel(tableData, `production_analytics_${new Date().toISOString().slice(0, 10)}`, 'Production Analytics');
    };

    const handleExportPDF = async () => {
        const chartIds = ['output-trend-chart', 'efficiency-chart', 'output-distribution-chart', 'shift-chart', 'downtime-chart'];
        for (const id of chartIds) {
            if (document.getElementById(id)) {
                await exportChartToPDF(id, `prod_${id}`, id.replace(/-/g, ' ').replace(/prod /g, '').toUpperCase());
            }
        }
    };

    const exportChart = async (chartId, filename) => {
        if (document.getElementById(chartId)) {
            const title = `${chartId.replace(/-/g, ' ').toUpperCase()} (${dateRangeLabel})`;
            await exportChartToPDF(chartId, `${filename}_${dateRangeLabel.replace(/ to /g, '_')}`, title);
        }
    };

    const exportTableData = (data, filename, sheetName) => {
        const truncatedSheetName = sheetName.length > 31 ? sheetName.substring(0, 31) : sheetName;
        const title = `${sheetName} (${dateRangeLabel})`;
        exportToExcel(data, `${filename}_${dateRangeLabel.replace(/ to /g, '_')}`, truncatedSheetName, title);
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

            {(filters.pet || filters.log_date || filters.start_date || filters.end_date) && (
                <div className="alert alert-info d-flex align-items-center mb-3" role="alert">
                    <i className="ti ti-filter me-2"></i>
                    <span>
                        Filtered by: {filters.pet && <strong>PET Line: {pets.find(p => p.id === parseInt(filters.pet))?.pet_name || filters.pet}</strong>}
                        {filters.pet && (filters.log_date || filters.start_date) && ' | '}
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
                            <div className="card border-top border-primary border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Total Output</p>
                                        <span className="badge bg-primary-subtle text-primary">Output</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.totalOutput.toLocaleString()}</h2>
                                    <small className="text-muted">{stats.reportCount} reports</small>
                                </div>
                            </div>
                        </div>
                {stats.isSingleDate ? (
                    <>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Availability</p>
                                        <span className="badge bg-success-subtle text-success">A</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgAvail.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(stats.avgAvail, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-warning border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Performance</p>
                                        <span className="badge bg-warning-subtle text-warning">P</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgPerf.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-warning" role="progressbar" style={{ width: `${Math.min(stats.avgPerf, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Quality</p>
                                        <span className="badge bg-info-subtle text-info">Q</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgQuality.toFixed(1)}%</h2>
                                    <div className="progress" style={{ height: 4, width: 80 }}>
                                        <div className="progress-bar bg-info" role="progressbar" style={{ width: `${Math.min(stats.avgQuality, 100)}%` }} />
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
                                        <p className="text-muted fs-14 mb-0">Average Output</p>
                                        <span className="badge bg-success-subtle text-success">Per Report</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.avgOutput.toLocaleString()}</h2>
                                    <small className="text-muted">pcs per report</small>
                                </div>
                            </div>
                        </div>
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
                                    <small className="text-muted">Target: {OEE_TARGET}%</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0 h-100">
                                <div className="card-body d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <p className="text-muted fs-14 mb-0">Total Downtime</p>
                                        <span className="badge bg-info-subtle text-info">{stats.uniqueLines} Lines</span>
                                    </div>
                                    <h2 className="mb-1 fs-16 fw-bold">{stats.totalDowntime.toLocaleString()} min</h2>
                                    <small className="text-muted">{(stats.totalDowntime / Math.max(stats.reportCount, 1)).toFixed(1)} min avg</small>
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
                    <div className="card mb-4">
                        <div className="card-header">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="mb-0">Production Overview</h6>
                                    <small className="text-muted">Daily output and OEE trends {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                </div>
                                <div className="d-flex gap-2 align-items-center">
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
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('output-trend-chart', 'production_overview')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="card-body" id="output-trend-chart">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border text-primary" role="status" /></div>
                            ) : combinedDailyData.length === 0 ? (
                                <p className="text-center text-muted py-5 mb-0">No data available</p>
                            ) : (
                                <>
                                    {activeTab === 'output' && (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <AreaChart data={combinedDailyData}>
                                                <defs>
                                                    <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                                <YAxis tick={{ fontSize: 12 }} yAxisId="left" label={{ value: 'Output (pcs)', angle: -90, position: 'insideLeft' }} />
                                                <YAxis tick={{ fontSize: 12 }} yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: 'OEE (%)', angle: 90, position: 'insideRight' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <ReferenceLine yAxisId="right" y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" label={{ value: `Target ${OEE_TARGET}%`, position: 'right', fill: '#22c55e', fontSize: 11 }} />
                                                <Area type="monotone" dataKey="output" stroke="#3b82f6" fill="url(#outputGradient)" name="Output (pcs)" yAxisId="left" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                    {activeTab === 'efficiency' && (
                                        <ResponsiveContainer width="100%" height={350}>
                                            <BarChart data={efficiencyByPet}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} label={{ value: 'PET Line', position: 'insideBottom', offset: -5 }} />
                                                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} label={{ value: 'OEE (%)', angle: -90, position: 'insideLeft' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <ReferenceLine y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" label={{ value: `Target ${OEE_TARGET}%`, position: 'right', fill: '#22c55e', fontSize: 11 }} />
                                                <Legend />
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
                                            <LineChart data={combinedDailyData}>
                                                <defs>
                                                    <linearGradient id="oeeLineGradient" x1="0" y1="0" x2="1" y2="0">
                                                        <stop offset="0%" stopColor="#22c55e" />
                                                        <stop offset="100%" stopColor="#f59e0b" />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} label={{ value: 'Date', position: 'insideBottom', offset: -5 }} />
                                                <YAxis tick={{ fontSize: 12 }} yAxisId="left" label={{ value: 'Output (pcs)', angle: -90, position: 'insideLeft' }} />
                                                <YAxis tick={{ fontSize: 12 }} yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: 'OEE (%)', angle: 90, position: 'insideRight' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <ReferenceLine yAxisId="right" y={OEE_TARGET} stroke="#22c55e" strokeDasharray="5 5" label={{ value: `Target ${OEE_TARGET}%`, position: 'right', fill: '#22c55e', fontSize: 11 }} />
                                                <Line type="monotone" dataKey="output" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} name="Output (pcs)" yAxisId="left" />
                                                <Line type="monotone" dataKey="oee" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} name="OEE %" yAxisId="right" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">Output Distribution by PET Line</h6>
                                        <small className="text-muted">Total production per line {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('output-distribution-chart', 'output_distribution')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="output-distribution-chart">
                                    {outputByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie data={outputByPet} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value"
                                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                        {outputByPet.map((_, idx) => (
                                                            <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => [v.toLocaleString(), 'Output']} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3">
                                                {outputByPet.map((pet, idx) => (
                                                    <div key={pet.name} className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="f-14">
                                                            <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                            {pet.name}
                                                        </span>
                                                        <span className="text-muted">{(pet.value || 0).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">Output by Shift</h6>
                                        <small className="text-muted">Production distribution across shifts {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('shift-chart', 'output_by_shift')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="shift-chart">
                                    {outputByShift.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={outputByShift}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 12 }} />
                                                    <Tooltip formatter={(v) => [v.toLocaleString(), 'Output']} />
                                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Output">
                                                        {outputByShift.map((entry, idx) => (
                                                            <Cell key={idx} fill={SHIFT_COLORS[entry.name] || DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3">
                                                {outputByShift.map((shift, idx) => (
                                                    <div key={shift.name} className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="f-14">
                                                            <i className="ti ti-circle-filled me-1" style={{ color: SHIFT_COLORS[shift.name] || DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                            {shift.name}
                                                        </span>
                                                        <span className="text-muted">{(shift.value || 0).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">Downtime by PET Line</h6>
                                        <small className="text-muted">Total downtime minutes per line {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('downtime-chart', 'downtime_by_pet')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="downtime-chart">
                                    {downtimeByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={downtimeByPet} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" tick={{ fontSize: 12 }} label={{ value: 'Downtime (min)', position: 'insideBottom', offset: -5 }} />
                                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} label={{ value: 'PET Line', angle: -90, position: 'insideLeft' }} />
                                                <Tooltip formatter={(v) => [`${v} min`, 'Downtime']} />
                                                <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} name="Minutes" />
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
                                        <h6 className="mb-0">Top Performing Lines</h6>
                                        <small className="text-muted">Lines with highest OEE {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                    </div>
                                    <button className="btn btn-danger btn-sm" onClick={() => exportChart('efficiency-chart', 'top_performers')}>
                                        <i className="ti ti-file-type-pdf me-1"></i>Export
                                    </button>
                                </div>
                                <div className="card-body" id="efficiency-chart">
                                    {efficiencyByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-sm mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Rank</th>
                                                        <th>PET Line</th>
                                                        <th>OEE</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {efficiencyByPet.slice(0, 8).map((pet, idx) => {
                                                        const efficiency = parseFloat(pet.efficiency);
                                                        const statusColor = efficiency >= 85 ? 'success' : efficiency >= 70 ? 'warning' : 'danger';
                                                        return (
                                                            <tr key={pet.name}>
                                                                <td>
                                                                    <span className={`avatar avatar-xs rounded-circle ${idx === 0 ? 'bg-warning text-white' : 'bg-light'}`}>
                                                                        #{idx + 1}
                                                                    </span>
                                                                </td>
                                                                <td className="fw-medium">{pet.name}</td>
                                                                <td>{pet.efficiency}%</td>
                                                                <td>
                                                                    <span className={`badge bg-soft-${statusColor} text-${statusColor}`}>
                                                                        {efficiency >= 85 ? 'Excellent' : efficiency >= 70 ? 'Good' : 'Needs Work'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="card mb-4">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Production Summary by PET Line</h6>
                                <small className="text-muted">Average performance per production line {dateRangeLabel && `(${dateRangeLabel})`}</small>
                            </div>
                            <button className="btn btn-success btn-sm" onClick={() => {
                                const petSummary = outputByPet.map(pet => {
                                    const petEff = efficiencyByPet.find(e => e.name === pet.name);
                                    const downtime = downtimeByPet.find(d => d.name === pet.name);
                                    return {
                                        'PET Line': pet.name,
                                        'Total Output': pet.value || 0,
                                        'Avg OEE': petEff ? `${petEff.efficiency}%` : '-',
                                        'Avg Efficiency': petEff ? `${petEff.efficiency}%` : '-',
                                        'Total Downtime': downtime ? `${downtime.value} min` : '0 min'
                                    };
                                });
                                exportTableData(petSummary, 'production_summary_by_pet', 'PET Summary');
                            }}>
                                <i className="ti ti-file-spreadsheet me-1"></i>Export
                            </button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                        <tr>
                                            <th>PET Line</th>
                                            <th>Total Output</th>
                                            <th>Avg OEE</th>
                                            <th>Avg Efficiency</th>
                                            <th>Total Downtime</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {outputByPet.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center text-muted py-4">No data available</td></tr>
                                        ) : (
                                            outputByPet.map(pet => {
                                                const petEfficiency = efficiencyByPet.find(e => e.name === pet.name);
                                                const eff = petEfficiency ? parseFloat(petEfficiency.efficiency) : 0;
                                                const status = getStatusConfig(eff);
                                                const downtime = downtimeByPet.find(d => d.name === pet.name)?.value || 0;
                                                return (
                                                    <tr key={pet.name} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                        <td className="fw-medium">{pet.name}</td>
                                                        <td>{(pet.value || 0).toLocaleString()}</td>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className={`badge bg-${status.bgClass?.replace('bg-', '')} text-${status.color}`}>
                                                                    {petEfficiency ? `${petEfficiency.efficiency}%` : '-'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="progress mb-1" style={{ height: 4, width: 60 }}>
                                                                <div className={`progress-bar bg-${status.color}`} role="progressbar" style={{ width: `${Math.min(eff, 100)}%` }} />
                                                            </div>
                                                        </td>
                                                        <td className={downtime > 100 ? 'text-danger' : ''}>{downtime.toLocaleString()} min</td>
                                                        <td><span className={`badge bg-${status.bgClass?.replace('bg-', '')} text-${status.color}`}>{status.label}</span></td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Output by Shift Summary</h6>
                                <small className="text-muted">Production distribution across shifts {dateRangeLabel && `(${dateRangeLabel})`}</small>
                            </div>
                            <button className="btn btn-success btn-sm" onClick={() => {
                                const total = outputByShift.reduce((sum, s) => sum + s.value, 0);
                                const shiftSummary = outputByShift.map(shift => ({
                                    'Shift': shift.name,
                                    'Total Output': shift.value || 0,
                                    '% of Total': total > 0 ? `${((shift.value / total) * 100).toFixed(1)}%` : '0%'
                                }));
                                exportTableData(shiftSummary, 'output_by_shift_summary', 'Shift Summary');
                            }}>
                                <i className="ti ti-file-spreadsheet me-1"></i>Export
                            </button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                        <tr>
                                            <th>Shift</th>
                                            <th>Total Output</th>
                                            <th>% of Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {outputByShift.length === 0 ? (
                                            <tr><td colSpan={3} className="text-center text-muted py-4">No data available</td></tr>
                                        ) : (
                                            outputByShift.map((shift, idx) => {
                                                const total = outputByShift.reduce((sum, s) => sum + s.value, 0);
                                                const percent = total > 0 ? ((shift.value / total) * 100).toFixed(1) : 0;
                                                return (
                                                    <tr key={shift.name}>
                                                        <td className="fw-medium">
                                                            <i className="ti ti-circle-filled me-2" style={{ color: SHIFT_COLORS[shift.name] || DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                            {shift.name}
                                                        </td>
                                                        <td>{(shift.value || 0).toLocaleString()}</td>
                                                        <td>{percent}%</td>
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
                                <h6 className="mb-0">Detailed Production Records</h6>
                                <small className="text-muted">{tableData.length} production records {dateRangeLabel && `(${dateRangeLabel})`}</small>
                            </div>
                            <button className="btn btn-success btn-sm" onClick={() => {
                                const title = `Detailed Production Records (${dateRangeLabel})`;
                                exportTableData(tableData, 'detailed_production_records', 'Production Records');
                            }}>
                                <i className="ti ti-file-spreadsheet me-1"></i>Export
                            </button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <table className="table table-sm mb-0">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th>Date</th>
                                            <th>PET Line</th>
                                            <th>Shift</th>
                                            <th>Output</th>
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
                                        ) : (
                                            tableData.map((row, idx) => {
                                                const oeeVal = parseFloat(row.OEE);
                                                const oeeStatus = getStatusConfig(oeeVal);
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                        <td className="fw-medium">{row.Date}</td>
                                                        <td>{row['PET Line']}</td>
                                                        <td><span className="badge bg-secondary-subtle text-secondary">{row.Shift}</span></td>
                                                        <td className="fw-medium">{(row.Output || 0).toLocaleString()}</td>
                                                        <td>
                                                            <span className={`badge bg-${oeeStatus.bgClass?.replace('bg-', '')} text-${oeeStatus.color}`}>
                                                                {row.OEE}
                                                            </span>
                                                        </td>
                                                        <td className={parseFloat(row.Availability) < 90 ? 'text-warning' : 'text-success'}>{row.Availability}</td>
                                                        <td className={parseFloat(row.Quality) < 95 ? 'text-warning' : 'text-success'}>{row.Quality}</td>
                                                        <td className={parseFloat(row.Performance) < 90 ? 'text-warning' : 'text-success'}>{row.Performance}</td>
                                                        <td className={parseInt(row.Downtime) > 60 ? 'text-danger' : 'text-muted'}>{row.Downtime}</td>
                                                    </tr>
                                                );
                                            })
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

export default ProductionAnalytics;
