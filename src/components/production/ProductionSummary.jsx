import React, { useState, useMemo, lazy, Suspense } from 'react';

const ReactApexChart = lazy(() => import('react-apexcharts'));

const ProductionSummary = ({ reports = [], loading = false, pets = [] }) => {
    const [period, setPeriod] = useState('week');
    const [selectedPets, setSelectedPets] = useState([]);

    const togglePet = (petId) => {
        setSelectedPets(prev => 
            prev.includes(petId) ? prev.filter(id => id !== petId) : [...prev, petId]
        );
    };

    const chartData = useMemo(() => {
        const filtered = selectedPets.length > 0 
            ? reports.filter(r => selectedPets.includes(r.pet_id))
            : reports;

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
            // Weekly for month
            for (let i = 3; i >= 0; i--) {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - (i * 7 + 6));
                const weekEnd = new Date(now);
                weekEnd.setDate(now.getDate() - (i * 7));
                dates.push(`Week ${4 - i}`);
                
                const weekKey = `Week ${4 - i}`;
                grouped[weekKey] = {};

                // Group reports in this week
                filtered.forEach(r => {
                    const reportDate = new Date(r.production_date);
                    if (reportDate >= weekStart && reportDate <= weekEnd) {
                        const petName = r.pet_name;
                        if (!grouped[weekKey][petName]) {
                            grouped[weekKey][petName] = { oee: 0, count: 0 };
                        }
                        grouped[weekKey][petName].oee += r.metrics?.oee || 0;
                        grouped[weekKey][petName].count += 1;
                    }
                });
            }
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
    }, [reports, selectedPets, period]);

    const summary = useMemo(() => {
        const filtered = selectedPets.length > 0 
            ? reports.filter(r => selectedPets.includes(r.pet_id))
            : reports;

        const totalProduction = filtered.reduce((s, r) => s + (r.metrics?.details?.total_output_pcs || 0), 0);
        const avgOee = filtered.length > 0 
            ? filtered.reduce((s, r) => s + (r.metrics?.oee || 0), 0) / filtered.length 
            : 0;
        const totalDowntime = filtered.reduce((s, r) => s + (r.metrics?.details?.total_downtime_mins || 0), 0);

        return { totalProduction, avgOee, totalDowntime, reports: filtered.length };
    }, [reports, selectedPets]);

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
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="btn-group btn-group-sm">
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
                    <div className="d-flex gap-2 flex-wrap">
                        {pets.map(pet => (
                            <button
                                key={pet.id}
                                className={`btn btn-sm ${selectedPets.includes(pet.id) ? 'btn-info' : 'btn-outline-secondary'}`}
                                onClick={() => togglePet(pet.id)}
                            >
                                {pet.pet_name}
                            </button>
                        ))}
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
                                    toolbar: { show: true },
                                    zoom: { enabled: true }
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
