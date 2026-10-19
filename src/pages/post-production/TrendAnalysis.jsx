import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { inventoryApi, productionApi, logisticsApi } from '../../api';
import { formatAndSortPets } from '../../utils/petUtils';
import { getProductName, getPacks, getStage, getCreatedAt } from '../../utils/transferUtils';
import { toLocalKey, listDates, parseYmd, dayCount, presetRange } from '../../utils/dateRange';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

/**
 * Trend Analysis
 * --------------
 * Daily trends over a date range for packs, pallets, bottles, warehouse stages
 * and customer dispatch. The range is plotted continuously (days with no
 * activity show as 0). Product, PET line and stage filters are applied
 * client-side to data loaded once, so changing a filter is instant.
 *
 * Sources
 *  - packs / pallets / warehouse: GET /inventory/handling-units/ (grouped by the
 *    local day each pallet was created; stage = the pallet's current stage)
 *  - bottles: GET /production/dashboard/production_summary/ (per day / PET / product)
 *  - customers: GET /logistics/shipments/
 */

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#84cc16', '#f97316'];
const MAX_RANGE_DAYS = 366;
const UNITS_PAGE_SIZE = 2000;
const SHIPMENTS_PAGE_SIZE = 1000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TABS = [
    { key: 'packs', label: 'Packs', icon: 'ti ti-box', noun: 'packs', groupable: true },
    { key: 'pallets', label: 'Pallets', icon: 'ti ti-package', noun: 'pallets', groupable: true },
    { key: 'bottles', label: 'Bottles', icon: 'ti ti-bottle', noun: 'bottles', groupable: true },
    { key: 'warehouse', label: 'Warehouse Stages', icon: 'ti ti-building-warehouse', noun: 'pallets', groupable: false },
    { key: 'customers', label: 'Customer Dispatch', icon: 'ti ti-truck-delivery', noun: 'shipments', groupable: false },
];

// --- data helpers ---
const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const norm = (v) => String(v ?? '').trim().toLowerCase();
const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString();
const shortDate = (date) => `${date.slice(5)} ${DAY_NAMES[parseYmd(date).getDay()]}`;
const formatStageName = (stage) => String(stage || 'Unknown').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const isObject = (v) => v !== null && typeof v === 'object';

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (Array.isArray(envelope?.results)) return envelope.results;
    if (Array.isArray(envelope?.data)) return envelope.data;
    if (Array.isArray(envelope?.details)) return envelope.details;
    return [];
};
// Total number of records the server reports (when paginated), if any.
const extractTotal = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    const total = envelope?.count ?? res?.data?.count;
    return Number.isFinite(Number(total)) ? Number(total) : null;
};

const normalizePetLabel = (name) => {
    const match = String(name || '').match(/pet\s*(\d+)/i);
    return match ? `Pet ${match[1]}` : String(name);
};

// PET line label for a pallet record; falls back to the pet catalogue when only an id is present.
const unitPetLabel = (u, petsById) => {
    const named = u.pet_name || (isObject(u.pet) ? (u.pet.pet_name || u.pet.name) : null);
    if (named) return normalizePetLabel(named);
    const id = isObject(u.pet) ? u.pet.id : (u.pet ?? u.pet_id);
    if (id !== undefined && id !== null && petsById[String(id)]) return petsById[String(id)].label;
    return typeof u.pet === 'string' && u.pet ? normalizePetLabel(u.pet) : 'Unknown';
};

// Product names carried by a shipment (shape varies); empty when the API gives none.
const shipmentProducts = (s) => {
    const names = [];
    const add = (v) => {
        if (!v) return;
        if (typeof v === 'string') names.push(v);
        else if (isObject(v)) add(v.product_name || v.name || v.product);
    };
    add(s.product_name);
    add(s.product);
    [s.products, s.items, s.handling_units, s.pallets].forEach((list) => {
        if (Array.isArray(list)) list.forEach(add);
    });
    return names;
};

