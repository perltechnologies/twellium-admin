import React, { useEffect, useMemo, useState } from 'react';
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

// Wrap a description into up to 3 lines for readable axis labels.
const wrapDescription = (text) => {
    const words = String(text || '').split(' ');
    if (words.length <= 1) return String(text || '');
    const chunkSize = Math.ceil(String(text).length / 3);
    const lines = [];
    let current = '';
    for (const word of words) {
        if (current.length + word.length + 1 > chunkSize && lines.length < 2) {
            lines.push(current.trim());
            current = word;
        } else {
            current += (current ? ' ' : '') + word;
        }
    }
    if (current) lines.push(current.trim());
    return lines;
};

/**
 * Plots each downtime subcategory (by its description) against its total duration.
 *
 * Duration comes from the production_summary `downtime_breakdown` (per subcategory
 * `total_duration_mins`). Descriptions are joined from the DowntimeSubCategory
 * records, matched by subcategory id (fallback: subcategory name).
 */
const DowntimeSubCategoryDurationChart = () => {
    const [useRange, setUseRange] = useState(false);
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [downtimeBreakdown, setDowntimeBreakdown] = useState(null);
    const [descriptionMap, setDescriptionMap] = useState({});
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchKey, setFetchKey] = useState(0);

    // Load subcategory descriptions once (id -> description, name -> description)
    useEffect(() => {
        let cancelled = false;
        const fetchSubCategories = async () => {
            try {
                const res = await productionApi.getDowntimeSubCategories({ page_size: 1000 });
                const d = res?.data;
                const list = Array.isArray(d) ? d
                    : Array.isArray(d?.results) ? d.results
                    : Array.isArray(d?.data) ? d.data
                    : Array.isArray(d?.data?.results) ? d.data.results
                    : [];
                if (cancelled) return;
                const map = {};
                list.forEach((sc) => {
                    const desc = (sc.description || '').trim();
                    if (sc.id != null) map[`id:${sc.id}`] = desc;
                    if (sc.name) map[`name:${sc.name.toLowerCase().trim()}`] = desc;
                });
                setDescriptionMap(map);
            } catch (err) {
                console.error('Failed to fetch downtime subcategories:', err);
            }
        };
        fetchSubCategories();
        return () => { cancelled = true; };
    }, []);

    // Load the downtime breakdown for the selected date range
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

                const res = await productionApi.getProductionSummary({ start_date: dateStart, end_date: dateEnd });
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

    // Build: subcategory description -> total duration
    const chartData = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const items = [];
        downtimeBreakdown.categories.forEach((cat) => {
            (cat.sub_categories || []).forEach((sub) => {
                const duration = sub.total_duration_mins || 0;
                if (duration <= 0) return;
                const subCategory = sub.sub_category_name || 'Unknown';
                // Filter to a single subcategory when one is selected.
                if (selectedSubCategory && subCategory !== selectedSubCategory) return;
                const byId = sub.sub_category_id != null ? descriptionMap[`id:${sub.sub_category_id}`] : '';
                const byName = sub.sub_category_name
                    ? descriptionMap[`name:${sub.sub_category_name.toLowerCase().trim()}`]
                    : '';
                const description = (byId || byName || '').trim();
                // Fall back to the subcategory name only when no description is available.
                const label = description || subCategory;
                items.push({
                    label,
                    subCategory,
                    category: cat.category_name,
                    totalDuration: duration,
                    hasDescription: Boolean(description),
                });
            });
        });
        // One bar per downtime description, largest duration first.
        return items.sort((a, b) => b.totalDuration - a.totalDuration).slice(0, 20);
    }, [downtimeBreakdown, descriptionMap, selectedSubCategory]);

    // All subcategories that have downtime (for the filter dropdown), regardless of selection.
    const availableSubCategories = useMemo(() => {
        if (!downtimeBreakdown?.categories) return [];
        const set = new Set();
        downtimeBreakdown.categories.forEach((cat) => {
            (cat.sub_categories || []).forEach((sub) => {
                if ((sub.total_duration_mins || 0) > 0 && sub.sub_category_name) {
                    set.add(sub.sub_category_name);
                }
            });
        });
        return [...set].sort();
    }, [downtimeBreakdown]);

    const totalDuration = useMemo(
        () => chartData.reduce((s, d) => s + d.totalDuration, 0),
        [chartData]
    );

    // Category label per bar: wrapped description.
    const categoryLabels = useMemo(
        () => chartData.map((d) => wrapDescription(d.label)),
        [chartData]
    );

    const chartOptions = useMemo(() => ({
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '70%',
                borderRadius: 4,
                distributed: false,
            }
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => formatDuration(val),
            style: { fontSize: '11px', colors: ['#fff'] }
        },
        stroke: { show: true, width: 1, colors: ['#fff'] },
        xaxis: {
            categories: categoryLabels,
            title: { text: 'Duration (minutes)' },
            labels: { style: { fontSize: '11px' } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '10px' },
                maxWidth: 260,
            }
        },
        tooltip: {
            y: {
                title: { formatter: () => 'Duration:' },
                formatter: (val) => formatDuration(val)
            },
            x: {
                formatter: (_val, opts) => {
                    const row = chartData[opts?.dataPointIndex];
                    return row ? `${row.label}  (${row.subCategory})` : '';
                }
            }
        },
        colors: ['#8b5cf6'],
        legend: { show: false }
    }), [chartData, categoryLabels]);

    const series = useMemo(() => [
        { name: 'Total Duration (min)', data: chartData.map((d) => Math.round(d.totalDuration)) }
    ], [chartData]);

    const hasActiveFilters = singleDate || startDate || endDate || selectedSubCategory;

    return (
        <div className="card">
            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <h6 className="mb-0">Downtime by Description</h6>
                        <small className="text-muted">Total downtime duration per description</small>
                    </div>
                    <div className="btn-group btn-group-sm" role="group">
                        <button
                            className="btn btn-outline-primary"
                            onClick={() => {
                                const end = new Date().toISOString().split('T')[0];
                                const start = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
                                setUseRange(true);
                                setStartDate(start);
                                setEndDate(end);
                                setSingleDate('');
                                setFetchKey((k) => k + 1);
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
                                setFetchKey((k) => k + 1);
                            }}
                        >
                            Month
                        </button>
                    </div>
                </div>

                <div className="row mt-3 align-items-end">
                    <div className="col-md-6">
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
                    <div className="col-md-6">
                        <label className="form-label small">Subcategory</label>
                        <select
                            className="form-select form-select-sm"
                            value={selectedSubCategory}
                            onChange={(e) => setSelectedSubCategory(e.target.value)}
                        >
                            <option value="">All subcategories</option>
                            {availableSubCategories.map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="alert alert-info d-flex align-items-center mt-3 mb-0">
                        <i className="ti ti-filter fs-5 me-2"></i>
                        <div className="flex-grow-1">
                            <strong>Active Filters:</strong>
                            {singleDate && <span className="ms-2">Date: {singleDate}</span>}
                            {startDate && <span className="ms-2">From: {startDate}</span>}
                            {endDate && <span className="ms-2">To: {endDate}</span>}
                            {selectedSubCategory && <span className="ms-2">• Subcategory: {selectedSubCategory}</span>}
                        </div>
                        <button
                            className="btn btn-sm btn-outline-info"
                            onClick={() => {
                                setSingleDate('');
                                setStartDate('');
                                setEndDate('');
                                setSelectedSubCategory('');
                                setUseRange(false);
                                setFetchKey((k) => k + 1);
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
                        <i className="ti ti-clock-pause fs-1 mb-3 d-block"></i>
                        <p className="mb-0">No downtime description data available</p>
                        <small className="d-block mt-2">No downtime recorded for the selected date range</small>
                    </div>
                ) : (
                    <>
                        <div className="row mb-3">
                            <div className="col-6">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Descriptions</small>
                                    <h4 className="mb-0 text-primary">{chartData.length}</h4>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Total Duration</small>
                                    <h4 className={`mb-0 ${totalDuration <= 60 ? 'text-success' : 'text-danger'}`}>{formatDuration(totalDuration)}</h4>
                                </div>
                            </div>
                        </div>

                        <ReactApexChart
                            options={chartOptions}
                            series={series}
                            type="bar"
                            height={Math.max(300, chartData.length * 48)}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default DowntimeSubCategoryDurationChart;
