import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { inventoryApi, productionApi } from '../../api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const LiveManagementDashboard = () => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);
    const [scanHistory, setScanHistory] = useState([]);
    const [palletCounts, setPalletCounts] = useState([]);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const response = await inventoryApi.getLiveMetrics();
            const result = response.data?.data?.data || response.data?.data || {};
            setMetrics(result);
            if (result.scan_history) setScanHistory(result.scan_history);
            if (result.pallet_counts) setPalletCounts(result.pallet_counts);
        } catch (error) {
            console.error('Failed to fetch live metrics:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPets = useCallback(async () => {
        try {
            const res = await productionApi.getPets();
            setPets(res.data?.data?.data || res.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch pets:', error);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        fetchPets();
    }, [fetchMetrics, fetchPets]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchMetrics, refreshInterval * 1000);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchMetrics]);

    const totals = useMemo(() => {
        if (!metrics) return { scanned: 0, pallets: 0, bottles: 0, packs: 0 };
        return {
            scanned: metrics.total_scanned || 0,
            pallets: metrics.total_pallets || 0,
            bottles: metrics.total_bottles || 0,
            packs: metrics.total_packs || 0,
        };
    }, [metrics]);

    const petPerformance = useMemo(() => {
        if (!metrics?.pet_metrics) return [];
        return metrics.pet_metrics.map(p => ({
            name: p.pet_name,
            scanned: p.scanned || 0,
            pallets: p.pallets || 0,
            bottles: p.bottles || 0,
        }));
    }, [metrics]);

    const batchProgress = useMemo(() => {
        if (!metrics?.batch_progress) return [];
        return metrics.batch_progress.map(b => ({
            name: b.batch_number,
            pallets: b.pallets || 0,
            bottles: b.bottles || 0,
        }));
    }, [metrics]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded shadow border">
                    <p className="fw-bold mb-2">{label}</p>
                    {payload.map((entry, idx) => (
                        <div key={idx} className="d-flex justify-content-between gap-3 mb-1">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="fw-medium">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="container-fluid">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">
                        <i className="ti ti-live-photo me-2"></i>
                        Live Management Dashboard
                    </h4>
                    <p className="text-muted mb-0">Real-time production metrics and pallet tracking</p>
                </div>
                <div className="d-flex gap-2 align-items-center">
                    <div className="d-flex align-items-center gap-1">
                        <span className="text-muted small">Auto-refresh:</span>
                        <div className="form-check form-switch mb-0">
                            <input className="form-check-input" type="checkbox"
                                checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                        </div>
                    </div>
                    <select className="form-select form-select-sm" style={{ width: 'auto' }}
                        value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}>
                        <option value={10}>10s</option>
                        <option value={30}>30s</option>
                        <option value={60}>1m</option>
                        <option value={120}>2m</option>
                    </select>
                    <button className="btn btn-sm btn-outline-primary" onClick={fetchMetrics} disabled={loading}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                </div>
            </div>

            {loading && !metrics ? (
                <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
            ) : metrics ? (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-primary border-3 mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <p className="text-muted fs-14 mb-1">Total Scanned</p>
                                            <h2 className="mb-0 fs-16 fw-bold">{totals.scanned.toLocaleString()}</h2>
                                        </div>
                                        <span className="avatar avatar-md bg-soft-primary rounded-circle">
                                            <i className="ti ti-barcode fs-16 text-primary"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <p className="text-muted fs-14 mb-1">Total Pallets</p>
                                            <h2 className="mb-0 fs-16 fw-bold">{totals.pallets.toLocaleString()}</h2>
                                        </div>
                                        <span className="avatar avatar-md bg-soft-success rounded-circle">
                                            <i className="ti ti-package fs-16 text-success"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <p className="text-muted fs-14 mb-1">Total Bottles</p>
                                            <h2 className="mb-0 fs-16 fw-bold">{totals.bottles.toLocaleString()}</h2>
                                        </div>
                                        <span className="avatar avatar-md bg-soft-info rounded-circle">
                                            <i className="ti ti-bottle fs-16 text-info"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-warning border-3 mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            <p className="text-muted fs-14 mb-1">Total Packs</p>
                                            <h2 className="mb-0 fs-16 fw-bold">{totals.packs.toLocaleString()}</h2>
                                        </div>
                                        <span className="avatar avatar-md bg-soft-warning rounded-circle">
                                            <i className="ti ti-box fs-16 text-warning"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-8">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">
                                        <i className="ti ti-chart-line me-1"></i>
                                        Pallet Count per Pet (Live)
                                    </h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={palletCounts}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            {pets.slice(0, 6).map((pet, idx) => (
                                                <Area key={pet.id} type="monotone" dataKey={pet.pet_name}
                                                    stroke={COLORS[idx % COLORS.length]}
                                                    fill={COLORS[idx % COLORS.length]} fillOpacity={0.1} />
                                            ))}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">
                                        <i className="ti ti-activity me-1"></i>
                                        Recent Scans
                                    </h6>
                                </div>
                                <div className="card-body p-0" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    <table className="table table-sm mb-0">
                                        <thead className="table-light sticky-top">
                                            <tr>
                                                <th>Barcode</th>
                                                <th>Pet</th>
                                                <th>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scanHistory.slice(0, 20).map((scan, idx) => (
                                                <tr key={idx}>
                                                    <td><code className="small">{scan.barcode || '-'}</code></td>
                                                    <td><span className="badge bg-soft-primary">{scan.pet_name || '-'}</span></td>
                                                    <td className="small text-muted">{scan.time || scan.created_at || '-'}</td>
                                                </tr>
                                            ))}
                                            {scanHistory.length === 0 && (
                                                <tr><td colSpan="3" className="text-center text-muted py-3">No recent scans</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Pet Performance Metrics</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={petPerformance}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="scanned" fill="#3b82f6" name="Scanned" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="pallets" fill="#22c55e" name="Pallets" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="bottles" fill="#f59e0b" name="Bottles" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Batch Progress</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={batchProgress}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="pallets" fill="#8b5cf6" name="Pallets" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="bottles" fill="#06b6d4" name="Bottles" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="card">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="ti ti-live-photo fs-1 mb-3 d-block"></i>
                        <h5>Unable to load live metrics</h5>
                        <p>Check your connection and try refreshing</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveManagementDashboard;
