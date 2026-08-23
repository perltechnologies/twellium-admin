import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi, productionApi, logisticsApi } from '../../api';
import { formatAndSortPets } from '../../utils/petUtils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (envelope?.results && Array.isArray(envelope.results)) return envelope.results;
    if (envelope?.data && Array.isArray(envelope.data)) return envelope.data;
    return [];
};

const TrendAnalysis = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        petName: '',
    });
    const [activeTab, setActiveTab] = useState('packs');
    const [units, setUnits] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [stageDetails, setStageDetails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);

    useEffect(() => {
        fetchPets();
        fetchData();
    }, []);

    const fetchPets = async () => {
        try {
            const res = await productionApi.getPets();
            const allPets = formatAndSortPets(res);
            setPets(allPets);
        } catch (error) {
            console.error('Failed to fetch pets:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { page_size: 2000 };

            const [unitsRes, shipmentsRes, stageRes] = await Promise.allSettled([
                inventoryApi.getHandlingUnits(params),
                logisticsApi.getShipments({ page_size: 1000 }),
                inventoryApi.getStageDetails(params),
            ]);

            let unitsData = unitsRes.status === 'fulfilled' ? extractData(unitsRes.value) : [];
            const shipmentsData = shipmentsRes.status === 'fulfilled' ? extractData(shipmentsRes.value) : [];
            const stageData = stageRes.status === 'fulfilled' ? (stageRes.value?.data?.data ?? stageRes.value?.data ?? {}) : {};
            const stageDetailsData = Array.isArray(stageData?.details) ? stageData.details : [];

            // Client-side filtering for unsupported API filters
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                unitsData = unitsData.filter(u => new Date(u.created_at) >= start);
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                unitsData = unitsData.filter(u => new Date(u.created_at) <= end);
            }
            if (filters.petName) {
                unitsData = unitsData.filter(u => String(u.pet) === String(filters.petName));
            }

            setUnits(unitsData);
            setShipments(shipmentsData);
            setStageDetails(stageDetailsData);
        } catch (error) {
            console.error('Failed to fetch trend data:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentData = useMemo(() => {
        if (activeTab === 'packs') {
            const dailyMap = {};
            units.forEach(u => {
                const date = u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : 'Unknown';
                const rawLabel = String(u.pet_name || u.pet || 'Unknown');
                const match = rawLabel.match(/\d+/);
                const pet = match ? `Pet ${match[0]}` : rawLabel;

                if (!dailyMap[date]) dailyMap[date] = { date };
                dailyMap[date][pet] = (dailyMap[date][pet] || 0) + (u.quantity || 0);
            });
            return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        }

        if (activeTab === 'pallets') {
            const dailyMap = {};
            units.forEach(u => {
                const date = u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : 'Unknown';
                const rawLabel = String(u.pet_name || u.pet || 'Unknown');
                const match = rawLabel.match(/\d+/);
                const pet = match ? `Pet ${match[0]}` : rawLabel;

                if (!dailyMap[date]) dailyMap[date] = { date };
                dailyMap[date][pet] = (dailyMap[date][pet] || 0) + 1;
            });
            return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        }

        if (activeTab === 'warehouse') {
            return stageDetails.map(s => ({
                date: s.date || s.created_at || 'Unknown',
                stage: s.stage || s.name || 'Unknown',
                count: s.count || s.total || 0,
            }));
        }

        if (activeTab === 'customers') {
            const dailyMap = {};
            shipments.forEach(s => {
                const date = s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : 'Unknown';
                const customer = s.customer_name || s.customer || 'Unknown';
                if (!dailyMap[date]) dailyMap[date] = { date };
                dailyMap[date][customer] = (dailyMap[date][customer] || 0) + 1;
            });
            return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        }

        return [];
    }, [units, shipments, stageDetails, activeTab]);

    const handleExport = () => {
        exportToExcel(currentData, `trend_${activeTab}_${filters.startDate}`, activeTab);
    };

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

    const tabs = [
        { key: 'packs', label: 'Packs per Pet', icon: 'ti ti-box' },
        { key: 'pallets', label: 'Pallets per Pet', icon: 'ti ti-package' },
        { key: 'warehouse', label: 'Warehouse Stages', icon: 'ti ti-building-warehouse' },
        { key: 'customers', label: 'Customer Dispatch', icon: 'ti ti-truck-delivery' },
    ];

    const lineDataKeys = useMemo(() => {
        if (currentData.length === 0) return [];
        return Object.keys(currentData[0])
            .filter(key => key !== 'date' && key !== 'stage' && key !== 'count')
            .sort((a, b) => {
                const aNum = parseInt(a.match(/\d+/)?.[0] || '999', 10);
                const bNum = parseInt(b.match(/\d+/)?.[0] || '999', 10);
                return aNum - bNum;
            });
    }, [currentData]);

    return (
        <div className="container-fluid">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1"><i className="ti ti-chart-line me-2"></i>Trend Analysis</h4>
                    <p className="text-muted mb-0">Analyze production trends across multiple dimensions</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={fetchData} disabled={loading}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <button className="btn btn-sm btn-success" onClick={handleExport} disabled={!currentData.length}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header"><h5 className="card-title mb-0"><i className="ti ti-filter me-2"></i>Filters</h5></div>
                        <div className="card-body">
                            <div className="row g-3 align-items-end">
                                <div className="col-md-3">
                                    <label className="form-label">Start Date</label>
                                    <input type="date" className="form-control" value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label">End Date</label>
                                    <input type="date" className="form-control" value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Pet Line</label>
                                    <select className="form-select" value={filters.petName}
                                        onChange={(e) => setFilters({ ...filters, petName: e.target.value })}>
                                        <option value="">All Pets</option>
                                        {pets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <button className="btn btn-primary w-100" onClick={fetchData} disabled={loading}>
                                        <i className="ti ti-search me-2"></i>{loading ? 'Loading...' : 'Search'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <ul className="nav nav-pills gap-2">
                        {tabs.map(tab => (
                            <li key={tab.key} className="nav-item">
                                <button className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.key)}>
                                    <i className={`${tab.icon} me-1`}></i>{tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
            ) : currentData.length > 0 ? (
                <div className="card">
                    <div className="card-header">
                        <h6 className="mb-0">{tabs.find(t => t.key === activeTab)?.label}</h6>
                    </div>
                    <div className="card-body">
                        {activeTab === 'warehouse' ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={currentData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" fill="#3b82f6" name="Count" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={currentData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    {lineDataKeys.map((key, idx) => (
                                        <Line key={key} type="monotone" dataKey={key}
                                            stroke={COLORS[idx % COLORS.length]}
                                            strokeWidth={2} dot={{ r: 3 }} name={key} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="ti ti-chart-line fs-1 mb-3 d-block"></i>
                        <h5>No trend data available</h5>
                        <p>Apply filters and search to view trend analysis</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrendAnalysis;
