import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const MATERIAL_COLORS = {
    PREFORMS: '#f59e0b',
    CLOSURES: '#8b5cf6',
    LABELS: '#0ea5e9',
    SHRINK: '#ec4899',
    GLUE: '#16a34a',
};
const PET_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const ConsumptionReport = () => {
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
            console.error('Failed to load consumption data:', err);
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

    const materials = useMemo(() => rawData?.material_consumptions?.materials || [], [rawData]);
    const summary = rawData?.summary || {};

    const defaultPets = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];
    const normalizePet = (name) => {
        const num = (name || '').toLowerCase().match(/pet\s*(\d+)/);
        return num ? `Pet ${num[1]}` : name;
    };

    // Total consumption per material type
    const materialTotals = useMemo(() => {
        return materials.map(m => ({
            name: m.material_type_display || m.material_type,
            type: m.material_type,
            unit: m.unit || 'pcs',
            total_used: m.total_used || 0,
            total_losses: m.total_losses || 0,
            yield: m.yield_percentage || 0,
        }));
    }, [materials]);

    // Consumption by PET (total across all materials)
    const consumptionByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = { pet: p, total_used: 0, total_losses: 0 }; });

        materials.forEach(m => {
            (m.pets || []).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (!petMap[name]) petMap[name] = { pet: name, total_used: 0, total_losses: 0 };
                petMap[name].total_used += parseFloat(p.used) || 0;
                petMap[name].total_losses += parseFloat(p.losses) || 0;
            });
        });

        return Object.values(petMap)
            .map(p => ({ ...p, yield: p.total_used > 0 ? ((p.total_used - p.total_losses) / p.total_used * 100) : 0 }))
            .sort((a, b) => {
                const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });
    }, [materials]);

    // Per-material per-pet chart data (stacked bar)
    const stackedChartData = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = { pet: p }; });

        materials.forEach(m => {
            const type = m.material_type_display || m.material_type;
            (m.pets || []).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (!petMap[name]) petMap[name] = { pet: name };
                petMap[name][type] = parseFloat(p.used) || 0;
            });
            // Ensure all pets have this material key
            defaultPets.forEach(pet => {
                if (petMap[pet] && !petMap[pet][type]) petMap[pet][type] = 0;
            });
        });

        return Object.values(petMap).sort((a, b) => {
            const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [materials]);

    // Losses by PET chart
    const lossesByPet = useMemo(() => {
        const petMap = {};
        defaultPets.forEach(p => { petMap[p] = { pet: p }; });

        materials.forEach(m => {
            const type = m.material_type_display || m.material_type;
            (m.pets || []).forEach(p => {
                const name = normalizePet(p.pet_name);
                if (!petMap[name]) petMap[name] = { pet: name };
                petMap[name][type] = parseFloat(p.losses) || 0;
            });
            defaultPets.forEach(pet => {
                if (petMap[pet] && !petMap[pet][type]) petMap[pet][type] = 0;
            });
        });

        return Object.values(petMap).sort((a, b) => {
            const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [materials]);

    const materialNames = useMemo(() => materials.map(m => m.material_type_display || m.material_type), [materials]);

    // Table data
    const tableData = useMemo(() => {
        const rows = [];
        materials.forEach(m => {
            (m.pets || []).forEach(p => {
                rows.push({
                    material: m.material_type_display || m.material_type,
                    material_type: m.material_type,
                    unit: m.unit || 'pcs',
                    pet: normalizePet(p.pet_name),
                    used: parseFloat(p.used) || 0,
                    losses: parseFloat(p.losses) || 0,
                    yield: p.yield_percentage || 0,
                });
            });
        });
        return rows.sort((a, b) => a.pet.localeCompare(b.pet) || a.material.localeCompare(b.material));
    }, [materials]);

    const handleExport = () => {
        const exportData = tableData.map(d => ({
            'Material': d.material,
            'Unit': d.unit,
            'PET Line': d.pet,
            'Used': d.used,
            'Losses': d.losses,
            'Yield %': d.yield.toFixed(1) + '%',
        }));
        exportToExcel(exportData, `Consumption_Analytics_${dateRangeLabel.replace(/ to /g, '_')}`);
    };

    const grandTotal = useMemo(() => {
        return {
            used: materials.reduce((s, m) => s + (m.total_used || 0), 0),
            losses: materials.reduce((s, m) => s + (m.total_losses || 0), 0),
        };
    }, [materials]);

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h4 className="mb-0">Consumption Analytics</h4>
                    <small className="text-muted">Material consumption and losses breakdown by PET line</small>
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
                    <span className="ms-3">Total Output: <strong>{(summary.total_output || 0).toLocaleString()}</strong> pcs</span>
                    <span className="ms-3">Reports: <strong>{summary.total_reports || 0}</strong></span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>
            ) : materials.length === 0 ? (
                <div className="text-center py-5 text-muted">
                    <i className="ti ti-package fs-1 mb-3 d-block"></i>
                    <p>No consumption data available for this period</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards per Material */}
                    <div className="row g-3 mb-4">
                        {materialTotals.map(m => (
                            <div key={m.type} className="col-xl col-sm-6">
                                <div className="card border-top border-3 mb-0 h-100" style={{ borderTopColor: MATERIAL_COLORS[m.type] || '#64748b' }}>
                                    <div className="card-body py-3">
                                        <div className="d-flex justify-content-between align-items-start mb-1">
                                            <small className="text-muted">{m.name}</small>
                                            <small className="text-muted">{m.unit}</small>
                                        </div>
                                        <h5 className="mb-1 fw-bold">{m.total_used.toLocaleString()}</h5>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <small className="text-danger">
                                                <i className="ti ti-trending-down me-1"></i>{m.total_losses.toLocaleString()} losses
                                            </small>
                                            <span className={`badge bg-${m.yield >= 98 ? 'success' : m.yield >= 95 ? 'warning' : 'danger'}-subtle text-${m.yield >= 98 ? 'success' : m.yield >= 95 ? 'warning' : 'danger'}`}>
                                                {m.yield.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {viewMode === 'chart' ? (
                        <>
                            {/* Consumption by PET (stacked) */}
                            <div className="row mb-4">
                                <div className="col-lg-7">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">Material Consumption by PET Line</h6>
                                            <small className="text-muted">Quantity used per material per line</small>
                                        </div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={350}>
                                                <BarChart data={stackedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                                    <Tooltip formatter={(v, name) => [v.toLocaleString(), name]} />
                                                    <Legend />
                                                    {materialNames.map((name, idx) => {
                                                        const type = materials[idx]?.material_type;
                                                        return (
                                                            <Bar key={name} dataKey={name} stackId="a" fill={MATERIAL_COLORS[type] || PET_COLORS[idx % PET_COLORS.length]} />
                                                        );
                                                    })}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-5">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">Losses by PET Line</h6>
                                            <small className="text-muted">Material losses per line</small>
                                        </div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={350}>
                                                <BarChart data={lossesByPet} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                                    <Tooltip formatter={(v, name) => [v.toLocaleString(), name]} />
                                                    <Legend />
                                                    {materialNames.map((name, idx) => {
                                                        const type = materials[idx]?.material_type;
                                                        return (
                                                            <Bar key={name} dataKey={name} stackId="a" fill={MATERIAL_COLORS[type] || PET_COLORS[idx % PET_COLORS.length]} opacity={0.8} />
                                                        );
                                                    })}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Yield comparison */}
                            <div className="card mb-4">
                                <div className="card-header">
                                    <h6 className="mb-0">Yield Comparison by PET Line</h6>
                                    <small className="text-muted">Overall material yield per production line</small>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={consumptionByPet} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                            <YAxis domain={[90, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Yield']} />
                                            <Bar dataKey="yield" name="Yield %" radius={[4, 4, 0, 0]}>
                                                {consumptionByPet.map((entry, idx) => (
                                                    <Cell key={idx} fill={entry.yield >= 98 ? '#16a34a' : entry.yield >= 95 ? '#d97706' : '#dc2626'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Table View */
                        <div className="card">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="mb-0">Consumption Details</h6>
                                    <small className="text-muted">{tableData.length} records {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                </div>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>PET Line</th>
                                                <th>Material</th>
                                                <th className="text-end">Used</th>
                                                <th className="text-end">Losses</th>
                                                <th className="text-end">Yield</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableData.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center text-muted py-4">No data</td></tr>
                                            ) : tableData.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td className="fw-medium">{row.pet}</td>
                                                    <td>
                                                        <span className="d-flex align-items-center gap-2">
                                                            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: MATERIAL_COLORS[row.material_type] || '#64748b' }}></span>
                                                            {row.material} <small className="text-muted">({row.unit})</small>
                                                        </span>
                                                    </td>
                                                    <td className="text-end">{row.used.toLocaleString()}</td>
                                                    <td className="text-end text-danger">{row.losses > 0 ? row.losses.toLocaleString() : '-'}</td>
                                                    <td className="text-end">
                                                        <span className={`badge bg-${row.yield >= 98 ? 'success' : row.yield >= 95 ? 'warning' : 'danger'}-subtle text-${row.yield >= 98 ? 'success' : row.yield >= 95 ? 'warning' : 'danger'} fw-bold`}>
                                                            {row.yield.toFixed(1)}%
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

export default ConsumptionReport;
