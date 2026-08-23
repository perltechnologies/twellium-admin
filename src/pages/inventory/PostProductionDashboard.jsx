import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { inventoryApi } from '../../api/inventory';
import { useTheme } from '../../context/ThemeContext';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
    Package, Boxes, CheckCircle2, Truck, AlertTriangle, ArrowRightLeft,
    RefreshCw, QrCode, Search, TrendingUp, GitBranch, BarChart3,
    Activity, ShieldCheck, Layers, FileText, ScanLine
} from 'lucide-react';

const STAGE_CONFIG = {
    PRODUCTION: { label: 'Production', icon: Package, color: '#3b82f6', bg: 'bg-soft-primary', text: 'text-primary' },
    WAREHOUSE: { label: 'Warehouse Storage', icon: Boxes, color: '#06b6d4', bg: 'bg-soft-info', text: 'text-info' },
    QUALIFIED: { label: 'QA Qualified', icon: CheckCircle2, color: '#22c55e', bg: 'bg-soft-success', text: 'text-success' },
    EXTERNAL_WAREHOUSE: { label: 'External WH', icon: Truck, color: '#f59e0b', bg: 'bg-soft-warning', text: 'text-warning' },
    LOADING: { label: 'Loading Bay', icon: ArrowRightLeft, color: '#8b5cf6', bg: 'bg-soft-purple', text: 'text-purple' },
    LOADED: { label: 'Loaded / Out', icon: ShieldCheck, color: '#16a34a', bg: 'bg-soft-success', text: 'text-success' },
    FAULTY: { label: 'Faulty Quarantine', icon: AlertTriangle, color: '#ef4444', bg: 'bg-soft-danger', text: 'text-danger' },
    DAMAGED: { label: 'Damaged', icon: AlertTriangle, color: '#dc2626', bg: 'bg-soft-danger', text: 'text-danger' },
};

const ACTION_BADGES = {
    BARCODE_CREATION: { label: 'Barcode Created', bg: 'bg-soft-success text-success' },
    STAGE_TRANSITION: { label: 'Stage Transition', bg: 'bg-soft-primary text-primary' },
    RFID_LINKING: { label: 'RFID Linked', bg: 'bg-soft-warning text-warning' },
    PRODUCTION_GENERATE: { label: 'Unit Generated', bg: 'bg-soft-success text-success' },
    WAREHOUSE_INBOUND: { label: 'WH Inbound', bg: 'bg-soft-info text-info' },
    WAREHOUSE_OUTBOUND: { label: 'WH Outbound', bg: 'bg-soft-warning text-warning' },
    UNIT_SCAN: { label: 'Unit Scanned', bg: 'bg-soft-secondary text-secondary' },
};

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (envelope?.results && Array.isArray(envelope.results)) return envelope.results;
    if (envelope?.data && Array.isArray(envelope.data)) return envelope.data;
    return [];
};

