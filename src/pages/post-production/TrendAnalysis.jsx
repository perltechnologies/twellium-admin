import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi, productionApi, logisticsApi } from '../../api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const TrendAnalysis = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        petName: '',
    });
    const [activeTab, setActiveTab] = useState('packs');
    const [data, setData] = useState({ packs: null, pallets: null, warehouse: null, customers: null });
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);

    useEffect(() => {
        fetchPets();
    }, []);

    const fetchPets = async () => {
        try {
            const res = await productionApi.getPets();
            setPets(res.data?.data?.data || res.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch pets:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.petName) params.pet_name = filters.petName;

            const endpoints = {
                packs: inventoryApi.getPacksTrend,
                pallets: inventoryApi.getPalletsTrend,
                warehouse: inventoryApi.getWarehouseStageTrend,
                customers: inventoryApi.getCustomerDispatchTrend,
            };

            const responses = await Promise.allSettled(
                Object.entries(endpoints).map(async ([key, fn]) => {
                    try {
                        const res = await fn(params);
                        const result = res.data?.data?.data || res.data?.data || [];
                        return [key, result];
                    } catch (e) {
                        return [key, []];
                    }
                })
            );

            const newData = {};
            responses.forEach(r => {
                if (r.status === 'fulfilled') {
                    newData[r.value[0]] = r.value[1];
                }
            });
            setData(newData);
        } catch (error) {
            console.error('Failed to fetch trend data:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentData = useMemo(() => {
        return data[activeTab] || [];
    }, [data, activeTab]);

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

    return (
        <div className="container-fluid">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">
                        <i className="ti ti-chart-line me-2"></i>
                        Trend Analysis
                    </h4>
                    <p className="text-muted mb-0">Analyze production trends across multiple dimensions</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={fetchData} disabled={loading}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <button className="btn btn-sm btn-success" onClick={handleExport}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-filter me-2"></i>
                                Filters
                            </h5>
                        </div>
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
                                        {pets.map(p => <option key={p.id} value={p.pet_name}>{p.pet_name}</option>)}
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
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={currentData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                {Object.keys(currentData[0] || {})
                                    .filter(key => key !== 'date')
                                    .map((key, idx) => (
                                        <Line key={key} type="monotone" dataKey={key}
                                            stroke={COLORS[idx % COLORS.length]}
                                            strokeWidth={2} dot={{ r: 3 }} name={key} />
                                    ))}
                            </LineChart>
                        </ResponsiveContainer>
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
