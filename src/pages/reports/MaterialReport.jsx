import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productionApi } from '../../api/production';
import FilterInputs from '../../components/FilterInputs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { PieChart, Pie } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';
import { useFilters } from '../../context/FilterContext';

const MATERIAL_COLORS = {
    PREFORMS: '#f59e0b',
    CLOSURES: '#8b5cf6',
    LABELS: '#0ea5e9',
    SHRINK: '#ec4899',
    GLUE: '#16a34a',
};

const yieldColor = (v) => v >= 98 ? '#16a34a' : v >= 95 ? '#d97706' : '#dc2626';
const yieldBadge = (v) => v >= 98 ? 'success' : v >= 95 ? 'warning' : 'danger';

const MaterialReport = () => {
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
                // Use timeRange
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
            console.error('Failed to load material data:', err);
            setRawData(null);
        } finally {
            setLoading(false);
        }
    }, [filters, timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (filters.log_date || filters.start_date || filters.end_date) {
            setTimeRange('custom');
        }
    }, [filters.log_date, filters.start_date, filters.end_date]);

    const materials = useMemo(() => {
        if (!rawData?.material_consumptions?.materials) return [];
        return rawData.material_consumptions.materials;
    }, [rawData]);

    const materialSummary = useMemo(() => {
        if (!rawData?.material_consumptions?.summary) return null;
        return rawData.material_consumptions.summary;
    }, [rawData]);

    const dateRangeLabel = useMemo(() => {
        const f = rawData?.filters;
        if (!f) return '';
        if (f.start_date === f.end_date) return f.start_date;
        return `${f.start_date} to ${f.end_date}`;
    }, [rawData]);

    // Build chart data: yield by pet across all material types
    const yieldByPetChart = useMemo(() => {
        // Always show Pet 1–6
        const defaultPets = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];
        const petMap = {};
        defaultPets.forEach(name => { petMap[name] = { pet: name, totalUsed: 0, totalLosses: 0 }; });

        materials.forEach(m => {
            (m.pets || []).forEach(p => {
                // Normalize pet name to "Pet X" format
                const rawName = (p.pet_name || '').toLowerCase().trim();
                const num = rawName.match(/pet\s*(\d+)/);
                const name = num ? `Pet ${num[1]}` : (p.pet_name || `Pet ${p.pet_id}`);
                if (!petMap[name]) petMap[name] = { pet: name, totalUsed: 0, totalLosses: 0 };
                petMap[name].totalUsed += parseFloat(p.used) || 0;
                petMap[name].totalLosses += parseFloat(p.losses) || 0;
            });
        });
        return Object.values(petMap)
            .map(p => ({ ...p, yield: p.totalUsed > 0 ? ((p.totalUsed - p.totalLosses) / p.totalUsed * 100) : 0 }))
            .sort((a, b) => {
                const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });
    }, [materials]);

    // Build chart data: yield per material type
    const yieldByMaterialChart = useMemo(() => {
        return materials.map(m => ({
            name: m.material_type_display || m.material_type,
            type: m.material_type,
            yield: m.yield_percentage || 0,
            used: m.total_used || 0,
            losses: m.total_losses || 0,
        }));
    }, [materials]);

    // Build per-material per-pet breakdown for the table
    const tableData = useMemo(() => {
        if (!materials.length) return [];
        const rows = [];
        materials.forEach(m => {
            (m.pets || []).forEach(p => {
                rows.push({
                    material: m.material_type_display || m.material_type,
                    material_type: m.material_type,
                    unit: m.unit || 'pcs',
                    pet: p.pet_name || `Pet ${p.pet_id}`,
                    used: parseFloat(p.used) || 0,
                    losses: parseFloat(p.losses) || 0,
                    yield: p.yield_percentage || 0,
                });
            });
        });
        return rows.sort((a, b) => {
            const aNum = parseInt(a.pet.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.pet.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum || a.material.localeCompare(b.material);
        });
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
        exportToExcel(exportData, `Material_Analytics_${dateRangeLabel.replace(/ to /g, '_')}`);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded shadow-lg border" style={{ minWidth: 150 }}>
                    <p className="fw-bold mb-2 border-bottom pb-2">{label}</p>
                    {payload.map((entry, idx) => (
                        <div key={idx} className="d-flex justify-content-between align-items-center mb-1">
                            <span className="d-flex align-items-center gap-1">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block' }} />
                                <span>{entry.name}:</span>
                            </span>
                            <span className="fw-medium ms-2">
                                {typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : entry.value}
                            </span>
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
                    <h4 className="mb-0">Material Analytics</h4>
                    <small className="text-muted">Material consumption, losses, and yield analysis</small>
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
                    {materialSummary && (
                        <span className="ms-3">
                            Overall Yield: <strong className={`text-${yieldBadge(materialSummary.overall_yield)}`}>{materialSummary.overall_yield?.toFixed(1)}%</strong>
                        </span>
                    )}
                </div>
            )}

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>
            ) : materials.length === 0 ? (
                <div className="text-center py-5 text-muted">
                    <i className="ti ti-stack fs-1 mb-3 d-block"></i>
                    <p>No material consumption data available for this period</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="row g-3 mb-4">
                        {materials.map(m => (
                            <div key={m.material_type} className="col-xl col-sm-6">
                                <div className="card border-top border-3 mb-0 h-100" style={{ borderTopColor: MATERIAL_COLORS[m.material_type] || '#64748b' }}>
                                    <div className="card-body">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <p className="text-muted fs-14 mb-0">{m.material_type_display}</p>
                                            <span className={`badge bg-${yieldBadge(m.yield_percentage)}-subtle text-${yieldBadge(m.yield_percentage)}`}>
                                                {m.yield_percentage?.toFixed(1)}%
                                            </span>
                                        </div>
                                        <h5 className="mb-1 fw-bold">{(m.total_used || 0).toLocaleString()}</h5>
                                        <small className="text-muted">{m.unit} used</small>
                                        {m.total_losses > 0 && (
                                            <div className="mt-1">
                                                <small className="text-danger">
                                                    <i className="ti ti-trending-down me-1"></i>
                                                    {(m.total_losses || 0).toLocaleString()} losses
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {materialSummary && (
                            <>
                                <div className="col-xl col-sm-6">
                                    <div className="card border-top border-success border-3 mb-0 h-100">
                                        <div className="card-body">
                                            <p className="text-muted fs-14 mb-2">Best Pet</p>
                                            <h5 className="mb-1 fw-bold text-success">{materialSummary.best_pet?.pet_name}</h5>
                                            <small className="text-muted">{materialSummary.best_pet?.yield_percentage?.toFixed(1)}% yield</small>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-xl col-sm-6">
                                    <div className="card border-top border-danger border-3 mb-0 h-100">
                                        <div className="card-body">
                                            <p className="text-muted fs-14 mb-2">Lowest Pet</p>
                                            <h5 className="mb-1 fw-bold text-danger">{materialSummary.worst_pet?.pet_name}</h5>
                                            <small className="text-muted">{materialSummary.worst_pet?.yield_percentage?.toFixed(1)}% yield</small>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {viewMode === 'chart' ? (
                        <>
                            {/* Yield by PET Line */}
                            <div className="row mb-4">
                                <div className="col-lg-7">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">Material Yield by PET Line</h6>
                                            <small className="text-muted">Overall yield percentage per production line</small>
                                        </div>
                                        <div className="card-body">
                                            {yieldByPetChart.length === 0 ? (
                                                <p className="text-center text-muted py-5">No data</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <BarChart data={yieldByPetChart} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey="pet" tick={{ fontSize: 12 }} />
                                                        <YAxis domain={[90, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="yield" name="Yield %" radius={[4, 4, 0, 0]}>
                                                            {yieldByPetChart.map((entry, idx) => (
                                                                <Cell key={idx} fill={yieldColor(entry.yield)} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-lg-5">
                                    <div className="card h-100">
                                        <div className="card-header">
                                            <h6 className="mb-0">Yield by Material Type</h6>
                                            <small className="text-muted">Yield comparison across material categories</small>
                                        </div>
                                        <div className="card-body">
                                            {yieldByMaterialChart.length === 0 ? (
                                                <p className="text-center text-muted py-5">No data</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <BarChart data={yieldByMaterialChart} layout="vertical" margin={{ top: 10, right: 20, left: 80, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis type="number" domain={[90, 100]} tick={{ fontSize: 12 }} tickFormatter={v => `${v}%`} />
                                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={75} />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="yield" name="Yield %" radius={[0, 4, 4, 0]}>
                                                            {yieldByMaterialChart.map((entry, idx) => (
                                                                <Cell key={idx} fill={MATERIAL_COLORS[entry.type] || '#64748b'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Material Table */}
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <div>
                                        <h6 className="mb-0">Material Consumption Details</h6>
                                        <small className="text-muted">Per-material, per-PET breakdown</small>
                                    </div>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-sm table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Material</th>
                                                    <th>PET Line</th>
                                                    <th className="text-end">Used</th>
                                                    <th className="text-end">Losses</th>
                                                    <th className="text-end">Yield</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableData.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <span className="d-flex align-items-center gap-2">
                                                                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: MATERIAL_COLORS[row.material_type] || '#64748b' }}></span>
                                                                {row.material}
                                                                <small className="text-muted">({row.unit})</small>
                                                            </span>
                                                        </td>
                                                        <td className="fw-medium">{row.pet}</td>
                                                        <td className="text-end">{row.used.toLocaleString()}</td>
                                                        <td className="text-end text-danger">{row.losses > 0 ? row.losses.toLocaleString() : '-'}</td>
                                                        <td className="text-end">
                                                            <span className={`badge bg-${yieldBadge(row.yield)}-subtle text-${yieldBadge(row.yield)} fw-bold`}>
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
                        </>
                    ) : (
                        /* Table View - Full matrix */
                        <div className="card">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 className="mb-0">Material Consumption Matrix</h6>
                                    <small className="text-muted">All materials × PET lines {dateRangeLabel && `(${dateRangeLabel})`}</small>
                                </div>
                            </div>
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.8rem' }}>
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ position: 'sticky', left: 0, background: '#f8f9fa', zIndex: 2 }}>Material</th>
                                                {yieldByPetChart.map(p => (
                                                    <th key={p.pet} className="text-center">{p.pet}</th>
                                                ))}
                                                <th className="text-center" style={{ position: 'sticky', right: 0, background: '#f8f9fa', zIndex: 2 }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {materials.map((m, idx) => {
                                                const color = MATERIAL_COLORS[m.material_type] || '#64748b';
                                                return (
                                                    <tr key={m.material_type} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                        <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#f8fafc', zIndex: 1, borderLeft: `3px solid ${color}` }}>
                                                            <strong style={{ color }}>{m.material_type_display}</strong>
                                                            <small className="text-muted ms-1">({m.unit})</small>
                                                        </td>
                                                        {yieldByPetChart.map(petInfo => {
                                                            const petData = (m.pets || []).find(p => 
                                                                (p.pet_name || '').toLowerCase().replace(/\s+/g, '') === petInfo.pet.toLowerCase().replace(/\s+/g, '')
                                                            );
                                                            if (!petData) {
                                                                return <td key={petInfo.pet} className="text-center text-muted">-</td>;
                                                            }
                                                            return (
                                                                <td key={petInfo.pet} className="text-center" style={{ whiteSpace: 'nowrap' }}>
                                                                    <span style={{ fontWeight: 700, color: yieldColor(petData.yield_percentage) }}>
                                                                        {petData.yield_percentage?.toFixed(1)}%
                                                                    </span>
                                                                    <br />
                                                                    <small className="text-muted">{(petData.used || 0).toLocaleString()}</small>
                                                                    {petData.losses > 0 && <small className="text-danger"> / -{(petData.losses || 0).toLocaleString()}</small>}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="text-center fw-bold" style={{ position: 'sticky', right: 0, background: '#f8f9fa', zIndex: 1 }}>
                                                            <span className={`badge bg-${yieldBadge(m.yield_percentage)}-subtle text-${yieldBadge(m.yield_percentage)}`}>
                                                                {m.yield_percentage?.toFixed(1)}%
                                                            </span>
                                                            <br />
                                                            <small className="text-muted">{(m.total_used || 0).toLocaleString()}</small>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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

export default MaterialReport;
