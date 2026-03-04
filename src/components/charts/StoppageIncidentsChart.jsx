import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const CATEGORY_COLORS = {
    'Mechanical Downtime': '#ef4444',
    'Planned Downtime': '#3b82f6',
    'Electrical': '#f59e0b',
    'Quality': '#8b5cf6',
    'Material': '#10b981',
    'Other': '#6b7280',
};

const StoppageIncidentsChart = ({ stoppages = [], loading = false }) => {
    const navigate = useNavigate();

    const chartData = useMemo(() => {
        const incidentMap = {};

        stoppages.forEach(stoppage => {
            (stoppage.incidents || []).forEach(incident => {
                const subCategory = incident.sub_downtime_category_name || 'Uncategorized';
                const description = incident.incident_description || 'No Description';
                const key = `${subCategory} - ${description}`;
                const duration = parseFloat(incident.incident_duration || 0);

                if (!incidentMap[key]) {
                    incidentMap[key] = {
                        label: key,
                        subCategory,
                        description,
                        count: 0,
                        totalDuration: 0
                    };
                }

                incidentMap[key].count += 1;
                incidentMap[key].totalDuration += duration;
            });
        });

        return Object.values(incidentMap)
            .sort((a, b) => b.totalDuration - a.totalDuration)
            .slice(0, 10);
    }, [stoppages]);

    const chartOptions = {
        chart: {
            type: 'bar',
            height: 800,
            toolbar: { show: false }
        },
        grid: {
            yaxis: { lines: { show: true } },
            xaxis: { lines: { show: false } }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '85%',
                borderRadius: 4,
                colors: {
                    backgroundBarColors: ['#f8f9fa', '#ffffff'],
                    backgroundBarOpacity: 1,
                }
            }
        },
        dataLabels: {
            enabled: true,
            style: { fontSize: '10px', colors: ['#fff'] }
        },
        stroke: { show: true, width: 1, colors: ['#fff'] },
        xaxis: {
            categories: chartData.map(d => d.label),
            labels: { style: { fontSize: '11px' } }
        },
        yaxis: {
            labels: { 
                style: { fontSize: '10px' },
                maxWidth: 200,
                formatter: (val) => {
                    if (!val || typeof val !== 'string') return val;
                    const words = val.split(' ');
                    if (words.length <= 1) return val;
                    const chunkSize = Math.ceil(val.length / 4);
                    const lines = [];
                    let current = '';
                    for (const word of words) {
                        if (current.length + word.length + 1 > chunkSize && lines.length < 3) {
                            lines.push(current.trim());
                            current = word;
                        } else {
                            current += (current ? ' ' : '') + word;
                        }
                    }
                    if (current) lines.push(current.trim());
                    return lines;
                }
            }
        },
        fill: { opacity: 1 },
        tooltip: {
            y: {
                formatter: (val, { seriesIndex }) => 
                    seriesIndex === 0 ? `${val} incidents` : `${formatDuration(val)}`
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '12px'
        },
        colors: ['#3b82f6', '#ef4444']
    };

    const series = [
        {
            name: 'Incident Count',
            data: chartData.map(d => d.count)
        },
        {
            name: 'Total Duration (min)',
            data: chartData.map(d => Math.round(d.totalDuration))
        }
    ];

    const totalIncidents = chartData.reduce((sum, d) => sum + d.count, 0);
    const totalDuration = chartData.reduce((sum, d) => sum + d.totalDuration, 0);

    return (
        <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
                <div>
                    <h6 className="mb-0">Stoppage Incidents by Category</h6>
                    <small className="text-muted">Incident count and total duration by downtime category</small>
                </div>
                <button onClick={() => navigate('/dashboard/production/stoppages')} className="btn btn-primary btn-xs">
                    <i className="ti ti-external-link me-1"></i>View All
                </button>
            </div>
            <div className="card-body">
                {loading ? (
                    <div className="text-center py-5">
                        <span className="spinner-border spinner-border-sm"></span>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="text-center text-muted py-5">
                        <i className="ti ti-alert-circle fs-1 mb-3 d-block"></i>
                        <p className="mb-0">No incident data available</p>
                    </div>
                ) : (
                    <>
                        <div className="row mb-3">
                            <div className="col-6">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Total Incidents</small>
                                    <h4 className="mb-0 text-primary">{totalIncidents}</h4>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Total Duration</small>
                                    <h4 className="mb-0 text-danger">{formatDuration(totalDuration)}</h4>
                                </div>
                            </div>
                        </div>
                        <ReactApexChart options={chartOptions} series={series} type="bar" height={700} />
                    </>
                )}
            </div>
        </div>
    );
};

export default StoppageIncidentsChart;
