import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useFilters } from '../../context/FilterContext';

const ReactApexChart = lazy(() => import('react-apexcharts'));

const ProductionSummary = ({ reports = [], loading = false, pets = [] }) => {
    const { filters } = useFilters();
    const [period, setPeriod] = useState('week');
    const [localStartDate, setLocalStartDate] = useState('');
    const [localEndDate, setLocalEndDate] = useState('');
    const [useLocalDates, setUseLocalDates] = useState(false);

    // Use local dates if week/month clicked, otherwise global filters
    const singleDate = useLocalDates ? '' : (filters.log_date || '');
    const startDate = useLocalDates ? localStartDate : (filters.start_date || '');
    const endDate = useLocalDates ? localEndDate : (filters.end_date || '');
    const useRange = !!startDate || !!endDate;
    const selectedPet = filters.pet || '';

    const chartData = useMemo(() => {
        let filtered = reports;

        // Filter by date - use global filters
        if (useRange) {
            if (startDate) filtered = filtered.filter(r => {
                const reportDate = r.production_date || r.log_date || '';
                return reportDate >= startDate;
            });
            if (endDate) filtered = filtered.filter(r => {
                const reportDate = r.production_date || r.log_date || '';
                return reportDate <= endDate;
            });
        } else if (singleDate) {
            filtered = filtered.filter(r => {
                const reportDate = r.production_date || r.log_date || '';
                return reportDate === singleDate;
            });
        }

        // Filter by PET - use pet_name for comparison
        if (selectedPet) {
            const selectedPetName = pets.find(p => p.id === parseInt(selectedPet))?.pet_name;
            if (selectedPetName) {
                filtered = filtered.filter(r => r.pet_name === selectedPetName);
            }
        }

        // Generate date range
        const now = new Date();
        let dates = [];
        let grouped = {};

        if (period === 'month') {
            // Current month: 1st to last day
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            for (let d = new Date(firstDay); d <= lastDay; d = new Date(d.setDate(d.getDate() + 1))) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }
        } else {
            // Current week: Sunday to Saturday
            const dayOfWeek = now.getDay();
            const sunday = new Date(now);
            sunday.setDate(now.getDate() - dayOfWeek);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            for (let d = new Date(sunday); d <= saturday; d = new Date(d.setDate(d.getDate() + 1))) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }
        }

        // Group by date
        filtered.forEach(r => {
            const date = r.production_date || r.log_date || '';
            if (!grouped[date]) grouped[date] = {};

            const petName = r.pet_name || 'Unknown';
            if (!grouped[date][petName]) {
                grouped[date][petName] = { oee: 0, count: 0 };
            }
            grouped[date][petName].oee += parseFloat(r.efficiency) || r.metrics?.oee || r.oee || 0;
            grouped[date][petName].count += 1;
        });

        const petNames = [...new Set(filtered.map(r => r.pet_name || 'Unknown'))].filter(Boolean);

        const series = petNames.map(pet => ({
            name: pet,
            data: dates.map(date => {
                const data = grouped[date]?.[pet];
                return data ? parseFloat((data.oee / data.count).toFixed(1)) : 0;
            })
        }));

        return { dates, series };
    }, [reports, period, useRange, singleDate, startDate, endDate, selectedPet, pets]);

    const summary = useMemo(() => {
        let filtered = reports;

        // Filter by date - use global filters
        if (useRange) {
            if (startDate) filtered = filtered.filter(r => {
                const reportDate = r.production_date || r.log_date || '';
                return reportDate >= startDate;
            });
            if (endDate) filtered = filtered.filter(r => {
                const reportDate = r.production_date || r.log_date || '';
                return reportDate <= endDate;
            });
        } else if (singleDate) {
            filtered = filtered.filter(r => {
                const reportDate = r.production_date || r.log_date || '';
                return reportDate === singleDate;
            });
        }

        // Filter by PET - use pet_name for comparison
        if (selectedPet) {
            const selectedPetName = pets.find(p => p.id === parseInt(selectedPet))?.pet_name;
            if (selectedPetName) {
                filtered = filtered.filter(r => r.pet_name === selectedPetName);
            }
        }

        const totalProduction = filtered.reduce((s, r) => s + (r.bottles_produced || r.total_bottles_produced || r.metrics?.details?.total_output_pcs || 0), 0);
        const avgOee = filtered.length > 0
            ? filtered.reduce((s, r) => s + (parseFloat(r.efficiency) || r.metrics?.oee || r.oee || 0), 0) / filtered.length
            : 0;
        const totalDowntime = filtered.reduce((s, r) => s + (r.downtime_minutes || r.metrics?.details?.total_downtime_mins || r.total_downtime_mins || 0), 0);

        return { totalProduction, avgOee, totalDowntime, reports: filtered.length };
    }, [reports, useRange, singleDate, startDate, endDate, selectedPet, pets]);

    const hasActiveFilter = !!(singleDate || startDate || endDate || selectedPet);

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-3 pb-0">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <div>
                        <h6 className="mb-0 fw-semibold">Production Summary</h6>
                        <small className="text-muted">Efficiency trends and multi-line comparison</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <div className="btn-group">
                            <button
                                className={`btn btn-sm ${period === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => {
                                    setPeriod('week');
                                    const today = new Date();
                                    const dayOfWeek = today.getDay();
                                    const sunday = new Date(today);
                                    sunday.setDate(today.getDate() - dayOfWeek);
                                    const saturday = new Date(sunday);
                                    saturday.setDate(sunday.getDate() + 6);
                                    setLocalStartDate(sunday.toISOString().split('T')[0]);
                                    setLocalEndDate(saturday.toISOString().split('T')[0]);
                                    setUseLocalDates(true);
                                }}
                            >
                                <i className="ti ti-calendar-week me-1"></i>Week
                            </button>
                            <button
                                className={`btn btn-sm ${period === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => {
                                    setPeriod('month');
                                    const today = new Date();
                                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                    setLocalStartDate(firstDay.toISOString().split('T')[0]);
                                    setLocalEndDate(lastDay.toISOString().split('T')[0]);
                                    setUseLocalDates(true);
                                }}
                            >
                                <i className="ti ti-calendar-month me-1"></i>Month
                            </button>
                        </div>
                    </div>
                </div>
                {/* Active Filters Display */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-soft-info text-info">
                        <i className="ti ti-calendar me-1"></i>
                        {useRange 
                            ? `${startDate || 'Start'} - ${endDate || 'End'}`
                            : singleDate || 'All Time'}
                    </span>
                    {selectedPet && (
                        <span className="badge bg-soft-primary text-primary">
                            <i className="ti ti-building-factory-2 me-1"></i>
                            {pets.find(p => p.id === parseInt(selectedPet))?.pet_name || 'Selected PET'}
                        </span>
                    )}
                    <span className="badge bg-soft-secondary text-secondary">
                        {reports.length} reports loaded
                    </span>
                </div>
            </div>
            <div className="card-body">

                {/* Summary Stats */}
                <div className="row g-3 mb-4">
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm bg-soft-primary">
                            <div className="card-body text-center">
                                <div className="avatar bg-primary rounded-circle p-2 mb-2">
                                    <i className="ti ti-bottle text-white fs-4"></i>
                                </div>
                                <small className="text-muted d-block fs-12">Total Production</small>
                                <h5 className="mb-0 text-primary fw-bold">{summary.totalProduction.toLocaleString()}</h5>
                                <small className="text-muted fs-11">bottles</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm bg-soft-success">
                            <div className="card-body text-center">
                                <div className="avatar bg-success rounded-circle p-2 mb-2">
                                    <i className="ti ti-chart-line text-white fs-4"></i>
                                </div>
                                <small className="text-muted d-block fs-12">Avg OEE</small>
                                <h5 className="mb-0 text-success fw-bold">{summary.avgOee.toFixed(1)}%</h5>
                                <small className="text-muted fs-11">efficiency</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm bg-soft-danger">
                            <div className="card-body text-center">
                                <div className="avatar bg-danger rounded-circle p-2 mb-2">
                                    <i className="ti ti-clock-stop text-white fs-4"></i>
                                </div>
                                <small className="text-muted d-block fs-12">Total Downtime</small>
                                <h5 className="mb-0 text-danger fw-bold">{Math.round(summary.totalDowntime)}m</h5>
                                <small className="text-muted fs-11">{Math.round(summary.totalDowntime / 60)}h {Math.round(summary.totalDowntime % 60)}m</small>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 shadow-sm bg-soft-info">
                            <div className="card-body text-center">
                                <div className="avatar bg-info rounded-circle p-2 mb-2">
                                    <i className="ti ti-file-report text-white fs-4"></i>
                                </div>
                                <small className="text-muted d-block fs-12">Reports</small>
                                <h5 className="mb-0 text-info fw-bold">{summary.reports}</h5>
                                <small className="text-muted fs-11">in period</small>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                ) : chartData.series.length === 0 || chartData.dates.length === 0 ? (
                    <div className="text-center text-muted py-5">
                        <i className="ti ti-chart-line fs-1 mb-3 d-block"></i>
                        <p className="mb-0">No data available for the selected period</p>
                        <small>Try adjusting the date filters or period selection</small>
                    </div>
                ) : (
                    <Suspense fallback={
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }>
                        <div className="border rounded p-3 bg-soft-light">
                            <ReactApexChart
                                options={{
                                    chart: {
                                        type: 'line',
                                        height: 350,
                                        toolbar: { show: false },
                                        zoom: { enabled: false },
                                        animations: { enabled: true, easing: 'easeinout', speed: 800 }
                                    },
                                    stroke: { curve: 'smooth', width: 3 },
                                    xaxis: {
                                        categories: chartData.dates,
                                        labels: { 
                                            rotate: -45, 
                                            style: { fontSize: 11 },
                                            formatter: (val) => {
                                                if (period === 'week') {
                                                    const d = new Date(val);
                                                    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
                                                    return `${d.getMonth() + 1}/${d.getDate()}\n${day}`;
                                                }
                                                return val;
                                            }
                                        },
                                        tooltip: { enabled: false },
                                        axisBorder: { show: false },
                                        axisTicks: { show: false }
                                    },
                                    yaxis: {
                                        title: { text: 'OEE (%)', style: { fontSize: 11, color: '#6c757d' } },
                                        min: 0,
                                        max: 100,
                                        labels: { 
                                            formatter: (val) => val ? val.toFixed(0) + '%' : '0%',
                                            style: { fontSize: 11 }
                                        }
                                    },
                                    markers: { size: 5, hover: { size: 7 }, strokeColors: '#fff', strokeWidth: 2 },
                                    legend: { 
                                        position: 'top', 
                                        horizontalAlign: 'right',
                                        fontSize: '12px',
                                        markers: { radius: 5 }
                                    },
                                    tooltip: {
                                        shared: true,
                                        intersect: false,
                                        theme: 'light',
                                        style: { fontSize: '12px' },
                                        y: { formatter: (val) => val ? `${val.toFixed(1)}%` : 'N/A' },
                                        x: { formatter: (val) => val }
                                    },
                                    grid: { 
                                        borderColor: '#e9ecef',
                                        strokeDashArray: 4,
                                        xaxis: { lines: { show: true } },
                                        yaxis: { lines: { show: true } }
                                    },
                                    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'],
                                    dataLabels: {
                                        enabled: hasActiveFilter,
                                        formatter: (val) => val > 0 ? `${val}%` : '',
                                        style: { fontSize: '10px', fontWeight: 600, colors: ['#374151'] },
                                        background: { enabled: true, borderRadius: 3, padding: 3, foreColor: '#fff', borderWidth: 0, dropShadow: { enabled: false } },
                                        offsetY: -6
                                    },
                                    theme: { mode: 'light' }
                                }}
                                series={chartData.series}
                                type="line"
                                height={350}
                            />
                        </div>
                    </Suspense>
                )}
            </div>
        </div>
    );
};

export default ProductionSummary;
