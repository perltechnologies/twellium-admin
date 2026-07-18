import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { productionApi } from '../../api/production';
import { DataTable } from '../../components/ui/DataTable';
import FilterInputs from '../../components/FilterInputs';
import { useFilters } from '../../context/FilterContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { exportToExcel as exportUtil } from '../../utils/exportUtils';

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const ProductionReports = () => {
    const { filters } = useFilters();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [analyticsMode, setAnalyticsMode] = useState('overview');
    const [oeeTrendData, setOeeTrendData] = useState([]);
    const [oeeTrendLoading, setOeeTrendLoading] = useState(true);
    const [pets, setPets] = useState([]);

    useEffect(() => {
        productionApi.getPets({ page_size: 100 })
            .then(res => { const d = res.data?.data ?? res.data; setPets((Array.isArray(d) ? d : (d?.results || [])).filter(p => !p.pet_name?.toLowerCase().includes('can'))); })
            .catch(() => {});
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate, endDate;

            if (filters.log_date) {
                startDate = new Date(filters.log_date);
                endDate = new Date(filters.log_date);
            } else if (filters.start_date && filters.end_date) {
                startDate = new Date(filters.start_date);
                endDate = new Date(filters.end_date);
            } else {
                // Default: current week
                const dayOfWeek = now.getDay();
                startDate = new Date(now);
                startDate.setDate(now.getDate() - dayOfWeek);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
            }

            const dates = [];
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }

            const results = await Promise.all(
                dates.map(date =>
                    productionApi.getDashboardShiftPetMetrics({ date })
                        .then(res => {
                            const raw = res?.data?.data ?? res?.data ?? {};
                            return (Array.isArray(raw.pets) ? raw.pets : (Array.isArray(raw) ? raw : []))
                                .filter(r => !r.pet_name?.toLowerCase().includes('can'))
                                .map(p => ({
                                    pet_name: p.pet_name,
                                    production_date: date,
                                    shift_name: p.shift || '',
                                    efficiency: p.efficiency || 0,
                                    metrics: {
                                        oee: p.efficiency || 0,
                                        availability: p.availability || 0,
                                        quality: p.quality || 0,
                                        performance: p.performance || 0,
                                        details: {
                                            planned_time_mins: 0,
                                            total_downtime_mins: p.total_downtime || 0,
                                            planned_downtime_mins: p.planned_downtime || 0,
                                            total_output_pcs: p.total_bottles_produced || 0
                                        }
                                    }
                                }));
                        })
                        .catch(() => [])
                )
            );

            let allData = results.flat();
            if (filters.pet) {
                const petObj = pets.find(p => p.id === parseInt(filters.pet));
                if (petObj) allData = allData.filter(r => r.pet_name === petObj.pet_name);
            }

            setReports(allData.sort((a, b) => new Date(a.production_date) - new Date(b.production_date)));
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }, [filters.log_date, filters.start_date, filters.end_date, filters.pet, pets]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const refetch = fetchData;

    const stats = useMemo(() => {
        if (!reports.length) {
            return {
                avgOee: 0,
                avgAvailability: 0,
                avgQuality: 0,
                avgPerformance: 0,
                totalOutput: 0,
                totalDowntime: 0,
                reportCount: 0
            };
        }

        const totalOutput = reports.reduce((sum, r) => sum + (r.metrics?.details?.total_output_pcs || 0), 0);
        const totalDowntime = reports.reduce((sum, r) => sum + (r.metrics?.details?.total_downtime_mins || 0), 0);

        return {
            avgOee: reports.reduce((sum, r) => sum + (r.metrics?.oee || 0), 0) / reports.length,
            avgAvailability: reports.reduce((sum, r) => sum + (r.metrics?.availability || 0), 0) / reports.length,
            avgQuality: reports.reduce((sum, r) => sum + (r.metrics?.quality || 0), 0) / reports.length,
            avgPerformance: reports.reduce((sum, r) => sum + (r.metrics?.performance || 0), 0) / reports.length,
            totalOutput,
            totalDowntime,
            reportCount: reports.length
        };
    }, [reports]);

    const oeeByPet = useMemo(() => {
        const grouped = {};
        reports.forEach(r => {
            const pet = r.pet_name || 'Unknown';
            if (!grouped[pet]) grouped[pet] = { oee: 0, count: 0 };
            grouped[pet].oee += r.metrics?.oee || 0;
            grouped[pet].count += 1;
        });
        return Object.entries(grouped)
            .map(([name, { oee, count }]) => ({ name, oee: count > 0 ? (oee / count).toFixed(1) : 0 }))
            .sort((a, b) => parseFloat(b.oee) - parseFloat(a.oee));
    }, [reports]);

    const outputByPet = useMemo(() => {
        const grouped = {};
        reports.forEach(r => {
            const pet = r.pet_name || 'Unknown';
            if (!grouped[pet]) grouped[pet] = 0;
            grouped[pet] += r.metrics?.details?.total_output_pcs || 0;
        });
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [reports]);

    const fetchOeeTrend = useCallback(async () => {
        setOeeTrendLoading(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const res = await productionApi.getDashboardShiftPetMetrics({ date: todayStr });
            const raw = res?.data?.data ?? res?.data ?? {};
            const petsData = (Array.isArray(raw.pets) ? raw.pets : (Array.isArray(raw) ? raw : []))
                .filter(r => !r.pet_name?.toLowerCase().includes('can'));
            const trendData = petsData.map(p => ({
                production_date: todayStr,
                pet_name: p.pet_name,
                metrics: {
                    oee: p.efficiency || 0,
                    availability: p.availability || 0,
                    quality: p.quality || 0,
                    performance: p.performance || 0,
                    details: { total_output_pcs: p.total_bottles_produced || 0 }
                }
            }));
            setOeeTrendData(trendData);
        } catch (err) {
            console.error('Failed to fetch OEE trend:', err);
        } finally {
            setOeeTrendLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOeeTrend();
    }, [fetchOeeTrend]);

    const trendChartData = useMemo(() => {
        return oeeTrendData.map(r => ({
            date: r.production_date?.slice(5, 10) || '',
            oee: r.metrics?.oee?.toFixed(1) || 0,
            availability: r.metrics?.availability?.toFixed(1) || 0,
            quality: r.metrics?.quality?.toFixed(1) || 0,
            performance: r.metrics?.performance?.toFixed(1) || 0,
            output: r.metrics?.details?.total_output_pcs || 0
        }));
    }, [oeeTrendData]);

    const exportToExcel = () => {
        if (!reports.length) return;
        const excelData = reports.map(r => ({
            'Date': r.production_date,
            'PET': r.pet_name,
            'Shift': r.shift_name,
            'OEE': r.metrics?.oee?.toFixed(2) || 0,
            'Availability': r.metrics?.availability?.toFixed(2) || 0,
            'Quality': r.metrics?.quality?.toFixed(2) || 0,
            'Performance': r.metrics?.performance?.toFixed(2) || 0,
            'Output': r.metrics?.details?.total_output_pcs || 0,
            'Downtime': r.metrics?.details?.total_downtime_mins || 0
        }));
        const title = `Production Reports (${new Date().toISOString().split('T')[0]})`;
        exportUtil(excelData, `production-reports-${new Date().toISOString().split('T')[0]}`, 'Production Reports', title);
    };

    // const exportToPDF = () => {
    //     window.print();
    // };

    const viewReport = (report) => {
        setSelectedReport(report);
        setShowModal(true);
    };

    const getOeeColor = (value) => {
        if (value >= 85) return 'success';
        if (value >= 70) return 'warning';
        return 'danger';
    };

    const columns = [
        { key: 'production_date', label: 'Date' },
        { key: 'pet_name', label: 'PET' },
        { key: 'shift_name', label: 'Shift' },
        { 
            key: 'metrics.oee', 
            label: 'OEE (%)', 
            render: (val) => {
                const color = getOeeColor(val);
                return <span className={`badge bg-soft-${color} text-${color}`}>{val?.toFixed(1) || '0.0'}%</span>;
            }
        },
        { key: 'metrics.availability', label: 'Avail (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.quality', label: 'Quality (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.performance', label: 'Perf (%)', render: (val) => val?.toFixed(1) || '0.0' },
        { key: 'metrics.details.total_output_pcs', label: 'Output', render: (val) => (val || 0).toLocaleString() },
        {
            key: 'actions',
            label: 'Actions',
            render: (_, report) => (
                <button className="btn btn-sm btn-outline-primary" onClick={() => viewReport(report)}>
                    <i className="ti ti-eye me-1"></i>View
                </button>
            )
        }
    ];

    return (
        <>
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-3">
                    <h4 className="mb-0">Production Reports</h4>
                    {loading && <span className="spinner-border spinner-border-sm text-primary" role="status" />}
                </div>
                <div className="d-flex gap-2">
                    <div className="btn-group btn-group-sm" role="group">
                        <button 
                            type="button" 
                            className={`btn ${analyticsMode === 'overview' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setAnalyticsMode('overview')}
                        >
                            <i className="ti ti-layout-grid me-1"></i>Overview
                        </button>
                        <button 
                            type="button" 
                            className={`btn ${analyticsMode === 'analytics' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setAnalyticsMode('analytics')}
                        >
                            <i className="ti ti-chart-line me-1"></i>Analytics
                        </button>
                    </div>
                    <button className="btn btn-outline-success btn-sm" onClick={exportToExcel} disabled={!reports.length}>
                        <i className="ti ti-file-spreadsheet me-1"></i>Export
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={refetch}>
                        <i className="ti ti-refresh me-1"></i>Refresh
                    </button>
                </div>
            </div>

            {analyticsMode === 'overview' ? (
                <>
                    <FilterInputs />

                    {error && (
                        <div className="alert alert-danger">
                            <i className="ti ti-alert-circle me-2"></i>{error}
                        </div>
                    )}

                    <div className="card">
                        <div className="card-body">
                            <DataTable
                                data={reports}
                                columns={columns}
                                loading={loading}
                                emptyMessage="No production reports found"
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="row row-gap-3 mb-4">
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Avg OEE</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.avgOee.toFixed(1)}%</h2>
                                            <small className={`badge bg-soft-${getOeeColor(stats.avgOee)} text-${getOeeColor(stats.avgOee)}`}>
                                                {stats.avgOee >= 85 ? 'World Class' : stats.avgOee >= 70 ? 'Typical' : 'Needs Improvement'}
                                            </small>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                                            <i className="ti ti-gauge fs-16 text-primary"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Avg Availability</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.avgAvailability.toFixed(1)}%</h2>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                            <i className="ti ti-clock-check fs-16 text-success"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Avg Quality</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.avgQuality.toFixed(1)}%</h2>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-info border border-info">
                                            <i className="ti ti-checks fs-16 text-info"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Avg Performance</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.avgPerformance.toFixed(1)}%</h2>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                                            <i className="ti ti-speed fs-16 text-warning"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row row-gap-3 mb-4">
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Total Output</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.totalOutput.toLocaleString()}</h2>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-primary border border-primary">
                                            <i className="ti ti-bottle fs-16 text-primary"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Total Downtime</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.totalDowntime.toLocaleString()} min</h2>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-danger border border-danger">
                                            <i className="ti ti-clock-pause fs-16 text-danger"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">Reports</p>
                                            <h2 className="mb-1 fs-16 fw-bold">{stats.reportCount}</h2>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-info border border-info">
                                            <i className="ti ti-file-text fs-16 text-info"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-3 col-sm-6">
                            <div className="card mb-0">
                                <div className="card-body">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 text-muted mb-1">OEE Target</p>
                                            <h2 className="mb-1 fs-16 fw-bold">85%</h2>
                                            <small className={`badge ${stats.avgOee >= 85 ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                                                {stats.avgOee >= 85 ? 'Target Met' : `${(85 - stats.avgOee).toFixed(1)}% to go`}
                                            </small>
                                        </div>
                                        <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                            <i className="ti ti-target fs-16 text-success"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row mb-4">
                        <div className="col-lg-8">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">OEE Trend Analysis</h6>
                                    <small className="text-muted">OEE metrics over time</small>
                                </div>
                                <div className="card-body">
                                    {oeeTrendLoading ? (
                                        <div className="text-center py-5">
                                            <span className="spinner-border text-primary" role="status" />
                                        </div>
                                    ) : trendChartData.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data available</p>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <LineChart data={trendChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    formatter={(value, name) => [`${value}%`, name.charAt(0).toUpperCase() + name.slice(1)]}
                                                />
                                                <Legend />
                                                <Line type="monotone" dataKey="oee" stroke="#3b82f6" strokeWidth={2} dot={false} name="OEE" />
                                                <Line type="monotone" dataKey="availability" stroke="#22c55e" strokeWidth={2} dot={false} name="Availability" />
                                                <Line type="monotone" dataKey="quality" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Quality" />
                                                <Line type="monotone" dataKey="performance" stroke="#f59e0b" strokeWidth={2} dot={false} name="Performance" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">OEE by PET Line</h6>
                                    <small className="text-muted">Average OEE per production line</small>
                                </div>
                                <div className="card-body">
                                    {oeeByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={oeeByPet} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                                                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                                                    <Tooltip formatter={(v) => [`${v}%`, 'OEE']} />
                                                    <Bar dataKey="oee" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3">
                                                {oeeByPet.slice(0, 5).map((pet, idx) => (
                                                    <div key={pet.name} className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="f-14 fw-medium">
                                                            <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                            {pet.name}
                                                        </span>
                                                        <span className={`badge bg-soft-${getOeeColor(parseFloat(pet.oee))} text-${getOeeColor(parseFloat(pet.oee))}`}>
                                                            {pet.oee}%
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">Output Distribution by PET</h6>
                                    <small className="text-muted">Total production output per line</small>
                                </div>
                                <div className="card-body">
                                    {outputByPet.length === 0 ? (
                                        <p className="text-center text-muted py-5 mb-0">No data</p>
                                    ) : (
                                        <>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie
                                                        data={outputByPet}
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={90}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                    >
                                                        {outputByPet.map((entry, idx) => (
                                                            <Cell key={entry.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip formatter={(v) => [v.toLocaleString(), 'Output']} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="mt-3">
                                                {outputByPet.map((pet, idx) => (
                                                    <div key={pet.name} className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="f-14 fw-medium">
                                                            <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                            {pet.name}
                                                        </span>
                                                        <span className="text-muted">{pet.value.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="card">
                                <div className="card-header">
                                    <h6 className="mb-0">Filtered Reports</h6>
                                    <small className="text-muted">{reports.length} records based on current filters</small>
                                </div>
                                <div className="card-body p-0">
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <span className="spinner-border text-primary" role="status" />
                                        </div>
                                    ) : reports.length === 0 ? (
                                        <div className="text-center py-5">
                                            <i className="ti ti-file-off fs-1 text-muted mb-3 d-block"></i>
                                            <p className="text-muted mb-0">No reports found</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>PET</th>
                                                        <th>OEE</th>
                                                        <th>Output</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reports.slice(0, 10).map((report) => (
                                                        <tr key={report.id}>
                                                            <td>{report.production_date?.slice(0, 10)}</td>
                                                            <td>{report.pet_name}</td>
                                                            <td>
                                                                <span className={`badge bg-soft-${getOeeColor(report.metrics?.oee)} text-${getOeeColor(report.metrics?.oee)}`}>
                                                                    {report.metrics?.oee?.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                            <td>{report.metrics?.details?.total_output_pcs?.toLocaleString() || 0}</td>
                                                            <td>
                                                                <button className="btn btn-sm btn-outline-primary" onClick={() => viewReport(report)}>
                                                                    <i className="ti ti-eye"></i>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {showModal && selectedReport && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Production Report Details</h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="row">
                                    <div className="col-md-6 mb-3">
                                        <div className="card bg-light">
                                            <div className="card-body">
                                                <h6 className="mb-3">Report Info</h6>
                                                <p className="mb-1"><strong>Date:</strong> {selectedReport.production_date}</p>
                                                <p className="mb-1"><strong>PET:</strong> {selectedReport.pet_name}</p>
                                                <p className="mb-1"><strong>Shift:</strong> {selectedReport.shift_name}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <div className="card bg-primary text-white">
                                            <div className="card-body">
                                                <h6 className="mb-3">OEE Score</h6>
                                                <h1 className="mb-0">{selectedReport.metrics?.oee?.toFixed(1)}%</h1>
                                                <small className={selectedReport.metrics?.oee >= 85 ? 'text-white-50' : 'text-white'}>
                                                    {selectedReport.metrics?.oee >= 85 ? 'World Class' : selectedReport.metrics?.oee >= 70 ? 'Typical' : 'Needs Improvement'}
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row mb-3">
                                    <div className="col-md-4">
                                        <div className="card">
                                            <div className="card-body text-center">
                                                <p className="text-muted mb-1">Availability</p>
                                                <h4 className="mb-0">{selectedReport.metrics?.availability?.toFixed(1)}%</h4>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="card">
                                            <div className="card-body text-center">
                                                <p className="text-muted mb-1">Quality</p>
                                                <h4 className="mb-0">{selectedReport.metrics?.quality?.toFixed(1)}%</h4>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <div className="card">
                                            <div className="card-body text-center">
                                                <p className="text-muted mb-1">Performance</p>
                                                <h4 className="mb-0">{selectedReport.metrics?.performance?.toFixed(1)}%</h4>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="card">
                                            <div className="card-body">
                                                <p className="mb-1"><strong>Total Output:</strong> {selectedReport.metrics?.details?.total_output_pcs?.toLocaleString() || 0}</p>
                                                <p className="mb-1"><strong>Total Downtime:</strong> {selectedReport.metrics?.details?.total_downtime_mins || 0} min</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="card">
                                            <div className="card-body">
                                                <pre className="mb-0" style={{ maxHeight: '200px', overflow: 'auto', fontSize: '12px' }}>
                                                    {JSON.stringify(selectedReport, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductionReports;
