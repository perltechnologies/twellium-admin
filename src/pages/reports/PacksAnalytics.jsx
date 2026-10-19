import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { productionApi } from '../../api/production';
import { exportToExcel } from '../../utils/exportUtils';
import { parseYmd, listDates, dayCount, presetRange } from '../../utils/dateRange';

/**
 * Packs Analytics
 * ---------------
 * Packs produced per day over a date range, filterable by product and PET line.
 *
 * Data source: GET /production/dashboard/production_summary/?start_date&end_date
 * (daily_breakdown[].pets[] carries pet_name, product_name, shift, total_packs).
 * The range is fetched once; product / PET filters and breakdowns are applied
 * client-side so the dropdowns always reflect what exists in the range.
 */

const SERIES_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#84cc16', '#f97316'];
const TOTAL_COLOR = '#3b82f6';
const MAX_RANGE_DAYS = 366;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --- field helpers ---
const isCanLine = (name) => String(name || '').toLowerCase().includes('can');
const normalizePet = (name) => {
    const match = String(name || '').toLowerCase().match(/pet\s*(\d+)/);
    return match ? `Pet ${match[1]}` : (name || 'Unknown');
};
const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString();
const shortDate = (date) => `${date.slice(5)} ${DAY_NAMES[parseYmd(date).getDay()]}`;

// Series definitions for the daily chart breakdown
const BREAKDOWNS = [
    { id: 'total', label: 'Total' },
    { id: 'product', label: 'By product' },
    { id: 'pet', label: 'By PET line' },
];

const PacksTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const rows = payload.filter((entry) => num(entry.value) > 0);
    const total = payload.reduce((sum, entry) => sum + num(entry.value), 0);
    return (
        <div className="bg-white p-3 rounded shadow-lg border" style={{ minWidth: 170 }}>
            <p className="fw-bold mb-2 border-bottom pb-2">{label}</p>
            {rows.map((entry) => (
                <div key={entry.dataKey} className="d-flex justify-content-between align-items-center mb-1">
                    <span className="d-flex align-items-center gap-1">
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                        <span>{entry.name}</span>
                    </span>
                    <span className="fw-medium ms-3">{fmt(entry.value)}</span>
                </div>
            ))}
            {rows.length > 1 && (
                <div className="d-flex justify-content-between border-top pt-2 mt-1 fw-bold">
                    <span>Total</span><span>{fmt(total)}</span>
                </div>
            )}
            {rows.length === 0 && <span className="text-muted">No packs</span>}
        </div>
    );
};

