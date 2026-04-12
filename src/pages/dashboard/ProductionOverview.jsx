import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';

import GaugeChart from '../../components/charts/GaugeChart';
import DowntimeBreakdownChart from '../../components/charts/DowntimeBreakdownChart';
import ProductionSummary from '../../components/production/ProductionSummary';
import FilterInputs from '../../components/FilterInputs';
import { useApiWithFilters } from '../../utils/useApiWithFilters';
import ChartErrorBoundary from '../../components/ui/ChartErrorBoundary';
import {
    SkeletonChart, SkeletonDonut, SkeletonTable
} from '../../components/ui/Skeletons';
import { useFilters } from '../../context/FilterContext';
import ReactApexChart from 'react-apexcharts';

/* ── helpers ─────────────────────────────────────── */
const extractList = (res) => {
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (d?.data?.results && Array.isArray(d.data.results)) return d.data.results;
    if (d?.results && Array.isArray(d.results)) return d.results;
    if (d?.data && Array.isArray(d.data)) return d.data;
    return [];
};

const STATUS_BADGES = {
    STARTED: 'badge bg-soft-info text-info',
    COMPLETED: 'badge bg-soft-success text-success',
    APPROVED: 'badge bg-soft-purple text-purple',
    DECLINED: 'badge bg-soft-danger text-danger',
    INCOMPLETE: 'badge bg-soft-warning text-warning',
    IDLE: 'badge bg-soft-secondary text-secondary',
};

const STATUS_COLORS = {
    COMPLETED: '#22c55e',
    APPROVED: '#8b5cf6',
    STARTED: '#3b82f6',
    INCOMPLETE: '#f59e0b',
    DECLINED: '#ef4444',
    IDLE: '#6b7280',
};

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const DOWNTIME_COLORS = {
    'Mechanical Downtime': '#ef4444',
    'Mechanical': '#ef4444',
    'Planned Downtime': '#3b82f6',
    'Planned': '#3b82f6',
    'Electrical': '#f59e0b',
    'Quality': '#8b5cf6',
    'Material': '#10b981',
    'Other': '#6b7280',
    'Uncategorized': '#9ca3af',
    'No Incidents Logged': '#d1d5db',
};

const formatNum = (n) => {
    if (n == null) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return Number(n).toFixed(2);
};

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    if (h > 24) {
        const days = (h / 24).toFixed(2);
        return `${days}d`;
    }
    return `${h}h ${m}m`;
};

const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ── component ───────────────────────────────────── */
const FilterBadge = ({ filters, localFilter, pets = [] }) => {
    const badges = [];
    if (localFilter) badges.push(<span key="local" className="badge bg-soft-info text-info fs-11 ms-2">{localFilter}</span>);
    
    if (filters?.pet) {
        const petName = pets.find(p => p.id === parseInt(filters.pet))?.pet_name || `PET ${filters.pet}`;
        badges.push(<span key="pet" className="badge bg-soft-primary text-primary fs-11 ms-2">{petName}</span>);
    }
    
    if (filters?.shift) {
        badges.push(<span key="shift" className="badge bg-soft-primary text-primary fs-11 ms-2">Shift: {filters.shift}</span>);
    }
    
    if (filters?.log_date) {
        badges.push(<span key="logdate" className="badge bg-soft-primary text-primary fs-11 ms-2">{formatDate(filters.log_date)}</span>);
    } else if (filters?.start_date && filters?.end_date) {
        badges.push(<span key="date" className="badge bg-soft-primary text-primary fs-11 ms-2">{formatDate(filters.start_date)} - {formatDate(filters.end_date)}</span>);
    } else if (filters?.start_date) {
        badges.push(<span key="date" className="badge bg-soft-primary text-primary fs-11 ms-2">From: {formatDate(filters.start_date)}</span>);
    } else if (filters?.end_date) {
        badges.push(<span key="date" className="badge bg-soft-primary text-primary fs-11 ms-2">To: {formatDate(filters.end_date)}</span>);
    }
    
    return badges.length > 0 ? <>{badges}</> : null;
};

