import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';

const formatDuration = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const DowntimeBreakdownChart = ({ 
    downtimeCategories = [], 
    loading = false,
    showDetailsButton = true,
    detailsRoute = '/dashboard/production/stoppages'
}) => {
    const navigate = useNavigate();
    const totalDowntime = downtimeCategories.reduce((sum, d) => sum + d.value, 0);

    const chartOptions = {
        chart: {
            height: 480,
            type: 'radialBar',
        },
        series: downtimeCategories.map(cat => 
            totalDowntime > 0 ? Number(((cat.value / totalDowntime) * 100).toFixed(1)) : 0
        ),
        plotOptions: {
            radialBar: {
                hollow: {
                    size: '15%'
                },
                track: {
                    strokeWidth: '100%',
                    margin:8
                },
                dataLabels: {
                    total: {
                        show: true,
                        label: 'TOTAL',
                        formatter: () => formatDuration(totalDowntime)
                    }
                }
            }
        },
        labels: downtimeCategories.map(cat => cat.name),
        colors: downtimeCategories.map(cat => cat.color),
        legend: {
            show: true,
            position: 'bottom',
            formatter: (seriesName, opts) => {
                const value = downtimeCategories[opts.seriesIndex]?.value || 0;
                return `${seriesName}: ${formatDuration(value)}`;
            }
        },
        stroke: {
            lineCap: 'round'
        }
    };

    return (
        <div className="card flex-fill">
            <div className="card-header d-flex align-items-center justify-content-between">
                <div>
                    <h6 className="mb-0">Downtime Breakdown (Minutes)</h6>
                    <small className="text-muted">Impacts Availability = (Planned - Downtime) / Planned × 100</small>
                </div>
                {showDetailsButton && (
                    <button onClick={() => navigate(detailsRoute)} className="btn btn-primary btn-xs">
                        <i className="ti ti-external-link me-1"></i>Details
                    </button>
                )}
            </div>
            <div className="card-body">
                {loading ? (
                    <div className="text-center py-5">
                        <span className="spinner-border spinner-border-sm"></span>
                    </div>
                ) : downtimeCategories.length === 0 || totalDowntime === 0 ? (
                    <div className="text-center text-muted py-5">
                        <i className="ti ti-clock-pause fs-1 mb-3 d-block"></i>
                        <p className="mb-0">No downtime recorded</p>
                    </div>
                ) : (
                    <ReactApexChart 
                        options={chartOptions} 
                        series={chartOptions.series} 
                        type="radialBar" 
                        height={380}
                    />
                )}
            </div>
        </div>
    );
};

export default DowntimeBreakdownChart;