// Turn {date, group, value} records into continuous daily rows + series.
const buildTrend = (records, dates) => {
    const groupTotals = {};
    records.forEach((r) => { groupTotals[r.group] = (groupTotals[r.group] || 0) + r.value; });
    const names = Object.keys(groupTotals).sort(naturalSort);
    const keyOf = {};
    names.forEach((name, index) => { keyOf[name] = `s${index}`; });
    const series = names.map((name, index) => ({ key: keyOf[name], name, color: COLORS[index % COLORS.length], total: groupTotals[name] }));

    const byDate = {};
    records.forEach((r) => {
        if (!byDate[r.date]) byDate[r.date] = {};
        byDate[r.date][keyOf[r.group]] = (byDate[r.date][keyOf[r.group]] || 0) + r.value;
    });
    const rows = dates.map((date) => {
        const row = { date, label: shortDate(date) };
        let total = 0;
        series.forEach((s) => {
            const v = byDate[date]?.[s.key] || 0;
            row[s.key] = v;
            total += v;
        });
        row.total = total;
        return row;
    });
    return { series, rows };
};

const TrendTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const total = payload.reduce((sum, entry) => sum + num(entry.value), 0);
    return (
        <div className="bg-white p-3 rounded shadow border" style={{ minWidth: 170 }}>
            <p className="fw-bold mb-2">{label}</p>
            {payload.map((entry) => (
                <div key={entry.dataKey} className="d-flex justify-content-between gap-3 mb-1">
                    <span style={{ color: entry.color }}>{entry.name}:</span>
                    <span className="fw-medium">{fmt(entry.value)}</span>
                </div>
            ))}
            {payload.length > 1 && (
                <div className="d-flex justify-content-between border-top pt-2 mt-1 fw-bold"><span>Total</span><span>{fmt(total)}</span></div>
            )}
        </div>
    );
};

