import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../api/inventory';
import { format, subDays } from 'date-fns';
import {
    Activity, Search, Filter, Clock, User, Package, ArrowRightLeft, QrCode, Tag,
    ExternalLink, Layers, Hash, Calendar, TrendingUp
} from 'lucide-react';
import { Pagination } from '../../components/ui/Pagination';

const ACTION_CONFIG = {
    BARCODE_CREATION: { label: 'Barcode Creation', icon: QrCode, color: 'success', bg: 'bg-soft-success', text: 'text-success', border: 'border-success' },
    STAGE_TRANSITION: { label: 'Stage Transition', icon: ArrowRightLeft, color: 'primary', bg: 'bg-soft-primary', text: 'text-primary', border: 'border-primary' },
    RFID_LINKING: { label: 'RFID Linking', icon: Tag, color: 'warning', bg: 'bg-soft-warning', text: 'text-warning', border: 'border-warning' },
    OTHER: { label: 'Other', icon: Activity, color: 'secondary', bg: 'bg-soft-secondary', text: 'text-secondary', border: 'border-secondary' },
    PRODUCTION_GENERATE: { label: 'Production Generate', icon: Package, color: 'success', bg: 'bg-soft-success', text: 'text-success', border: 'border-success' },
    WAREHOUSE_INBOUND: { label: 'Warehouse Inbound', icon: ArrowRightLeft, color: 'primary', bg: 'bg-soft-primary', text: 'text-primary', border: 'border-primary' },
    WAREHOUSE_OUTBOUND: { label: 'Warehouse Outbound', icon: ArrowRightLeft, color: 'warning', bg: 'bg-soft-warning', text: 'text-warning', border: 'border-warning' },
    SHIPMENT_CREATE: { label: 'Shipment Create', icon: Layers, color: 'info', bg: 'bg-soft-info', text: 'text-info', border: 'border-info' },
    UNIT_SCAN: { label: 'Unit Scan', icon: QrCode, color: 'secondary', bg: 'bg-soft-secondary', text: 'text-secondary', border: 'border-secondary' },
};

