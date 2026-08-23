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

const ProductAnalysis = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        petName: '',
        productFilter: '',
    });
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);

    // Table pagination state
    const [tablePage, setTablePage] = useState(1);
    const [tablePageSize, setTablePageSize] = useState(10);

    useEffect(() => {
        fetchDropdownData();
        fetchData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts({ page_size: 100 }),
            ]);
            const allPets = formatAndSortPets(petsRes);
            setPets(allPets);

            const prodList = productsRes.data?.data?.data || productsRes.data?.data || productsRes.data?.results || [];
            setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { page_size: 2000 };

            const response = await inventoryApi.getProductAnalysis(params);
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
            if (filters.petName) {
                result = result.filter(u => String(u.pet) === String(filters.petName));
            }
            if (filters.productFilter) {
                result = result.filter(u => String(u.product) === String(filters.productFilter));
            }

            setUnits(result);
            setTablePage(1);
        } catch (error) {
            console.error('Failed to fetch product analysis:', error);
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    const productsPerPallet = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const name = u.product_name || u.product || 'Unknown';
            if (!map[name]) map[name] = { name, pallets: 0, packs: 0 };
            map[name].pallets += 1;
            map[name].packs += (u.quantity || 0);
        });
        return Object.values(map).sort((a, b) => b.pallets - a.pallets);
    }, [units]);

    const paginatedProducts = useMemo(() => {
        const start = (tablePage - 1) * tablePageSize;
        return productsPerPallet.slice(start, start + tablePageSize);
    }, [productsPerPallet, tablePage, tablePageSize]);

    const packsPerBatch = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const batch = u.actual_production_code || u.production_run_name || 'Unknown';
            if (!map[batch]) map[batch] = { name: batch, packs: 0 };
            map[batch].packs += (u.quantity || 0);
        });
        return Object.values(map).sort((a, b) => b.packs - a.packs);
    }, [units]);

    const palletsPerPet = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const pet = u.pet_name || u.pet || 'Unknown';
            if (!map[pet]) map[pet] = { name: pet, pallets: 0, packs: 0 };
            map[pet].pallets += 1;
            map[pet].packs += (u.quantity || 0);
        });
        return Object.values(map).sort((a, b) => b.pallets - a.pallets);
    }, [units]);

    const packsPerPet = useMemo(() => {
        const map = {};
        units.forEach(u => {
            const pet = u.pet_name || u.pet || 'Unknown';
            if (!map[pet]) map[pet] = { name: pet, packs: 0 };
            map[pet].packs += (u.quantity || 0);
        });
        return Object.values(map).sort((a, b) => b.packs - a.packs);
    }, [units]);

    const totals = useMemo(() => ({
        products: new Set(units.map(u => u.product_name || u.product || '')).size,
        pallets: units.length,
        packs: units.reduce((s, u) => s + (u.quantity || 0), 0),
        batches: new Set(units.map(u => u.actual_production_code || u.production_run_name || '')).size,
    }), [units]);

    const handleExport = () => {
        const exportData = productsPerPallet.map(p => ({
            'Product': p.name,
            'Pallets': p.pallets,
            'Packs': p.packs,
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
                    <h4 className="mb-1"><i className="ti ti-chart-bar me-2"></i>Product Analysis Dashboard</h4>
                    <p className="text-muted mb-0">Comprehensive analysis of products across multiple dimensions</p>
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
                        <div className="card-header"><h5 className="card-title mb-0"><i className="ti ti-filter me-2"></i>Filters</h5></div>
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
                                        {pets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
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
            ) : units.length > 0 ? (
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
                                    <p className="text-muted fs-14 mb-1">Total Packs</p>
                                    <h2 className="mb-0 fs-16 fw-bold">{totals.packs.toLocaleString()}</h2>
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
                                <div className="card-header"><h6 className="mb-0">Products per Pallet</h6></div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={productsPerPallet.slice(0, 8)}>
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
                                <div className="card-header"><h6 className="mb-0">Packs per Batch</h6></div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={packsPerBatch.slice(0, 8)}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="packs" fill="#22c55e" name="Packs" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-6">
                            <div className="card h-100">
                                <div className="card-header"><h6 className="mb-0">Pallets per Pet</h6></div>
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
                                <div className="card-header"><h6 className="mb-0">Packs per Pet</h6></div>
                                <div className="card-body">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={packsPerPet} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="packs"
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                {packsPerPet.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v.toLocaleString(), 'Packs']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Product Summary Table */}
                    <div className="card mb-4">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <h6 className="mb-0">Product Production Summary</h6>
                            <span className="badge bg-soft-primary text-primary">{productsPerPallet.length} products</span>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-striped table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Product</th>
                                            <th className="text-end">Total Pallets</th>
                                            <th className="text-end">Total Packs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedProducts.map((p, idx) => (
                                            <tr key={idx}>
                                                <td className="fw-semibold">{p.name}</td>
                                                <td className="text-end">{p.pallets.toLocaleString()}</td>
                                                <td className="text-end">{p.packs.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <Pagination
                            page={tablePage}
                            pageSize={tablePageSize}
                            totalCount={productsPerPallet.length}
                            onPageChange={setTablePage}
                            onPageSizeChange={(newSize) => {
                                setTablePageSize(newSize);
                                setTablePage(1);
                            }}
                            pageSizeOptions={[5, 10, 20, 50]}
                            itemLabel="products"
                        />
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