const PacksAnalytics = () => {
    const initialRange = useMemo(() => presetRange('7d'), []);
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    const [product, setProduct] = useState('');
    const [pet, setPet] = useState('');
    const [breakdown, setBreakdown] = useState('total');
    const [tab, setTab] = useState('daily');

    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const requestSeq = useRef(0);

    const rangeError = useMemo(() => {
        if (!startDate || !endDate) return 'Select a start and end date.';
        if (startDate > endDate) return 'Start date must be on or before the end date.';
        if (dayCount(startDate, endDate) > MAX_RANGE_DAYS) return `Select a range of at most ${MAX_RANGE_DAYS} days.`;
        return '';
    }, [startDate, endDate]);

    const fetchData = useCallback(async () => {
        if (rangeError) return;
        const seq = ++requestSeq.current;
        setLoading(true);
        setError('');
        try {
            const res = await productionApi.getProductionSummary({ start_date: startDate, end_date: endDate });
            if (seq !== requestSeq.current) return; // a newer request superseded this one
            setRawData(res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {});
        } catch (err) {
            if (seq !== requestSeq.current) return;
            console.error('Failed to fetch packs analytics:', err);
            setError('Could not load packs data. Please try again.');
            setRawData(null);
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [startDate, endDate, rangeError]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // One record per PET line / shift / report per day, can lines excluded.
    const records = useMemo(() => {
        const list = [];
        (rawData?.daily_breakdown || []).forEach((day) => {
            (day.pets || []).forEach((p) => {
                if (isCanLine(p.pet_name)) return;
                list.push({
                    date: day.date,
                    pet: normalizePet(p.pet_name),
                    product: p.product_name || 'Unknown',
                    shift: p.shift || '-',
                    packs: num(p.total_packs),
                });
            });
        });
        return list;
    }, [rawData]);

    const productOptions = useMemo(() => [...new Set(records.map((r) => r.product))].sort(naturalSort), [records]);
    const petOptions = useMemo(() => [...new Set(records.map((r) => r.pet))].sort(naturalSort), [records]);

    // A selection that no longer exists in the loaded range behaves as "all".
    const activeProduct = productOptions.includes(product) ? product : '';
    const activePet = petOptions.includes(pet) ? pet : '';

    const filtered = useMemo(() => records.filter((r) => (
        (!activeProduct || r.product === activeProduct) && (!activePet || r.pet === activePet)
    )), [records, activeProduct, activePet]);

    const allDates = useMemo(() => (rangeError ? [] : listDates(startDate, endDate)), [startDate, endDate, rangeError]);

    // Series used by the daily chart (index keys: product names can contain "." which recharts treats as a path).
    const series = useMemo(() => {
        if (breakdown === 'total') return [{ key: 's0', name: 'Packs', color: TOTAL_COLOR }];
        const field = breakdown === 'product' ? 'product' : 'pet';
        const totals = {};
        filtered.forEach((r) => { totals[r[field]] = (totals[r[field]] || 0) + r.packs; });
        return Object.keys(totals)
            .sort(naturalSort)
            .map((name, index) => ({ key: `s${index}`, name, color: SERIES_COLORS[index % SERIES_COLORS.length], value: name }));
    }, [breakdown, filtered]);

    const dailyRows = useMemo(() => {
        const byDate = {};
        filtered.forEach((r) => {
            if (!byDate[r.date]) byDate[r.date] = { packs: 0, products: new Set(), pets: new Set(), series: {} };
            const day = byDate[r.date];
            day.packs += r.packs;
            day.products.add(r.product);
            day.pets.add(r.pet);
            const field = breakdown === 'product' ? r.product : breakdown === 'pet' ? r.pet : null;
            if (field !== null) day.series[field] = (day.series[field] || 0) + r.packs;
        });
        return allDates.map((date) => {
            const day = byDate[date];
            return {
                date,
                label: shortDate(date),
                packs: day?.packs || 0,
                products: day?.products.size || 0,
                pets: day?.pets.size || 0,
                series: day?.series || {},
            };
        });
    }, [filtered, allDates, breakdown]);

    const chartData = useMemo(() => dailyRows.map((row) => {
        const point = { label: row.label };
        if (breakdown === 'total') point.s0 = row.packs;
        else series.forEach((s) => { point[s.key] = row.series[s.value] || 0; });
        return point;
    }), [dailyRows, series, breakdown]);

    const groupBy = useCallback((field) => {
        const map = {};
        filtered.forEach((r) => {
            const key = r[field];
            if (!map[key]) map[key] = { name: key, packs: 0, days: new Set(), products: new Set(), pets: new Set() };
            map[key].packs += r.packs;
            map[key].days.add(r.date);
            map[key].products.add(r.product);
            map[key].pets.add(r.pet);
        });
        return Object.values(map).sort((a, b) => b.packs - a.packs);
    }, [filtered]);

    const byProduct = useMemo(() => groupBy('product'), [groupBy]);
    const byPet = useMemo(() => groupBy('pet'), [groupBy]);

    const totalPacks = useMemo(() => filtered.reduce((sum, r) => sum + r.packs, 0), [filtered]);
    const producingDays = dailyRows.filter((row) => row.packs > 0).length;
    const peakDay = dailyRows.reduce((best, row) => (row.packs > (best?.packs || 0) ? row : best), null);
    const avgPerDay = allDates.length ? totalPacks / allDates.length : 0;

    const detailRecords = useMemo(
        () => [...filtered].sort((a, b) => b.date.localeCompare(a.date) || naturalSort(a.pet, b.pet)),
        [filtered]
    );

    const applyPreset = (preset) => {
        const range = presetRange(preset);
        setStartDate(range.start);
        setEndDate(range.end);
    };
    const resetFilters = () => { setProduct(''); setPet(''); setBreakdown('total'); };

    const handleExport = () => {
        const rows = detailRecords.map((r) => ({
            Date: r.date,
            'PET Line': r.pet,
            Product: r.product,
            Shift: r.shift,
            Packs: r.packs,
        }));
        exportToExcel(rows, `packs_analytics_${startDate}_${endDate}`, 'Packs');
    };

    const activeFilterCount = (activeProduct ? 1 : 0) + (activePet ? 1 : 0);
    const hasData = totalPacks > 0;
    const share = (value) => (totalPacks > 0 ? `${((value / totalPacks) * 100).toFixed(1)}%` : '0.0%');
    const scopeLabel = [activeProduct, activePet].filter(Boolean).join(' · ') || 'All products and PET lines';

    const renderGroupTable = (rows, nameHeader, onSelect, otherHeader, otherKey) => (
        <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                    <tr>
                        <th>{nameHeader}</th>
                        <th className="text-end">Packs</th>
                        <th style={{ width: '28%' }}>Share</th>
                        <th className="text-end">Days produced</th>
                        <th className="text-end">{otherHeader}</th>
                        <th className="text-end">Avg / day</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.name} style={{ cursor: 'pointer' }} onClick={() => onSelect(row.name)} title="Click to filter by this selection">
                            <td className="fw-medium">{row.name}</td>
                            <td className="text-end fw-semibold">{fmt(row.packs)}</td>
                            <td>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="progress flex-grow-1" style={{ height: 6 }}>
                                        <div className="progress-bar" style={{ width: share(row.packs), backgroundColor: TOTAL_COLOR }} />
                                    </div>
                                    <small className="text-muted" style={{ width: 44 }}>{share(row.packs)}</small>
                                </div>
                            </td>
                            <td className="text-end">{row.days.size}</td>
                            <td className="text-end">{row[otherKey].size}</td>
                            <td className="text-end">{fmt(Math.round(row.packs / Math.max(row.days.size, 1)))}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="table-light">
                    <tr>
                        <th>Total</th>
                        <th className="text-end">{fmt(totalPacks)}</th>
                        <th colSpan={4} />
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    return (
        <>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-0">Packs Analytics</h4>
                    <small className="text-muted">Packs produced per day, by product and PET line</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                    <button className="btn btn-outline-secondary btn-sm" onClick={fetchData} disabled={loading || Boolean(rangeError)}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <button className="btn btn-success btn-sm" onClick={handleExport} disabled={detailRecords.length === 0}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-xl-4 col-lg-6">
                            <label className="form-label fw-medium mb-1">Date range</label>
                            <div className="input-group input-group-sm">
                                <input type="date" className="form-control" aria-label="Start date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
                                <span className="input-group-text">to</span>
                                <input type="date" className="form-control" aria-label="End date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="col-xl-2 col-lg-6">
                            <label className="form-label fw-medium mb-1">Quick range</label>
                            <div className="btn-group btn-group-sm w-100" role="group">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('7d')}>7 days</button>
                                <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('30d')}>30 days</button>
                                <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('month')}>This month</button>
                            </div>
                        </div>
                        <div className="col-xl-2 col-md-4">
                            <label className="form-label fw-medium mb-1">Product</label>
                            <select className="form-select form-select-sm" value={activeProduct} onChange={(e) => setProduct(e.target.value)}>
                                <option value="">All products</option>
                                {productOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div className="col-xl-2 col-md-4">
                            <label className="form-label fw-medium mb-1">PET line</label>
                            <select className="form-select form-select-sm" value={activePet} onChange={(e) => setPet(e.target.value)}>
                                <option value="">All PET lines</option>
                                {petOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div className="col-xl-2 col-md-4">
                            <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={resetFilters} disabled={activeFilterCount === 0 && breakdown === 'total'}>
                                <i className="ti ti-rotate me-1"></i>Reset filters
                            </button>
                        </div>
                    </div>
                    {rangeError && <div className="alert alert-warning py-2 px-3 mt-3 mb-0 fs-13">{rangeError}</div>}
                    {error && <div className="alert alert-danger py-2 px-3 mt-3 mb-0 fs-13">{error}</div>}
                </div>
            </div>

            {/* Stat cards */}
            <div className="row row-gap-3 mb-4">
                {[
                    { label: 'Total Packs', value: fmt(totalPacks), sub: scopeLabel, color: 'primary' },
                    { label: 'Average / Day', value: fmt(Math.round(avgPerDay)), sub: `over ${allDates.length} day${allDates.length === 1 ? '' : 's'}`, color: 'success' },
                    { label: 'Peak Day', value: peakDay && peakDay.packs > 0 ? fmt(peakDay.packs) : '-', sub: peakDay && peakDay.packs > 0 ? peakDay.label : 'No production', color: 'warning' },
                    { label: 'Producing Days', value: `${producingDays} / ${allDates.length}`, sub: `${byProduct.length} product${byProduct.length === 1 ? '' : 's'} · ${byPet.length} line${byPet.length === 1 ? '' : 's'}`, color: 'info' },
                ].map((card) => (
                    <div key={card.label} className="col-xl-3 col-sm-6">
                        <div className={`card border-top border-${card.color} border-3 mb-0 h-100`}>
                            <div className="card-body">
                                <p className="text-muted fs-14 mb-2">{card.label}</p>
                                {loading && !rawData
                                    ? <div className="placeholder-glow"><span className="placeholder col-6 placeholder-lg" /></div>
                                    : <h2 className="mb-1 fs-16 fw-bold">{card.value}</h2>}
                                <small className="text-muted">{card.sub}</small>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Daily chart */}
            <div className="card mb-4">
                <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                        <h6 className="mb-0">Packs Produced per Day</h6>
                        <small className="text-muted">{scopeLabel} ({startDate} to {endDate})</small>
                    </div>
                    <div className="btn-group btn-group-sm" role="group" aria-label="Chart breakdown">
                        {BREAKDOWNS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={`btn ${breakdown === option.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setBreakdown(option.id)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="card-body">
                    {loading && !rawData ? (
                        <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
                    ) : !hasData ? (
                        <div className="text-center text-muted py-5">
                            <p className="mb-2">No packs recorded for this selection.</p>
                            {activeFilterCount > 0 && (
                                <button type="button" className="btn btn-outline-primary btn-sm" onClick={resetFilters}>Clear filters</button>
                            )}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)} />
                                <Tooltip content={<PacksTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                                {breakdown !== 'total' && <Legend />}
                                {series.map((s, index) => (
                                    <Bar
                                        key={s.key}
                                        dataKey={s.key}
                                        name={s.name}
                                        fill={s.color}
                                        stackId="packs"
                                        radius={breakdown === 'total' || index === series.length - 1 ? [4, 4, 0, 0] : 0}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Detail tables */}
            <div className="card mb-4">
                <div className="card-header">
                    <ul className="nav nav-pills mb-0" role="tablist">
                        {[
                            { id: 'daily', label: 'Daily', icon: 'ti-calendar' },
                            { id: 'product', label: 'By product', icon: 'ti-package' },
                            { id: 'pet', label: 'By PET line', icon: 'ti-layers-intersect' },
                            { id: 'records', label: 'Records', icon: 'ti-list' },
                        ].map((item) => (
                            <li className="nav-item" key={item.id}>
                                <button className={`nav-link btn-sm ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
                                    <i className={`ti ${item.icon} me-1`}></i>{item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="card-body p-0">
                    {loading && !rawData ? (
                        <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
                    ) : tab === 'daily' ? (
                        <div className="table-responsive" style={{ maxHeight: 480 }}>
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th>Date</th>
                                        <th className="text-end">Packs</th>
                                        <th className="text-end">Products</th>
                                        <th className="text-end">PET lines</th>
                                        <th style={{ width: '30%' }}>Share of range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...dailyRows].reverse().map((row) => (
                                        <tr key={row.date} className={row.packs === 0 ? 'text-muted' : ''}>
                                            <td>{row.date} <small className="text-muted">{DAY_NAMES[parseYmd(row.date).getDay()]}</small></td>
                                            <td className="text-end fw-semibold">{fmt(row.packs)}</td>
                                            <td className="text-end">{row.products}</td>
                                            <td className="text-end">{row.pets}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="progress flex-grow-1" style={{ height: 6 }}>
                                                        <div className="progress-bar" style={{ width: share(row.packs), backgroundColor: TOTAL_COLOR }} />
                                                    </div>
                                                    <small className="text-muted" style={{ width: 44 }}>{share(row.packs)}</small>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="table-light">
                                    <tr>
                                        <th>Total</th>
                                        <th className="text-end">{fmt(totalPacks)}</th>
                                        <th colSpan={3} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : tab === 'product' ? (
                        byProduct.length === 0
                            ? <p className="text-center text-muted py-5 mb-0">No data</p>
                            : renderGroupTable(byProduct, 'Product', setProduct, 'PET lines', 'pets')
                    ) : tab === 'pet' ? (
                        byPet.length === 0
                            ? <p className="text-center text-muted py-5 mb-0">No data</p>
                            : renderGroupTable(byPet, 'PET line', setPet, 'Products', 'products')
                    ) : (
                        detailRecords.length === 0 ? (
                            <p className="text-center text-muted py-5 mb-0">No data</p>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: 480 }}>
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                                        <tr>
                                            <th>Date</th>
                                            <th>PET line</th>
                                            <th>Product</th>
                                            <th>Shift</th>
                                            <th className="text-end">Packs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailRecords.map((r, index) => (
                                            <tr key={`${r.date}-${r.pet}-${r.shift}-${index}`}>
                                                <td>{r.date}</td>
                                                <td>{r.pet}</td>
                                                <td>{r.product}</td>
                                                <td>{r.shift}</td>
                                                <td className="text-end fw-semibold">{fmt(r.packs)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
                {tab !== 'daily' && tab !== 'records' && byProduct.length + byPet.length > 0 && (
                    <div className="card-footer text-muted fs-13">Click a row to filter the report by that {tab === 'product' ? 'product' : 'PET line'}.</div>
                )}
            </div>
        </>
    );
};

export default PacksAnalytics;
