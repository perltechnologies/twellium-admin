import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi, productionApi } from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const BatchTraceability = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        petName: '',
        batchNumber: '',
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchDetails, setBatchDetails] = useState(null);

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, batchesRes] = await Promise.all([
                productionApi.getPets(),
                productionApi.getBatches(),
            ]);
            setPets(petsRes.data?.data?.data || petsRes.data?.data || []);
            setBatches(batchesRes.data?.data?.data || batchesRes.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.petName) params.pet_name = filters.petName;
            if (filters.batchNumber) params.batch_number = filters.batchNumber;

            const response = await inventoryApi.getBatchTraceability(params);
            const result = response.data?.data?.data || response.data?.data || {};
            setData(result);
        } catch (error) {
            console.error('Failed to fetch batch traceability:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBatchDetails = async (batchNumber) => {
        try {
            const params = { batch_number: batchNumber };
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;

            const response = await inventoryApi.getBatchTraceability(params);
            const result = response.data?.data?.data || response.data?.data || {};
            setBatchDetails(result);
            setSelectedBatch(batchNumber);
        } catch (error) {
            console.error('Failed to fetch batch details:', error);
        }
    };

    const palletData = useMemo(() => {
        if (!data?.pallets) return [];
        return data.pallets.map(p => ({
            name: `Pallet ${p.pallet_id || p.id}`,
            packs: p.total_packs || 0,
            bottles: p.total_bottles || 0,
        }));
    }, [data]);

    const batchSummary = useMemo(() => {
        if (!data?.batches) return [];
        return data.batches.map(b => ({
            name: b.batch_number,
            pallets: b.total_pallets || 0,
            packs: b.total_packs || 0,
            bottles: b.total_bottles || 0,
        }));
    }, [data]);

    const petBreakdown = useMemo(() => {
        if (!data?.pets) return [];
        return data.pets.map(p => ({
            name: p.pet_name,
            pallets: p.total_pallets || 0,
            packs: p.total_packs || 0,
            bottles: p.total_bottles || 0,
        }));
    }, [data]);

    const totals = useMemo(() => {
        if (!data) return { pallets: 0, packs: 0, bottles: 0 };
        return {
            pallets: data.total_pallets || 0,
            packs: data.total_packs || 0,
            bottles: data.total_bottles || 0,
        };
    }, [data]);

    const handleExport = () => {
        const exportData = batchSummary.map(b => ({
            'Batch Number': b.name,
            'Pallets': b.pallets,
            'Packs': b.packs,
            'Bottles': b.bottles,
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
                                <i className="ti ti-filter me-2"></i>
                                Filters
                            </h5>
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
                                        {pets.map(p => <option key={p.id} value={p.pet_name}>{p.pet_name}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Batch Number</label>
                                    <select className="form-select" value={filters.batchNumber}
                                        onChange={(e) => setFilters({ ...filters, batchNumber: e.target.value })}>
                                        <option value="">All Batches</option>
                                        {batches.map(b => <option key={b.id} value={b.batch_number}>{b.batch_number}</option>)}
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
            ) : data ? (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-xl-4 col-sm-6">
                            <div className="card border-top border-primary border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Pallets</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.pallets.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-4 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Packs</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.packs.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-4 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Bottles</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.bottles.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-8">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Pallet Production Breakdown</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={palletData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="packs" fill="#3b82f6" name="Packs" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="bottles" fill="#22c55e" name="Bottles" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Bottles by Pet</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={petBreakdown} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="bottles"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                {petBreakdown.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v.toLocaleString(), 'Bottles']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">Batch Summary</h6>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-striped mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Batch Number</th>
                                                    <th>Pallets</th>
                                                    <th>Packs</th>
                                                    <th>Bottles</th>
                                                    <th className="text-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batchSummary.map((batch) => (
                                                    <tr key={batch.name}>
                                                        <td><code>{batch.name}</code></td>
                                                        <td>{batch.pallets.toLocaleString()}</td>
                                                        <td>{batch.packs.toLocaleString()}</td>
                                                        <td>{batch.bottles.toLocaleString()}</td>
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
                            </div>
                        </div>
                    </div>

                    {selectedBatch && batchDetails && (
                        <div className="card mb-4">
                            <div className="card-header d-flex align-items-center justify-content-between">
                                <h6 className="mb-0">
                                    <i className="ti ti-trace me-2"></i>
                                    Trace Details: Batch {selectedBatch}
                                </h6>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedBatch(null); setBatchDetails(null); }}>
                                    <i className="ti ti-x me-1"></i>Close
                                </button>
                            </div>
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-3">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Pallets</small>
                                            <h5 className="mb-0">{batchDetails.total_pallets || 0}</h5>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Packs</small>
                                            <h5 className="mb-0">{batchDetails.total_packs || 0}</h5>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Bottles</small>
                                            <h5 className="mb-0">{batchDetails.total_bottles || 0}</h5>
                                        </div>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="p-3 bg-light rounded">
                                            <small className="text-muted">Barcodes</small>
                                            <h5 className="mb-0">{batchDetails.total_barcodes || 0}</h5>
                                        </div>
                                    </div>
                                </div>
                                {batchDetails.barcodes && batchDetails.barcodes.length > 0 && (
                                    <div className="mt-4">
                                        <h6>Barcode Details</h6>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-bordered">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Barcode</th>
                                                        <th>Product</th>
                                                        <th>Pet</th>
                                                        <th>Quantity</th>
                                                        <th>Stage</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {batchDetails.barcodes.slice(0, 50).map((bc, idx) => (
                                                        <tr key={idx}>
                                                            <td><code>{bc.barcode}</code></td>
                                                            <td>{bc.product_name || '-'}</td>
                                                            <td>{bc.pet_name || '-'}</td>
                                                            <td>{bc.quantity || 0}</td>
                                                            <td><span className="badge bg-soft-info">{bc.stage || '-'}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
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
