import React, { useState, useEffect } from 'react';
import { inventoryApi, productionApi, logisticsApi } from '../../api';
import { exportToExcel } from '../../utils/exportUtils';

const VehicleDispatchDetails = () => {
    const today = new Date().toISOString().split('T')[0];
    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        vehicleId: '',
        customerName: '',
    });
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [vehiclesRes, customersRes] = await Promise.all([
                logisticsApi.getVehicles(),
                logisticsApi.getCustomers(),
            ]);
            setVehicles(vehiclesRes.data?.data?.data || vehiclesRes.data?.data || vehiclesRes.data?.results || []);
            setCustomers(customersRes.data?.data?.data || customersRes.data?.data || customersRes.data?.results || []);
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
            if (filters.vehicleId) params.vehicle_id = filters.vehicleId;
            if (filters.customerName) params.customer_name = filters.customerName;

            const res = await inventoryApi.getVehicleDispatchDetails(params);
            const result = res.data?.data?.data || res.data?.data || res.data?.results || [];
            setData(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error('Failed to fetch vehicle dispatch details:', error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApplyFilters = () => {
        fetchData();
    };

    const handleExport = () => {
        const exportData = data.map(item => ({
            'Vehicle': item.vehicle_name || item.vehicle_number || '-',
            'Driver': item.driver_name || '-',
            'Customer': item.customer_name || '-',
            'Batch Numbers': (item.batch_numbers || []).join(', '),
            'Total Pallets': item.total_pallets || 0,
            'Total Packs': item.total_packs || 0,
            'Dispatch Date': item.dispatch_date || item.date || '-',
            'Status': item.status || '-',
        }));
        exportToExcel(exportData, `Vehicle_Dispatch_${filters.startDate}_${filters.endDate}`);
    };

    // Group data by vehicle for summary cards
    const vehicleSummary = data.reduce((acc, item) => {
        const vehicle = item.vehicle_name || item.vehicle_number || 'Unknown';
        if (!acc[vehicle]) {
            acc[vehicle] = { vehicle, trips: 0, pallets: 0, packs: 0, customers: new Set(), batches: new Set() };
        }
        acc[vehicle].trips += 1;
        acc[vehicle].pallets += (item.total_pallets || 0);
        acc[vehicle].packs += (item.total_packs || 0);
        if (item.customer_name) acc[vehicle].customers.add(item.customer_name);
        (item.batch_numbers || []).forEach(b => acc[vehicle].batches.add(b));
        return acc;
    }, {});
    const vehicleSummaryArr = Object.values(vehicleSummary).sort((a, b) => b.pallets - a.pallets);

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h4 className="mb-0">Vehicle & Customer Dispatch Details</h4>
                    <small className="text-muted">Track vehicle details for batch dispatches with customer mapping</small>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-success btn-sm" onClick={handleExport} disabled={data.length === 0}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={fetchData}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-2">
                            <label className="form-label">Start Date</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={filters.startDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">End Date</label>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={filters.endDate}
                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Vehicle</label>
                            <select
                                className="form-select form-select-sm"
                                value={filters.vehicleId}
                                onChange={(e) => setFilters(prev => ({ ...prev, vehicleId: e.target.value }))}
                            >
                                <option value="">All Vehicles</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.vehicle_number || v.name || v.plate_number}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Customer</label>
                            <select
                                className="form-select form-select-sm"
                                value={filters.customerName}
                                onChange={(e) => setFilters(prev => ({ ...prev, customerName: e.target.value }))}
                            >
                                <option value="">All Customers</option>
                                {customers.map((c, idx) => (
                                    <option key={idx} value={c.name || c.customer_name}>{c.name || c.customer_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary btn-sm w-100" onClick={handleApplyFilters}>
                                <i className="ti ti-filter me-1"></i>Apply
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1 text-muted">Total Dispatches</p>
                                    <h3 className="mb-0 fw-bold">{data.length}</h3>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                                    <i className="ti ti-truck fs-16 text-primary"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1 text-muted">Total Pallets</p>
                                    <h3 className="mb-0 fw-bold">{data.reduce((s, d) => s + (d.total_pallets || 0), 0).toLocaleString()}</h3>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                    <i className="ti ti-package fs-16 text-success"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1 text-muted">Vehicles Used</p>
                                    <h3 className="mb-0 fw-bold">{vehicleSummaryArr.length}</h3>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-info border border-info">
                                    <i className="ti ti-car fs-16 text-info"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0 h-100">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1 text-muted">Unique Customers</p>
                                    <h3 className="mb-0 fw-bold">{new Set(data.map(d => d.customer_name).filter(Boolean)).size}</h3>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                                    <i className="ti ti-users fs-16 text-warning"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Vehicle Summary Table */}
            {vehicleSummaryArr.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h6 className="mb-0">Vehicle Summary</h6>
                        <small className="text-muted">Aggregated dispatch stats per vehicle</small>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Vehicle</th>
                                        <th className="text-center">Trips</th>
                                        <th className="text-center">Pallets</th>
                                        <th className="text-center">Packs</th>
                                        <th className="text-center">Customers</th>
                                        <th className="text-center">Batches</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehicleSummaryArr.map((v, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-medium">{v.vehicle}</td>
                                            <td className="text-center">{v.trips}</td>
                                            <td className="text-center fw-bold text-success">{v.pallets.toLocaleString()}</td>
                                            <td className="text-center">{v.packs.toLocaleString()}</td>
                                            <td className="text-center">{v.customers.size}</td>
                                            <td className="text-center">{v.batches.size}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Dispatch Table */}
            <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                    <div>
                        <h6 className="mb-0">Dispatch Details</h6>
                        <small className="text-muted">{data.length} records</small>
                    </div>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <span className="spinner-border text-primary"></span>
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="ti ti-truck-off fs-1 mb-3 d-block"></i>
                            <p>No dispatch data available for the selected period</p>
                        </div>
                    ) : (
                        <div className="table-responsive" style={{ maxHeight: 500 }}>
                            <table className="table table-sm table-hover mb-0">
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th>Date</th>
                                        <th>Vehicle</th>
                                        <th>Driver</th>
                                        <th>Customer</th>
                                        <th>Batch Numbers</th>
                                        <th className="text-end">Pallets</th>
                                        <th className="text-end">Packs</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-medium">{item.dispatch_date || item.date || '-'}</td>
                                            <td>{item.vehicle_name || item.vehicle_number || '-'}</td>
                                            <td>{item.driver_name || '-'}</td>
                                            <td>{item.customer_name || '-'}</td>
                                            <td>
                                                {(item.batch_numbers || []).length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {(item.batch_numbers || []).map((b, i) => (
                                                            <span key={i} className="badge bg-soft-primary text-primary">{b}</span>
                                                        ))}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="text-end fw-bold">{item.total_pallets || 0}</td>
                                            <td className="text-end">{(item.total_packs || 0).toLocaleString()}</td>
                                            <td className="text-center">
                                                <span className={`badge bg-${item.status === 'DISPATCHED' || item.status === 'DELIVERED' ? 'success' : item.status === 'LOADING' ? 'warning' : 'secondary'}-subtle text-${item.status === 'DISPATCHED' || item.status === 'DELIVERED' ? 'success' : item.status === 'LOADING' ? 'warning' : 'secondary'}`}>
                                                    {item.status || 'PENDING'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default VehicleDispatchDetails;
