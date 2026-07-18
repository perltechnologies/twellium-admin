import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const PET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const TARGET_YIELD = 98;

const yieldColor = (v) => {
    if (!v || v === 0) return '#94a3b8';
    return v >= 100 ? '#16a34a' : v >= 95 ? '#d97706' : '#dc2626';
};
const yieldBadge = (v) => {
    if (!v || v === 0) return 'secondary';
    return v >= 100 ? 'success' : v >= 95 ? 'warning' : 'danger';
};

const SyrupReport = () => {
    const { filters } = useFilters();
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('week');
    const [viewMode, setViewMode] = useState('chart');

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
            console.error('Failed to load syrup data:', err);
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

    const avgSyrupYield = rawData?.summary?.avg_syrup_yield || 0;

    // All 6 pets always shown
    const defaultPets = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];
    const normalizePet = (name) => {
        const num = (name || '').toLowerCase().match(/pet\s*(\d+)/);
        return num ? `Pet ${num[1]}` : name;
    };

    // Build per-pet syrup yield data (aggregated across all dates/shifts)
    const syrupByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = { pet: p, yieldSum: 0, count: 0, values: [] }; });

        (rawData?.daily_breakdown || []).forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (!petMap[name]) petMap[name] = { pet: name, yieldSum: 0, count: 0, values: [] };
                const sy = p.syrup_yield;
                if (sy !== null && sy !== undefined && sy > 0) {
                    petMap[name].yieldSum += sy;
                    petMap[name].count += 1;
                    petMap[name].values.push({ date: day.date, shift: p.shift, yield: sy, product: p.product_name });
                }
            });
        });

        return Object.values(petMap)
            .map(p => ({
                pet: p.pet,
                avg_yield: p.count > 0 ? p.yieldSum / p.count : 0,
                count: p.count,
                values: p.values,
            }))
            .sort((a, b) => {
                const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });
    }, [rawData]);

    // Build daily trend data for line chart
    const dailyTrendData = useMemo(() => {
        const days = rawData?.daily_breakdown || [];
        return days.map(day => {
            const row = { date: day.date.slice(5) }; // MM-DD format
            const petYields = {};
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (p.syrup_yield !== null && p.syrup_yield !== undefined && p.syrup_yield > 0) {
                    if (!petYields[name]) petYields[name] = { sum: 0, count: 0 };
                    petYields[name].sum += p.syrup_yield;
                    petYields[name].count += 1;
                }
            });
            defaultPets.forEach(pet => {
                row[pet] = petYields[pet] ? parseFloat((petYields[pet].sum / petYields[pet].count).toFixed(1)) : null;
            });
            return row;
        });
    }, [rawData]);

    // Build detailed table
    const tableData = useMemo(() => {
        const rows = [];
        (rawData?.daily_breakdown || []).forEach(day => {
            (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can')).forEach(p => {
                if (p.syrup_yield !== null && p.syrup_yield !== undefined && p.syrup_yield > 0) {
                    rows.push({
                        date: day.date,
                        pet: normalizePet(p.pet_name),
                        product: p.product_name || '-',
                        shift: p.shift || '-',
                        syrup_yield: p.syrup_yield,
                        total_bottles_produced: p.total_bottles_produced || 0,
                    });
                }
            });
        });
        return rows.sort((a, b) => a.date.localeCompare(b.date) || a.pet.localeCompare(b.pet));
    }, [rawData]);

    const handleExport = () => {
        const exportData = tableData.map(d => ({
            'Date': d.date,
            'PET Line': d.pet,
            'Product': d.product,
            'Shift': d.shift,
            'Syrup Yield %': d.syrup_yield,
            'Total Output': d.total_bottles_produced,
        }));
        exportToExcel(exportData, `Syrup_Analytics_${dateRangeLabel.replace(/ to /g, '_')}`);
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
                    <h4 className="mb-0">Syrup Analytics</h4>
                    <small className="text-muted">Syrup yield performance by PET line</small>
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

            <FilterInputs />

            {dateRangeLabel && (
                <div className="alert alert-light d-flex align-items-center mb-3 py-2">
                    <i className="ti ti-calendar me-2 text-primary"></i>
                    <span>Period: <strong>{dateRangeLabel}</strong></span>
                    <span className="ms-3">
                        Avg Syrup Yield: <strong className={`text-${yieldBadge(avgSyrupYield)}`}>{avgSyrupYield.toFixed(1)}%</strong>
                    </span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>
            ) : !rawData ? (
                <div className="text-center py-5 text-muted">
                    <i className="ti ti-droplet fs-1 mb-3 d-block"></i>
                    <p>No syrup data available for this period</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="row g-3 mb-4">
                        {syrupByPet.map((p, idx) => (
                            <div key={p.pet} className="col-xl-2 col-md-4 col-sm-6">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body text-center py-3">
                                        <small className="text-muted d-block mb-1">{p.pet}</small>
                                        <h5 className="mb-0 fw-bold" style={{ color: yieldColor(p.avg_yield) }}>
                                            {p.avg_yield > 0 ? `${p.avg_yield.toFixed(1)}%` : '-'}
                                        </h5>
                                        <small className="text-muted">{p.count} report{p.count !== 1 ? 's' : ''}</small>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {viewMode === 'chart' ? (
                        <>
                            {/* Syrup Yield by PET Bar Chart */}
                            <div className="row mb-4">
                                <div className="col-lg-6">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">Syrup Yield by PET Line</h6>
                                            <small className="text-muted">Average yield percentage per line</small>
                                        </div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={320}>
                                                <BarChart data={syrupByPet} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                                    <YAxis domain={[85, 105]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                    <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Syrup Yield']} />
                                                    <ReferenceLine y={TARGET_YIELD} stroke="#16a34a" strokeDasharray="5 5" label={{ value: `Target ${TARGET_YIELD}%`, position: 'right', fill: '#16a34a', fontSize: 11 }} />
                                                    <Bar dataKey="avg_yield" name="Syrup Yield %" radius={[4, 4, 0, 0]}>
                                                        {syrupByPet.map((entry, idx) => (
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
                                            <h6 className="mb-0">Syrup Yield Trend</h6>
                                            <small className="text-muted">Daily yield by PET line</small>
                                        </div>
                                        <div className="card-body">
                                            {dailyTrendData.length === 0 ? (
                                                <p className="text-center text-muted py-5">No trend data</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <LineChart data={dailyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                                        <YAxis domain={[85, 105]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Legend />
                                                        <ReferenceLine y={TARGET_YIELD} stroke="#16a34a" strokeDasharray="5 5" />
                                                        {defaultPets.map((pet, idx) => (
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

                            {/* Detail Table */}
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">Syrup Yield Details</h6>
                                    <small className="text-muted">{tableData.length} records</small>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive" style={{ maxHeight: 400 }}>
                                        <table className="table table-sm table-hover mb-0">
                                            <thead className="table-light sticky-top">
                                                <tr>
                                                    <th>Date</th>
                                                    <th>PET Line</th>
                                                    <th>Product</th>
                                                    <th>Shift</th>
                                                    <th className="text-end">Syrup Yield</th>
                                                    <th className="text-end">Output</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableData.length === 0 ? (
                                                    <tr><td colSpan={6} className="text-center text-muted py-4">No syrup yield data</td></tr>
                                                ) : tableData.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td>{row.date}</td>
                                                        <td className="fw-medium">{row.pet}</td>
                                                        <td className="text-muted">{row.product}</td>
                                                        <td><span className="badge bg-secondary-subtle text-secondary">{row.shift}</span></td>
                                                        <td className="text-end">
                                                            <span className={`badge bg-${yieldBadge(row.syrup_yield)}-subtle text-${yieldBadge(row.syrup_yield)} fw-bold`}>
                                                                {row.syrup_yield.toFixed(1)}%
                                                            </span>
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
                                    <h6 className="mb-0">Syrup Yield Records</h6>
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
                                                <th className="text-end">Syrup Yield %</th>
                                                <th className="text-end">Total Output</th>
                                                <th className="text-end">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableData.length === 0 ? (
                                                <tr><td colSpan={7} className="text-center text-muted py-4">No data available</td></tr>
                                            ) : tableData.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-medium">{row.date}</td>
                                                    <td>{row.pet}</td>
                                                    <td className="text-muted">{row.product}</td>
                                                    <td><span className="badge bg-secondary-subtle text-secondary">{row.shift}</span></td>
                                                    <td className="text-end fw-bold" style={{ color: yieldColor(row.syrup_yield) }}>
                                                        {row.syrup_yield.toFixed(1)}%
                                                    </td>
                                                    <td className="text-end">{(row.total_bottles_produced || 0).toLocaleString()}</td>
                                                    <td className="text-end">
                                                        <span className={`badge bg-${yieldBadge(row.syrup_yield)}-subtle text-${yieldBadge(row.syrup_yield)}`}>
                                                            {row.syrup_yield >= 100 ? 'Excellent' : row.syrup_yield >= 95 ? 'Good' : 'Low'}
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

export default SyrupReport;
