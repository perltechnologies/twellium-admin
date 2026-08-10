import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi, productionApi } from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const PetPerformance = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;

            const response = await inventoryApi.getPetPerformance(params);
            const result = response.data?.data?.data || response.data?.data || {};
            setData(result);
        } catch (error) {
            console.error('Failed to fetch pet performance:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const performanceData = useMemo(() => {
        if (!data?.pets) return [];
        return data.pets
            .map(p => ({
                name: p.pet_name,
                totalOutput: p.total_output || p.total_bottles || 0,
                totalPallets: p.total_pallets || 0,
                totalPacks: p.total_packs || 0,
                efficiency: p.efficiency || p.avg_efficiency || 0,
            }))
            .sort((a, b) => b.totalOutput - a.totalOutput);
    }, [data]);

    const topPet = performanceData[0];
    const leastPet = performanceData[performanceData.length - 1];

    const handleExport = () => {
        const exportData = performanceData.map(p => ({
            'Pet Name': p.name,
            'Total Output': p.totalOutput,
            'Total Pallets': p.totalPallets,
            'Total Packs': p.totalPacks,
            'Efficiency (%)': p.efficiency,
        }));
        exportToExcel(exportData, `pet_performance_${filters.startDate}`, 'Pet Performance');
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

    return (
        <div className="container-fluid">
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-1">
                        <i className="ti ti-trophy me-2"></i>
                        Pet Performance Ranking
                    </h4>
                    <p className="text-muted mb-0">Top and least producing pets by production output</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={fetchData} disabled={loading}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <button className="btn btn-sm btn-success" onClick={handleExport} disabled={!data}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5 className="card-title mb-0">
                                <i className="ti ti-calendar me-2"></i>
                                Date Range
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
                                    <button className="btn btn-primary w-100" onClick={fetchData} disabled={loading}>
                                        <i className="ti ti-search me-2"></i>{loading ? 'Loading...' : 'Search'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
            ) : data ? (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-xl-6">
                            <div className="card border-top border-success border-3 mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-center gap-3">
                                        <span className="avatar avatar-lg bg-soft-success rounded-circle">
                                            <i className="ti ti-trophy fs-2 text-success"></i>
                                        </span>
                                        <div>
                                            <p className="text-muted fs-14 mb-1">Top Producing Pet</p>
                                            <h3 className="mb-0 fs-16 fw-bold">{topPet?.name || 'N/A'}</h3>
                                            <small className="text-muted">{topPet?.totalOutput.toLocaleString()} units | {topPet?.efficiency}% efficiency</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-6">
                            <div className="card border-top border-danger border-3 mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-center gap-3">
                                        <span className="avatar avatar-lg bg-soft-danger rounded-circle">
                                            <i className="ti ti-arrow-down fs-2 text-danger"></i>
                                        </span>
                                        <div>
                                            <p className="text-muted fs-14 mb-1">Least Producing Pet</p>
                                            <h3 className="mb-0 fs-16 fw-bold">{leastPet?.name || 'N/A'}</h3>
                                            <small className="text-muted">{leastPet?.totalOutput.toLocaleString()} units | {leastPet?.efficiency}% efficiency</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header">
                            <h6 className="mb-0">Production Output by Pet</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={performanceData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="totalOutput" name="Total Output" radius={[4, 4, 0, 0]}>
                                        {performanceData.map((entry, idx) => (
                                            <Cell key={idx} fill={idx === 0 ? '#22c55e' : idx === performanceData.length - 1 ? '#ef4444' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h6 className="mb-0">Performance Ranking</h6>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Rank</th>
                                            <th>Pet Name</th>
                                            <th className="text-end">Total Output</th>
                                            <th className="text-end">Pallets</th>
                                            <th className="text-end">Packs</th>
                                            <th>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {performanceData.map((pet, idx) => (
                                            <tr key={pet.name}>
                                                <td>
                                                    <span className={`avatar avatar-xs rounded-circle ${idx === 0 ? 'bg-warning text-white' : idx === performanceData.length - 1 ? 'bg-danger text-white' : 'bg-light'}`}>
                                                        #{idx + 1}
                                                    </span>
                                                </td>
                                                <td className="fw-medium">{pet.name}</td>
                                                <td className="text-end fw-medium">{pet.totalOutput.toLocaleString()}</td>
                                                <td className="text-end">{pet.totalPallets.toLocaleString()}</td>
                                                <td className="text-end">{pet.totalPacks.toLocaleString()}</td>
                                                <td>
                                                    <span className={`badge ${pet.efficiency >= 85 ? 'bg-success' : pet.efficiency >= 70 ? 'bg-warning' : 'bg-danger'}`}>
                                                        {pet.efficiency}%
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
                <div className="card">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="ti ti-trophy fs-1 mb-3 d-block"></i>
                        <h5>No data available</h5>
                        <p>Select a date range to view pet performance</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PetPerformance;
