import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Download, Search, RotateCcw, ArrowRightLeft, Layers, Package, FileText, Eye } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { loadAllHandlingUnits } from '../../api/inventory';
import { getUnitsCache, hydrateUnitsCache, setUnitsCache } from '../../utils/unitsCache';
import { getUnitsSignature } from '../../utils/unitsSnapshot';
import { Pagination } from '../../components/ui/Pagination';
import TransferDetailModal from '../../components/post-production/TransferDetailModal';
import { exportToExcel } from '../../utils/exportUtils';
import {
    DIRECTION_LABELS,
    DIRECTION_PENDING,
    DIRECTION_PRODUCTION_STAGING,
    DIRECTION_STAGING_WAREHOUSE,
    buildTransferId,
    getCreatedAt,
    getPacks,
    getPetName,
    getProductName,
    getUnitDirection,
    getUpdatedAt,
    normalizeTransferId,
    toDateKey,
} from '../../utils/transferUtils';

/**
 * Transfer Analytics
 * -------------------
 * There is no transfer record on the backend. A transfer form is derived from
 * handling units: same production date + product + PET line + direction.
 *   - Production -> Staging : pallets now sitting in the staging warehouse
 *   - Staging -> Warehouse  : pallets now in the main warehouse
 *   - Pending               : pallets still in production (not transferred yet)
 * The transfer date is when the pallets last changed stage (updated_at); for
 * pending pallets it is the production date.
 */

const DIRECTION_COLORS = {
    [DIRECTION_PRODUCTION_STAGING]: '#3b82f6',
    [DIRECTION_STAGING_WAREHOUSE]: '#22c55e',
    [DIRECTION_PENDING]: '#f59e0b',
};
const DIRECTIONS = [DIRECTION_PRODUCTION_STAGING, DIRECTION_STAGING_WAREHOUSE, DIRECTION_PENDING];

const isoDaysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
};

const petSort = (a, b) => {
    const an = parseInt(String(a).match(/\d+/)?.[0] || '999', 10);
    const bn = parseInt(String(b).match(/\d+/)?.[0] || '999', 10);
    return an - bn || String(a).localeCompare(String(b));
};

