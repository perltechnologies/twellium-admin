import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi } from '../../api';
import { Pagination } from '../../components/ui/Pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (envelope?.results && Array.isArray(envelope.results)) return envelope.results;
    if (envelope?.data && Array.isArray(envelope.data)) return envelope.data;
    return [];
};

const PetPerformance = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
    });
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(false);

    // Table pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { page_size: 2000 };

            const response = await inventoryApi.getPetPerformance(params);
            let result = extractData(response);

            // Client-side filtering for unsupported API filters
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                result = result.filter(u => new Date(u.created_at) >= start);
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                result = result.filter(u => new Date(u.created_at) <= end);
            }

            setUnits(result);
            setPage(1);
        } catch (error) {
            console.error('Failed to fetch pet performance:', error);
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const performanceData = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const rawLabel = String(u.pet_name || u.pet || 'Unknown');
            if (rawLabel.toLowerCase().includes('can')) return;

            const match = rawLabel.match(/\d+/);
            const petNumber = match ? parseInt(match[0], 10) : 999;
            const petKey = match ? `Pet ${petNumber}` : rawLabel;

            if (!map[petKey]) {
                map[petKey] = {
                    name: petKey,
                    petNumber,
                    totalPallets: 0,
                    totalPacks: 0
                };
            }
            map[petKey].totalPallets += 1;
            map[petKey].totalPacks += (u.quantity || 0);
        });

        return Object.values(map)
            .map(p => ({
                ...p,
                totalOutput: p.totalPacks,
                efficiency: p.totalPacks > 0 ? Math.min(Math.round((p.totalPacks / (p.totalPallets * 1000)) * 100), 100) : 0,
            }))
            .sort((a, b) => b.totalOutput - a.totalOutput);
    }, [units]);

    const paginatedPerformance = useMemo(() => {
        const start = (page - 1) * pageSize;
        return performanceData.slice(start, start + pageSize);
    }, [performanceData, page, pageSize]);

    const topPet = performanceData[0];
    const leastPet = performanceData[performanceData.length - 1];

    const handleExport = () => {
        const exportData = performanceData.map((p, idx) => ({
            'Rank': idx + 1,
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
                    <h4 className="mb-1"><i className="ti ti-trophy me-2"></i>Pet Performance Ranking</h4>
                    <p className="text-muted mb-0">Top and least producing pets by production output</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={fetchData} disabled={loading}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                    <button className="btn btn-sm btn-success" onClick={handleExport} disabled={!units.length}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header"><h5 className="card-title mb-0"><i className="ti ti-calendar me-2"></i>Date Range</h5></div>
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
            ) : units.length > 0 ? (
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
                        <div className="card-header"><h6 className="mb-0">Production Output by Pet</h6></div>
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
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h6 className="mb-0">Performance Ranking</h6>
                            <span className="badge bg-soft-primary text-primary">{performanceData.length} lines</span>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-sm table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th style={{ width: 60 }}>Rank</th>
                                            <th>Pet Name</th>
                                            <th className="text-end">Total Output</th>
                                            <th className="text-end">Pallets</th>
                                            <th className="text-end">Packs</th>
                                            <th>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPerformance.map((pet, idx) => {
                                            const actualRank = (page - 1) * pageSize + idx + 1;
                                            return (
                                                <tr key={pet.name}>
                                                    <td>
                                                        <span className={`avatar avatar-xs rounded-circle ${actualRank === 1 ? 'bg-warning text-white' : actualRank === performanceData.length ? 'bg-danger text-white' : 'bg-light text-dark'}`}>
                                                            #{actualRank}
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            totalCount={performanceData.length}
                            onPageChange={setPage}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setPage(1);
                            }}
                            pageSizeOptions={[5, 10, 20, 50]}
                            itemLabel="lines"
                        />
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
