import React, { useState, useMemo, lazy, Suspense } from 'react';

const ReactApexChart = lazy(() => import('react-apexcharts'));

const ProductionSummary = ({ reports = [], loading = false, pets = [] }) => {
    const [period, setPeriod] = useState('week');
    const [useRange, setUseRange] = useState(false);
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPet, setSelectedPet] = useState('');

    const chartData = useMemo(() => {
        let filtered = reports;
        
        // Filter by date
        if (useRange) {
            if (startDate) filtered = filtered.filter(r => r.production_date >= startDate);
            if (endDate) filtered = filtered.filter(r => r.production_date <= endDate);
        } else if (singleDate) {
            filtered = filtered.filter(r => r.production_date === singleDate);
        }
        
        // Filter by PET
        if (selectedPet) {
            filtered = filtered.filter(r => r.pet_id === parseInt(selectedPet));
        }

        // Generate date range
        const now = new Date();
        let dates = [];
        let grouped = {};

        if (period === 'week') {
            // Daily for week
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                dates.push(d.toISOString().split('T')[0]);
            }

            // Group by date
            filtered.forEach(r => {
                const date = r.production_date;
                if (!grouped[date]) grouped[date] = {};
                
                const petName = r.pet_name;
                if (!grouped[date][petName]) {
                    grouped[date][petName] = { oee: 0, count: 0 };
                }
                grouped[date][petName].oee += r.metrics?.oee || 0;
                grouped[date][petName].count += 1;
            });
        } else {
            // Daily for month (last 30 days)
            for (let i = 29; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                dates.push(d.toISOString().split('T')[0]);
            }

            // Group by date
            filtered.forEach(r => {
                const date = r.production_date;
                if (!grouped[date]) grouped[date] = {};
                
                const petName = r.pet_name;
                if (!grouped[date][petName]) {
                    grouped[date][petName] = { oee: 0, count: 0 };
                }
                grouped[date][petName].oee += r.metrics?.oee || 0;
                grouped[date][petName].count += 1;
            });
        }

        const petNames = [...new Set(filtered.map(r => r.pet_name))];

        const series = petNames.map(pet => ({
            name: pet,
            data: dates.map(date => {
                const data = grouped[date]?.[pet];
                return data ? parseFloat((data.oee / data.count).toFixed(1)) : 0;
            })
        }));

        return { dates, series };
    }, [reports, period, useRange, singleDate, startDate, endDate, selectedPet]);

    const summary = useMemo(() => {
        let filtered = reports;
        
        // Filter by date
        if (useRange) {
            if (startDate) filtered = filtered.filter(r => r.production_date >= startDate);
            if (endDate) filtered = filtered.filter(r => r.production_date <= endDate);
        } else if (singleDate) {
            filtered = filtered.filter(r => r.production_date === singleDate);
        }
        
        // Filter by PET
        if (selectedPet) {
            filtered = filtered.filter(r => r.pet_id === parseInt(selectedPet));
        }

        const totalProduction = filtered.reduce((s, r) => s + (r.metrics?.details?.total_output_pcs || 0), 0);
        const avgOee = filtered.length > 0 
            ? filtered.reduce((s, r) => s + (r.metrics?.oee || 0), 0) / filtered.length 
            : 0;
        const totalDowntime = filtered.reduce((s, r) => s + (r.metrics?.details?.total_downtime_mins || 0), 0);

        return { totalProduction, avgOee, totalDowntime, reports: filtered.length };
    }, [reports, useRange, singleDate, startDate, endDate, selectedPet]);

    return (
        <div className="card">
            <div className="card-header">
                <h6 className="mb-0">Production Summary</h6>
                <small className="text-muted">Efficiency trends and multi-line comparison</small>
            </div>
            <div className="card-body">
                {/* Summary Stats */}
                <div className="row mb-4">
                    <div className="col-3">
                        <div className="border rounded p-3 text-center">
                            <small className="text-muted d-block">Total Production</small>
                            <h5 className="mb-0 text-primary">{summary.totalProduction.toLocaleString()}</h5>
                        </div>
                    </div>
                    <div className="col-3">
                        <div className="border rounded p-3 text-center">
                            <small className="text-muted d-block">Avg OEE</small>
                            <h5 className="mb-0 text-success">{summary.avgOee.toFixed(1)}%</h5>
                        </div>
                    </div>
                    <div className="col-3">
                        <div className="border rounded p-3 text-center">
                            <small className="text-muted d-block">Total Downtime</small>
                            <h5 className="mb-0 text-danger">{Math.round(summary.totalDowntime)}m</h5>
                        </div>
                    </div>
                    <div className="col-3">
                        <div className="border rounded p-3 text-center">
                            <small className="text-muted d-block">Reports</small>
                            <h5 className="mb-0">{summary.reports}</h5>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="mb-3">
                    <div className="row align-items-end">
                        <div className="col-md-4">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <label className="form-label mb-0">Date</label>
                                <div className="form-check form-switch">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={useRange}
                                        onChange={(e) => {
                                            setUseRange(e.target.checked);
                                            if (e.target.checked) setSingleDate('');
                                            else { setStartDate(''); setEndDate(''); }
                                        }}
                                    />
                                    <label className="form-check-label small">Range</label>
                                </div>
                            </div>
                            {!useRange ? (
                                <input
                                    type="date"
                                    className="form-control"
                                    value={singleDate}
                                    onChange={(e) => setSingleDate(e.target.value)}
                                />
                            ) : (
                                <div className="d-flex gap-2">
                                    <input
                                        type="date"
                                        className="form-control"
                                        placeholder="Start"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                    <input
                                        type="date"
                                        className="form-control"
                                        placeholder="End"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="col-md-4">
                            <label className="form-label">PET</label>
                            <select
                                className="form-select"
                                value={selectedPet}
                                onChange={(e) => setSelectedPet(e.target.value)}
                            >
                                <option value="">All</option>
                                {pets.sort((a, b) => {
                                    const aName = (a.pet_name || '').toLowerCase();
                                    const bName = (b.pet_name || '').toLowerCase();
                                    const aIsCan = aName.includes('can');
                                    const bIsCan = bName.includes('can');
                                    if (aIsCan && !bIsCan) return 1;
                                    if (!aIsCan && bIsCan) return -1;
                                    const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                                    const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                                    return aNum - bNum;
                                }).map(pet => (
                                    <option key={pet.id} value={pet.id}>{pet.pet_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label className="form-label">Period</label>
                            <div className="btn-group w-100">
                                <button 
                                    className={`btn ${period === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setPeriod('week')}
                                >
                                    Week
                                </button>
                                <button 
                                    className={`btn ${period === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setPeriod('month')}
                                >
                                    Month
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                {loading ? (
                    <div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>
                ) : chartData.series.length === 0 || chartData.dates.length === 0 ? (
                    <div className="text-center text-muted py-4">No data available for the selected period</div>
                ) : (
                    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>}>
                        <ReactApexChart
                            options={{
                                chart: { 
                                    type: 'line', 
                                    height: 350, 
                                    toolbar: { show: false },
                                    zoom: { enabled: false }
                                },
                                stroke: { curve: 'smooth', width: 3 },
                                xaxis: { 
                                    categories: chartData.dates,
                                    labels: { rotate: -45 }
                                },
                                yaxis: { 
                                    title: { text: 'OEE (%)' }, 
                                    min: 0, 
                                    max: 100,
                                    labels: { formatter: (val) => val ? val.toFixed(0) : '0' }
                                },
                                markers: { size: 5, hover: { size: 7 } },
                                legend: { position: 'top', horizontalAlign: 'right' },
                                tooltip: { 
                                    shared: true,
                                    intersect: false,
                                    y: { formatter: (val) => val ? `${val}%` : 'N/A' } 
                                },
                                grid: { borderColor: '#e7e7e7' },
                                colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
                                dataLabels: { enabled: false }
                            }}
                            series={chartData.series}
                            type="line"
                            height={350}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
};

export default ProductionSummary;
