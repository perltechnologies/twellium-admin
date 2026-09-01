import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';
import { productionApi } from '../../api/production';
import { toLocalDateStr } from '../../utils/filterParams';

const formatDuration = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const StoppageIncidentsChart = ({ dateFilter, petFilter, onPetChange }) => {
    const navigate = useNavigate();
    const [useRange, setUseRange] = useState(false);
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPet, setSelectedPet] = useState('');
    const [downtimeBreakdown, setDowntimeBreakdown] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchKey, setFetchKey] = useState(0);

    useEffect(() => {
        if (dateFilter) {
            const hasRange = Boolean(dateFilter.start_date && dateFilter.end_date);
            setUseRange(hasRange);
            setSingleDate(dateFilter.log_date || '');
            setStartDate(dateFilter.start_date || '');
            setEndDate(dateFilter.end_date || '');
        }
    }, [dateFilter?.log_date, dateFilter?.start_date, dateFilter?.end_date]);

    useEffect(() => {
        if (petFilter) {
            setSelectedPet(petFilter);
        } else if (!selectedPet && !petFilter) {
            setSelectedPet('');
        }
    }, [petFilter, selectedPet]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const effectiveUseRange = dateFilter ? Boolean(dateFilter.start_date && dateFilter.end_date) : useRange;
                const effectiveSingleDate = dateFilter ? (dateFilter.log_date || '') : singleDate;
                const effectiveStartDate = dateFilter ? (dateFilter.start_date || '') : startDate;
                const effectiveEndDate = dateFilter ? (dateFilter.end_date || '') : endDate;

                let dateStart, dateEnd;
                if (effectiveUseRange && effectiveStartDate && effectiveEndDate) {
                    dateStart = effectiveStartDate;
                    dateEnd = effectiveEndDate;
                } else if (effectiveSingleDate) {
                    dateStart = effectiveSingleDate;
                    dateEnd = effectiveSingleDate;
                } else {
                    const now = new Date();
                    const currentTime = now.toTimeString().slice(0, 5);
                    const ref = new Date(now);
                    if (currentTime < '06:00') {
                        ref.setDate(ref.getDate() - 1);
                    }
                    const todayStr = toLocalDateStr(ref);
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
    }, [dateFilter?.log_date, dateFilter?.start_date, dateFilter?.end_date, useRange, singleDate, startDate, endDate, fetchKey]);

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

    const effectiveSelectedPet = petFilter || selectedPet;

    // Build chart data from downtime_breakdown subcategories (Mechanical only)
    const chartData = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const items = [];
        downtimeBreakdown.categories.forEach(cat => {
            // Only include Mechanical Downtime subcategories.
            if (!cat.category_name?.toLowerCase().includes('mechanical')) return;
            (cat.sub_categories || []).forEach(sub => {
                let count = sub.incident_count || 0;
                let duration = sub.total_duration_mins || 0;
                
                // Filter by pet if selected
                if (effectiveSelectedPet && sub.pets_affected?.length > 0) {
                    const petData = sub.pets_affected.find(p => p.pet_name === effectiveSelectedPet);
                    if (!petData) return;
                    count = petData.count || 0;
                    duration = petData.duration_mins || 0;
                } else if (effectiveSelectedPet && !sub.pets_affected?.length) {
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
    }, [downtimeBreakdown, effectiveSelectedPet]);

    // Totals (Mechanical only) — derived from chartData so they always match
    // the mechanical subcategory bars, with or without a PET filter.
    const totalIncidents = useMemo(
        () => chartData.reduce((sum, d) => sum + d.count, 0),
        [chartData]
    );

    const totalDuration = useMemo(
        () => chartData.reduce((sum, d) => sum + d.totalDuration, 0),
        [chartData]
    );

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
    
    return (
        <div className="card">
            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h6 className="mb-0">Stoppage Incidents by Subcategory</h6>
                        <small className="text-muted">Mechanical downtime — incident count and total duration by subcategory</small>
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
                    <div className="col-md-4">
                        <label className="form-label small">PET</label>
                        <select
                            className="form-select form-select-sm"
                            value={effectiveSelectedPet}
                            onChange={(e) => {
                                setSelectedPet(e.target.value);
                                if (onPetChange) onPetChange(e.target.value || null);
                            }}
                        >
                            <option value="">All</option>
                            {availablePets.map(pet => (
                                <option key={pet} value={pet}>{pet}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-2">
                        <label className="form-label small">Quick Select</label>
                        <div className="btn-group btn-group-sm w-100">
                            <button 
                                className="btn btn-outline-primary"
                                onClick={() => {
                                    const end = toLocalDateStr(new Date());
                                    const start = toLocalDateStr(new Date(Date.now() - 6 * 86400000));
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
                                    const end = toLocalDateStr(new Date());
                                    const start = toLocalDateStr(new Date(Date.now() - 29 * 86400000));
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
                
                {(singleDate || startDate || endDate || selectedPet) && (
                    <div className="alert alert-info d-flex align-items-center mt-3 mb-0">
                        <i className="ti ti-filter fs-5 me-2"></i>
                        <div className="flex-grow-1">
                            <strong>Active Filters:</strong>
                            {singleDate && <span className="ms-2">Date: {singleDate}</span>}
                            {startDate && <span className="ms-2">From: {startDate}</span>}
                            {endDate && <span className="ms-2">To: {endDate}</span>}
                            {selectedPet && <span className="ms-2">• PET: {selectedPet}</span>}
                        </div>
                        <button 
                            className="btn btn-sm btn-outline-info"
                            onClick={() => {
                                setSingleDate('');
                                setStartDate('');
                                setEndDate('');
                                setSelectedPet('');
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
                        <small className="d-block mt-2">No downtime was recorded for the selected date range. Try the <strong>Week</strong> or <strong>Month</strong> quick-select above, or widen the date range.</small>
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
                                    <h4 className={`mb-0 ${totalDuration <= 60 ? 'text-success' : 'text-danger'}`}>{formatDuration(totalDuration)}</h4>
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
