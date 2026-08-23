import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { inventoryApi, productionApi } from '../../api';
import { formatAndSortPets } from '../../utils/petUtils';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (envelope?.results && Array.isArray(envelope.results)) return envelope.results;
    if (envelope?.data && Array.isArray(envelope.data)) return envelope.data;
    return [];
};

const LiveManagementDashboard = () => {
    const [overview, setOverview] = useState(null);
    const [stageCounts, setStageCounts] = useState(null);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const [overviewRes, stageRes, unitsRes] = await Promise.all([
                inventoryApi.getTodayOverview(),
                inventoryApi.getStageCounts(),
                inventoryApi.getHandlingUnits({ page_size: 100, ordering: '-created_at' }),
            ]);

            const overviewData = overviewRes?.data?.data ?? overviewRes?.data ?? {};
            setOverview(overviewData);

            const stageData = stageRes?.data?.data ?? stageRes?.data ?? {};
            setStageCounts(stageData);

            const unitsData = extractData(unitsRes);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch live metrics:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPets = useCallback(async () => {
        try {
            const res = await productionApi.getPets();
            const allPets = formatAndSortPets(res);
            setPets(allPets);
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
        return {
            scanned: overview?.total_units || units.length,
            pallets: overview?.total_pallets || units.filter(u => u.unit_type === 'PALLET').length,
            bottles: overview?.total_bottles || units.reduce((s, u) => s + (u.total_bottles || u.bottles || 0), 0),
            packs: overview?.total_packs || units.reduce((s, u) => s + (u.quantity || 0), 0),
        };
    }, [overview, units]);

    const petPerformance = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const pet = u.pet_name || u.pet?.pet_name || u.pet || 'Unknown';
            if (!map[pet]) map[pet] = { name: pet, scanned: 0, pallets: 0, bottles: 0 };
            map[pet].scanned += 1;
            if (u.unit_type === 'PALLET') map[pet].pallets += 1;
            map[pet].bottles += (u.total_bottles || u.bottles || 0);
        });
        return Object.values(map);
    }, [units]);

    const batchProgress = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const batch = u.batch_number || u.batch || 'Unknown';
            if (!map[batch]) map[batch] = { name: batch, pallets: 0, bottles: 0 };
            map[batch].pallets += 1;
            map[batch].bottles += (u.total_bottles || u.bottles || 0);
        });
        return Object.values(map).slice(0, 10);
    }, [units]);

    const palletCounts = useMemo(() => {
        const stageData = stageCounts?.stages || stageCounts || [];
        return Array.isArray(stageData) ? stageData.map(s => ({
            name: s.stage || s.name || 'Unknown',
            count: s.count || s.total || 0,
        })) : [];
    }, [stageCounts]);

    const recentScans = useMemo(() => {
        return units.slice(0, 20).map(u => ({
            barcode: u.barcode || u.current_barcode || u.id || '-',
            pet_name: u.pet_name || u.pet?.pet_name || u.pet || '-',
            created_at: u.created_at,
            time: u.created_at ? new Date(u.created_at).toLocaleTimeString() : '-',
        }));
    }, [units]);

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
                    <h4 className="mb-1"><i className="ti ti-live-photo me-2"></i>Live Management Dashboard</h4>
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

            {loading && !overview && units.length === 0 ? (
                <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
            ) : (
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
                                    <h6 className="mb-0"><i className="ti ti-chart-line me-1"></i>Pallet Count per Stage</h6>
                                </div>
                                <div className="card-body">
                                    {palletCounts.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={palletCounts}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 12 }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="count" fill="#3b82f6" name="Pallets" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="text-center text-muted py-4">No stage data available</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0"><i className="ti ti-activity me-1"></i>Recent Scans</h6>
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
                                            {recentScans.map((scan, idx) => (
                                                <tr key={idx}>
                                                    <td><code className="small">{scan.barcode}</code></td>
                                                    <td><span className="badge bg-soft-primary">{scan.pet_name}</span></td>
                                                    <td className="small text-muted">{scan.time}</td>
                                                </tr>
                                            ))}
                                            {recentScans.length === 0 && (
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
                                <div className="card-header"><h6 className="mb-0">Pet Performance Metrics</h6></div>
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
                                <div className="card-header"><h6 className="mb-0">Batch Progress</h6></div>
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
            )}
        </div>
    );
};

export default LiveManagementDashboard;
