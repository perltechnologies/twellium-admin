import React, { useState, useEffect, useMemo } from 'react';
import { inventoryApi, productionApi } from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { exportToExcel } from '../../utils/exportUtils';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const ProductAnalysis = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        petName: '',
        reportName: '',
        productFilter: '',
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts(),
            ]);
            setPets(petsRes.data?.data?.data || petsRes.data?.data || []);
            setProducts(productsRes.data?.data?.data || productsRes.data?.data || []);
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
            if (filters.reportName) params.report_name = filters.reportName;
            if (filters.productFilter) params.product = filters.productFilter;

            const response = await inventoryApi.getProductAnalysis(params);
            const result = response.data?.data?.data || response.data?.data || {};
            setData(result);
        } catch (error) {
            console.error('Failed to fetch product analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const productsPerPallet = useMemo(() => {
        if (!data?.products_per_pallet) return [];
        return data.products_per_pallet.map(p => ({
            name: p.product_name || p.name,
            pallets: p.total_pallets || 0,
        }));
    }, [data]);

    const bottlesPerBatch = useMemo(() => {
        if (!data?.bottles_per_batch) return [];
        return data.bottles_per_batch.map(b => ({
            name: b.batch_number,
            bottles: b.total_bottles || 0,
        }));
    }, [data]);

    const palletsPerPet = useMemo(() => {
        if (!data?.pallets_per_pet) return [];
        return data.pallets_per_pet.map(p => ({
            name: p.pet_name,
            pallets: p.total_pallets || 0,
        }));
    }, [data]);

    const bottlesPerPet = useMemo(() => {
        if (!data?.bottles_per_pet) return [];
        return data.bottles_per_pet.map(p => ({
            name: p.pet_name,
            bottles: p.total_bottles || 0,
        }));
    }, [data]);

    const totals = useMemo(() => {
        if (!data) return { products: 0, pallets: 0, bottles: 0, batches: 0 };
        return {
            products: data.total_products || 0,
            pallets: data.total_pallets || 0,
            bottles: data.total_bottles || 0,
            batches: data.total_batches || 0,
        };
    }, [data]);

    const handleExport = () => {
        const exportData = productsPerPallet.map(p => ({
            'Product': p.name,
            'Pallets': p.pallets,
        }));
        exportToExcel(exportData, `product_analysis_${filters.startDate}`, 'Product Analysis');
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
                        <i className="ti ti-chart-bar me-2"></i>
                        Product Analysis Dashboard
                    </h4>
                    <p className="text-muted mb-0">Comprehensive analysis of products across multiple dimensions</p>
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
                                    <label className="form-label">Pet Line</label>
                                    <select className="form-select" value={filters.petName}
                                        onChange={(e) => setFilters({ ...filters, petName: e.target.value })}>
                                        <option value="">All Pets</option>
                                        {pets.map(p => <option key={p.id} value={p.pet_name}>{p.pet_name}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <label className="form-label">Product</label>
                                    <select className="form-select" value={filters.productFilter}
                                        onChange={(e) => setFilters({ ...filters, productFilter: e.target.value })}>
                                        <option value="">All Products</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name || p.product_name}</option>)}
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
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-primary border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Products</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.products.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-success border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Pallets</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.pallets.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-info border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Bottles</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.bottles.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card border-top border-warning border-3 mb-0">
                                <div className="card-body">
                                    <p className="text-muted fs-14 mb-1">Total Batches</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.batches.toLocaleString()}</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Products per Pallet</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={productsPerPallet}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="pallets" fill="#3b82f6" name="Pallets" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Bottles per Batch</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={bottlesPerBatch}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="bottles" fill="#22c55e" name="Bottles" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Pallets per Pet</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={palletsPerPet} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="pallets"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                {palletsPerPet.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v.toLocaleString(), 'Pallets']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header">
                                    <h6 className="mb-0">Bottles per Pet</h6>
                                </div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={bottlesPerPet} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="bottles"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                {bottlesPerPet.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v.toLocaleString(), 'Bottles']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="card">
                    <div className="card-body text-center py-5 text-muted">
                        <i className="ti ti-chart-bar fs-1 mb-3 d-block"></i>
                        <h5>No data available</h5>
                        <p>Apply filters and search to view product analysis</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductAnalysis;