const PostProductionDashboard = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30);

    const [stats, setStats] = useState({
        palletsToday: 0,
        activeUnits: 0,
        bottlesToday: 0,
        packsToday: 0,
        qualifiedCount: 0,
        faultyCount: 0,
        activitiesCount: 0,
    });
    const [stageCounts, setStageCounts] = useState({});
    const [productBreakdown, setProductBreakdown] = useState([]);
    const [activities, setActivities] = useState([]);
    const [recentUnits, setRecentUnits] = useState([]);
    const [activeFeedTab, setActiveFeedTab] = useState('activities');

    const fetchDashboardData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const [overviewRes, stageRes, activityRes, unitsRes] = await Promise.allSettled([
                inventoryApi.getTodayOverview(),
                inventoryApi.getStageCounts(),
                inventoryApi.getActivityLogs({ page_size: 10 }),
                inventoryApi.getHandlingUnits({ page_size: 8, ordering: '-created_at' }),
            ]);

            const overview = overviewRes.status === 'fulfilled' ? (overviewRes.value?.data?.data ?? overviewRes.value?.data ?? {}) : {};
            const stageData = stageRes.status === 'fulfilled' ? (stageRes.value?.data?.data ?? stageRes.value?.data ?? {}) : {};
            const activityData = activityRes.status === 'fulfilled' ? extractData(activityRes.value) : [];
            const unitsData = unitsRes.status === 'fulfilled' ? extractData(unitsRes.value) : [];

            const counts = stageData.stage_counts || {};
            const totalActive = stageData.total_units || overview.total_units_active || Object.values(counts).reduce((s, c) => s + (Number(c) || 0), 0);

            setStats({
                palletsToday: overview.new_pallets_produced || overview.total_pallets || 0,
                activeUnits: totalActive,
                bottlesToday: overview.total_bottles || 0,
                packsToday: overview.total_packs || 0,
                qualifiedCount: counts.QUALIFIED || 0,
                faultyCount: (counts.FAULTY || 0) + (counts.DAMAGED || 0),
                activitiesCount: activityData.length,
            });

            setStageCounts(counts);
            setProductBreakdown(Array.isArray(stageData.product_breakdown) ? stageData.product_breakdown : []);
            setActivities(activityData);
            setRecentUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        if (!autoRefresh) return;
        const timer = setInterval(() => {
            fetchDashboardData(true);
        }, refreshInterval * 1000);
        return () => clearInterval(timer);
    }, [autoRefresh, refreshInterval, fetchDashboardData]);

    // Donut chart data for stages
    const stageChartData = useMemo(() => {
        return Object.entries(stageCounts)
            .filter(([, count]) => Number(count) > 0)
            .map(([stageKey, count]) => {
                const cfg = STAGE_CONFIG[stageKey] || { label: stageKey.replace(/_/g, ' '), color: '#64748b' };
                return {
                    name: cfg.label,
                    stageKey,
                    value: Number(count),
                    color: cfg.color,
                };
            })
            .sort((a, b) => b.value - a.value);
    }, [stageCounts]);

    // Product bar chart data
    const productChartData = useMemo(() => {
        const list = productBreakdown.length > 0 ? productBreakdown : [];
        return [...list]
            .sort((a, b) => (b.total_count || 0) - (a.total_count || 0))
            .slice(0, 6)
            .map(p => ({
                name: (p.name || 'Unknown').length > 18 ? (p.name || '').slice(0, 16) + '…' : p.name,
                fullName: p.name,
                pallets: p.total_count || p.pallets || 0,
            }));
    }, [productBreakdown]);

    const qualifiedRate = stats.activeUnits > 0
        ? Math.round((stats.qualifiedCount / stats.activeUnits) * 100)
        : 0;

    const chartGridColor = isDark ? '#334155' : '#f1f5f9';
    const chartTextColor = isDark ? '#94a3b8' : '#64748b';
    const tooltipBg = isDark ? '#1e293b' : '#ffffff';
    const tooltipBorder = isDark ? '#475569' : '#e2e8f0';

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-2 rounded shadow-sm border small" style={{ background: tooltipBg, borderColor: tooltipBorder, color: isDark ? '#f8fafc' : '#1e293b' }}>
                    <p className="fw-bold mb-1">{payload[0].payload.fullName || payload[0].name || label}</p>
                    <div className="text-primary fw-semibold">
                        {payload[0].value.toLocaleString()} units
                    </div>
                </div>
            );
        }
        return null;
    };

    const workflowCategories = [
        {
            title: 'Production & Labelling',
            color: '#3b82f6',
            items: [
                { title: 'Production Mode', desc: 'Create handling units & auto-generate barcode labels', icon: Package, path: '/post-production/production', badge: 'Active' },
                { title: 'Bulk Barcodes', desc: 'Batch generate & export PDF pallet barcode labels', icon: QrCode, path: '/post-production/analytics/bulk-barcodes', badge: 'Export PDF' },
                { title: 'Transfer Form', desc: 'Official production-to-warehouse dispatch form', icon: FileText, path: '/post-production/batch-print-transfer', badge: 'Printable' },
                { title: 'Batch Scan', desc: 'High-speed multi-barcode scanner & stage check-in', icon: ScanLine, path: '/post-production/batch-scan', badge: 'Scanner' },
            ]
        },
        {
            title: 'Traceability & Analytics',
            color: '#8b5cf6',
            items: [
                { title: 'Batch Traceability', desc: 'Trace pallets back to batch numbers & bottle yields', icon: GitBranch, path: '/post-production/analytics/batch-traceability', badge: 'Trace' },
                { title: 'Product Analysis', desc: 'Detailed SKU volume & packaging metrics', icon: BarChart3, path: '/post-production/analytics/product-analysis', badge: 'Metrics' },
                { title: 'Pet Line Performance', desc: 'Output comparison and ranking across PET lines', icon: TrendingUp, path: '/post-production/analytics/pet-performance', badge: 'Ranking' },
                { title: 'Plant Live Telemetry', desc: 'Live multi-line overview with OEE & syrup yields', icon: Activity, path: '/post-production/analytics/plant-overview', badge: 'Live OEE' },
            ]
        },
        {
            title: 'Warehouse & Logistics',
            color: '#06b6d4',
            items: [
                { title: 'Warehouse Workflows', desc: 'Monitor stage movements and inventory queues', icon: Boxes, path: '/post-production/warehouse', badge: 'Workflow' },
                { title: 'Loading & Dispatch', desc: 'Vehicle loading manifest and driver assignments', icon: Truck, path: '/post-production/logistics/dispatch', badge: 'Logistics' },
                { title: 'Vehicle Dispatch', desc: 'Customer delivery mapping and batch dispatches', icon: ArrowRightLeft, path: '/post-production/analytics/vehicle-dispatch', badge: 'Dispatch' },
                { title: 'Unit Lookup & Reprints', desc: 'Diagnostic RFID & barcode verification tool', icon: Search, path: '/post-production/lookup', badge: 'Diagnostic' },
            ]
        }
    ];

    return (
        <div className="container-fluid px-0">
            {/* Top Control Bar / Hero */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <h4 className="fw-bold mb-0 text-dark">Post-Production Command Center</h4>
                        <span className="badge bg-soft-success text-success d-flex align-items-center gap-1 rounded-pill px-2.5 py-1">
                            <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '0.45rem', height: '0.45rem' }}></span>
                            Telemetry Live
                        </span>
                    </div>
                    <p className="text-muted small mb-0">
                        Real-time pallet lifecycle, warehouse stage telemetry & batch traceability
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Auto Refresh Toggle */}
                    <div className="d-flex align-items-center gap-2 bg-light px-3 py-1.5 rounded border">
                        <small className="text-muted">Auto-sync:</small>
                        <div className="form-check form-switch mb-0">
                            <input
                                className="form-check-input cursor-pointer"
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                        </div>
                        {autoRefresh && (
                            <select
                                className="form-select form-select-sm border-0 bg-transparent py-0 ps-1 pe-3 text-muted"
                                style={{ width: 'auto', fontSize: '0.8rem' }}
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            >
                                <option value={15}>15s</option>
                                <option value={30}>30s</option>
                                <option value={60}>60s</option>
                            </select>
                        )}
                    </div>

                    <button
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                        onClick={() => fetchDashboardData(true)}
                        disabled={loading || refreshing}
                        title="Refresh metrics"
                    >
                        <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
                        <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
                    </button>

                    <button
                        className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
                        onClick={() => navigate('/post-production/production')}
                    >
                        <Package size={14} />
                        <span>Create Unit</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="row g-3 mb-4">
                {/* Pallets Today */}
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100 border-start border-4 border-success shadow-none border-top-0 border-end-0 border-bottom-0">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Pallets Today</span>
                                <div className="avatar avatar-sm bg-soft-success rounded-circle d-flex align-items-center justify-content-center">
                                    <Package size={16} className="text-success" />
                                </div>
                            </div>
                            <div className="d-flex align-items-baseline gap-2">
                                <h3 className="fw-bold mb-0 text-dark">{stats.palletsToday.toLocaleString()}</h3>
                                <span className="badge bg-soft-success text-success small">New</span>
                            </div>
                            <div className="mt-2 text-muted small d-flex justify-content-between">
                                <span>Bottles: {stats.bottlesToday > 0 ? stats.bottlesToday.toLocaleString() : '—'}</span>
                                <span>Packs: {stats.packsToday > 0 ? stats.packsToday.toLocaleString() : '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Inventory */}
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100 border-start border-4 border-primary shadow-none border-top-0 border-end-0 border-bottom-0">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Active Pallets</span>
                                <div className="avatar avatar-sm bg-soft-primary rounded-circle d-flex align-items-center justify-content-center">
                                    <Boxes size={16} className="text-primary" />
                                </div>
                            </div>
                            <div className="d-flex align-items-baseline gap-2">
                                <h3 className="fw-bold mb-0 text-dark">{stats.activeUnits.toLocaleString()}</h3>
                                <span className="text-muted small">Total tracked</span>
                            </div>
                            <div className="mt-2 text-muted small">
                                Across <strong>{stageChartData.length}</strong> active warehouse stages
                            </div>
                        </div>
                    </div>
                </div>

                {/* Qualified Quality Rate */}
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100 border-start border-4 border-info shadow-none border-top-0 border-end-0 border-bottom-0">
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">QA Qualified</span>
                                <div className="avatar avatar-sm bg-soft-info rounded-circle d-flex align-items-center justify-content-center">
                                    <CheckCircle2 size={16} className="text-info" />
                                </div>
                            </div>
                            <div className="d-flex align-items-baseline gap-2">
                                <h3 className="fw-bold mb-0 text-dark">{stats.qualifiedCount.toLocaleString()}</h3>
                                <span className="badge bg-soft-info text-info small">{qualifiedRate}% of total</span>
                            </div>
                            <div className="progress mt-2" style={{ height: '5px' }}>
                                <div className="progress-bar bg-info" style={{ width: `${qualifiedRate}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exceptions & Alerts */}
                <div className="col-xl-3 col-sm-6">
                    <div className={`card h-100 border-start border-4 ${stats.faultyCount > 0 ? 'border-danger' : 'border-secondary'} shadow-none border-top-0 border-end-0 border-bottom-0`}>
                        <div className="card-body p-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="text-muted small fw-semibold text-uppercase">Faulty / Quarantine</span>
                                <div className={`avatar avatar-sm ${stats.faultyCount > 0 ? 'bg-soft-danger' : 'bg-soft-secondary'} rounded-circle d-flex align-items-center justify-content-center`}>
                                    <AlertTriangle size={16} className={stats.faultyCount > 0 ? 'text-danger' : 'text-secondary'} />
                                </div>
                            </div>
                            <div className="d-flex align-items-baseline gap-2">
                                <h3 className={`fw-bold mb-0 ${stats.faultyCount > 0 ? 'text-danger' : 'text-dark'}`}>{stats.faultyCount}</h3>
                                <span className="text-muted small">Units flagged</span>
                            </div>
                            <div className="mt-2 text-muted small">
                                {stats.faultyCount > 0 ? (
                                    <span className="text-danger fw-semibold">Action required in quarantine</span>
                                ) : (
                                    <span className="text-success">All quality gates clear</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Stage Telemetry Pipeline */}
            <div className="card mb-4 border shadow-none">
                <div className="card-header bg-light d-flex align-items-center justify-content-between py-2.5">
                    <div className="d-flex align-items-center gap-2">
                        <Boxes size={16} className="text-primary" />
                        <h6 className="fw-bold mb-0 text-dark">Live Stage Telemetry Pipeline</h6>
                    </div>
                    <button
                        className="btn btn-link btn-sm text-primary p-0 text-decoration-none"
                        onClick={() => navigate('/post-production/overview')}
                    >
                        Detailed Stage Breakdown →
                    </button>
                </div>
                <div className="card-body p-3">
                    <div className="row g-2">
                        {Object.entries(STAGE_CONFIG).map(([stageKey, cfg]) => {
                            const count = Number(stageCounts[stageKey] || 0);
                            const IconComponent = cfg.icon;
                            const pct = stats.activeUnits > 0 ? Math.round((count / stats.activeUnits) * 100) : 0;

                            return (
                                <div key={stageKey} className="col-xxl-3 col-lg-3 col-md-4 col-sm-6">
                                    <div
                                        className="p-3 rounded border transition-all h-100 cursor-pointer hover-shadow bg-light"
                                        onClick={() => navigate(`/post-production/pallets/${stageKey}`)}
                                    >
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className={`avatar avatar-xs ${cfg.bg} rounded-circle d-flex align-items-center justify-content-center`}>
                                                    <IconComponent size={13} className={cfg.text} />
                                                </div>
                                                <span className="fw-semibold small text-dark">{cfg.label}</span>
                                            </div>
                                            <span className="badge bg-light text-muted border small">{pct}%</span>
                                        </div>
                                        <div className="d-flex align-items-baseline justify-content-between mt-2">
                                            <h4 className="fw-bold mb-0 text-dark">{count.toLocaleString()}</h4>
                                            <span className="text-muted small" style={{ fontSize: '0.75rem' }}>View units →</span>
                                        </div>
                                        <div className="progress mt-2" style={{ height: '3px' }}>
                                            <div className="progress-bar" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cfg.color }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Charts & Analytical Breakdown Row */}
            <div className="row g-3 mb-4">
                {/* Donut Chart: Units by Stage */}
                <div className="col-lg-5">
                    <div className="card h-100 border shadow-none">
                        <div className="card-header bg-light d-flex align-items-center justify-content-between py-2.5">
                            <div className="d-flex align-items-center gap-2">
                                <BarChart3 size={16} className="text-primary" />
                                <h6 className="fw-bold mb-0 text-dark">Stage Inventory Distribution</h6>
                            </div>
                            <span className="badge bg-soft-primary text-primary small">{stats.activeUnits} Units</span>
                        </div>
                        <div className="card-body p-3">
                            {stageChartData.length > 0 ? (
                                <div>
                                    <div style={{ height: 230 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stageChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {stageChartData.map((entry, idx) => (
                                                        <Cell key={idx} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Legend Chips */}
                                    <div className="d-flex flex-wrap justify-content-center gap-2 mt-2 pt-2 border-top">
                                        {stageChartData.map((entry, idx) => (
                                            <span
                                                key={idx}
                                                className="d-flex align-items-center gap-1.5 px-2 py-1 rounded bg-light border cursor-pointer small"
                                                onClick={() => navigate(`/post-production/pallets/${entry.stageKey}`)}
                                                title={`Click to view ${entry.name} pallets`}
                                            >
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }}></span>
                                                <span className="text-muted">{entry.name}:</span>
                                                <strong className="text-dark">{entry.value.toLocaleString()}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <Boxes size={36} strokeWidth={1} className="mb-2 opacity-50" />
                                    <p className="mb-0 small">No inventory stage telemetry available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top SKUs / Product Volume Chart */}
                <div className="col-lg-7">
                    <div className="card h-100 border shadow-none">
                        <div className="card-header bg-light d-flex align-items-center justify-content-between py-2.5">
                            <div className="d-flex align-items-center gap-2">
                                <BarChart3 size={16} className="text-primary" />
                                <h6 className="fw-bold mb-0 text-dark">Top Product Inventory Volume</h6>
                            </div>
                            <button
                                className="btn btn-link btn-sm text-primary p-0 text-decoration-none"
                                onClick={() => navigate('/post-production/analytics/product-analysis')}
                            >
                                Full Analysis →
                            </button>
                        </div>
                        <div className="card-body p-3">
                            {productChartData.length > 0 ? (
                                <div style={{ height: 260 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={productChartData}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                                            <XAxis
                                                type="number"
                                                tick={{ fill: chartTextColor, fontSize: 11 }}
                                                tickFormatter={v => v.toLocaleString()}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                tick={{ fill: chartTextColor, fontSize: 11, fontWeight: 500 }}
                                                width={130}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="pallets" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Pallets" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="text-center py-5 text-muted">
                                    <Package size={36} strokeWidth={1} className="mb-2 opacity-50" />
                                    <p className="mb-0 small">No product volume breakdown available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Operations Directory (Workflow Hub) */}
            <div className="card mb-4 border shadow-none">
                <div className="card-header bg-light d-flex align-items-center justify-content-between py-2.5">
                    <div className="d-flex align-items-center gap-2">
                        <Layers size={16} className="text-primary" />
                        <h6 className="fw-bold mb-0 text-dark">Operational Workflows & Modules</h6>
                    </div>
                    <small className="text-muted">1-Click quick access</small>
                </div>
                <div className="card-body p-3">
                    <div className="row g-3">
                        {workflowCategories.map((category, catIdx) => (
                            <div key={catIdx} className="col-lg-4 col-md-6">
                                <div className="p-2.5 rounded bg-light border h-100">
                                    <div className="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom">
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: category.color }}></span>
                                        <span className="fw-bold small text-dark">{category.title}</span>
                                    </div>
                                    <div className="d-flex flex-column gap-2">
                                        {category.items.map((item, itemIdx) => {
                                            const IconComp = item.icon;
                                            return (
                                                <div
                                                    key={itemIdx}
                                                    className="p-2 rounded bg-white border cursor-pointer d-flex align-items-center justify-content-between transition-all"
                                                    onClick={() => navigate(item.path)}
                                                >
                                                    <div className="d-flex align-items-center gap-2.5">
                                                        <div className="avatar avatar-xs bg-light rounded d-flex align-items-center justify-content-center">
                                                            <IconComp size={14} style={{ color: category.color }} />
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold small text-dark leading-tight">{item.title}</div>
                                                            <small className="text-muted d-block" style={{ fontSize: '0.72rem', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {item.desc}
                                                            </small>
                                                        </div>
                                                    </div>
                                                    <span className="badge bg-light text-muted border" style={{ fontSize: '0.68rem' }}>
                                                        {item.badge}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Live Feed: Recent Activities & Recent Units */}
            <div className="card border shadow-none">
                <div className="card-header bg-light d-flex align-items-center justify-content-between py-2">
                    <ul className="nav nav-pills card-header-pills gap-1">
                        <li className="nav-item">
                            <button
                                className={`nav-link btn-sm py-1 px-3 small ${activeFeedTab === 'activities' ? 'active bg-primary' : ''}`}
                                onClick={() => setActiveFeedTab('activities')}
                            >
                                <Activity size={14} className="me-1" />
                                Recent Activity Stream ({activities.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link btn-sm py-1 px-3 small ${activeFeedTab === 'units' ? 'active bg-primary' : ''}`}
                                onClick={() => setActiveFeedTab('units')}
                            >
                                <Package size={14} className="me-1" />
                                Latest Pallet Units ({recentUnits.length})
                            </button>
                        </li>
                    </ul>

                    {activeFeedTab === 'activities' ? (
                        <button
                            className="btn btn-sm btn-link text-primary p-0 text-decoration-none"
                            onClick={() => navigate('/post-production/activity-logs')}
                        >
                            View All Logs →
                        </button>
                    ) : (
                        <button
                            className="btn btn-sm btn-link text-primary p-0 text-decoration-none"
                            onClick={() => navigate('/post-production/production')}
                        >
                            Production Mode →
                        </button>
                    )}
                </div>

                <div className="card-body p-0">
                    {activeFeedTab === 'activities' ? (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light small">
                                    <tr>
                                        <th>Action Type</th>
                                        <th>Unit ID</th>
                                        <th>Description</th>
                                        <th>Performed By</th>
                                        <th className="text-end">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activities.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="text-center py-4 text-muted small">
                                                No recent activity logs recorded
                                            </td>
                                        </tr>
                                    ) : (
                                        activities.map((act) => {
                                            const badgeInfo = ACTION_BADGES[act.activity_type] || { label: act.activity_type || 'Event', bg: 'bg-soft-secondary text-secondary' };
                                            return (
                                                <tr
                                                    key={act.id}
                                                    className="cursor-pointer"
                                                    onClick={() => navigate(`/post-production/activity-logs/${act.id}`)}
                                                >
                                                    <td>
                                                        <span className={`badge ${badgeInfo.bg} small`}>{badgeInfo.label}</span>
                                                    </td>
                                                    <td>
                                                        {act.unit_internal_id ? (
                                                            <code className="small bg-light px-1.5 py-0.5 rounded">{act.unit_internal_id}</code>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="small" style={{ maxWidth: 280, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                        {act.description || '—'}
                                                    </td>
                                                    <td className="small text-muted">{act.performed_by_name || 'System'}</td>
                                                    <td className="text-end small text-muted">
                                                        {act.timestamp ? format(new Date(act.timestamp), 'dd MMM, HH:mm') : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light small">
                                    <tr>
                                        <th>Barcode</th>
                                        <th>Product</th>
                                        <th>Pet Line</th>
                                        <th className="text-end">Quantity</th>
                                        <th>Stage</th>
                                        <th className="text-end">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentUnits.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-4 text-muted small">
                                                No recent pallet units recorded
                                            </td>
                                        </tr>
                                    ) : (
                                        recentUnits.map((unit) => {
                                            const barcode = unit.barcode || unit.current_barcode || unit.id || '—';
                                            const stageCfg = STAGE_CONFIG[unit.stage] || { label: unit.stage || 'PRODUCTION', bg: 'bg-soft-primary', text: 'text-primary' };
                                            return (
                                                <tr
                                                    key={unit.id || barcode}
                                                    className="cursor-pointer"
                                                    onClick={() => navigate(`/post-production/pallets/details/${unit.id || barcode}`)}
                                                >
                                                    <td>
                                                        <code className="fw-bold small">{barcode}</code>
                                                    </td>
                                                    <td className="small fw-semibold">{unit.product_name || unit.product?.name || unit.product || '—'}</td>
                                                    <td>
                                                        <span className="badge bg-light text-dark border small">{unit.pet_name || unit.pet?.pet_name || unit.pet || 'Line'}</span>
                                                    </td>
                                                    <td className="text-end fw-bold small">{unit.quantity || 0}</td>
                                                    <td>
                                                        <span className={`badge ${stageCfg.bg} ${stageCfg.text} small`}>{stageCfg.label}</span>
                                                    </td>
                                                    <td className="text-end small text-muted">
                                                        {unit.created_at ? format(new Date(unit.created_at), 'dd MMM, HH:mm') : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PostProductionDashboard;
