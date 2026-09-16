import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import {
    buildCO2ExportRows,
    CO2_CONSUMPTION_UNIT,
    resolveCO2Consumption,
    summarizeCO2Consumption,
} from '../../utils/co2Consumption';
import { useFilters } from '../../context/FilterContext';

const PET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const TARGET_YIELD = 95;
const DEFAULT_PETS = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];
const normalizePet = (name) => {
    const num = (name || '').toLowerCase().match(/pet\s*(\d+)/);
    return num ? `Pet ${num[1]}` : name;
};
const formatConsumption = (value) => Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const yieldColor = (v) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return '#94a3b8';
    return v >= 95 ? '#16a34a' : v >= 90 ? '#d97706' : '#dc2626';
};
const yieldBadge = (v) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return 'secondary';
    return v >= 95 ? 'success' : v >= 90 ? 'warning' : 'danger';
};

const CO2Report = () => {
    const { filters, updateFilters } = useFilters();
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('week');
    const [viewMode, setViewMode] = useState('chart');
    const [activeProductTab, setActiveProductTab] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.pet) params.pet = filters.pet;

            if (filters.log_date) {
                params.start_date = filters.log_date;
                params.end_date = filters.log_date;
            } else if (filters.start_date && filters.end_date) {
                params.start_date = filters.start_date;
                params.end_date = filters.end_date;
            } else {
                const now = new Date();
                if (timeRange === 'today') {
                    const today = now.toISOString().split('T')[0];
                    params.start_date = today;
                    params.end_date = today;
                } else if (timeRange === 'week') {
                    const dayOfWeek = now.getDay();
                    const sunday = new Date(now);
                    sunday.setDate(now.getDate() - dayOfWeek);
                    params.start_date = sunday.toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                } else if (timeRange === 'month') {
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    params.start_date = firstDay.toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                }
            }

            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            setRawData(envelope);
        } catch (err) {
            console.error('Failed to load CO2 data:', err);
            setRawData(null);
        } finally {
            setLoading(false);
        }
    }, [filters, timeRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (filters.log_date || filters.start_date || filters.end_date) setTimeRange('custom');
    }, [filters.log_date, filters.start_date, filters.end_date]);

    const dateRangeLabel = useMemo(() => {
        const f = rawData?.filters;
        if (!f) return '';
        return f.start_date === f.end_date ? f.start_date : `${f.start_date} to ${f.end_date}`;
    }, [rawData]);

    const productFilterOptions = useMemo(() => {
        const names = new Set();
        (rawData?.daily_breakdown || []).forEach((day) => {
            (day.pets || []).forEach((pet) => {
                if (!(pet.pet_name || '').toLowerCase().includes('can') && pet.product_name) {
                    names.add(pet.product_name);
                }
            });
        });
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [rawData]);

    useEffect(() => {
        if (rawData && filters.product && !productFilterOptions.includes(filters.product)) {
            updateFilters({ product: null });
        }
    }, [filters.product, productFilterOptions, rawData, updateFilters]);

    // Single source of truth for cards, trends, detail rows, and exports.
    const tableData = useMemo(() => {
        const rows = [];
        (rawData?.daily_breakdown || []).forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                if (filters.product && p.product_name !== filters.product) return;
                const consumption = resolveCO2Consumption(p);
                if (!consumption.qualifies) return;
                rows.push({
                    date: day.date,
                    pet: normalizePet(p.pet_name),
                    product: p.product_name || '-',
                    shift: p.shift || '-',
                    co2_yield: consumption.yieldPercent,
                    standard_consumption: consumption.standard,
                    actual_consumption: consumption.actual,
                    consumption_unit: consumption.unit,
                    actual_source: consumption.actualSource,
                    total_bottles_produced: consumption.output,
                });
            });
        });
        return rows.sort((a, b) => a.date.localeCompare(b.date) || a.pet.localeCompare(b.pet));
    }, [rawData, filters.product]);

    // Distinct products present in the qualifying detail rows, for the detail tabs.
    const products = useMemo(() => {
        const set = new Set();
        tableData.forEach(r => set.add(r.product || '-'));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [tableData]);

    // Keep the active product tab pointed at a product that exists in the current
    // dataset. Default to the first product; reset if it disappears after a filter change.
    useEffect(() => {
        if (!products.length) {
            if (activeProductTab !== null) setActiveProductTab(null);
            return;
        }
        if (!products.includes(activeProductTab)) setActiveProductTab(products[0]);
    }, [products, activeProductTab]);

    // Rows for the currently active product tab.
    const productTabRows = useMemo(
        () => tableData.filter(r => (r.product || '-') === activeProductTab),
        [tableData, activeProductTab]
    );

    // Build cumulative per-PET CO2 values from the same qualifying detail rows.
    const co2ByPet = useMemo(() => {
        const petMap = {};
        DEFAULT_PETS.forEach(p => { petMap[p] = { pet: p, totalActual: 0, totalStd: 0, count: 0 }; });
        tableData.forEach(row => {
            if (!petMap[row.pet]) petMap[row.pet] = { pet: row.pet, totalActual: 0, totalStd: 0, count: 0 };
            petMap[row.pet].count += 1;
            petMap[row.pet].totalActual += row.actual_consumption;
            petMap[row.pet].totalStd += row.standard_consumption;
        });

        return Object.values(petMap)
            .map(p => ({
                pet: p.pet,
                avg_yield: p.count > 0 && p.totalActual > 0 ? (p.totalStd / p.totalActual) * 100 : null,
                totalStd: p.totalStd,
                totalActual: p.totalActual,
                count: p.count,
            }))
            .sort((a, b) => {
                const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });
    }, [tableData]);

    // Headline Avg CO2 Yield = CUMULATIVE Σ standard / Σ actual × 100 across all
    // running lines, using the same std + derived-actual as the per-line badges.
    const avgCo2Yield = useMemo(() => {
        const contributors = co2ByPet
            .filter(p => p.count > 0 && p.totalActual > 0)
            .map(p => ({ pet: p.pet, yield: p.avg_yield, count: p.count, totalStd: p.totalStd, totalActual: p.totalActual }));
        const cumulative = summarizeCO2Consumption(tableData);
        return {
            value: cumulative.yieldPercent,
            contributors,
            totalStd: cumulative.totalStandard,
            totalActual: cumulative.totalActual,
            recordCount: cumulative.recordCount,
        };
    }, [co2ByPet, tableData]);

    // Build daily trend data
    const dailyTrendData = useMemo(() => {
        const dayMap = {};
        tableData.forEach(record => {
            const key = record.date;
            if (!dayMap[key]) dayMap[key] = {};
            if (!dayMap[key][record.pet]) dayMap[key][record.pet] = { standard: 0, actual: 0 };
            dayMap[key][record.pet].standard += record.standard_consumption;
            dayMap[key][record.pet].actual += record.actual_consumption;
        });
        return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, pets]) => {
            const row = { date: date.slice(5) };
            DEFAULT_PETS.forEach(pet => {
                row[pet] = pets[pet]?.actual > 0 ? Number(((pets[pet].standard / pets[pet].actual) * 100).toFixed(1)) : null;
            });
            return row;
        });
    }, [tableData]);

    const handleExport = () => {
        const exportData = buildCO2ExportRows(tableData);
        exportToExcel(exportData, `CO2_Analytics_${dateRangeLabel.replace(/ to /g, '_')}`);
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
                            <span className="fw-medium ms-2">{entry.value?.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h4 className="mb-0">CO₂ Analytics</h4>
                    <small className="text-muted">CO₂ yield performance by PET line</small>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${timeRange === 'today' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('today')}>Today</button>
                        <button className={`btn ${timeRange === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('week')}>Week</button>
                        <button className={`btn ${timeRange === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setTimeRange('month')}>Month</button>
                    </div>
                    <div className="btn-group btn-group-sm">
                        <button className={`btn ${viewMode === 'chart' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('chart')}>
                            <i className="ti ti-chart-bar me-1"></i>Chart
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

            <FilterInputs showProduct productOptions={productFilterOptions} />

            {dateRangeLabel && (
                <div className="alert alert-light border mb-3">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span><i className="ti ti-calendar me-2 text-primary"></i>Period: <strong>{dateRangeLabel}</strong></span>
                        <small className="text-muted">Cumulative standard ÷ cumulative actual × 100</small>
                    </div>
                    <div className="row g-2 mt-1">
                        <div className="col-md-4">
                            <div className="bg-white border rounded-3 px-3 py-2 h-100">
                                <small className="text-muted d-block">Average CO₂ Yield</small>
                                <strong className={`fs-5 text-${yieldBadge(avgCo2Yield.value)}`}>
                                    {avgCo2Yield.value !== null ? `${avgCo2Yield.value.toFixed(1)}%` : 'No data'}
                                </strong>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="bg-white border rounded-3 px-3 py-2 h-100">
                                <small className="text-muted d-block">Cumulative Standard</small>
                                <strong className="fs-5">
                                    {avgCo2Yield.recordCount > 0 ? `${formatConsumption(avgCo2Yield.totalStd)} ${CO2_CONSUMPTION_UNIT}` : 'No data'}
                                </strong>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="bg-white border rounded-3 px-3 py-2 h-100">
                                <small className="text-muted d-block">Cumulative Actual</small>
                                <strong className="fs-5">
                                    {avgCo2Yield.recordCount > 0 ? `${formatConsumption(avgCo2Yield.totalActual)} ${CO2_CONSUMPTION_UNIT}` : 'No data'}
                                </strong>
                            </div>
                        </div>
                    </div>
                    {avgCo2Yield.contributors?.length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                            {avgCo2Yield.contributors.map((c) => (
                                <span
                                    key={c.pet}
                                    className={`badge bg-${yieldBadge(c.yield)}-subtle text-${yieldBadge(c.yield)} border border-${yieldBadge(c.yield)}-subtle`}
                                    title={`${c.pet} — Σstd ${Math.round(c.totalStd).toLocaleString()} / Σactual ${Math.round(c.totalActual).toLocaleString()} kg (${c.count} report${c.count > 1 ? 's' : ''})`}
                                >
                                    {c.pet}: {c.yield.toFixed(1)}%
                                </span>
                            ))}
                            <span className="text-muted small">
                                = Σstd {Math.round(avgCo2Yield.totalStd).toLocaleString()} ÷ Σactual {Math.round(avgCo2Yield.totalActual).toLocaleString()} = {avgCo2Yield.value.toFixed(1)}%
                            </span>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>
            ) : !rawData ? (
                <div className="text-center py-5 text-muted">
                    <i className="ti ti-cloud fs-1 mb-3 d-block"></i>
                    <p>No CO₂ data available for this period</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="row g-3 mb-4">
                        {co2ByPet.map((p, idx) => (
                            <div key={p.pet} className="col-xl-2 col-md-4 col-sm-6">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body text-center py-3">
                                        <small className="text-muted d-block mb-1">{p.pet}</small>
                                        {p.count > 0 ? (
                                            <>
                                                <h5 className="mb-2 fw-bold" style={{ color: yieldColor(p.avg_yield) }}>
                                                    {p.avg_yield.toFixed(1)}%
                                                </h5>
                                                <div className="border-top pt-2 text-start small">
                                                    <div className="d-flex justify-content-between gap-2">
                                                        <span className="text-muted">Standard</span>
                                                        <strong>{formatConsumption(p.totalStd)} {CO2_CONSUMPTION_UNIT}</strong>
                                                    </div>
                                                    <div className="d-flex justify-content-between gap-2 mt-1">
                                                        <span className="text-muted">Actual</span>
                                                        <strong>{formatConsumption(p.totalActual)} {CO2_CONSUMPTION_UNIT}</strong>
                                                    </div>
                                                </div>
                                                <small className="text-muted d-block mt-2">{p.count} report{p.count !== 1 ? 's' : ''}</small>
                                            </>
                                        ) : (
                                            <div className="py-3 text-muted">
                                                <i className="ti ti-database-off d-block fs-4 mb-1"></i>
                                                <small>No qualifying data</small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {viewMode === 'chart' ? (
                        <>
                            {/* CO2 Yield by PET Bar Chart */}
                            <div className="row mb-4">
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">CO₂ Yield by PET Line</h6>
                                            <small className="text-muted">Average CO₂ yield percentage per line</small>
                                        </div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={320}>
                                                <BarChart data={co2ByPet} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                                    <YAxis domain={[80, 105]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                    <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'CO₂ Yield']} />
                                                    <ReferenceLine y={TARGET_YIELD} stroke="#16a34a" strokeDasharray="5 5" label={{ value: `Target ${TARGET_YIELD}%`, position: 'right', fill: '#16a34a', fontSize: 11 }} />
                                                    <Bar dataKey="avg_yield" name="CO₂ Yield %" radius={[4, 4, 0, 0]}>
                                                        {co2ByPet.map((entry, idx) => (
                                                            <Cell key={idx} fill={yieldColor(entry.avg_yield)} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">CO₂ Yield Trend</h6>
                                            <small className="text-muted">Daily CO₂ yield by PET line</small>
                                        </div>
                                        <div className="card-body">
                                            {dailyTrendData.length === 0 ? (
                                                <p className="text-center text-muted py-5">No trend data</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <LineChart data={dailyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                                        <YAxis domain={[80, 105]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Legend />
                                                        <ReferenceLine y={TARGET_YIELD} stroke="#16a34a" strokeDasharray="5 5" />
                                                        {DEFAULT_PETS.map((pet, idx) => (
                                                            <Line
                                                                key={pet}
                                                                type="monotone"
                                                                dataKey={pet}
                                                                stroke={PET_COLORS[idx % PET_COLORS.length]}
                                                                strokeWidth={2}
                                                                dot={{ r: 3 }}
                                                                connectNulls={false}
                                                            />
                                                        ))}
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detail Table - one tab per product */}
                            <div className="card">
                                <div className="card-header">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div>
                                            <h6 className="mb-0">CO₂ Yield Details</h6>
                                            <small className="text-muted">{productTabRows.length} of {tableData.length} records</small>
                                        </div>
                                    </div>
                                    <ul className="nav nav-pills card-header-pills gap-2 flex-wrap" role="tablist">
                                        {products.map((product, idx) => {
                                            const isActive = product === activeProductTab;
                                            const color = PET_COLORS[idx % PET_COLORS.length];
                                            const count = tableData.filter(r => (r.product || '-') === product).length;
                                            return (
                                                <li className="nav-item" key={product} role="presentation">
                                                    <button
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={isActive}
                                                        className={`btn btn-sm d-flex align-items-center gap-2 ${isActive ? 'text-white' : 'btn-outline-secondary'}`}
                                                        style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
                                                        onClick={() => setActiveProductTab(product)}
                                                    >
                                                        <span
                                                            style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: isActive ? '#fff' : color, display: 'inline-block' }}
                                                        ></span>
                                                        {product}
                                                        <span
                                                            className={`badge ${isActive ? 'bg-white' : 'bg-secondary-subtle text-secondary'}`}
                                                            style={isActive ? { color } : undefined}
                                                        >
                                                            {count}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive" style={{ maxHeight: 400 }}>
                                        <table className="table table-sm table-hover mb-0">
                                            <thead className="table-light sticky-top">
                                                <tr>
                                                    <th>Date</th>
                                                    <th>PET Line</th>
                                                    <th>Shift</th>
                                                    <th className="text-end">CO₂ Yield</th>
                                                    <th className="text-end">Standard ({CO2_CONSUMPTION_UNIT})</th>
                                                    <th className="text-end">Actual ({CO2_CONSUMPTION_UNIT})</th>
                                                    <th className="text-end">Output</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {productTabRows.length === 0 ? (
                                                    <tr><td colSpan={7} className="text-center text-muted py-4">No qualifying CO₂ consumption data</td></tr>
                                                ) : productTabRows.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td>{row.date}</td>
                                                        <td className="fw-medium">{row.pet}</td>
                                                        <td><span className="badge bg-secondary-subtle text-secondary">{row.shift}</span></td>
                                                        <td className="text-end">
                                                            <span className={`badge bg-${yieldBadge(row.co2_yield)}-subtle text-${yieldBadge(row.co2_yield)} fw-bold`}>
                                                                {row.co2_yield.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="text-end">{formatConsumption(row.standard_consumption)}</td>
                                                        <td className="text-end" title={row.actual_source === 'derived' ? 'Derived from standard consumption and reported yield' : 'Authoritative API value'}>
                                                            {formatConsumption(row.actual_consumption)}
                                                        </td>
                                                        <td className="text-end">{(row.total_bottles_produced || 0).toLocaleString()}</td>
                                                    </tr>
                                                ))}
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
                                    <h6 className="mb-0">CO₂ Yield Records</h6>
                                    <small className="text-muted">{tableData.length} records {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                </div>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Date</th>
                                                <th>PET Line</th>
                                                <th>Product</th>
                                                <th>Shift</th>
                                                <th className="text-end">CO₂ Yield %</th>
                                                <th className="text-end">Standard ({CO2_CONSUMPTION_UNIT})</th>
                                                <th className="text-end">Actual ({CO2_CONSUMPTION_UNIT})</th>
                                                <th className="text-end">Total Output</th>
                                                <th className="text-end">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableData.length === 0 ? (
                                                <tr><td colSpan={9} className="text-center text-muted py-4">No qualifying CO₂ consumption data</td></tr>
                                            ) : tableData.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-medium">{row.date}</td>
                                                    <td>{row.pet}</td>
                                                    <td className="text-muted">{row.product}</td>
                                                    <td><span className="badge bg-secondary-subtle text-secondary">{row.shift}</span></td>
                                                    <td className="text-end fw-bold" style={{ color: yieldColor(row.co2_yield) }}>
                                                        {row.co2_yield.toFixed(1)}%
                                                    </td>
                                                    <td className="text-end">{formatConsumption(row.standard_consumption)}</td>
                                                    <td className="text-end" title={row.actual_source === 'derived' ? 'Derived from standard consumption and reported yield' : 'Authoritative API value'}>
                                                        {formatConsumption(row.actual_consumption)}
                                                    </td>
                                                    <td className="text-end">{(row.total_bottles_produced || 0).toLocaleString()}</td>
                                                    <td className="text-end">
                                                        <span className={`badge bg-${yieldBadge(row.co2_yield)}-subtle text-${yieldBadge(row.co2_yield)}`}>
                                                            {row.co2_yield >= 95 ? 'Good' : row.co2_yield >= 90 ? 'Fair' : 'Low'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export default CO2Report;