const Overview = () => {
    const navigate = useNavigate();
    const { getParams, filters } = useApiWithFilters();
    const { updateFilters } = useFilters();

    /* Stale-while-revalidate: separate initial vs refresh state */
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const hasFetched = useRef(false);
    const abortRef = useRef(null);

    const [stats, setStats] = useState({ totalReports: 0, activeLines: 0, totalStoppages: 0, totalDowntime: 0, totalProduced: 0 });
    const [recentReports, setRecentReports] = useState([]);
    const [recentStoppages, setRecentStoppages] = useState([]);
    const [reports, setReports] = useState([]);
    const [pets, setPets] = useState([]);
    const [planVsActual, setPlanVsActual] = useState([]);
    const [statusBreakdown, setStatusBreakdown] = useState([]);
    const [topLines, setTopLines] = useState([]);
    const [totals, setTotals] = useState({ planned: 0, actual: 0 });
    const [downtimeTypes, setDowntimeTypes] = useState([]);
    const [downtimeByLine, setDowntimeByLine] = useState([]);
    const [oeeSummary, setOeeSummary] = useState([]); // OEE data from API

    // Downtime chart local filters
    const [dtFilter, setDtFilter] = useState('all');
    const [dtDate, setDtDate] = useState('');
    const [dtDateRange, setDtDateRange] = useState({ start: '', end: '' });
    const [dtUseRange, setDtUseRange] = useState(false);
    const [allStoppages, setAllStoppages] = useState([]);

    // Fetch all stoppages once for downtime chart
    useEffect(() => {
        productionApi.getStoppages({ page_size: 1000 })
            .then(res => setAllStoppages(extractList(res).filter(s => !(s.pet_name || s.line_name || '').toLowerCase().includes('can'))))
            .catch(err => console.error('Failed to fetch all stoppages:', err));
    }, []);

    // Derive downtime by line from allStoppages with client-side date filtering
    const activeDowntimeByLine = useMemo(() => {
        let filtered = [...allStoppages];

        const getDate = (s) => (s.log_date || s.created_at || s.start_time || '').split('T')[0];

        // Apply date filters
        if (dtUseRange) {
            if (dtDateRange.start) filtered = filtered.filter(s => getDate(s) >= dtDateRange.start);
            if (dtDateRange.end) filtered = filtered.filter(s => getDate(s) <= dtDateRange.end);
        } else if (dtDate) {
            filtered = filtered.filter(s => getDate(s) === dtDate);
        }

        if (dtFilter !== 'all') {
            const end = new Date();
            const start = new Date();
            if (dtFilter === 'week') {
                const dayOfWeek = end.getDay();
                start.setDate(end.getDate() - dayOfWeek);
                end.setDate(start.getDate() + 6);
            }
            if (dtFilter === 'month') {
                start.setDate(1);
                end.setMonth(end.getMonth() + 1, 0);
            }
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];
            filtered = filtered.filter(s => {
                const d = getDate(s);
                return d >= startStr && d <= endStr;
            });
        }

        const lineMap = {};
        filtered.forEach(s => {
            const raw = s.pet_name || s.line_name || 'Unknown';
            const key = raw.toLowerCase().trim();
            if (!lineMap[key]) lineMap[key] = { name: raw, Mechanical: 0, Planned: 0 };
            (s.incidents || []).forEach(inc => {
                const cat = (inc.downtime_category_name || '').toLowerCase();
                const dur = parseFloat(inc.incident_duration || 0);
                if (cat.includes('mechanical')) lineMap[key].Mechanical += dur;
                else if (cat.includes('planned')) lineMap[key].Planned += dur;
            });
        });
        return Object.values(lineMap)
            .filter(l => l.Mechanical + l.Planned > 0)
            .sort((a, b) => {
                const aNum = parseInt(a.name.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.name.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });
    }, [allStoppages, dtFilter, dtDate, dtUseRange, dtDateRange.start, dtDateRange.end]);

    const handlePetChange = (e) => {
        const petId = e.target.value;
        updateFilters({ pet: petId });
    };

    const loadData = useCallback(async () => {
        /* Cancel any in-flight request */
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (hasFetched.current) {
            setRefreshing(true);
        } else {
            setInitialLoading(true);
        }
        setError(null);

        try {
            const params = getParams();
            
            // OEE params already have datetime format from getParams
            const oeeParams = { ...params };
            
            console.log('ProductionOverview - Fetching with params:', params);
            console.log('ProductionOverview - OEE params:', oeeParams);

            const stoppageParams = getParams({}, true);

            const [reportsRes, stoppagesRes, oeeRes] = await Promise.all([
                productionApi.getReports(params),
                productionApi.getStoppages(stoppageParams),
                productionApi.getOeeSummary(oeeParams),
            ]);

            if (controller.signal.aborted) return;

            const reports = extractList(reportsRes).filter(r => !r.pet_name?.toLowerCase().includes('can'));
            const stoppages = extractList(stoppagesRes).filter(s => !(s.pet_name || s.line_name || '').toLowerCase().includes('can'));
            const oeeData = extractList(oeeRes).filter(r => !r.pet_name?.toLowerCase().includes('can'));

            console.log('OEE Summary Response:', oeeRes);
            console.log('OEE Data (extracted):', oeeData);

            /* Store OEE summary from API */
            setOeeSummary(oeeData);

            /* totals */
            let totalDowntime = 0;
            stoppages.forEach(s => { totalDowntime += s.downtime_minutes || s.duration || 0; });
            let totalProduced = 0;
            reports.forEach(r => { totalProduced += r.total_bottles_produced || 0; });
            
            // Get unique PET lines from reports
            const uniquePets = new Set(reports.map(r => r.pet_name).filter(Boolean));
            
            setStats({
                totalReports: reports.length,
                activeLines: uniquePets.size,
                totalStoppages: stoppages.length,
                totalDowntime: Math.round(totalDowntime),
                totalProduced,
            });

            /* Store all reports for ProductionSummary */
            setReports(reports);

            /* recent reports */
            const sorted = [...reports].sort((a, b) =>
                new Date(b.production_date) - new Date(a.production_date)
            );
            setRecentReports(sorted.slice(0, 5));

            /* recent stoppages */
            const sortedStops = [...stoppages].sort((a, b) =>
                new Date(b.created_at || b.start_time || 0) - new Date(a.created_at || a.start_time || 0)
            );
            setRecentStoppages(sortedStops.slice(0, 5));

            /* plan vs actual per line */
            const lineMap = {};
            reports.forEach(r => {
                const line = r.pet_name || 'Unknown';
                if (!lineMap[line]) lineMap[line] = { name: line, planned: 0, actual: 0 };
                const actual = r.total_bottles_produced || 0;
                const planned = r.target_output || r.planned_output || Math.round(actual * 1.05);
                lineMap[line].actual += actual;
                lineMap[line].planned += planned;
            });
            const pvData = Object.values(lineMap).sort((a, b) => b.actual - a.actual).slice(0, 6);
            setPlanVsActual(pvData);

            const sumActual = pvData.reduce((s, d) => s + d.actual, 0);
            const sumPlanned = pvData.reduce((s, d) => s + d.planned, 0);
            setTotals({ planned: sumPlanned, actual: sumActual });

            /* status breakdown for donut */
            const statusMap = {};
            reports.forEach(r => {
                const st = r.status || 'UNKNOWN';
                statusMap[st] = (statusMap[st] || 0) + 1;
            });
            setStatusBreakdown(
                Object.entries(statusMap).map(([name, value]) => ({ name, value }))
            );

            /* top lines for donut */
            setTopLines(
                pvData.slice(0, 4).map(l => ({ name: l.name, value: l.actual }))
            );

            /* downtime breakdown from stoppages → incidents (all categories) */
            const categoryMap = {};
            stoppages.forEach(s => {
                (s.incidents || []).forEach(inc => {
                    const cat = inc.downtime_category_name || 'Uncategorized';
                    const dur = parseFloat(inc.incident_duration || 0);
                    categoryMap[cat] = (categoryMap[cat] || 0) + dur;
                });
            });

            const categorisedMins = Object.values(categoryMap).reduce((s, v) => s + v, 0);
            const noIncidentMins = Math.round(totalDowntime) - Math.round(categorisedMins);

            const allCategories = [
                ...Object.entries(categoryMap).map(([name, value]) => ({ name, value: Math.round(value) })),
                ...(noIncidentMins > 0 ? [{ name: 'No Incidents Logged', value: noIncidentMins }] : [])
            ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

            setDowntimeTypes(allCategories);

            /* downtime by line for bar chart */
            const lineDowntimeMap = {};
            stoppages.forEach(s => {
                const lineName = s.pet_name || s.line_name || 'Unknown';
                if (!lineDowntimeMap[lineName]) lineDowntimeMap[lineName] = { name: lineName, Mechanical: 0, Planned: 0 };
                (s.incidents || []).forEach(inc => {
                    const cat = (inc.downtime_category_name || '').toLowerCase();
                    const dur = parseFloat(inc.incident_duration || 0);
                    if (cat.includes('mechanical')) lineDowntimeMap[lineName].Mechanical += dur;
                    else if (cat.includes('planned')) lineDowntimeMap[lineName].Planned += dur;
                });
            });
            setDowntimeByLine(
                Object.values(lineDowntimeMap)
                    .filter(l => l.Mechanical + l.Planned > 0)
                    .sort((a, b) => (b.Mechanical + b.Planned) - (a.Mechanical + a.Planned))
                    .slice(0, 6)
            );

            hasFetched.current = true;
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
            setError('Failed to load production data. Please try again.');
        } finally {
            if (!controller.signal.aborted) {
                setInitialLoading(false);
                setRefreshing(false);
            }
        }
    }, [getParams]);

    useEffect(() => {
        loadData();
        return () => { if (abortRef.current) abortRef.current.abort(); };
    }, [loadData]);

    /* Fetch pets for ProductionSummary */
    useEffect(() => {
        productionApi.getPets({ page_size: 1000 })
            .then(res => setPets((res.data.data || []).filter(pet => !pet.pet_name?.toLowerCase().includes('can'))))
            .catch(err => console.error('Failed to load pets:', err));
    }, []);

    const efficiency = totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0;

    // Filtered planVsActual for Bottles by PET - uses global date filters + optional PET filter
    const filteredPlanVsActual = useMemo(() => {
        console.log('=== Production Output by PET Debug ===');
        console.log('Total reports:', reports.length);
        console.log('Reports with pet 6:', reports.filter(r => r.pet_name?.toLowerCase().includes('pet 6')));
        console.log('All unique pet names:', [...new Set(reports.map(r => r.pet_name))]);
        
        let filtered = [...reports];

        // Apply PET filter if selected
        if (filters.pet) {
            const selectedPetName = pets.find(p => p.id === parseInt(filters.pet))?.pet_name;
            if (selectedPetName) filtered = filtered.filter(r => r.pet_name === selectedPetName);
        }

        const lineMap = {};
        filtered.forEach(r => {
            const line = r.pet_name || 'Unknown';
            if (!lineMap[line]) lineMap[line] = { name: line, planned: 0, actual: 0 };
            const actual = r.total_bottles_produced || 0;
            const planned = r.target_output || r.planned_output || Math.round(actual * 1.05);
            lineMap[line].actual += actual;
            lineMap[line].planned += planned;
        });
        const sorted = Object.values(lineMap).sort((a, b) => b.actual - a.actual).filter(l => l.actual > 0);
        console.log('Aggregated lines:', sorted);
        console.log('PET 6 in aggregated:', sorted.find(l => l.name?.toLowerCase().includes('pet 6')));
        return sorted;
    }, [reports, filters.pet, pets]);

    // PET Contribution to Quality - uses OEE summary API, aggregated per PET
    const petQuality = useMemo(() => {
        const grouped = {};
        oeeSummary.forEach(pet => {
            const name = pet.pet_name;
            if (!name) return;
            const q = pet.metrics?.quality ?? pet.quality ?? 0;
            if (!grouped[name]) grouped[name] = { total: 0, count: 0 };
            grouped[name].total += q;
            grouped[name].count += 1;
        });
        return Object.entries(grouped)
            .map(([name, { total, count }]) => ({
                name,
                quality: count > 0 ? total / count : 0
            }))
            .filter(pet => pet.quality > 0)
            .sort((a, b) => b.quality - a.quality)
            .slice(0, 6);
    }, [oeeSummary]);

    // Transform downtimeTypes for DowntimeBreakdownChart component
    const downtimeCategories = downtimeTypes.map(d => ({
        name: d.name,
        value: Math.round(d.value),
        color: DOWNTIME_COLORS[d.name] || '#6b7280'
    }));

    const isLoading = initialLoading;

    /* ── render ── */
    return (
        <>
            {/* Page Header */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body py-3">
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                        <div className="d-flex align-items-center gap-2">
                            <div className="avatar bg-soft-primary rounded-circle p-2">
                                <i className="ti ti-layout-dashboard text-primary fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-0 fs-18 fw-bold">Production Overview</h4>
                                <small className="text-muted">Real-time production metrics and insights</small>
                            </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <button className="btn btn-outline-primary d-flex align-items-center gap-1" onClick={loadData} disabled={refreshing}>
                                <i className={`ti ti-refresh${refreshing ? ' spin' : ''}`}></i>
                                <span className="d-none d-sm-inline">Refresh</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <FilterInputs />

            {/* Error State */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center shadow-sm mb-3">
                    <i className="ti ti-alert-circle fs-4 me-2"></i>
                    <div className="flex-grow-1">
                        <strong className="d-block">Error Loading Data</strong>
                        <small>{error}</small>
                    </div>
                    <button className="btn btn-danger btn-sm ms-2" onClick={loadData}>
                        <i className="ti ti-refresh me-1"></i>Retry
                    </button>
                </div>
            )}

            {/* Production Summary - Efficiency trends and multi-line comparison */}
            {isLoading ? <SkeletonChart height={400} title /> : (
                <ChartErrorBoundary fallbackMessage="Failed to render production summary">
                    <ProductionSummary
                        reports={oeeSummary}
                        loading={isLoading}
                        pets={pets}
                    />
                </ChartErrorBoundary>
            )}

            {/* Stats Overview Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Total Reports</p>
                                    <h3 className="mb-0 mt-1 fs-24 fw-bold">{stats.totalReports}</h3>
                                </div>
                                <div className="avatar bg-soft-primary rounded-circle p-3">
                                    <i className="ti ti-file-report text-primary fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Active Lines</p>
                                    <h3 className="mb-0 mt-1 fs-24 fw-bold">{stats.activeLines}</h3>
                                </div>
                                <div className="avatar bg-soft-info rounded-circle p-3">
                                    <i className="ti ti-building-factory-2 text-info fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Total Stoppages</p>
                                    <h3 className="mb-0 mt-1 fs-24 fw-bold">{stats.totalStoppages}</h3>
                                </div>
                                <div className="avatar bg-soft-warning rounded-circle p-3">
                                    <i className="ti ti-alert-triangle text-warning fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted mb-0 fs-13">Total Downtime</p>
                                    <h3 className="mb-0 mt-1 fs-24 fw-bold">{formatDuration(stats.totalDowntime)}</h3>
                                </div>
                                <div className="avatar bg-soft-danger rounded-circle p-3">
                                    <i className="ti ti-clock-stop text-danger fs-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="row g-3 mb-4">
                {/* Reports by Status – donut */}
                <div className="col-xxl-3 col-lg-6 d-flex">
                    {isLoading ? <SkeletonDonut /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render status chart">
                    <div className="card border-0 shadow-sm flex-fill">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <h6 className="mb-0 fw-semibold">
                                Reports by Status
                                <FilterBadge filters={filters} pets={pets} />
                            </h6>
                        </div>
                        <div className="card-body">
                            {statusBreakdown.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                                paddingAngle={2} dataKey="value">
                                                {statusBreakdown.map((entry, idx) => (
                                                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v, name) => [v, name]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {statusBreakdown.map((s, idx) => (
                                        <div key={s.name} className="d-flex align-items-center justify-content-between mb-2">
                                            <p className="f-14 fw-medium text-dark mb-0">
                                                <i className="ti ti-circle-filled me-1" style={{ color: STATUS_COLORS[s.name] || DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                {s.name}
                                            </p>
                                            <p className="f-14 fw-medium text-dark mb-0">{s.value}</p>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0">No data</p>
                            )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>

                {/* Plan vs Actual – bar chart */}
                <div className="col-xxl-6 col-lg-6 d-flex">
                    {isLoading ? <SkeletonChart height={220} title /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render plan vs actual chart">
                    <div className="card border-0 shadow-sm flex-fill">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <h6 className="mb-0 fw-semibold">
                                Plan vs Actual Output
                                <FilterBadge filters={filters} pets={pets} />
                            </h6>
                        </div>
                        <div className="card-body pb-0">
                            <div className="d-flex align-items-center justify-content-between flex-wrap mb-3">
                                <div className="mb-1">
                                    <h5 className="mb-2 fs-16 fw-bold">{formatNum(totals.actual)}</h5>
                                    <small className="text-muted">Total bottles produced</small>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="badge rounded-pill" style={{ backgroundColor: '#2F80ED' }}></span>
                                        <span className="fs-13 text-muted">Planned</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="badge rounded-pill" style={{ backgroundColor: '#1ABE17' }}></span>
                                        <span className="fs-13 text-muted">Actual</span>
                                    </div>
                                </div>
                            </div>
                            {planVsActual.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={planVsActual} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                                            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: 8, border: '1px solid #e9ecef', fontSize: 12 }}
                                            formatter={(v, name) => [v.toLocaleString(), name === 'planned' ? 'Planned' : 'Actual']}
                                        />
                                        <Bar dataKey="planned" fill="#2F80ED" radius={[3, 3, 0, 0]} barSize={18}
                                            label={{ position: 'inside', fontSize: 10, fill: '#ffffff', fontWeight: 600, formatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v }} />
                                        <Bar dataKey="actual" fill="#1ABE17" radius={[3, 3, 0, 0]} barSize={18}
                                            label={{ position: 'inside', fontSize: 10, fill: '#ffffff', fontWeight: 600, formatter: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0">No data available</p>
                            )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>

                {/* Top Lines – donut */}
                <div className="col-xxl-3 col-xl-6 d-flex">
                    {isLoading ? <SkeletonDonut /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render top lines chart">
                    <div className="card border-0 shadow-sm flex-fill">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <h6 className="mb-0 fw-semibold">
                                Top PET Lines
                                <FilterBadge filters={filters} pets={pets} />
                            </h6>
                        </div>
                        <div className="card-body">
                            {topLines.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <PieChart>
                                            <Pie data={topLines} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                                paddingAngle={2} dataKey="value">
                                                {topLines.map((entry, idx) => (
                                                    <Cell key={entry.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v, name) => [formatNum(v), name]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {topLines.map((l, idx) => {
                                        const total = topLines.reduce((s, t) => s + t.value, 0);
                                        const pct = total > 0 ? Math.round((l.value / total) * 100) : 0;
                                        return (
                                            <div key={l.name} className="d-flex align-items-center justify-content-between mb-3">
                                                <p className="f-14 fw-medium text-dark mb-0">
                                                    <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                    {l.name}
                                                </p>
                                                <p className="f-14 fw-medium text-dark mb-0">{pct}%</p>
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0">No data</p>
                            )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>
            </div>

            {/* Downtime Breakdown Row */}
            <div className="row g-3 mb-4">
                {/* Downtime by Line – grouped bar */}
                <div className="col-12 d-flex">
                    {isLoading ? <SkeletonChart height={220} title /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render downtime by line chart">
                    <div className="card border-0 shadow-sm w-100">
                        <div className="card-header bg-transparent border-0 pt-3 pb-2">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div>
                                    <h6 className="mb-0 fw-semibold">
                                        Mechanical vs Planned Downtime
                                        <FilterBadge filters={filters} pets={pets} localFilter={dtFilter !== 'all' ? dtFilter : dtDate || (dtDateRange.start && 'Custom Range')} />
                                    </h6>
                                    <small className="text-muted">Downtime comparison by PET line</small>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="d-inline-block rounded-circle" style={{ width: 8, height: 8, backgroundColor: DOWNTIME_COLORS.Mechanical }}></span>
                                        <span className="fs-13 text-muted">Mechanical</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-1">
                                        <span className="d-inline-block rounded-circle" style={{ width: 8, height: 8, backgroundColor: DOWNTIME_COLORS.Planned }}></span>
                                        <span className="fs-13 text-muted">Planned</span>
                                    </div>
                                </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2">
                                <div className="d-flex align-items-center gap-2">
                                    {activeDowntimeByLine.length > 0 && (
                                        <>
                                            <div className="border rounded px-3 py-1">
                                                <small className="text-muted d-block" style={{ fontSize: 11 }}>Total Mechanical</small>
                                                <span className="fw-bold text-danger fs-14">{formatDuration(activeDowntimeByLine.reduce((s, l) => s + l.Mechanical, 0))}</span>
                                            </div>
                                            <div className="border rounded px-3 py-1">
                                                <small className="text-muted d-block" style={{ fontSize: 11 }}>Total Planned</small>
                                                <span className="fw-bold text-primary fs-14">{formatDuration(activeDowntimeByLine.reduce((s, l) => s + l.Planned, 0))}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    {!dtUseRange ? (
                                        <input type="date" className="form-control form-control-sm" style={{ maxWidth: 150 }}
                                            value={dtDate} onChange={(e) => { setDtDate(e.target.value); setDtFilter('all'); }} />
                                    ) : (
                                        <>
                                            <input type="date" className="form-control form-control-sm" style={{ maxWidth: 140 }}
                                                value={dtDateRange.start} onChange={(e) => setDtDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                            <input type="date" className="form-control form-control-sm" style={{ maxWidth: 140 }}
                                                value={dtDateRange.end} onChange={(e) => setDtDateRange(prev => ({ ...prev, end: e.target.value }))} />
                                        </>
                                    )}
                                    <div className="form-check form-switch mb-0">
                                        <input className="form-check-input" type="checkbox" checked={dtUseRange}
                                            onChange={(e) => { setDtUseRange(e.target.checked); if (!e.target.checked) setDtDateRange({ start: '', end: '' }); else setDtDate(''); }} />
                                        <label className="form-check-label small">Range</label>
                                    </div>
                                    <div className="btn-group btn-group-sm">
                                        <button className={`btn ${dtFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => { setDtFilter('all'); setDtDate(''); setDtDateRange({ start: '', end: '' }); }}>All</button>
                                        <button className={`btn ${dtFilter === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => { setDtFilter('week'); setDtDate(''); }}>Week</button>
                                        <button className={`btn ${dtFilter === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => { setDtFilter('month'); setDtDate(''); }}>Month</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card-body pt-0 pb-2">
                            {activeDowntimeByLine.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={activeDowntimeByLine} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                                            tickFormatter={v => formatDuration(v)} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151', fontWeight: 500 }} axisLine={false} tickLine={false} width={60} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12, padding: '8px 12px' }}
                                            formatter={(v, name) => [formatDuration(v), name]}
                                        />
                                        <Bar dataKey="Mechanical" fill={DOWNTIME_COLORS.Mechanical} radius={[0, 4, 4, 0]} barSize={20}
                                            label={{ position: 'inside', fontSize: 10, fill: '#ffffff', fontWeight: 600, formatter: (v) => v > 0 ? formatDuration(v) : '' }} />
                                        <Bar dataKey="Planned" fill={DOWNTIME_COLORS.Planned} radius={[0, 4, 4, 0]} barSize={20}
                                            label={{ position: 'inside', fontSize: 10, fill: '#ffffff', fontWeight: 600, formatter: (v) => v > 0 ? formatDuration(v) : '' }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0">No downtime data</p>
                            )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>
            </div>

            {/* Downtime Details Row */}
            <div className="row g-3 mb-4">
                {/* Downtime Breakdown Chart */}
                <div className="col-xxl-4 col-lg-4 d-flex">
                    {isLoading ? <SkeletonDonut /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render downtime breakdown">
                        <DowntimeBreakdownChart
                            downtimeCategories={downtimeCategories}
                            loading={false}
                            showDetailsButton={true}
                            detailsRoute="/dashboard/production/downtime-breakdown"
                        />
                    </ChartErrorBoundary>
                    )}
                </div>

                {/* Bottles by PET */}
                <div className="col-xxl-4 col-lg-4 d-flex">
                    {isLoading ? <SkeletonDonut /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render bottles by PET chart">
                    <div className="card border-0 shadow-sm w-100">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <div>
                                <h6 className="mb-0 fw-semibold">
                                    Production Output by PET
                                    <FilterBadge filters={filters} pets={pets} />
                                </h6>
                                <small className="text-muted">Production distribution across lines</small>
                            </div>
                        </div>
                        <div className="card-body">
                            {(() => {
                                const totalOutput = filteredPlanVsActual.reduce((s, l) => s + l.actual, 0);
                                const series = filteredPlanVsActual.map(l => totalOutput > 0 ? Number(((l.actual / totalOutput) * 100).toFixed(1)) : 0);
                                const labels = filteredPlanVsActual.map(l => l.name);
                                return filteredPlanVsActual.length > 0 ? (
                                    <ReactApexChart
                                        options={{
                                            chart: { type: 'radialBar' },
                                            plotOptions: {
                                                radialBar: {
                                                    hollow: { size: '15%' },
                                                    track: { strokeWidth: '100%', margin: 8 },
                                                    dataLabels: {
                                                        total: {
                                                            show: true,
                                                            label: 'TOTAL',
                                                            formatter: () => formatNum(totalOutput)
                                                        }
                                                    }
                                                }
                                            },
                                            labels,
                                            colors: DONUT_COLORS.slice(0, labels.length),
                                            legend: {
                                                show: true,
                                                position: 'bottom',
                                                formatter: (name, opts) => {
                                                    const val = filteredPlanVsActual[opts.seriesIndex]?.actual || 0;
                                                    return `${name}: ${formatNum(val)}`;
                                                }
                                            },
                                            stroke: { lineCap: 'round' }
                                        }}
                                        series={series}
                                        type="radialBar"
                                        height={380}
                                    />
                                ) : (
                                    <p className="text-center text-muted py-5 mb-0">No data for selected filters</p>
                                );
                            })()}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>

                {/* PET Contribution to Quality */}
                <div className="col-xxl-4 col-lg-4 d-flex">
                    {isLoading ? <SkeletonDonut /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render quality chart">
                    <div className="card border-0 shadow-sm w-100">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <div>
                                <h6 className="mb-0 fw-semibold">
                                    PET Contribution to Quality
                                    <FilterBadge filters={filters} pets={pets} />
                                </h6>
                                <small className="text-muted">Quality performance by line</small>
                            </div>
                        </div>
                        <div className="card-body">
                            {petQuality.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie
                                                data={petQuality}
                                                cx="50%" cy="50%" outerRadius={90}
                                                paddingAngle={2} dataKey="quality"
                                                label={(entry) => `${entry.name}: ${entry.quality.toFixed(1)}%`}>
                                                {petQuality.map((entry, idx) => (
                                                    <Cell key={entry.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Quality']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-3">
                                        {petQuality.map((l, idx) => {
                                            const qualityBadge = l.quality >= 95 ? 'success' : l.quality >= 85 ? 'warning' : 'danger';
                                            return (
                                                <div key={l.name} className="d-flex align-items-center justify-content-between mb-2">
                                                    <p className="f-14 fw-medium text-dark mb-0">
                                                        <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                        {l.name}
                                                    </p>
                                                    <span className={`badge bg-soft-${qualityBadge} text-${qualityBadge} fs-10`}>
                                                        {l.quality.toFixed(1)}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0">No data for selected filters</p>
                            )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>
            </div>

            {/* Bottom Row – Lists */}
            <div className="row g-3 mb-4">
                {/* Recent Reports */}
                <div className="col-xxl-4 col-xl-6">
                    {isLoading ? <SkeletonTable rows={5} cols={3} /> : (
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <div className="d-flex align-items-center justify-content-between gap-2">
                                <h5 className="mb-0 fs-16 fw-bold">
                                    Recent Reports
                                    <FilterBadge filters={filters} pets={pets} />
                                </h5>
                                <button onClick={() => navigate('/dashboard/production')} className="btn btn-primary btn-xs">
                                    View All <i className="ti ti-arrow-right ms-1"></i>
                                </button>
                            </div>
                        </div>
                        <div className="card-body pb-2">
                            {recentReports.length === 0 ? (
                                <p className="text-center text-muted py-4 mb-0">No recent reports</p>
                            ) : (
                                recentReports.map((r, idx) => (
                                    <div key={r.id} className={`d-sm-flex justify-content-between flex-wrap ${idx < recentReports.length - 1 ? 'mb-4' : 'mb-0'} p-2 rounded hover-bg-light`}
                                        style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/production/${r.id}`)}>
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-primary">
                                                <i className="ti ti-file-report fs-16 text-primary"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">{r.report_code || r.product_name || '-'}</h6>
                                                <p className="fs-13 mb-0 text-muted">{formatDate(r.production_date)}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{r.pet_name || '-'}</h6>
                                            <span className={STATUS_BADGES[r.status] || 'badge bg-secondary'}>{r.status || 'N/A'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    )}
                </div>

                {/* Recent Stoppages */}
                <div className="col-xxl-4 col-xl-6">
                    {isLoading ? <SkeletonTable rows={5} cols={3} /> : (
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <div className="d-flex align-items-center justify-content-between gap-2">
                                <h5 className="mb-0 fs-16 fw-bold">
                                    Recent Stoppages
                                    <FilterBadge filters={filters} pets={pets} />
                                </h5>
                                <button onClick={() => navigate('/dashboard/production/stoppages')} className="btn btn-primary btn-xs">
                                    View All <i className="ti ti-arrow-right ms-1"></i>
                                </button>
                            </div>
                        </div>
                        <div className="card-body pb-2">
                            {recentStoppages.length === 0 ? (
                                <p className="text-center text-muted py-4 mb-0">No stoppages recorded</p>
                            ) : (
                                recentStoppages.map((s, idx) => (
                                    <div key={s.id} className={`d-sm-flex justify-content-between flex-wrap ${idx < recentStoppages.length - 1 ? 'mb-4' : 'mb-0'} p-2 rounded hover-bg-light`}>
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-danger">
                                                <i className="ti ti-alert-triangle fs-16 text-danger"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">
                                                    {s.category_name || s.reason || 'Stoppage'}
                                                </h6>
                                                <p className="fs-13 mb-0 text-muted">{s.pet_name || s.line_name || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">
                                                {s.downtime_minutes || s.duration || 0} min
                                            </h6>
                                            <p className="fs-13 mb-0 text-muted">
                                                {formatDate(s.log_date || s.created_at || s.start_time)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    )}
                </div>

                {/* Production Summary */}
                <div className="col-xxl-4 col-xl-12">
                    {isLoading ? <SkeletonTable rows={5} cols={2} /> : (
                    <ChartErrorBoundary fallbackMessage="Failed to render production summary">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0">
                            <h5 className="mb-0 fs-16 fw-bold">
                                Production Summary
                                <FilterBadge filters={filters} pets={pets} />
                            </h5>
                        </div>
                        <div className="card-body pb-2">
                            {(
                                <>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4 p-2 rounded hover-bg-light">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-primary">
                                                <i className="ti ti-bottle fs-16 text-primary"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Total Produced</h6>
                                                <p className="fs-13 mb-0 text-muted">All lines combined</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{formatNum(stats.totalProduced)}</h6>
                                            <p className="fs-13 mb-0 text-muted">bottles</p>
                                        </div>
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4 p-2 rounded hover-bg-light">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-success">
                                                <i className="ti ti-target fs-16 text-success"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Planned Output</h6>
                                                <p className="fs-13 mb-0 text-muted">Target across lines</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{formatNum(totals.planned)}</h6>
                                            <p className="fs-13 mb-0 text-muted">bottles</p>
                                        </div>
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4 p-2 rounded hover-bg-light">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-warning">
                                                <i className="ti ti-clock-stop fs-16 text-warning"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Total Downtime</h6>
                                                <p className="fs-13 mb-0 text-muted">{stats.totalStoppages} stoppages</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{formatNum(stats.totalDowntime)}</h6>
                                            <p className="fs-13 mb-0 text-muted">minutes</p>
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <GaugeChart
                                            value={efficiency}
                                            label="Efficiency"
                                            color={efficiency >= 85 ? '#22c55e' : efficiency >= 50 ? '#f59e0b' : '#ef4444'}
                                            max={120}
                                        />
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-0 p-2 rounded hover-bg-light">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-info">
                                                <i className="ti ti-building-factory-2 fs-16 text-info"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Active Lines</h6>
                                                <p className="fs-13 mb-0 text-muted">PET production lines</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{stats.activeLines}</h6>
                                            <p className="fs-13 mb-0 text-muted">lines</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                    )}
                </div>
            </div>
        </>
    );
};

export default Overview;
