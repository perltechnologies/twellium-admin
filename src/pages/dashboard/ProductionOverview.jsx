import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell,
} from 'recharts';

import GaugeChart from '../../components/charts/GaugeChart';
import DowntimeBreakdownChart from '../../components/charts/DowntimeBreakdownChart';
import FilterInputs from '../../components/FilterInputs';
import { useApiWithFilters } from '../../utils/useApiWithFilters';

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
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ── component ───────────────────────────────────── */
const Overview = () => {
    const navigate = useNavigate();
    const { getParams, filters } = useApiWithFilters();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalReports: 0, activeLines: 0, totalStoppages: 0, totalDowntime: 0, totalProduced: 0 });
    const [recentReports, setRecentReports] = useState([]);
    const [recentStoppages, setRecentStoppages] = useState([]);
    const [planVsActual, setPlanVsActual] = useState([]);
    const [statusBreakdown, setStatusBreakdown] = useState([]);
    const [topLines, setTopLines] = useState([]);
    const [totals, setTotals] = useState({ planned: 0, actual: 0 });
    const [downtimeTypes, setDowntimeTypes] = useState([]);
    const [downtimeByLine, setDowntimeByLine] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = getParams();
            const [reportsRes, petsRes, stoppagesRes] = await Promise.all([
                productionApi.getReports(params),
                productionApi.getPets(params),
                productionApi.getStoppages(params),
            ]);

            const reports = extractList(reportsRes);
            const pets = extractList(petsRes);
            const stoppages = extractList(stoppagesRes);

            /* totals */
            let totalDowntime = 0;
            stoppages.forEach(s => { totalDowntime += s.downtime_minutes || s.duration || 0; });
            let totalProduced = 0;
            reports.forEach(r => { totalProduced += r.total_bottles_produced || 0; });
            setStats({
                totalReports: reports.length,
                activeLines: pets.length,
                totalStoppages: stoppages.length,
                totalDowntime: Math.round(totalDowntime),
                totalProduced,
            });

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

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { loadData(); }, [loadData]);

    const efficiency = totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0;

    // Transform downtimeTypes for DowntimeBreakdownChart component
    const downtimeCategories = downtimeTypes.map(d => ({
        name: d.name,
        value: Math.round(d.value),
        color: DOWNTIME_COLORS[d.name] || '#6b7280'
    }));

    const statCards = [
        { label: 'Production Reports', value: stats.totalReports, icon: 'ti-file-report', color: 'primary', elemnt: 'elemnt-01', delta: null },
        { label: 'Active PET Lines', value: stats.activeLines, icon: 'ti-building-factory-2', color: 'success', elemnt: 'elemnt-02', delta: null },
        { label: 'Total Stoppages', value: stats.totalStoppages, icon: 'ti-alert-triangle', color: 'warning', elemnt: 'elemnt-03', delta: null },
        { label: 'Total Downtime', value: `${stats.totalDowntime} min`, icon: 'ti-clock-pause', color: 'danger', elemnt: 'elemnt-04', delta: null },
    ];

    /* ── render ── */
    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <div>
                    <h4 className="mb-1">Dashboard</h4>
                </div>
                <div className="gap-2 d-flex align-items-center flex-wrap">
                    <button className="btn btn-icon btn-outline-light shadow" title="Refresh" onClick={loadData}>
                        <i className={`ti ti-refresh${loading ? ' spin' : ''}`}></i>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <FilterInputs />

            {/* Welcome Banner */}
            <div className="welcome-wrap mb-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 bg-dark rounded p-4">
                    <div>
                        <h2 className="mb-1 text-white fs-24">Production Overview</h2>
                        <p className="text-light fs-14 mb-0">
                            {loading ? 'Loading…' : `${formatNum(stats.totalProduced)} bottles produced across ${stats.activeLines} active lines`}
                        </p>
                    </div>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                        <button onClick={() => navigate('/dashboard/production')} className="btn btn-danger btn-sm">Reports</button>
                        <button onClick={() => navigate('/dashboard/stoppages')} className="btn btn-light btn-sm">Stoppages</button>
                    </div>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="row row-gap-3 mb-4">
                {statCards.map((card) => (
                    <div key={card.label} className="col-xl-3 col-sm-6 d-flex">
                        <div className="card flex-fill mb-0 position-relative overflow-hidden">
                            <div className="card-body position-relative z-1">
                                <div className="d-flex align-items-start justify-content-between">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 mb-1">{card.label}</p>
                                            <h2 className="mb-1 fs-16">{loading ? '…' : card.value}</h2>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className={`avatar avatar-md rounded-circle bg-soft-${card.color} border border-${card.color}`}>
                                            <i className={`ti ${card.icon} fs-16 text-${card.color}`}></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <img src={`/assets/img/icons/${card.elemnt}.svg`} alt="" className="img-fluid position-absolute top-0 start-0" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="row">
                {/* Reports by Status – donut */}
                <div className="col-xxl-3 col-lg-6 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">Reports by Status</h6>
                        </div>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : statusBreakdown.length > 0 ? (
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
                </div>

                {/* Plan vs Actual – bar chart */}
                <div className="col-lg-6 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">Plan vs Actual Output</h6>
                        </div>
                        <div className="card-body pb-0">
                            <div className="d-flex align-items-center justify-content-between flex-wrap mb-3">
                                <div className="mb-1">
                                    <h5 className="mb-2 fs-16 fw-bold">{formatNum(totals.actual)}</h5>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <p className="fs-14 text-dark d-flex align-items-center mb-1">
                                        <i className="ti ti-circle-filled me-1 fs-6" style={{ color: '#2F80ED' }}></i>Planned
                                    </p>
                                    <p className="fs-14 text-dark d-flex align-items-center mb-1">
                                        <i className="ti ti-circle-filled me-1 fs-6" style={{ color: '#1ABE17' }}></i>Actual
                                    </p>
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
                                        <Bar dataKey="planned" fill="#2F80ED" radius={[3, 3, 0, 0]} barSize={18} />
                                        <Bar dataKey="actual" fill="#1ABE17" radius={[3, 3, 0, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0">No data available</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Lines – donut */}
                <div className="col-xxl-3 col-xl-12 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">Top PET Lines</h6>
                        </div>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : topLines.length > 0 ? (
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
                </div>
            </div>

            {/* Downtime Breakdown Row */}
            <div className="row">
                {/* Downtime Breakdown Chart */}
                <div className="col-xxl-4 col-lg-6 d-flex">
                    <DowntimeBreakdownChart 
                        downtimeCategories={downtimeCategories}
                        loading={loading}
                        showDetailsButton={true}
                        detailsRoute="/dashboard/downtime"
                    />
                </div>

                {/* Downtime by Line – grouped bar */}
                <div className="col-xxl-8 col-lg-6 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">Mechanical vs Planned by Line</h6>
                            <div className="d-flex align-items-center gap-3">
                                <p className="fs-13 text-dark d-flex align-items-center mb-0">
                                    <i className="ti ti-circle-filled me-1" style={{ color: DOWNTIME_COLORS.Mechanical, fontSize: 8 }}></i>Mechanical
                                </p>
                                <p className="fs-13 text-dark d-flex align-items-center mb-0">
                                    <i className="ti ti-circle-filled me-1" style={{ color: DOWNTIME_COLORS.Planned, fontSize: 8 }}></i>Planned
                                </p>
                            </div>
                        </div>
                        <div className="card-body p-0 d-flex" style={{ minHeight: '400px' }}>
                            {loading ? (
                                <div className="text-center py-5 w-100 align-self-center"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : downtimeByLine.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={downtimeByLine} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                                            tickFormatter={v => formatDuration(v)} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: 8, border: '1px solid #e9ecef', fontSize: 12 }}
                                            formatter={(v, name) => [formatDuration(v), name]}
                                        />
                                        <Bar dataKey="Mechanical" fill={DOWNTIME_COLORS.Mechanical} radius={[3, 3, 0, 0]} barSize={18} />
                                        <Bar dataKey="Planned" fill={DOWNTIME_COLORS.Planned} radius={[3, 3, 0, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-muted py-5 mb-0 w-100 align-self-center">No downtime data</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row – Lists */}
            <div className="row">
                {/* Recent Reports */}
                <div className="col-xxl-4 col-xl-12 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h5 className="mb-0 fs-16 fw-bold">Recent Reports</h5>
                            <button onClick={() => navigate('/dashboard/production')} className="btn btn-primary btn-xs">View All</button>
                        </div>
                        <div className="card-body pb-2">
                            {loading ? (
                                <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : recentReports.length === 0 ? (
                                <p className="text-center text-muted py-4 mb-0">No recent reports</p>
                            ) : (
                                recentReports.map((r, idx) => (
                                    <div key={r.id} className={`d-sm-flex justify-content-between flex-wrap ${idx < recentReports.length - 1 ? 'mb-4' : 'mb-0'}`}
                                        style={{ cursor: 'pointer' }} onClick={() => navigate(`/dashboard/production/${r.id}`)}>
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-primary">
                                                <i className="ti ti-file-report fs-16 text-primary"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">{r.report_code || r.product_name || '-'}</h6>
                                                <p className="fs-13 mb-0">{formatDate(r.production_date)}</p>
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
                </div>

                {/* Recent Stoppages */}
                <div className="col-xxl-4 col-xl-12 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h5 className="mb-0 fs-16 fw-bold">Recent Stoppages</h5>
                            <button onClick={() => navigate('/dashboard/stoppages')} className="btn btn-primary btn-xs">View All</button>
                        </div>
                        <div className="card-body pb-2">
                            {loading ? (
                                <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : recentStoppages.length === 0 ? (
                                <p className="text-center text-muted py-4 mb-0">No stoppages recorded</p>
                            ) : (
                                recentStoppages.map((s, idx) => (
                                    <div key={s.id} className={`d-sm-flex justify-content-between flex-wrap ${idx < recentStoppages.length - 1 ? 'mb-4' : 'mb-0'}`}>
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-danger">
                                                <i className="ti ti-alert-triangle fs-16 text-danger"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">
                                                    {s.category_name || s.reason || 'Stoppage'}
                                                </h6>
                                                <p className="fs-13 mb-0">{s.pet_name || s.line_name || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">
                                                {s.downtime_minutes || s.duration || 0} min
                                            </h6>
                                            <p className="fs-13 mb-0">
                                                {formatDate(s.created_at || s.start_time)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Production Summary */}
                <div className="col-xxl-4 col-xl-12 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h5 className="mb-0 fs-16 fw-bold">Production Summary</h5>
                        </div>
                        <div className="card-body pb-2">
                            {loading ? (
                                <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : (
                                <>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-primary">
                                                <i className="ti ti-bottle fs-16 text-primary"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Total Produced</h6>
                                                <p className="fs-13 mb-0">All lines combined</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{formatNum(stats.totalProduced)}</h6>
                                            <p className="fs-13 mb-0">bottles</p>
                                        </div>
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-success">
                                                <i className="ti ti-target fs-16 text-success"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Planned Output</h6>
                                                <p className="fs-13 mb-0">Target across lines</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{formatNum(totals.planned)}</h6>
                                            <p className="fs-13 mb-0">bottles</p>
                                        </div>
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-warning">
                                                <i className="ti ti-clock-stop fs-16 text-warning"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Total Downtime</h6>
                                                <p className="fs-13 mb-0">{stats.totalStoppages} stoppages</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{formatNum(stats.totalDowntime)}</h6>
                                            <p className="fs-13 mb-0">minutes</p>
                                        </div>
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-4">
                                        <GaugeChart
                                            value={efficiency}
                                            label="Efficiency"
                                            color={efficiency >= 85 ? '#22c55e' : efficiency >= 50 ? '#f59e0b' : '#ef4444'}
                                            max={120}
                                        />
                                    </div>
                                    <div className="d-sm-flex justify-content-between flex-wrap mb-0">
                                        <div className="d-flex align-items-center">
                                            <span className="avatar avatar-md border rounded-circle flex-shrink-0 bg-soft-info">
                                                <i className="ti ti-building-factory-2 fs-16 text-info"></i>
                                            </span>
                                            <div className="ms-2 flex-fill">
                                                <h6 className="fw-medium text-truncate mb-1 fs-14">Active Lines</h6>
                                                <p className="fs-13 mb-0">PET production lines</p>
                                            </div>
                                        </div>
                                        <div className="text-sm-end mb-0">
                                            <h6 className="fw-medium text-truncate mb-1 fs-14">{stats.activeLines}</h6>
                                            <p className="fs-13 mb-0">lines</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Overview;