const TransferAnalytics = () => {
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null); // transfer row shown in the detail modal
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: null });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const [filters, setFilters] = useState({
        startDate: isoDaysAgo(30),
        endDate: new Date().toISOString().split('T')[0],
        direction: '',
        petName: '',
        productName: '',
        transferId: '',
    });

    // Transfer forms are derived from units, so every unit is needed. They are loaded
    // 100 per request: the first page paints straight away and the rest stream in
    // (parallel). On a refresh the current data stays until the new load completes.
    const loadSeq = useRef(0);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const fetchData = async () => {
        const seq = ++loadSeq.current;
        const isCurrent = () => mounted.current && seq === loadSeq.current;
        const progressive = units.length === 0;
        const collected = new Map();

        setLoading(true);
        setError('');
        setLoadProgress({ loaded: 0, total: null });
        try {
            const signature = await getUnitsSignature();
            if (!isCurrent()) return;
            const result = await loadAllHandlingUnits({}, {
                isCancelled: () => !isCurrent(),
                onPage: (items, { total }) => {
                    if (!isCurrent()) return;
                    items.forEach((u) => collected.set(u.id ?? u.internal_id ?? `row-${collected.size}`, u));
                    setLoadProgress({ loaded: collected.size, total });
                    if (progressive) setUnits(Array.from(collected.values()));
                },
            });
            if (result.cancelled || !isCurrent()) return;
            const list = Array.from(collected.values());
            setUnits(list);
            const fetchedAt = new Date();
            setLastUpdated(fetchedAt);
            if (result.failedPages > 0 || (result.total !== null && list.length < result.total)) {
                setError(`Loaded ${list.length.toLocaleString()}${result.total !== null ? ` of ${result.total.toLocaleString()}` : ''} pallets. Some could not be loaded.`);
            } else {
                // Complete snapshot: lets the transfer form open without reloading every pallet.
                setUnitsCache(list, fetchedAt, signature);
            }
        } catch (err) {
            console.error('Failed to load transfers:', err);
            if (!isCurrent()) return;
            setError('Could not load transfer data. Please try again.');
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    // Loaded once: a cached list is reused unless the per-stage counts show the data changed.
    // Refresh always reloads.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const cached = getUnitsCache() || await hydrateUnitsCache();
            if (cancelled) return;
            if (!cached) {
                fetchData();
                return;
            }
            setUnits(cached.units);
            setLastUpdated(new Date(cached.fetchedAt));
            setLoading(false);
            const signature = await getUnitsSignature();
            if (cancelled) return;
            if (!signature || signature !== cached.signature) fetchData();
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Transfer forms = units grouped by production date + product + PET + direction.
    const transfers = useMemo(() => {
        const map = {};
        units.forEach((u) => {
            const createdKey = toDateKey(getCreatedAt(u));
            const direction = getUnitDirection(u);
            const productName = getProductName(u);
            const petName = getPetName(u);
            const key = `${createdKey}||${productName}||${petName}||${direction}`;
            const transferKey = toDateKey(direction === DIRECTION_PENDING ? getCreatedAt(u) : getUpdatedAt(u));
            if (!map[key]) {
                map[key] = {
                    key,
                    transferId: buildTransferId(createdKey, productName, petName),
                    productionDate: createdKey,
                    transferDate: transferKey,
                    direction,
                    productName,
                    petName,
                    pallets: 0,
                    packs: 0,
                    units: [],
                };
            }
            map[key].pallets += 1;
            map[key].packs += getPacks(u);
            map[key].units.push(u);
            if (transferKey > map[key].transferDate) map[key].transferDate = transferKey;
        });
        return Object.values(map);
    }, [units]);

    const petOptions = useMemo(() => [...new Set(transfers.map((t) => t.petName))].sort(petSort), [transfers]);
    const productOptions = useMemo(() => [...new Set(transfers.map((t) => t.productName))].sort(), [transfers]);

    const filtered = useMemo(() => {
        const wantedId = normalizeTransferId(filters.transferId);
        return transfers
        .filter((t) => {
            // A Transfer ID search looks across all dates.
            if (!wantedId) {
                if (t.transferDate === 'unknown') return !filters.startDate && !filters.endDate;
                if (filters.startDate && t.transferDate < filters.startDate) return false;
                if (filters.endDate && t.transferDate > filters.endDate) return false;
            }
            if (filters.direction && t.direction !== filters.direction) return false;
            if (filters.petName && t.petName !== filters.petName) return false;
            if (filters.productName && t.productName !== filters.productName) return false;
            if (wantedId && !normalizeTransferId(t.transferId).includes(wantedId)) return false;
            return true;
        })
        .sort((a, b) => (a.transferDate < b.transferDate ? 1 : a.transferDate > b.transferDate ? -1 : a.transferId.localeCompare(b.transferId)));
    }, [transfers, filters]);

    useEffect(() => { setPage(1); }, [filters, pageSize]);

    const totals = useMemo(() => {
        const t = { forms: filtered.length, pallets: 0, packs: 0, byDirection: {} };
        DIRECTIONS.forEach((d) => { t.byDirection[d] = { forms: 0, pallets: 0 }; });
        filtered.forEach((r) => {
            t.pallets += r.pallets;
            t.packs += r.packs;
            t.byDirection[r.direction].forms += 1;
            t.byDirection[r.direction].pallets += r.pallets;
        });
        return t;
    }, [filtered]);

    // Daily trend, one column per direction
    const dailyTrend = useMemo(() => {
        const map = {};
        filtered.forEach((r) => {
            if (!map[r.transferDate]) {
                map[r.transferDate] = { date: r.transferDate };
                DIRECTIONS.forEach((d) => { map[r.transferDate][`forms_${d}`] = 0; map[r.transferDate][`pallets_${d}`] = 0; });
            }
            map[r.transferDate][`forms_${r.direction}`] += 1;
            map[r.transferDate][`pallets_${r.direction}`] += r.pallets;
        });
        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }, [filtered]);

    const visibleDirections = filters.direction ? [filters.direction] : DIRECTIONS;

    const groupBy = (field) => {
        const map = {};
        filtered.forEach((r) => {
            const k = r[field];
            if (!map[k]) map[k] = { name: k, forms: 0, pallets: 0 };
            map[k].forms += 1;
            map[k].pallets += r.pallets;
        });
        return Object.values(map);
    };
    const byPet = useMemo(() => groupBy('petName').sort((a, b) => petSort(a.name, b.name)), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
    const byProduct = useMemo(() => groupBy('productName').sort((a, b) => b.pallets - a.pallets), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

    const pagedRows = filtered.slice((page - 1) * pageSize, page * pageSize);

    const resetFilters = () => setFilters({
        startDate: isoDaysAgo(30),
        endDate: new Date().toISOString().split('T')[0],
        direction: '',
        petName: '',
        productName: '',
        transferId: '',
    });

    const handleExport = () => {
        if (filtered.length === 0) return;
        exportToExcel(
            filtered.map((r) => ({
                'Transfer ID': r.transferId,
                Direction: DIRECTION_LABELS[r.direction],
                'Transfer Date': r.transferDate,
                'Production Date': r.productionDate,
                Product: r.productName,
                PET: r.petName,
                Pallets: r.pallets,
                Packs: r.packs,
            })),
            `transfer_analytics_${filters.startDate || 'all'}_${filters.endDate || 'all'}`,
            'Transfers'
        );
    };

    const formatDate = (key) => (key && key !== 'unknown' ? new Date(key).toLocaleDateString('en-GB') : '—');

    const kpi = (icon, tone, label, value, sub) => (
        <div className="col-md-3 col-sm-6">
            <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex align-items-center gap-3">
                    <span className={`d-inline-flex align-items-center justify-content-center bg-soft-${tone} text-${tone} rounded`} style={{ width: 42, height: 42 }}>
                        {icon}
                    </span>
                    <div>
                        <span className="text-muted fs-13 d-block">{label}</span>
                        <strong className="fs-4">{value}</strong>
                        {sub && <small className="text-muted d-block">{sub}</small>}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div>
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <div>
                    <h4 className="fw-bold mb-1">Transfer Analytics</h4>
                    <p className="text-muted mb-0">
                        Transfer forms created, by direction, with pallet counts per PET and product
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    {loading && loadProgress.loaded > 0 && (
                        <span className="text-muted fs-13">
                            Loaded {loadProgress.loaded.toLocaleString()}{loadProgress.total ? ` of ${loadProgress.total.toLocaleString()}` : ''} pallets…
                        </span>
                    )}
                    {!loading && lastUpdated && (
                        <span className="text-muted fs-13">
                            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2" onClick={fetchData} disabled={loading}>
                        {loading ? <Loader2 size={15} className="spinning" /> : <RefreshCw size={15} />} Refresh
                    </button>
                    <button className="btn btn-success btn-sm d-flex align-items-center gap-2" onClick={handleExport} disabled={filtered.length === 0}>
                        <Download size={15} /> Export
                    </button>
                </div>
            </div>

            {/* Filters (single compact line) */}
            <div className="card mb-3">
                <div className="card-body py-2 px-3">
                    <div className="d-flex flex-nowrap align-items-end gap-2" style={{ overflowX: 'auto' }}>
                        <div style={{ flex: '1 1 190px', minWidth: 170 }}>
                            <label className="form-label fs-12 text-muted mb-0">Transfer ID</label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light px-2"><Search size={13} className="text-muted" /></span>
                                <input type="text" className="form-control" placeholder="TR260908-RUSH-P02"
                                    title={filters.transferId ? 'Searching all dates' : 'Partial IDs match; searches all dates'}
                                    value={filters.transferId}
                                    onChange={(e) => setFilters((f) => ({ ...f, transferId: e.target.value }))} />
                            </div>
                        </div>
                        <div style={{ flex: '0 0 125px' }}>
                            <label className="form-label fs-12 text-muted mb-0">Start</label>
                            <input type="date" className="form-control form-control-sm" value={filters.startDate}
                                disabled={!!filters.transferId}
                                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
                        </div>
                        <div style={{ flex: '0 0 125px' }}>
                            <label className="form-label fs-12 text-muted mb-0">End</label>
                            <input type="date" className="form-control form-control-sm" value={filters.endDate}
                                disabled={!!filters.transferId}
                                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
                        </div>
                        <div style={{ flex: '1 1 160px', minWidth: 150 }}>
                            <label className="form-label fs-12 text-muted mb-0">Direction</label>
                            <select className="form-select form-select-sm" value={filters.direction}
                                onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}>
                                <option value="">All directions</option>
                                {DIRECTIONS.map((d) => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '0 1 100px', minWidth: 90 }}>
                            <label className="form-label fs-12 text-muted mb-0">PET</label>
                            <select className="form-select form-select-sm" value={filters.petName}
                                onChange={(e) => setFilters((f) => ({ ...f, petName: e.target.value }))}>
                                <option value="">All</option>
                                {petOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '1 1 140px', minWidth: 130 }}>
                            <label className="form-label fs-12 text-muted mb-0">Product</label>
                            <select className="form-select form-select-sm" value={filters.productName}
                                onChange={(e) => setFilters((f) => ({ ...f, productName: e.target.value }))}>
                                <option value="">All products</option>
                                {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-outline-secondary btn-sm flex-shrink-0" onClick={resetFilters} title="Reset filters" aria-label="Reset filters">
                            <RotateCcw size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert alert-danger d-flex justify-content-between align-items-center">
                    <span>{error}</span>
                    <button className="btn btn-sm btn-outline-danger" onClick={fetchData}>Try again</button>
                </div>
            )}

            {loading && units.length === 0 ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                    <Loader2 size={28} className="text-primary spinning" />
                    <span className="ms-2 text-muted">Loading transfers…</span>
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="row g-3 mb-3">
                        {kpi(<FileText size={20} />, 'primary', 'Transfer forms', totals.forms.toLocaleString(),
                            `${totals.byDirection[DIRECTION_PRODUCTION_STAGING].forms} to staging · ${totals.byDirection[DIRECTION_STAGING_WAREHOUSE].forms} to warehouse`)}
                        {kpi(<Layers size={20} />, 'success', 'Pallets', totals.pallets.toLocaleString(),
                            `${totals.byDirection[DIRECTION_PRODUCTION_STAGING].pallets} to staging · ${totals.byDirection[DIRECTION_STAGING_WAREHOUSE].pallets} to warehouse`)}
                        {kpi(<Package size={20} />, 'info', 'Packs', totals.packs.toLocaleString())}
                        {kpi(<ArrowRightLeft size={20} />, 'warning', 'Pending in production',
                            totals.byDirection[DIRECTION_PENDING].forms.toLocaleString(),
                            `${totals.byDirection[DIRECTION_PENDING].pallets} pallets not yet transferred`)}
                    </div>

                    {filtered.length === 0 ? (
                        <div className="card"><div className="card-body text-center py-5 text-muted">
                            <Search size={40} strokeWidth={1} className="mb-2" />
                            <p className="mb-0">No transfers match the selected filters.</p>
                        </div></div>
                    ) : (
                        <>
                            {/* Trend charts */}
                            <div className="row g-3 mb-3">
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header"><h6 className="mb-0">Transfer forms per day</h6></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={dailyTrend}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                    <Tooltip />
                                                    <Legend />
                                                    {visibleDirections.map((d) => (
                                                        <Bar key={d} dataKey={`forms_${d}`} name={DIRECTION_LABELS[d]} stackId="forms" fill={DIRECTION_COLORS[d]} />
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header"><h6 className="mb-0">Pallets per day</h6></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={dailyTrend}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                    <Tooltip />
                                                    <Legend />
                                                    {visibleDirections.map((d) => (
                                                        <Line key={d} type="monotone" dataKey={`pallets_${d}`} name={DIRECTION_LABELS[d]}
                                                            stroke={DIRECTION_COLORS[d]} strokeWidth={2} dot={{ r: 3 }} />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PET / Product breakdown */}
                            <div className="row g-3 mb-3">
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header"><h6 className="mb-0">Pallets by PET</h6></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={280}>
                                                <BarChart data={byPet}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="pallets" name="Pallets" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="forms" name="Transfer forms" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header"><h6 className="mb-0">Pallets by product</h6></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={280}>
                                                <BarChart data={byProduct}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="pallets" name="Pallets" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="forms" name="Transfer forms" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="card">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0">Transfer forms</h6>
                                    <span className="badge bg-soft-primary text-primary">{filtered.length} forms</span>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0 align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Transfer ID</th>
                                                    <th>Direction</th>
                                                    <th>Transfer date</th>
                                                    <th>Production date</th>
                                                    <th>Product</th>
                                                    <th>PET</th>
                                                    <th className="text-end">Pallets</th>
                                                    <th className="text-end">Packs</th>
                                                    <th className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedRows.map((r) => (
                                                    <tr key={r.key}>
                                                        <td>
                                                            <Link to={`/post-production/batch-print-transfer?transfer_id=${encodeURIComponent(r.transferId)}`}>
                                                                <code>{r.transferId}</code>
                                                            </Link>
                                                        </td>
                                                        <td>
                                                            <span className="badge" style={{ backgroundColor: DIRECTION_COLORS[r.direction] }}>
                                                                {DIRECTION_LABELS[r.direction]}
                                                            </span>
                                                        </td>
                                                        <td>{formatDate(r.transferDate)}</td>
                                                        <td>{formatDate(r.productionDate)}</td>
                                                        <td>{r.productName}</td>
                                                        <td>{r.petName}</td>
                                                        <td className="text-end">{r.pallets.toLocaleString()}</td>
                                                        <td className="text-end">{r.packs.toLocaleString()}</td>
                                                        <td className="text-center">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                                                onClick={() => setDetail(r)}
                                                                title="View transfer details"
                                                            >
                                                                <Eye size={14} /> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="card-footer">
                                    <Pagination
                                        page={page}
                                        pageSize={pageSize}
                                        totalCount={filtered.length}
                                        onPageChange={setPage}
                                        onPageSizeChange={setPageSize}
                                        itemLabel="transfer forms"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {detail && (
                <TransferDetailModal
                    transfer={{
                        ...detail,
                        directionLabel: DIRECTION_LABELS[detail.direction],
                        directionColor: DIRECTION_COLORS[detail.direction],
                    }}
                    onClose={() => setDetail(null)}
                    onOpenForm={() => navigate(`/post-production/batch-print-transfer?transfer_id=${encodeURIComponent(detail.transferId)}`)}
                />
            )}
        </div>
    );
};

export default TransferAnalytics;
