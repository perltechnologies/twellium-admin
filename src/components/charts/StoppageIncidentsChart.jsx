import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';
import { productionApi } from '../../api/production';

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const StoppageIncidentsChart = () => {
    const navigate = useNavigate();
    const [useRange, setUseRange] = useState(false);
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPet, setSelectedPet] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [downtimeBreakdown, setDowntimeBreakdown] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchKey, setFetchKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let dateStart, dateEnd;
                if (useRange && startDate && endDate) {
                    dateStart = startDate;
                    dateEnd = endDate;
                } else if (singleDate) {
                    dateStart = singleDate;
                    dateEnd = singleDate;
                } else {
                    const now = new Date();
                    const currentTime = now.toTimeString().slice(0, 5);
                    let todayStr = now.toISOString().split('T')[0];
                    if (currentTime < '06:00') {
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        todayStr = yesterday.toISOString().split('T')[0];
                    }
                    dateStart = todayStr;
                    dateEnd = todayStr;
                }

                const params = { start_date: dateStart, end_date: dateEnd };
                const res = await productionApi.getProductionSummary(params);
                const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
                setDowntimeBreakdown(envelope.downtime_breakdown || null);
            } catch (err) {
                console.error('Failed to fetch production summary:', err);
                setDowntimeBreakdown(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [useRange, singleDate, startDate, endDate, fetchKey]);

    // Extract available pets from downtime breakdown
    const availablePets = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const petSet = new Set();
        downtimeBreakdown.categories.forEach(cat => {
            (cat.sub_categories || []).forEach(sub => {
                (sub.pets_affected || []).forEach(pet => {
                    if (pet.pet_name) petSet.add(pet.pet_name);
                });
            });
        });
        return [...petSet].sort((a, b) => {
            const aNum = parseInt(a.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [downtimeBreakdown]);

    // Extract available subcategories
    const availableSubCategories = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const subCats = new Set();
        downtimeBreakdown.categories.forEach(cat => {
            (cat.sub_categories || []).forEach(sub => {
                if (sub.sub_category_name) subCats.add(sub.sub_category_name);
            });
        });
        return [...subCats].sort();
    }, [downtimeBreakdown]);

    // Build chart data from downtime_breakdown subcategories
    const chartData = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const items = [];
        downtimeBreakdown.categories.forEach(cat => {
            (cat.sub_categories || []).forEach(sub => {
                if (selectedSubCategory && sub.sub_category_name !== selectedSubCategory) return;
                
                let count = sub.incident_count || 0;
                let duration = sub.total_duration_mins || 0;
                
                // Filter by pet if selected
                if (selectedPet && sub.pets_affected?.length > 0) {
                    const petData = sub.pets_affected.find(p => p.pet_name === selectedPet);
                    if (!petData) return;
                    count = petData.count || 0;
                    duration = petData.duration_mins || 0;
                } else if (selectedPet && !sub.pets_affected?.length) {
                    return;
                }
                
                items.push({
                    label: sub.sub_category_name || 'Unknown',
                    category: cat.category_name,
                    count,
                    totalDuration: duration,
                });
            });
        });
        return items.sort((a, b) => b.totalDuration - a.totalDuration).slice(0, 15);
    }, [downtimeBreakdown, selectedSubCategory, selectedPet]);

    // Planned Downtime breakdown by subcategory
    const plannedDowntimeData = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const plannedCat = downtimeBreakdown.categories.find(c => c.category_name?.toLowerCase().includes('planned'));
        if (!plannedCat) return [];
        return (plannedCat.sub_categories || []).map(sub => {
            let count = sub.incident_count || 0;
            let duration = sub.total_duration_mins || 0;
            if (selectedPet && sub.pets_affected?.length > 0) {
                const petData = sub.pets_affected.find(p => p.pet_name === selectedPet);
                if (!petData) return null;
                count = petData.count || 0;
                duration = petData.duration_mins || 0;
            } else if (selectedPet && !sub.pets_affected?.length) {
                return null;
            }
            return { label: sub.sub_category_name || 'Unknown', count, totalDuration: duration };
        }).filter(Boolean).sort((a, b) => b.totalDuration - a.totalDuration);
    }, [downtimeBreakdown, selectedPet]);

    // Totals
    const totalIncidents = useMemo(() => {
        if (!downtimeBreakdown?.categories) return 0;
        if (selectedSubCategory || selectedPet) return chartData.reduce((sum, d) => sum + d.count, 0);
        return downtimeBreakdown.total_incidents || downtimeBreakdown.categories.reduce((s, c) => s + (c.incident_count || 0), 0);
    }, [downtimeBreakdown, chartData, selectedSubCategory, selectedPet]);

    const totalDuration = useMemo(() => {
        if (!downtimeBreakdown?.categories) return 0;
        if (selectedSubCategory || selectedPet) return chartData.reduce((sum, d) => sum + d.totalDuration, 0);
        return downtimeBreakdown.total_downtime_mins || downtimeBreakdown.categories.reduce((s, c) => s + (c.total_duration_mins || 0), 0);
    }, [downtimeBreakdown, chartData, selectedSubCategory, selectedPet]);

    const chartOptions = useMemo(() => ({
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
                formatter: (val, opts) => {
                    const seriesIndex = opts?.seriesIndex ?? 1;
                    return seriesIndex === 0 ? `${val} incidents` : `${formatDuration(val)}`;
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '12px'
        },
        colors: ['#3b82f6', '#ef4444']
    }), [chartData]);

    const series = useMemo(() => [
        {
            name: 'Incident Count',
            data: chartData.map(d => d.count)
        },
        {
            name: 'Total Duration (min)',
            data: chartData.map(d => Math.round(d.totalDuration))
        }
    ], [chartData]);
    
    const dailyRate = useMemo(() => {
        if (!useRange || !startDate || !endDate) return null;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return days > 0 ? (totalIncidents / days).toFixed(1) : 0;
    }, [useRange, startDate, endDate, totalIncidents]);

    return (
        <div className="card">
            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h6 className="mb-0">Stoppage Incidents by Category</h6>
                        <small className="text-muted">Incident count and total duration by downtime category</small>
                    </div>
                    <button onClick={() => navigate('/dashboard/production/stoppages')} className="btn btn-primary btn-xs">
                        <i className="ti ti-external-link me-1"></i>View All
                    </button>
                </div>
                
                <div className="row mt-3 align-items-end">
                    <div className="col-md-4">
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <label className="form-label mb-0 small">Date</label>
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
                                className="form-control form-control-sm"
                                value={singleDate}
                                onChange={(e) => setSingleDate(e.target.value)}
                            />
                        ) : (
                            <div className="d-flex gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    placeholder="Start"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    placeholder="End"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small">PET</label>
                        <select
                            className="form-select form-select-sm"
                            value={selectedPet}
                            onChange={(e) => setSelectedPet(e.target.value)}
                        >
                            <option value="">All</option>
                            {availablePets.map(pet => (
                                <option key={pet} value={pet}>{pet}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label small">Subcategory</label>
                        <select
                            className="form-select form-select-sm"
                            value={selectedSubCategory}
                            onChange={(e) => setSelectedSubCategory(e.target.value)}
                        >
                            <option value="">All</option>
                            {availableSubCategories.map(subCat => (
                                <option key={subCat} value={subCat}>{subCat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-2">
                        <label className="form-label small">Quick Select</label>
                        <div className="btn-group btn-group-sm w-100">
                            <button 
                                className="btn btn-outline-primary"
                                onClick={() => {
                                    const end = new Date().toISOString().split('T')[0];
                                    const start = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
                                    setUseRange(true);
                                    setStartDate(start);
                                    setEndDate(end);
                                    setSingleDate('');
                                    setFetchKey(k => k + 1);
                                }}
                            >
                                Week
                            </button>
                            <button 
                                className="btn btn-outline-primary"
                                onClick={() => {
                                    const end = new Date().toISOString().split('T')[0];
                                    const start = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
                                    setUseRange(true);
                                    setStartDate(start);
                                    setEndDate(end);
                                    setSingleDate('');
                                    setFetchKey(k => k + 1);
                                }}
                            >
                                Month
                            </button>
                        </div>
                    </div>
                </div>
                
                {(singleDate || startDate || endDate || selectedPet || selectedSubCategory) && (
                    <div className="alert alert-info d-flex align-items-center mt-3 mb-0">
                        <i className="ti ti-filter fs-5 me-2"></i>
                        <div className="flex-grow-1">
                            <strong>Active Filters:</strong>
                            {singleDate && <span className="ms-2">Date: {singleDate}</span>}
                            {startDate && <span className="ms-2">From: {startDate}</span>}
                            {endDate && <span className="ms-2">To: {endDate}</span>}
                            {selectedPet && <span className="ms-2">• PET: {selectedPet}</span>}
                            {selectedSubCategory && <span className="ms-2">• Subcategory: {selectedSubCategory}</span>}
                        </div>
                        <button 
                            className="btn btn-sm btn-outline-info"
                            onClick={() => {
                                setSingleDate('');
                                setStartDate('');
                                setEndDate('');
                                setSelectedPet('');
                                setSelectedSubCategory('');
                                setUseRange(false);
                                setFetchKey(k => k + 1);
                            }}
                        >
                            Clear
                        </button>
                    </div>
                )}
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
                        <small className="d-block mt-2">No downtime data for selected filters</small>
                    </div>
                ) : (
                    <>
                        <div className="row mb-3">
                            <div className="col-4">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Total Incidents</small>
                                    <h4 className="mb-0 text-primary">{totalIncidents}</h4>
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Total Duration</small>
                                    <h4 className={`mb-0 ${totalDuration <= 60 ? 'text-success' : 'text-danger'}`}>{formatDuration(totalDuration)}</h4>
                                </div>
                            </div>
                            {dailyRate && (
                                <div className="col-4">
                                    <div className="border rounded p-3 text-center">
                                        <small className="text-muted d-block mb-1">Daily Rate</small>
                                        <h4 className="mb-0 text-info">{dailyRate}</h4>
                                        <small className="text-muted">incidents/day</small>
                                    </div>
                                </div>
                            )}
                        </div>
                        <ReactApexChart options={chartOptions} series={series} type="bar" height={700} />

                        {/* Planned Downtime Subcategory Breakdown */}
                        {plannedDowntimeData.length > 0 && (
                            <div className="mt-4 pt-3 border-top">
                                <h6 className="mb-3">
                                    <i className="ti ti-clock-pause me-2"></i>
                                    Planned Downtime by Subcategory
                                    <span className="badge bg-info text-white ms-2">{plannedDowntimeData.reduce((s, d) => s + d.count, 0)} incidents</span>
                                    <span className="badge bg-secondary text-white ms-1">{formatDuration(plannedDowntimeData.reduce((s, d) => s + d.totalDuration, 0))}</span>
                                </h6>
                                <ReactApexChart
                                    options={{
                                        chart: { type: 'bar', toolbar: { show: false } },
                                        plotOptions: { bar: { horizontal: true, barHeight: '70%', borderRadius: 4 } },
                                        dataLabels: { enabled: true, style: { fontSize: '11px' } },
                                        xaxis: {
                                            categories: plannedDowntimeData.map(d => d.label),
                                            labels: { style: { fontSize: '11px' } }
                                        },
                                        yaxis: { labels: { style: { fontSize: '11px' } } },
                                        tooltip: {
                                            y: {
                                                formatter: (val, opts) => {
                                                    return opts?.seriesIndex === 0 ? `${val} incidents` : `${formatDuration(val)}`;
                                                }
                                            }
                                        },
                                        colors: ['#3b82f6', '#f59e0b'],
                                        legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px' }
                                    }}
                                    series={[
                                        { name: 'Incidents', data: plannedDowntimeData.map(d => d.count) },
                                        { name: 'Duration (min)', data: plannedDowntimeData.map(d => Math.round(d.totalDuration)) }
                                    ]}
                                    type="bar"
                                    height={Math.max(200, plannedDowntimeData.length * 50)}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StoppageIncidentsChart;
