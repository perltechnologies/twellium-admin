import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';
import { productionApi } from '../../api/production';
import { toLocalDateStr } from '../../utils/filterParams';
import { classifyDowntime, DOWNTIME_CLASSIFICATION, parseDowntimeMinutes } from '../../utils/downtime';

const formatDuration = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const normalizeIncidentDescription = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const descriptionSimilarity = (leftValue, rightValue) => {
    const left = normalizeIncidentDescription(leftValue);
    const right = normalizeIncidentDescription(rightValue);
    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftTokens = new Set(left.split(' '));
    const rightTokens = new Set(right.split(' '));
    const sharedTokens = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const tokenSimilarity = sharedTokens / (leftTokens.size + rightTokens.size - sharedTokens);

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + substitutionCost
            );
        }
        previous = current;
    }

    const characterSimilarity = 1 - previous[right.length] / Math.max(left.length, right.length);
    return Math.max(tokenSimilarity, characterSimilarity);
};

const SIMILAR_DESCRIPTION_THRESHOLD = 0.76;

const StoppageIncidentsChart = ({ dateFilter, petFilter, onPetChange }) => {
    const navigate = useNavigate();
    const filterLogDate = dateFilter?.log_date || '';
    const filterStartDate = dateFilter?.start_date || '';
    const filterEndDate = dateFilter?.end_date || '';
    const [useRange, setUseRange] = useState(() => Boolean(filterStartDate && filterEndDate));
    const [singleDate, setSingleDate] = useState(() => filterLogDate);
    const [startDate, setStartDate] = useState(() => filterStartDate);
    const [endDate, setEndDate] = useState(() => filterEndDate);
    const [selectedPet, setSelectedPet] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [downtimeBreakdown, setDowntimeBreakdown] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchKey, setFetchKey] = useState(0);
    const [selectedSubCategory, setSelectedSubCategory] = useState(null);
    const [incidentDetails, setIncidentDetails] = useState([]);
    const [incidentDetailsLoading, setIncidentDetailsLoading] = useState(false);
    const [incidentDetailsError, setIncidentDetailsError] = useState('');

    useEffect(() => {
        const hasRange = Boolean(filterStartDate && filterEndDate);
        setUseRange(hasRange);
        setSingleDate(filterLogDate);
        setStartDate(filterStartDate);
        setEndDate(filterEndDate);
    }, [filterLogDate, filterStartDate, filterEndDate]);

    useEffect(() => {
        if (petFilter) {
            setSelectedPet(petFilter);
        } else if (!selectedPet && !petFilter) {
            setSelectedPet('');
        }
    }, [petFilter, selectedPet]);

    useEffect(() => {
        let cancelled = false;

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
                if (!cancelled) setDowntimeBreakdown(envelope.downtime_breakdown || null);
            } catch (err) {
                console.error('Failed to fetch production summary:', err);
                if (!cancelled) setDowntimeBreakdown(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
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

    const effectiveSelectedPet = petFilter || selectedPet;

    const activeDateLabel = useMemo(() => {
        if (useRange && startDate && endDate) return `${startDate} to ${endDate}`;
        if (singleDate) return singleDate;

        const now = new Date();
        const ref = new Date(now);
        if (now.toTimeString().slice(0, 5) < '06:00') ref.setDate(ref.getDate() - 1);
        return toLocalDateStr(ref);
    }, [endDate, singleDate, startDate, useRange]);

    // Build chart data from planned and mechanical downtime subcategories.
    const chartData = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const items = [];
        downtimeBreakdown.categories.forEach(cat => {
            (cat.sub_categories || []).forEach(sub => {
                const classification = classifyDowntime(sub, cat);
                if (![DOWNTIME_CLASSIFICATION.PLANNED, DOWNTIME_CLASSIFICATION.MECHANICAL].includes(classification)) return;
                if (selectedCategory && classification !== selectedCategory) return;
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
                    classification,
                    count,
                    totalDuration: duration,
                });
            });
        });
        return items.sort((a, b) => b.totalDuration - a.totalDuration);
    }, [downtimeBreakdown, effectiveSelectedPet, selectedCategory]);

    const chartHeight = Math.max(700, chartData.length * 44);

    const closeIncidentDetails = useCallback(() => {
        setSelectedSubCategory(null);
        setIncidentDetails([]);
        setIncidentDetailsError('');
    }, []);

    const showIncidentDetails = useCallback(async (item) => {
        if (!item) return;

        setSelectedSubCategory(item);
        setIncidentDetails([]);
        setIncidentDetailsError('');
        setIncidentDetailsLoading(true);

        try {
            const params = { page_size: 1000, ordering: '-log_date' };
            let selectedStart;
            let selectedEnd;

            if (useRange && startDate && endDate) {
                selectedStart = startDate;
                selectedEnd = endDate;
                params.start_datetime = `${startDate}T00:00:00Z`;
                params.end_datetime = `${endDate}T23:59:59Z`;
            } else {
                let detailDate = singleDate;
                if (!detailDate) {
                    const now = new Date();
                    const ref = new Date(now);
                    if (now.toTimeString().slice(0, 5) < '06:00') ref.setDate(ref.getDate() - 1);
                    detailDate = toLocalDateStr(ref);
                }
                selectedStart = detailDate;
                selectedEnd = detailDate;
                params.log_date = detailDate;
            }

            const response = await productionApi.getStoppages(params);
            const payload = response?.data;
            const stoppages = Array.isArray(payload) ? payload
                : Array.isArray(payload?.results) ? payload.results
                : Array.isArray(payload?.data) ? payload.data
                : Array.isArray(payload?.data?.results) ? payload.data.results
                : [];

            const details = [];
            stoppages.forEach((stoppage) => {
                const rowDate = String(
                    stoppage.log_date
                    || stoppage.production_date
                    || stoppage.datetime_start_time
                    || stoppage.created_at
                    || ''
                ).slice(0, 10);
                if (rowDate && (rowDate < selectedStart || rowDate > selectedEnd)) return;
                if (effectiveSelectedPet && stoppage.pet_name !== effectiveSelectedPet) return;

                (stoppage.incidents || []).forEach((incident) => {
                    const subCategory = incident.sub_downtime_category_name || incident.sub_category_name || '';
                    const category = incident.downtime_category_name || incident.category_name || '';
                    if (subCategory !== item.label) return;
                    if (item.category && category && category !== item.category) return;

                    details.push({
                        id: incident.id ?? `${stoppage.id}-${details.length}`,
                        description: (incident.incident_description || '').trim() || `Incident ${details.length + 1}`,
                        duration: parseDowntimeMinutes(incident.incident_duration),
                        date: rowDate,
                        time: incident.incident_time || stoppage.log_time || '',
                        pet: stoppage.pet_name || 'Unknown',
                        reportCode: stoppage.report_code || '',
                    });
                });
            });

            setIncidentDetails(details.sort((left, right) => right.duration - left.duration));
        } catch (error) {
            console.error('Failed to fetch incident details:', error);
            setIncidentDetailsError('Unable to load the individual incidents. Please try again.');
        } finally {
            setIncidentDetailsLoading(false);
        }
    }, [effectiveSelectedPet, endDate, singleDate, startDate, useRange]);

    // Totals are derived from chartData so they always match the visible bars.
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
            toolbar: { show: false },
            events: {
                dataPointSelection: (_event, _chartContext, config) => {
                    showIncidentDetails(chartData[config.dataPointIndex]);
                }
            }
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
                maxWidth: 240,
                formatter: (val) => {
                    if (!val || typeof val !== 'string') return val;
                    const words = val.split(' ');
                    if (words.length <= 1) return val;
                    const chunkSize = 28;
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
        colors: ['#3b82f6', '#ef4444'],
        states: {
            hover: { filter: { type: 'darken', value: 0.08 } }
        }
    }), [chartData, showIncidentDetails]);

    const groupedIncidentDetails = useMemo(() => {
        const groups = [];

        incidentDetails.forEach((incident) => {
            let matchingGroup = null;
            let bestScore = 0;

            groups.forEach((group) => {
                const score = Math.max(...group.variants.map((variant) => descriptionSimilarity(incident.description, variant)));
                if (score >= SIMILAR_DESCRIPTION_THRESHOLD && score > bestScore) {
                    matchingGroup = group;
                    bestScore = score;
                }
            });

            if (matchingGroup) {
                matchingGroup.count += 1;
                matchingGroup.totalDuration += incident.duration;
                if (!matchingGroup.variants.includes(incident.description)) matchingGroup.variants.push(incident.description);
            } else {
                groups.push({
                    label: incident.description,
                    count: 1,
                    totalDuration: incident.duration,
                    variants: [incident.description],
                });
            }
        });

        return groups.sort((left, right) => right.totalDuration - left.totalDuration);
    }, [incidentDetails]);

    const incidentDetailOptions = useMemo(() => ({
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
        dataLabels: {
            enabled: true,
            formatter: (value) => formatDuration(value),
            style: { fontSize: '10px' }
        },
        xaxis: {
            categories: groupedIncidentDetails.map((group) => `${group.label} (${group.count})`),
            title: { text: 'Duration (minutes)' }
        },
        yaxis: { labels: { maxWidth: 280, style: { fontSize: '11px' } } },
        tooltip: {
            y: {
                formatter: (value, { dataPointIndex }) => {
                    const group = groupedIncidentDetails[dataPointIndex];
                    return `${formatDuration(value)} · ${group?.count || 0} incident${group?.count === 1 ? '' : 's'}`;
                }
            }
        },
        colors: ['#ef4444'],
        grid: { xaxis: { lines: { show: true } } }
    }), [groupedIncidentDetails]);

    const incidentDetailSeries = useMemo(() => [{
        name: 'Duration',
        data: groupedIncidentDetails.map((group) => group.totalDuration)
    }], [groupedIncidentDetails]);

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
        <>
        <div className="card">
            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h6 className="mb-0">Stoppage Incidents by Subcategory</h6>
                        <small className="text-muted">Planned and mechanical downtime — incident count and total duration by subcategory</small>
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
                    <div className="col-md-3">
                        <label className="form-label small">Category</label>
                        <select className="form-select form-select-sm" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                            <option value="">All Categories</option>
                            <option value={DOWNTIME_CLASSIFICATION.PLANNED}>Planned Downtime</option>
                            <option value={DOWNTIME_CLASSIFICATION.MECHANICAL}>Mechanical Downtime</option>
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
                
                {(singleDate || startDate || endDate || selectedPet || selectedCategory) && (
                    <div className="alert alert-info d-flex align-items-center mt-3 mb-0">
                        <i className="ti ti-filter fs-5 me-2"></i>
                        <div className="flex-grow-1">
                            <strong>Active Filters:</strong>
                            {singleDate && <span className="ms-2">Date: {singleDate}</span>}
                            {startDate && <span className="ms-2">From: {startDate}</span>}
                            {endDate && <span className="ms-2">To: {endDate}</span>}
                            {selectedPet && <span className="ms-2">• PET: {selectedPet}</span>}
                            {selectedCategory && (
                                <span className="ms-2">
                                    • Category: {selectedCategory === DOWNTIME_CLASSIFICATION.PLANNED ? 'Planned Downtime' : 'Mechanical Downtime'}
                                </span>
                            )}
                        </div>
                        <button 
                            className="btn btn-sm btn-outline-info"
                            onClick={() => {
                                setSingleDate('');
                                setStartDate('');
                                setEndDate('');
                                setSelectedPet('');
                                setSelectedCategory('');
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
                        <small className="text-muted d-block mb-2">
                            <i className="ti ti-pointer me-1"></i>Click a bar to view its individual incidents.
                        </small>
                        <div style={{ cursor: 'pointer' }}>
                            <ReactApexChart options={chartOptions} series={series} type="bar" height={chartHeight} />
                        </div>

                    </>
                )}
            </div>
        </div>
        {selectedSubCategory && (
            <>
                <div className="modal-backdrop fade show"></div>
                <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" aria-labelledby="incident-detail-title">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header">
                                <div>
                                    <h5 className="modal-title" id="incident-detail-title">{selectedSubCategory.label}</h5>
                                    <small className="text-muted">
                                        Individual incidents · {selectedSubCategory.category || 'Uncategorized'}
                                    </small>
                                </div>
                                <button type="button" className="btn-close" aria-label="Close" onClick={closeIncidentDetails}></button>
                            </div>
                            <div className="modal-body">
                                <div className="alert alert-info py-2 mb-3">
                                    <div className="d-flex flex-wrap align-items-center gap-2">
                                        <strong className="me-1"><i className="ti ti-filter me-1"></i>Applicable Filters:</strong>
                                        <span className="badge bg-info-transparent text-info">Date: {activeDateLabel}</span>
                                        <span className="badge bg-info-transparent text-info">PET: {effectiveSelectedPet || 'All PETs'}</span>
                                        <span className="badge bg-info-transparent text-info">
                                            Category: {selectedSubCategory.classification === DOWNTIME_CLASSIFICATION.PLANNED ? 'Planned Downtime' : 'Mechanical Downtime'}
                                        </span>
                                    </div>
                                </div>
                                {incidentDetailsLoading ? (
                                    <div className="text-center py-5">
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Loading incident details…
                                    </div>
                                ) : incidentDetailsError ? (
                                    <div className="alert alert-danger mb-0">{incidentDetailsError}</div>
                                ) : incidentDetails.length === 0 ? (
                                    <div className="text-center text-muted py-5">No individual incident records were found for this subcategory.</div>
                                ) : (
                                    <>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <span className="badge bg-primary-transparent text-primary me-2">{incidentDetails.length} incidents</span>
                                                <span className="badge bg-secondary-transparent text-secondary">{groupedIncidentDetails.length} similar-description groups</span>
                                            </div>
                                            <strong>Total: {formatDuration(incidentDetails.reduce((sum, incident) => sum + incident.duration, 0))}</strong>
                                        </div>
                                        <small className="text-muted d-block mb-2">
                                            Similar descriptions are combined by spelling, casing, punctuation, and wording similarity. The number in brackets is the incident count.
                                        </small>
                                        <ReactApexChart
                                            options={incidentDetailOptions}
                                            series={incidentDetailSeries}
                                            type="bar"
                                            height={Math.max(360, groupedIncidentDetails.length * 48)}
                                        />
                                        <div className="table-responsive mt-4">
                                            <table className="table table-sm table-striped align-middle mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Incident</th>
                                                        <th>Date / Time</th>
                                                        <th>PET</th>
                                                        <th>Report</th>
                                                        <th className="text-end">Duration</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {incidentDetails.map((incident, index) => (
                                                        <tr key={`${incident.id}-${index}`}>
                                                            <td>{incident.description}</td>
                                                            <td>{[incident.date, incident.time].filter(Boolean).join(' ') || '—'}</td>
                                                            <td>{incident.pet}</td>
                                                            <td>{incident.reportCode || '—'}</td>
                                                            <td className="text-end">{formatDuration(incident.duration)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeIncidentDetails}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}
        </>
    );
};

export default StoppageIncidentsChart;