const TrendAnalysis = () => {
    const initialRange = useMemo(() => presetRange('7d'), []);
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    const [petId, setPetId] = useState('');
    const [product, setProduct] = useState('');
    const [stage, setStage] = useState('');
    const [groupBy, setGroupBy] = useState('pet');
    const [activeTab, setActiveTab] = useState('packs');

    const [pets, setPets] = useState([]);
    const [units, setUnits] = useState([]);
    const [unitsTotal, setUnitsTotal] = useState(null);
    const [shipments, setShipments] = useState([]);
    const [stageCatalog, setStageCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Bottles come from the production summary and are fetched per date range.
    const [summary, setSummary] = useState({ key: '', days: [] });
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState('');
    const summarySeq = useRef(0);

    const tab = TABS.find((t) => t.key === activeTab);

    const rangeError = useMemo(() => {
        if (!startDate || !endDate) return 'Select a start and end date.';
        if (startDate > endDate) return 'Start date must be on or before the end date.';
        if (dayCount(startDate, endDate) > MAX_RANGE_DAYS) return `Select a range of at most ${MAX_RANGE_DAYS} days.`;
        return '';
    }, [startDate, endDate]);

    const fetchBase = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        const [petsRes, unitsRes, shipmentsRes, stagesRes] = await Promise.allSettled([
            productionApi.getPets(),
            inventoryApi.getHandlingUnits({ page_size: UNITS_PAGE_SIZE, ordering: '-created_at' }),
            logisticsApi.getShipments({ page_size: SHIPMENTS_PAGE_SIZE, ordering: '-created_at' }),
            inventoryApi.getStages(),
        ]);

        if (petsRes.status === 'fulfilled') setPets(formatAndSortPets(petsRes.value));
        if (stagesRes.status === 'fulfilled') setStageCatalog(extractData(stagesRes.value));

        const errors = [];
        if (unitsRes.status === 'fulfilled') {
            setUnits(extractData(unitsRes.value));
            setUnitsTotal(extractTotal(unitsRes.value));
        } else {
            console.error('Failed to fetch pallets:', unitsRes.reason);
            setUnits([]);
            setUnitsTotal(null);
            errors.push('pallet data');
        }
        if (shipmentsRes.status === 'fulfilled') {
            setShipments(extractData(shipmentsRes.value));
        } else {
            console.error('Failed to fetch shipments:', shipmentsRes.reason);
            setShipments([]);
            errors.push('shipments');
        }
        if (errors.length) setLoadError(`Could not load ${errors.join(' and ')}. Try refreshing.`);
        setLoading(false);
    }, []);

    useEffect(() => { fetchBase(); }, [fetchBase]);

    // Bottles: (re)load when the bottles tab is open and the range changed.
    const summaryKey = `${startDate}|${endDate}`;
    const fetchSummary = useCallback(async () => {
        if (rangeError) return;
        const seq = ++summarySeq.current;
        setSummaryLoading(true);
        setSummaryError('');
        try {
            const res = await productionApi.getProductionSummary({ start_date: startDate, end_date: endDate });
            if (seq !== summarySeq.current) return;
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            setSummary({ key: `${startDate}|${endDate}`, days: envelope.daily_breakdown || [] });
        } catch (error) {
            if (seq !== summarySeq.current) return;
            console.error('Failed to fetch bottles data:', error);
            setSummaryError('Could not load bottles data. Try refreshing.');
            setSummary({ key: '', days: [] });
        } finally {
            if (seq === summarySeq.current) setSummaryLoading(false);
        }
    }, [startDate, endDate, rangeError]);

    useEffect(() => {
        if (activeTab === 'bottles' && summary.key !== summaryKey && !rangeError) fetchSummary();
    }, [activeTab, summary.key, summaryKey, rangeError, fetchSummary]);

    const handleRefresh = () => {
        fetchBase();
        setSummary({ key: '', days: [] }); // forces the bottles tab to reload for the current range
    };

    const petsById = useMemo(() => {
        const map = {};
        pets.forEach((p) => { map[String(p.id)] = p; });
        return map;
    }, [pets]);
    const selectedPet = petsById[String(petId)] || null;

    const stageLabels = useMemo(() => {
        const map = {};
        stageCatalog.forEach((s) => {
            const code = String(s.name || '').trim().toUpperCase();
            if (code) map[code] = s.display_name || formatStageName(s.name);
        });
        return map;
    }, [stageCatalog]);
    const stageLabel = useCallback((code) => stageLabels[code] || formatStageName(code), [stageLabels]);

    const dates = useMemo(() => (rangeError ? [] : listDates(startDate, endDate)), [startDate, endDate, rangeError]);

    // ----- normalise every source into one shape -----
    const unitRecords = useMemo(() => units.map((u) => ({
        date: toLocalKey(getCreatedAt(u)),
        pet: unitPetLabel(u, petsById),
        petId: String(isObject(u.pet) ? u.pet.id : (u.pet_id ?? u.pet ?? '')),
        product: getProductName(u),
        stage: getStage(u) || 'UNKNOWN',
        packs: getPacks(u),
    })).filter((r) => r.date), [units, petsById]);

    const bottleRecords = useMemo(() => {
        const list = [];
        summary.days.forEach((day) => {
            (day.pets || []).forEach((p) => {
                if (String(p.pet_name || '').toLowerCase().includes('can')) return;
                list.push({
                    date: day.date,
                    pet: normalizePetLabel(p.pet_name),
                    petId: String(p.pet_id ?? ''),
                    product: p.product_name || 'Unknown',
                    // finalized output when available, otherwise the live count (same rule as the dashboards)
                    value: num(p.total_bottles_produced) || num(p.total_bottles),
                });
            });
        });
        return list;
    }, [summary.days]);

    const shipmentRecords = useMemo(() => shipments.map((s) => ({
        date: toLocalKey(s.dispatch_date || s.date || s.created_at),
        customer: s.customer_name || s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || 'Unknown',
        products: shipmentProducts(s),
    })).filter((r) => r.date), [shipments]);

    // Dispatch records may not carry product info; then the product filter cannot apply to that tab.
    const shipmentsHaveProducts = shipmentRecords.some((r) => r.products.length > 0);

    // ----- filter options -----
    const productOptions = useMemo(() => {
        const set = new Set();
        unitRecords.forEach((r) => { if (r.product && r.product !== 'N/A') set.add(r.product); });
        bottleRecords.forEach((r) => { if (r.product && r.product !== 'Unknown') set.add(r.product); });
        shipmentRecords.forEach((r) => r.products.forEach((p) => set.add(p)));
        return [...set].sort(naturalSort);
    }, [unitRecords, bottleRecords, shipmentRecords]);

    const stageOptions = useMemo(
        () => [...new Set(unitRecords.map((r) => r.stage))].sort((a, b) => naturalSort(stageLabel(a), stageLabel(b))),
        [unitRecords, stageLabel]
    );

    const matchesPet = useCallback((r) => !selectedPet || r.pet === selectedPet.label || r.petId === String(selectedPet.id), [selectedPet]);
    const matchesProduct = useCallback((r) => !product || norm(r.product) === norm(product), [product]);
    const inRange = useCallback((r) => !rangeError && r.date >= startDate && r.date <= endDate, [rangeError, startDate, endDate]);

    // ----- records for the active tab -----
    const records = useMemo(() => {
        const groupField = groupBy === 'product' ? 'product' : 'pet';
        if (activeTab === 'packs' || activeTab === 'pallets') {
            return unitRecords
                .filter((r) => inRange(r) && matchesPet(r) && matchesProduct(r))
                .map((r) => ({ date: r.date, group: r[groupField], value: activeTab === 'packs' ? r.packs : 1 }));
        }
        if (activeTab === 'bottles') {
            return bottleRecords
                .filter((r) => inRange(r) && matchesPet(r) && matchesProduct(r))
                .map((r) => ({ date: r.date, group: r[groupField], value: r.value }));
        }
        if (activeTab === 'warehouse') {
            return unitRecords
                .filter((r) => inRange(r) && matchesPet(r) && matchesProduct(r) && (!stage || r.stage === stage))
                .map((r) => ({ date: r.date, group: stageLabel(r.stage), value: 1, packs: r.packs }));
        }
        // customers
        return shipmentRecords
            .filter((r) => inRange(r) && (!product || !shipmentsHaveProducts || r.products.some((p) => norm(p) === norm(product))))
            .map((r) => ({ date: r.date, group: r.customer, value: 1 }));
    }, [activeTab, groupBy, unitRecords, bottleRecords, shipmentRecords, inRange, matchesPet, matchesProduct, stage, stageLabel, product, shipmentsHaveProducts]);

    const trend = useMemo(() => buildTrend(records, dates), [records, dates]);

    const stageSummary = useMemo(() => {
        if (activeTab !== 'warehouse') return [];
        const map = {};
        records.forEach((r) => {
            if (!map[r.group]) map[r.group] = { name: r.group, pallets: 0, packs: 0 };
            map[r.group].pallets += r.value;
            map[r.group].packs += r.packs || 0;
        });
        return Object.values(map).sort((a, b) => b.pallets - a.pallets);
    }, [records, activeTab]);

    const total = trend.rows.reduce((sum, row) => sum + row.total, 0);
    const activeDays = trend.rows.filter((row) => row.total > 0).length;
    const peak = trend.rows.reduce((best, row) => (row.total > (best?.total || 0) ? row : best), null);
    const avgPerDay = dates.length ? total / dates.length : 0;

    // Warn when the server returned only part of the pallet list and it may not reach back to the start date.
    const unitsPartial = unitsTotal !== null && unitsTotal > units.length;
    const oldestLoaded = useMemo(
        () => unitRecords.reduce((oldest, r) => (!oldest || r.date < oldest ? r.date : oldest), null),
        [unitRecords]
    );
    const usesUnits = ['packs', 'pallets', 'warehouse'].includes(activeTab);
    const incompleteRange = usesUnits && unitsPartial && oldestLoaded && oldestLoaded > startDate;

    const isBottleTabLoading = activeTab === 'bottles' && (summaryLoading || (summary.key !== summaryKey && !summaryError && !rangeError));
    const showSkeleton = activeTab === 'bottles' ? isBottleTabLoading : loading;

    const activeFilterCount = (petId ? 1 : 0) + (product ? 1 : 0) + (stage ? 1 : 0);
    const resetFilters = () => { setPetId(''); setProduct(''); setStage(''); };
    const applyPreset = (preset) => {
        const range = presetRange(preset);
        setStartDate(range.start);
        setEndDate(range.end);
    };

    const handleExport = () => {
        const rows = trend.rows.map((row) => {
            const out = { Date: row.date };
            trend.series.forEach((s) => { out[s.name] = row[s.key]; });
            out.Total = row.total;
            return out;
        });
        exportToExcel(rows, `trend_${activeTab}_${startDate}_${endDate}`, tab.label.slice(0, 31));
    };

    const petFilterApplies = activeTab !== 'customers';
    const productFilterApplies = activeTab !== 'customers' || shipmentsHaveProducts;
    const seriesLabel = activeTab === 'warehouse' ? 'stage' : activeTab === 'customers' ? 'customer' : groupBy === 'product' ? 'product' : 'PET line';

    return (
        <div className="container-fluid">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                <div>
                    <h4 className="mb-1"><i className="ti ti-chart-line me-2"></i>Trend Analysis</h4>
                    <p className="text-muted mb-0">Daily trends across the selected date range</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={handleRefresh} disabled={loading || summaryLoading}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <button className="btn btn-sm btn-success" onClick={handleExport} disabled={total === 0}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h5 className="card-title mb-0"><i className="ti ti-filter me-2"></i>Filters{activeFilterCount > 0 && <span className="badge bg-primary rounded-pill ms-2">{activeFilterCount} active</span>}</h5>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters} disabled={activeFilterCount === 0}>
                        <i className="ti ti-rotate me-1"></i>Reset filters
                    </button>
                </div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-xl-4 col-lg-6">
                            <label className="form-label">Date range</label>
                            <div className="input-group">
                                <input type="date" className="form-control" aria-label="Start date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
                                <span className="input-group-text">to</span>
                                <input type="date" className="form-control" aria-label="End date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="col-xl-2 col-lg-6">
                            <label className="form-label">Quick range</label>
                            <div className="btn-group w-100" role="group">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('7d')}>7d</button>
                                <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('30d')}>30d</button>
                                <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('month')}>Month</button>
                            </div>
                        </div>
                        <div className="col-xl-2 col-md-4">
                            <label className="form-label">Product</label>
                            <select className="form-select" aria-label="Product" value={product} disabled={!productFilterApplies}
                                title={productFilterApplies ? undefined : 'Dispatch records do not include product information'}
                                onChange={(e) => setProduct(e.target.value)}>
                                <option value="">All products</option>
                                {productOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div className="col-xl-2 col-md-4">
                            <label className="form-label">Pet Line</label>
                            <select className="form-select" aria-label="PET line" value={petId} disabled={!petFilterApplies}
                                title={petFilterApplies ? undefined : 'Dispatch is not tracked per PET line'}
                                onChange={(e) => setPetId(e.target.value)}>
                                <option value="">All Pets</option>
                                {pets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                        {activeTab === 'warehouse' && (
                            <div className="col-xl-2 col-md-4">
                                <label className="form-label">Stage</label>
                                <select className="form-select" aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                                    <option value="">All stages</option>
                                    {stageOptions.map((code) => <option key={code} value={code}>{stageLabel(code)}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    {rangeError && <div className="alert alert-warning py-2 px-3 mt-3 mb-0 fs-13">{rangeError}</div>}
                    {loadError && <div className="alert alert-danger py-2 px-3 mt-3 mb-0 fs-13">{loadError}</div>}
                    {summaryError && activeTab === 'bottles' && <div className="alert alert-danger py-2 px-3 mt-3 mb-0 fs-13">{summaryError}</div>}
                    {incompleteRange && (
                        <div className="alert alert-warning py-2 px-3 mt-3 mb-0 fs-13">
                            Only the most recent {units.length.toLocaleString()} of {unitsTotal.toLocaleString()} pallets were loaded (back to {oldestLoaded}), so days before that may look empty or low.
                        </div>
                    )}
                    {activeTab === 'customers' && product && !shipmentsHaveProducts && (
                        <div className="alert alert-info py-2 px-3 mt-3 mb-0 fs-13">Dispatch records do not carry product information, so the product filter is not applied to this tab.</div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <ul className="nav nav-pills gap-2 mb-4">
                {TABS.map((t) => (
                    <li key={t.key} className="nav-item">
                        <button className={`nav-link ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            <i className={`${t.icon} me-1`}></i>{t.label}
                        </button>
                    </li>
                ))}
            </ul>

            {/* KPI cards */}
            <div className="row row-gap-3 mb-4">
                {[
                    { label: `Total ${tab.noun}`, value: fmt(total), sub: `${startDate} to ${endDate}`, color: 'primary' },
                    { label: 'Average / day', value: fmt(Math.round(avgPerDay)), sub: `over ${dates.length} day${dates.length === 1 ? '' : 's'}`, color: 'success' },
                    { label: 'Peak day', value: peak && peak.total > 0 ? fmt(peak.total) : '-', sub: peak && peak.total > 0 ? peak.label : 'No activity', color: 'warning' },
                    { label: 'Active days', value: `${activeDays} / ${dates.length}`, sub: `${trend.series.length} ${seriesLabel}${trend.series.length === 1 ? '' : 's'}`, color: 'info' },
                ].map((card) => (
                    <div key={card.label} className="col-xl-3 col-sm-6">
                        <div className={`card border-top border-${card.color} border-3 mb-0 h-100`}>
                            <div className="card-body">
                                <p className="text-muted fs-14 mb-2 text-capitalize">{card.label}</p>
                                {showSkeleton
                                    ? <div className="placeholder-glow"><span className="placeholder col-6 placeholder-lg" /></div>
                                    : <h2 className="mb-1 fs-16 fw-bold">{card.value}</h2>}
                                <small className="text-muted">{card.sub}</small>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="card mb-4">
                <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <h6 className="mb-0">{tab.label} per day{stage && activeTab === 'warehouse' ? ` · ${stageLabel(stage)}` : ''}{product && productFilterApplies ? ` · ${product}` : ''}{selectedPet && petFilterApplies ? ` · ${selectedPet.label}` : ''}</h6>
                    {tab.groupable && (
                        <div className="btn-group btn-group-sm" role="group" aria-label="Group series by">
                            <button type="button" className={`btn ${groupBy === 'pet' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setGroupBy('pet')}>By PET line</button>
                            <button type="button" className={`btn ${groupBy === 'product' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setGroupBy('product')}>By product</button>
                        </div>
                    )}
                </div>
                <div className="card-body">
                    {showSkeleton ? (
                        <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
                    ) : rangeError ? (
                        <p className="text-center text-muted py-5 mb-0">{rangeError}</p>
                    ) : total === 0 ? (
                        <div className="text-center text-muted py-5">
                            <i className="ti ti-chart-line fs-1 mb-3 d-block"></i>
                            <h5>No {tab.noun} in this range</h5>
                            <p className="mb-2">Try a wider date range or different filters.</p>
                            {activeFilterCount > 0 && <button type="button" className="btn btn-outline-primary btn-sm" onClick={resetFilters}>Clear filters</button>}
                        </div>
                    ) : activeTab === 'warehouse' ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={trend.rows}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
                                <Legend />
                                {trend.series.map((s, index) => (
                                    <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId="stage"
                                        radius={index === trend.series.length - 1 ? [4, 4, 0, 0] : 0} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={trend.rows}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<TrendTooltip />} />
                                <Legend />
                                {trend.series.map((s) => (
                                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
                                        stroke={s.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Stage summary (warehouse) */}
            {activeTab === 'warehouse' && !showSkeleton && stageSummary.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header"><h6 className="mb-0">Pallets by current stage</h6></div>
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light"><tr><th>Stage</th><th className="text-end">Pallets</th><th className="text-end">Packs</th><th style={{ width: '30%' }}>Share</th></tr></thead>
                            <tbody>
                                {stageSummary.map((row) => (
                                    <tr key={row.name}>
                                        <td className="fw-medium">{row.name}</td>
                                        <td className="text-end fw-semibold">{fmt(row.pallets)}</td>
                                        <td className="text-end">{fmt(row.packs)}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress flex-grow-1" style={{ height: 6 }}><div className="progress-bar" style={{ width: `${(row.pallets / total) * 100}%` }} /></div>
                                                <small className="text-muted" style={{ width: 44 }}>{((row.pallets / total) * 100).toFixed(1)}%</small>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="card-footer text-muted fs-13">Pallets are grouped by the day they were created and shown at the stage they are in now.</div>
                </div>
            )}

            {/* Daily table */}
            {!showSkeleton && !rangeError && total > 0 && (
                <div className="card mb-4">
                    <div className="card-header"><h6 className="mb-0">Daily breakdown</h6></div>
                    <div className="table-responsive" style={{ maxHeight: 420 }}>
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                                <tr>
                                    <th>Date</th>
                                    {trend.series.map((s) => <th key={s.key} className="text-end">{s.name}</th>)}
                                    <th className="text-end">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...trend.rows].reverse().map((row) => (
                                    <tr key={row.date} className={row.total === 0 ? 'text-muted' : ''}>
                                        <td>{row.date} <small className="text-muted">{DAY_NAMES[parseYmd(row.date).getDay()]}</small></td>
                                        {trend.series.map((s) => <td key={s.key} className="text-end">{fmt(row[s.key])}</td>)}
                                        <td className="text-end fw-semibold">{fmt(row.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="table-light">
                                <tr>
                                    <th>Total</th>
                                    {trend.series.map((s) => <th key={s.key} className="text-end">{fmt(s.total)}</th>)}
                                    <th className="text-end">{fmt(total)}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrendAnalysis;
