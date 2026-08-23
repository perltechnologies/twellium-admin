import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi, productionApi } from '../../api';
import { formatAndSortPets } from '../../utils/petUtils';
import { Pagination } from '../../components/ui/Pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const extractData = (res) => {
    const envelope = res?.data?.data ?? res?.data ?? {};
    if (Array.isArray(envelope)) return envelope;
    if (envelope?.results && Array.isArray(envelope.results)) return envelope.results;
    if (envelope?.data && Array.isArray(envelope.data)) return envelope.data;
    return [];
};

const BatchTraceability = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        petName: '',
        batchNumber: '',
    });
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchDetails, setBatchDetails] = useState(null);

    // Batch summary table pagination
    const [summaryPage, setSummaryPage] = useState(1);
    const [summaryPageSize, setSummaryPageSize] = useState(10);

    // Detail units table pagination
    const [detailPage, setDetailPage] = useState(1);
    const [detailPageSize, setDetailPageSize] = useState(10);

    useEffect(() => {
        fetchDropdownData();
        fetchData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, batchesRes] = await Promise.all([
                productionApi.getPets(),
                productionApi.getBatches(),
            ]);
            const allPets = formatAndSortPets(petsRes);
            setPets(allPets);

            const batchList = batchesRes.data?.data?.data || batchesRes.data?.data || batchesRes.data?.results || [];
            setBatches(Array.isArray(batchList) ? batchList : batchList.results || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { page_size: 2000 };
            if (filters.petName) params.pet = filters.petName;

            const response = await inventoryApi.getBatchTraceability(params);
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
            if (filters.batchNumber) {
                result = result.filter(u => {
                    const unitBatch = u.actual_production_code || u.production_run_name || '';
                    return unitBatch.includes(filters.batchNumber);
                });
            }

            setUnits(result);
            setSummaryPage(1);
        } catch (error) {
            console.error('Failed to fetch batch traceability:', error);
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchBatchDetails = (batchNumber) => {
        const filtered = units.filter(u => {
            const unitBatch = u.actual_production_code || u.production_run_name || '';
            return unitBatch === batchNumber;
        });
        setBatchDetails(filtered);
        setSelectedBatch(batchNumber);
        setDetailPage(1);
    };

    const palletData = useMemo(() => {
        const stageMap = {};
        units.forEach(u => {
            const stage = u.current_status || 'UNKNOWN';
            if (!stageMap[stage]) stageMap[stage] = { name: stage, packs: 0 };
            stageMap[stage].packs += (u.quantity || 0);
        });
        return Object.values(stageMap);
    }, [units]);

    const batchSummary = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const batch = u.actual_production_code || u.production_run_name || 'Unknown';
            if (!map[batch]) map[batch] = { name: batch, pallets: 0, packs: 0 };
            map[batch].pallets += 1;
            map[batch].packs += (u.quantity || 0);
        });
        return Object.values(map).sort((a, b) => b.pallets - a.pallets);
    }, [units]);

    const paginatedBatchSummary = useMemo(() => {
        const start = (summaryPage - 1) * summaryPageSize;
        return batchSummary.slice(start, start + summaryPageSize);
    }, [batchSummary, summaryPage, summaryPageSize]);

    const paginatedBatchDetails = useMemo(() => {
        if (!batchDetails) return [];
        const start = (detailPage - 1) * detailPageSize;
        return batchDetails.slice(start, start + detailPageSize);
    }, [batchDetails, detailPage, detailPageSize]);

    const petBreakdown = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const pet = u.pet_name || u.pet || 'Unknown';
            if (!map[pet]) map[pet] = { name: pet, pallets: 0, packs: 0 };
            map[pet].pallets += 1;
            map[pet].packs += (u.quantity || 0);
        });
        return Object.values(map).sort((a, b) => b.packs - a.packs);
    }, [units]);

    const totals = useMemo(() => ({
        pallets: units.length,
        packs: units.reduce((s, u) => s + (u.quantity || 0), 0),
    }), [units]);

    const handleExport = () => {
        const exportData = batchSummary.map(b => ({
            'Batch Number': b.name,
            'Pallets': b.pallets,
            'Packs': b.packs,
        }));
        exportToExcel(exportData, `batch_traceability_${filters.startDate}`, 'Batch Traceability');
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded shadow border">
                    <p className="fw-bold mb-2">{label}</p>
                    {payload.map((entry, idx) => (
                        <div key={idx} className="d-flex justify-content-between gap-3 mb-1">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="fw-medium">{entry.value.toLocaleString()}</span>
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
                        <i className="ti ti-trace me-2"></i>
                        Batch Traceability & Pallet Analytics
                    </h4>
                    <p className="text-muted mb-0">Track pallet production and trace back to source batches</p>
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
                        <div className="card-header">
                            <h5 className="card-title mb-0"><i className="ti ti-filter me-2"></i>Filters</h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3 align-items-end">
                                <div className="col-md-2">
                                    <label className="form-label">Start Date</label>
                                    <input type="date" className="form-control" value={filters.startDate}
                                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">End Date</label>
                                    <input type="date" className="form-control" value={filters.endDate}
                                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Pet Name</label>
                                    <select className="form-select" value={filters.petName}
                                        onChange={(e) => setFilters({ ...filters, petName: e.target.value })}>
                                        <option value="">All Pets</option>
                                        {pets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Batch Number</label>
                                    <select className="form-select" value={filters.batchNumber}
                                        onChange={(e) => setFilters({ ...filters, batchNumber: e.target.value })}>
                                        <option value="">All Batches</option>
                                        {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
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

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
            ) : units.length > 0 ? (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-xl-6 col-sm-6">
                            <div className="card border-top border-primary border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Pallets</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.pallets.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-6 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Packs</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.packs.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-8">
                            <div className="card h-100">
                                <div className="card-header"><h6 className="mb-0">Pallet Production by Status</h6></div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={palletData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="packs" fill="#3b82f6" name="Packs" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-header"><h6 className="mb-0">Packs by Pet</h6></div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={petBreakdown} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="packs"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                {petBreakdown.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v.toLocaleString(), 'Packs']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header d-flex align-items-center justify-content-between">
                                    <h6 className="mb-0">Batch Summary</h6>
                                    <span className="badge bg-soft-primary text-primary">{batchSummary.length} batches</span>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-striped table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Batch Number</th>
                                                    <th>Pallets</th>
                                                    <th>Packs</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedBatchSummary.map((batch) => (
                                                    <tr key={batch.name}>
                                                        <td><code>{batch.name}</code></td>
                                                        <td>{batch.pallets.toLocaleString()}</td>
                                                        <td>{batch.packs.toLocaleString()}</td>
                                                        <td className="text-end">
                                                            <button className="btn btn-sm btn-outline-primary"
                                                                onClick={() => fetchBatchDetails(batch.name)}>
                                                                <i className="ti ti-eye me-1"></i>Trace
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <Pagination
                                    page={summaryPage}
                                    pageSize={summaryPageSize}
                                    totalCount={batchSummary.length}
                                    onPageChange={setSummaryPage}
                                    onPageSizeChange={(newSize) => {
                                        setSummaryPageSize(newSize);
                                        setSummaryPage(1);
                                    }}
                                    pageSizeOptions={[5, 10, 20, 50]}
                                    itemLabel="batches"
                                />
                            </div>
                        </div>
                    </div>

                    {selectedBatch && batchDetails && (
                        <div className="card mb-4">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <h6 className="mb-0"><i className="ti ti-trace me-2"></i>Trace Details: Batch {selectedBatch}</h6>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedBatch(null); setBatchDetails(null); }}>
                                    <i className="ti ti-x me-1"></i>Close
                                </button>
                            </div>
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Pallets</small>
                                            <h5 className="mb-0">{batchDetails.length}</h5>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Packs</small>
                                            <h5 className="mb-0">{batchDetails.reduce((s, u) => s + (u.quantity || 0), 0).toLocaleString()}</h5>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Unique Pets</small>
                                            <h5 className="mb-0">{new Set(batchDetails.map(u => u.pet_name || u.pet || '')).size}</h5>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <h6 className="mb-0">Unit Details</h6>
                                        <small className="text-muted">{batchDetails.length} units total</small>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-bordered table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Barcode</th>
                                                    <th>Product</th>
                                                    <th>Pet</th>
                                                    <th>Quantity</th>
                                                    <th>Status</th>
                                                    <th>Created</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedBatchDetails.map((u, idx) => (
                                                    <tr key={idx}>
                                                        <td><code>{u.current_barcode || u.internal_id || u.id || '-'}</code></td>
                                                        <td>{u.product_name || '-'}</td>
                                                        <td>{u.pet_name || '-'}</td>
                                                        <td>{u.quantity || 0}</td>
                                                        <td><span className="badge bg-soft-info">{u.current_status || '-'}</span></td>
                                                        <td className="small">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <Pagination
                                        page={detailPage}
                                        pageSize={detailPageSize}
                                        totalCount={batchDetails.length}
                                        onPageChange={setDetailPage}
                                        onPageSizeChange={(newSize) => {
                                            setDetailPageSize(newSize);
                                            setDetailPage(1);
                                        }}
                                        pageSizeOptions={[10, 25, 50, 100]}
                                        itemLabel="units"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="card">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="ti ti-package fs-1 mb-3 d-block"></i>
                        <h5>No data available</h5>
                        <p>Apply filters and search to view batch traceability data</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchTraceability;
