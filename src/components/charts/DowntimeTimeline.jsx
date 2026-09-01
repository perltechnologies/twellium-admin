import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import { toLocalDateStr } from '../../utils/filterParams';
import Pagination from '../ui/Pagination';

const formatDuration = (mins) => {
    if (!Number.isFinite(mins) || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// Format a YYYY-MM-DD (optionally with time) into a friendly label.
const formatDateLabel = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTimeLabel = (timeStr) => {
    if (!timeStr) return null;
    const d = new Date(`2000-01-01T${timeStr}`);
    if (Number.isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

// Color the left rail dot by downtime category.
const categoryColor = (category = '') => {
    const c = category.toLowerCase();
    if (c.includes('planned')) return '#f59e0b';       // amber
    if (c.includes('mechanical')) return '#ef4444';     // red
    if (c.includes('electrical')) return '#3b82f6';     // blue
    if (c.includes('quality')) return '#8b5cf6';        // purple
    return '#6b7280';                                    // gray fallback
};

/**
 * Date-ordered timeline of individual downtime incidents.
 *
 * Data source: /production/stoppages/ (per-incident detail), because the
 * aggregated production_summary `downtime_breakdown` carries no dates.
 * Each incident shows a category → sub-category → description trail plus its
 * duration. Incidents are grouped by date (newest first) and sorted within a
 * day by duration (longest first).
 */
const DowntimeTimeline = ({ dateFilter, subCategoryFilter, onSubCategoryChange }) => {
    const navigate = useNavigate();
    const [useRange, setUseRange] = useState(false);
    const [singleDate, setSingleDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [stoppages, setStoppages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchKey, setFetchKey] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

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
        if (subCategoryFilter) {
            setSelectedSubCategory(subCategoryFilter);
        } else if (!selectedSubCategory && !subCategoryFilter) {
            setSelectedSubCategory('');
        }
    }, [subCategoryFilter, selectedSubCategory]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const effectiveUseRange = dateFilter ? Boolean(dateFilter.start_date && dateFilter.end_date) : useRange;
                const effectiveSingleDate = dateFilter ? (dateFilter.log_date || '') : singleDate;
                const effectiveStartDate = dateFilter ? (dateFilter.start_date || '') : startDate;
                const effectiveEndDate = dateFilter ? (dateFilter.end_date || '') : endDate;

                const params = { page_size: 1000, ordering: '-log_date' };
                if (effectiveUseRange && effectiveStartDate && effectiveEndDate) {
                    params.start_date = effectiveStartDate;
                    params.end_date = effectiveEndDate;
                } else if (effectiveSingleDate) {
                    params.log_date = effectiveSingleDate;
                } else {
                    const now = new Date();
                    const currentTime = now.toTimeString().slice(0, 5);
                    const ref = new Date(now);
                    if (currentTime < '06:00') ref.setDate(ref.getDate() - 1);
                    params.log_date = toLocalDateStr(ref);
                }

                const res = await productionApi.getStoppages(params);
                const d = res?.data;
                const list = Array.isArray(d) ? d
                    : Array.isArray(d?.results) ? d.results
                    : Array.isArray(d?.data) ? d.data
                    : Array.isArray(d?.data?.results) ? d.data.results
                    : [];
                setStoppages(list.filter(r => !r.pet_name?.toLowerCase().includes('can')));
            } catch (err) {
                console.error('Failed to fetch stoppages for timeline:', err);
                setStoppages([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [dateFilter?.log_date, dateFilter?.start_date, dateFilter?.end_date, useRange, singleDate, startDate, endDate, fetchKey]);

    const effectiveSelectedSubCategory = subCategoryFilter || selectedSubCategory;

    // Flatten every incident into a timeline entry with its trail + duration.
    const incidents = useMemo(() => {
        const items = [];
        stoppages.forEach((row) => {
            (row.incidents || []).forEach((inc) => {
                const rawDuration = Number(inc.incident_duration);
                const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
                const category = inc.downtime_category_name || 'Uncategorized';
                const subCategory = inc.sub_downtime_category_name || '';
                const description = (inc.incident_description || '').trim();
                items.push({
                    id: inc.id ?? `${row.id}-${items.length}`,
                    date: row.log_date,
                    time: inc.incident_time || row.log_time || null,
                    pet: row.pet_name || 'Unknown',
                    reportCode: row.report_code,
                    category,
                    subCategory,
                    description,
                    duration,
                });
            });
        });
        return items;
    }, [stoppages]);

    // Subcategories available for the filter dropdown.
    const availableSubCategories = useMemo(() => {
        const set = new Set();
        incidents.forEach((i) => { if (i.subCategory) set.add(i.subCategory); });
        return [...set].sort();
    }, [incidents]);

    // Apply subcategory filter, then produce a flat list sorted by date
    // (newest first), and within a day by duration (longest first).
    const sortedIncidents = useMemo(() => {
        const filtered = effectiveSelectedSubCategory
            ? incidents.filter((i) => i.subCategory === effectiveSelectedSubCategory)
            : incidents;
        return [...filtered].sort((a, b) => {
            const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
            if (dateCmp !== 0) return dateCmp;
            return b.duration - a.duration;
        });
    }, [incidents, effectiveSelectedSubCategory]);

    const totalCount = sortedIncidents.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Keep the current page within bounds when data/filters change.
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    // Reset to page 1 whenever the underlying data or filters change.
    useEffect(() => {
        setPage(1);
    }, [effectiveSelectedSubCategory, stoppages]);

    // The incidents visible on the current page.
    const pageIncidents = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedIncidents.slice(start, start + pageSize);
    }, [sortedIncidents, page, pageSize]);

    // Re-group the current page's incidents by date for rendering.
    const groups = useMemo(() => {
        const byDate = {};
        pageIncidents.forEach((i) => {
            const key = i.date || 'Unknown';
            (byDate[key] = byDate[key] || []).push(i);
        });
        return Object.entries(byDate)
            .sort(([a], [b]) => String(b).localeCompare(String(a)))
            .map(([date, list]) => ({
                date,
                total: list.reduce((s, i) => s + i.duration, 0),
                incidents: list, // already globally sorted by duration desc
            }));
    }, [pageIncidents]);

    // Totals reflect the whole filtered dataset, not just the current page.
    const totalIncidents = totalCount;
    const totalDuration = useMemo(
        () => sortedIncidents.reduce((s, i) => s + i.duration, 0),
        [sortedIncidents]
    );

    const hasActiveFilters = singleDate || startDate || endDate || effectiveSelectedSubCategory;

    return (
        <div className="card">
            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <h6 className="mb-0">Downtime by Description</h6>
                        <small className="text-muted">Timeline of downtime incidents (newest first, longest first within a day)</small>
                    </div>
                    <div className="d-flex gap-2">
                        <div className="btn-group btn-group-sm" role="group">
                            <button
                                className="btn btn-outline-primary"
                                onClick={() => {
                                    const end = toLocalDateStr(new Date());
                                    const start = toLocalDateStr(new Date(Date.now() - 6 * 86400000));
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
                                    const end = toLocalDateStr(new Date());
                                    const start = toLocalDateStr(new Date(Date.now() - 29 * 86400000));
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
                        <button onClick={() => navigate('/dashboard/production/stoppages')} className="btn btn-primary btn-sm">
                            <i className="ti ti-external-link me-1"></i>View All
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
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
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
                            value={effectiveSelectedSubCategory}
                            onChange={(e) => {
                                setSelectedSubCategory(e.target.value);
                                if (onSubCategoryChange) onSubCategoryChange(e.target.value || null);
                            }}
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
                            {effectiveSelectedSubCategory && <span className="ms-2">• Subcategory: {effectiveSelectedSubCategory}</span>}
                        </div>
                        <button
                            className="btn btn-sm btn-outline-info"
                            onClick={() => {
                                setSingleDate('');
                                setStartDate('');
                                setEndDate('');
                                setSelectedSubCategory('');
                                setUseRange(false);
                                if (onSubCategoryChange) onSubCategoryChange(null);
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
                ) : groups.length === 0 ? (
                    <div className="text-center text-muted py-5">
                        <i className="ti ti-clock-pause fs-1 mb-3 d-block"></i>
                        <p className="mb-0">No downtime incidents available</p>
                        <small className="d-block mt-2">No downtime was recorded for the selected date range. Try the <strong>Week</strong> or <strong>Month</strong> quick-select above, or widen the date range.</small>
                    </div>
                ) : (
                    <>
                        <div className="row mb-4">
                            <div className="col-6">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Incidents</small>
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

                        {/* Vertical timeline */}
                        <div className="downtime-timeline" style={{ position: 'relative' }}>
                            {groups.map((group) => (
                                <div key={group.date} className="mb-4">
                                    {/* Date header */}
                                    <div className="d-flex align-items-center mb-2">
                                        <span className="badge bg-dark text-white me-2">{formatDateLabel(group.date)}</span>
                                        <small className="text-muted">
                                            {group.incidents.length} incident{group.incidents.length !== 1 ? 's' : ''} · {formatDuration(group.total)}
                                        </small>
                                    </div>

                                    {/* Incidents for the day */}
                                    <div style={{ borderLeft: '2px solid #e5e7eb', marginLeft: 6, paddingLeft: 16 }}>
                                        {group.incidents.map((inc) => (
                                            <div key={inc.id} className="position-relative mb-3">
                                                {/* Rail dot */}
                                                <span
                                                    style={{
                                                        position: 'absolute',
                                                        left: -23,
                                                        top: 4,
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        background: categoryColor(inc.category),
                                                        border: '2px solid #fff',
                                                        boxShadow: '0 0 0 1px #e5e7eb',
                                                    }}
                                                />
                                                <div className="d-flex justify-content-between align-items-start gap-2">
                                                    <div className="flex-grow-1">
                                                        {/* Trail: category > sub-category > description */}
                                                        <div className="d-flex align-items-center flex-wrap gap-1 mb-1" style={{ fontSize: 12 }}>
                                                            <span
                                                                className="badge"
                                                                style={{ background: categoryColor(inc.category), color: '#fff' }}
                                                            >
                                                                {inc.category}
                                                            </span>
                                                            {inc.subCategory && (
                                                                <>
                                                                    <i className="ti ti-chevron-right text-muted" style={{ fontSize: 12 }}></i>
                                                                    <span className="badge bg-soft-secondary text-secondary">{inc.subCategory}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="text-body" style={{ fontSize: 13 }}>
                                                            {inc.description || <span className="text-muted fst-italic">No description</span>}
                                                        </div>
                                                        <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                                                            {formatTimeLabel(inc.time) && <span className="me-2"><i className="ti ti-clock me-1"></i>{formatTimeLabel(inc.time)}</span>}
                                                            <span className="me-2"><i className="ti ti-versions me-1"></i>{inc.pet}</span>
                                                            {inc.reportCode && <span><i className="ti ti-file me-1"></i>{inc.reportCode}</span>}
                                                        </div>
                                                    </div>
                                                    <span className={`badge ${inc.duration <= 15 ? 'bg-soft-success text-success' : inc.duration <= 60 ? 'bg-soft-warning text-warning' : 'bg-soft-danger text-danger'}`} style={{ whiteSpace: 'nowrap' }}>
                                                        {formatDuration(inc.duration)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            totalCount={totalCount}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            pageSizeOptions={[10, 20, 50, 100]}
                            itemLabel="incidents"
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default DowntimeTimeline;