const ActivityLogs = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [actionType, setActionType] = useState('');
    const [dateFrom, setDateFrom] = useState(() => subDays(new Date(), 7).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [showFilters, setShowFilters] = useState(false);
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const [stats, setStats] = useState({ total: 0, todayCount: 0, uniqueUnits: 0 });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = { page, page_size: pageSize };
            if (search.trim()) params.search = search.trim();
            if (actionType) params.action_type = actionType;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            const response = await inventoryApi.getActivityLogs(params);
            const envelope = response.data?.data ?? {};
            const results = Array.isArray(envelope) ? envelope : (envelope.results ?? envelope.data ?? []);
            setLogs(results);
            setCount(envelope.count ?? envelope.total ?? results.length);
        } catch (error) {
            console.error('Failed to fetch activity logs', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [allRes, todayRes] = await Promise.allSettled([
                inventoryApi.getActivityLogs({ page_size: 1 }),
                inventoryApi.getActivityLogs({ page_size: 1, date_from: today }),
            ]);
            const totalCount = allRes.status === 'fulfilled' ? (allRes.value.data?.data?.count ?? 0) : 0;
            const todayCount = todayRes.status === 'fulfilled' ? (todayRes.value.data?.data?.count ?? 0) : 0;
            setStats({ total: totalCount, todayCount, uniqueUnits: 0 });
        } catch (e) { /* silent */ }
    };

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [page, pageSize, actionType]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    const handleReset = () => {
        setSearch('');
        setActionType('');
        setDateFrom(subDays(new Date(), 7).toISOString().split('T')[0]);
        setDateTo(new Date().toISOString().split('T')[0]);
        setPage(1);
    };

    const uniqueUsers = useMemo(() => {
        const map = {};
        logs.forEach(log => {
            if (log.performed_by_name) map[log.performed_by_name] = (map[log.performed_by_name] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [logs]);

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const ActivityIcon = ({ type, size = 16 }) => {
        const config = ACTION_CONFIG[type] || ACTION_CONFIG.OTHER;
        const Icon = config.icon;
        return <Icon size={size} className={config.text} />;
    };

    const SkeletonRow = () => (
        <tr>
            <td><div className="d-flex align-items-center gap-2"><div className="spinner-grow spinner-grow-sm text-muted" /><div className="bg-light rounded" style={{ width: 120, height: 24 }} /></div></td>
            <td><div className="bg-light rounded" style={{ width: 100, height: 16 }} /></td>
            <td><div className="bg-light rounded" style={{ width: 250, height: 16 }} /></td>
            <td><div className="d-flex align-items-center gap-2"><div className="bg-light rounded-circle" style={{ width: 28, height: 28 }} /><div className="bg-light rounded" style={{ width: 80, height: 16 }} /></div></td>
            <td><div className="bg-light rounded" style={{ width: 120, height: 16 }} /></td>
        </tr>
    );

    return (
        <div className="container-fluid">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1"><Activity size={20} className="me-2" />Activity Logs</h4>
                    <p className="text-muted mb-0">Track all system events and unit movements</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={14} className="me-1" />{showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                    <button className="btn btn-sm btn-outline-primary" onClick={fetchLogs}>
                        <TrendingUp size={14} className="me-1" />Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="row g-3 mb-4">
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="avatar avatar-md bg-soft-primary rounded-circle d-flex align-items-center justify-content-center">
                                    <Clock size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-muted fs-14 mb-0">Total Logs</p>
                                    <h3 className="mb-0 fw-bold">{stats.total > 0 ? stats.total.toLocaleString() : count.toLocaleString()}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="avatar avatar-md bg-soft-success rounded-circle d-flex align-items-center justify-content-center">
                                    <Calendar size={20} className="text-success" />
                                </div>
                                <div>
                                    <p className="text-muted fs-14 mb-0">Today</p>
                                    <h3 className="mb-0 fw-bold">{stats.todayCount.toLocaleString()}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="avatar avatar-md bg-soft-info rounded-circle d-flex align-items-center justify-content-center">
                                    <Hash size={20} className="text-info" />
                                </div>
                                <div>
                                    <p className="text-muted fs-14 mb-0">Unique Units</p>
                                    <h3 className="mb-0 fw-bold">{new Set(logs.map(l => l.unit_internal_id).filter(Boolean)).size.toLocaleString()}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-center gap-3">
                                <div className="avatar avatar-md bg-soft-warning rounded-circle d-flex align-items-center justify-content-center">
                                    <User size={20} className="text-warning" />
                                </div>
                                <div>
                                    <p className="text-muted fs-14 mb-0">Active Users</p>
                                    <h3 className="mb-0 fw-bold">{uniqueUsers.length}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h6 className="mb-0"><Filter size={16} className="me-2" />Filter Options</h6>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSearchSubmit}>
                            <div className="row g-3 align-items-end">
                                <div className="col-md-3">
                                    <label className="form-label small text-muted">Search</label>
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text"><Search size={14} /></span>
                                        <input type="text" className="form-control" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted">Action Type</label>
                                    <select className="form-select form-select-sm" value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }}>
                                        <option value="">All Actions</option>
                                        {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                                            <option key={key} value={key}>{cfg.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted">Date From</label>
                                    <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label small text-muted">Date To</label>
                                    <input type="date" className="form-control form-control-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                                <div className="col-md-1">
                                    <label className="form-label small text-muted">Per Page</label>
                                    <select className="form-select form-select-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                                <div className="col-md-2 d-flex gap-2">
                                    <button type="submit" className="btn btn-primary btn-sm flex-grow-1">
                                        <Search size={14} className="me-1" />Search
                                    </button>
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset}>
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Results info bar */}
            {count > 0 && (
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="text-muted small">Showing {logs.length} of {count.toLocaleString()} logs</span>
                </div>
            )}

            {/* Table */}
            <div className="card">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th>Activity Type</th>
                                    <th>Unit</th>
                                    <th>Description</th>
                                    <th>User</th>
                                    <th>Timestamp</th>
                                    <th style={{ width: 50 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="7">
                                            <div className="text-center py-5">
                                                <Activity size={48} strokeWidth={1} className="text-muted mb-3" />
                                                <h6 className="text-muted mb-1">No activity logs found</h6>
                                                <p className="text-muted small mb-0">Try adjusting your filters or search criteria</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log, idx) => {
                                        const config = ACTION_CONFIG[log.activity_type] || ACTION_CONFIG.OTHER;
                                        const Icon = config.icon;
                                        return (
                                            <tr
                                                key={log.id}
                                                className="cursor-pointer"
                                                onClick={() => navigate(`/post-production/activity-logs/${log.id}`)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td className="text-muted small">{((page - 1) * pageSize) + idx + 1}</td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className={`avatar avatar-xs ${config.bg} rounded-circle d-flex align-items-center justify-content-center`}>
                                                            <Icon size={14} />
                                                        </div>
                                                        <span className={`badge ${config.bg} ${config.text}`}>{config.label}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {log.unit_internal_id ? (
                                                        <code className="small bg-light px-2 py-1 rounded">{log.unit_internal_id}</code>
                                                    ) : (
                                                        <span className="text-muted small">—</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="small" style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.description}>
                                                        {log.description || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="avatar avatar-xs bg-light rounded-circle d-flex align-items-center justify-content-center fw-bold small text-muted">
                                                            {getInitials(log.performed_by_name)}
                                                        </div>
                                                        <span className="small">{log.performed_by_name || '—'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="small">
                                                        {log.timestamp ? format(new Date(log.timestamp), 'dd MMM yyyy') : '—'}
                                                        <br />
                                                        <span className="text-muted">{log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : ''}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <ExternalLink size={14} className="text-muted" />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Pagination
                    page={page}
                    pageSize={pageSize}
                    totalCount={count}
                    onPageChange={setPage}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                    pageSizeOptions={[10, 20, 50, 100]}
                    itemLabel="activity logs"
                />
            </div>
        </div>
    );
};

export default ActivityLogs;
