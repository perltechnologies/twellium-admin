import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactApexChart from 'react-apexcharts';
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

// --- Similarity helpers (dependency-free, heuristic) ---------------------

// Normalize free-text: lowercase, strip punctuation, collapse whitespace.
const normalizeText = (s) =>
    String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (s) => normalizeText(s).split(' ').filter(Boolean);

// Jaccard similarity over the word sets (0..1). Good for word-order/extra words.
const jaccard = (aTokens, bTokens) => {
    if (!aTokens.length && !bTokens.length) return 1;
    const a = new Set(aTokens);
    const b = new Set(bTokens);
    let inter = 0;
    a.forEach((t) => { if (b.has(t)) inter += 1; });
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
};

// Levenshtein edit distance (iterative, O(n*m)) on normalized strings.
const levenshtein = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let curr = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i += 1) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
};

// Character-level similarity (0..1) from edit distance. Catches typos.
const charRatio = (a, b) => {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
};

// Combined similarity score (0..1): the stronger of token-overlap and
// char-level similarity, so either near-identical wording OR minor typos merge.
const similarity = (aRaw, bRaw) => {
    const aNorm = normalizeText(aRaw);
    const bNorm = normalizeText(bRaw);
    if (aNorm === bNorm) return 1;
    const tokenScore = jaccard(tokenize(aRaw), tokenize(bRaw));
    const charScore = charRatio(aNorm, bNorm);
    return Math.max(tokenScore, charScore);
};

// Merge threshold: descriptions with similarity >= this cluster together.
const SIMILARITY_THRESHOLD = 0.72;

/**
 * "Downtime by Description" — horizontal bar chart.
 *
 * Data source: /production/stoppages/ (per-incident detail). Incidents on the
 * current page are aggregated into one bar per description (kept distinct per
 * sub-category); bar length is total duration, sorted longest first.
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

    // Apply subcategory filter, then aggregate incidents into bars using a
    // heuristic similarity strategy: within a sub-category, descriptions that
    // are *similar* (typos, word-order, extra words) are merged into one bar
    // and their durations summed. The highest-duration wording becomes the
    // cluster's display label. Sorted by total duration, longest first.
    const allBars = useMemo(() => {
        const filtered = effectiveSelectedSubCategory
            ? incidents.filter((i) => i.subCategory === effectiveSelectedSubCategory)
            : incidents;

        // Step 1: collapse exact (normalized) duplicates first, grouped by
        // sub-category, to reduce the number of pairwise comparisons.
        const exact = {};
        filtered.forEach((i) => {
            const subCategory = i.subCategory || 'Uncategorized';
            const description = i.description || '(No description)';
            const key = `${subCategory}||${normalizeText(description)}`;
            if (!exact[key]) {
                exact[key] = {
                    description,
                    subCategory,
                    category: i.category || '',
                    duration: 0,
                    count: 0,
                };
            }
            exact[key].duration += i.duration;
            exact[key].count += 1;
        });

        // Step 2: group the exact-items by sub-category.
        const bySub = {};
        Object.values(exact).forEach((item) => {
            (bySub[item.subCategory] = bySub[item.subCategory] || []).push(item);
        });

        // Step 3: greedy similarity clustering within each sub-category.
        const clusters = [];
        Object.values(bySub).forEach((items) => {
            // Seed clusters with the longest-duration items first so the
            // representative label is the most significant wording.
            const ordered = [...items].sort((a, b) => b.duration - a.duration);
            const subClusters = [];
            ordered.forEach((item) => {
                let placed = false;
                for (const cluster of subClusters) {
                    if (similarity(item.description, cluster.description) >= SIMILARITY_THRESHOLD) {
                        cluster.duration += item.duration;
                        cluster.count += item.count;
                        cluster.variants.push(item.description);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    subClusters.push({
                        key: `${item.subCategory}||${item.description}`,
                        description: item.description, // canonical (longest duration)
                        subCategory: item.subCategory,
                        category: item.category,
                        duration: item.duration,
                        count: item.count,
                        variants: [item.description],
                    });
                }
            });
            clusters.push(...subClusters);
        });

        return clusters.sort((a, b) => b.duration - a.duration);
    }, [incidents, effectiveSelectedSubCategory]);

    const totalCount = allBars.length;              // number of merged descriptions
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Keep the current page within bounds when data/filters change.
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    // Reset to page 1 whenever the underlying data or filters change.
    useEffect(() => {
        setPage(1);
    }, [effectiveSelectedSubCategory, stoppages]);

    // The description bars visible on the current page.
    const barData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return allBars.slice(start, start + pageSize);
    }, [allBars, page, pageSize]);

    // A readable bar label: the description only.
    const barLabels = useMemo(
        () => barData.map((d) => d.description),
        [barData]
    );

    const chartOptions = useMemo(() => ({
        chart: { type: 'bar', toolbar: { show: false } },
        plotOptions: {
            bar: { horizontal: true, barHeight: '70%', borderRadius: 4, distributed: false },
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => formatDuration(val),
            style: { fontSize: '11px', colors: ['#fff'] },
        },
        stroke: { show: true, width: 1, colors: ['#fff'] },
        xaxis: {
            categories: barLabels,
            title: { text: 'Duration (minutes)' },
            labels: { style: { fontSize: '11px' } },
        },
        yaxis: { labels: { style: { fontSize: '10px' }, maxWidth: 320 } },
        tooltip: {
            y: {
                title: { formatter: () => 'Duration:' },
                formatter: (val) => formatDuration(val),
            },
            x: {
                formatter: (_val, opts) => {
                    const row = barData[opts?.dataPointIndex];
                    if (!row) return '';
                    const variantNote = row.variants && row.variants.length > 1
                        ? ` · ${row.variants.length} similar wordings merged`
                        : '';
                    return `${row.description}  (${row.subCategory} · ${row.count} incident${row.count !== 1 ? 's' : ''}${variantNote})`;
                },
            },
        },
        colors: ['#8b5cf6'],
        legend: { show: false },
    }), [barData, barLabels]);

    const chartSeries = useMemo(
        () => [{ name: 'Total Duration (min)', data: barData.map((d) => Math.round(d.duration)) }],
        [barData]
    );

    // Totals reflect the whole filtered dataset, not just the current page.
    const totalDescriptions = totalCount;                       // unique descriptions (bars)
    const totalIncidents = useMemo(
        () => allBars.reduce((s, b) => s + b.count, 0),          // underlying incident count
        [allBars]
    );
    const totalDuration = useMemo(
        () => allBars.reduce((s, b) => s + b.duration, 0),
        [allBars]
    );

    const hasActiveFilters = singleDate || startDate || endDate || effectiveSelectedSubCategory;

    return (
        <div className="card">
            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                        <h6 className="mb-0">Downtime by Description</h6>
                        <small className="text-muted">Total downtime duration per description (longest first)</small>
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
                ) : barData.length === 0 ? (
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
                                    <small className="text-muted d-block mb-1">Descriptions</small>
                                    <h4 className="mb-0 text-primary">{totalDescriptions}</h4>
                                    <small className="text-muted">{totalIncidents} incident{totalIncidents !== 1 ? 's' : ''}</small>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="border rounded p-3 text-center">
                                    <small className="text-muted d-block mb-1">Total Duration</small>
                                    <h4 className={`mb-0 ${totalDuration <= 60 ? 'text-success' : 'text-danger'}`}>{formatDuration(totalDuration)}</h4>
                                </div>
                            </div>
                        </div>

                        {/* Horizontal bar: one bar per description (duration) */}
                        <ReactApexChart
                            options={chartOptions}
                            series={chartSeries}
                            type="bar"
                            height={Math.max(300, barData.length * 42)}
                        />

                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            totalCount={totalCount}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            pageSizeOptions={[10, 20, 50, 100]}
                            itemLabel="descriptions"
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default DowntimeTimeline;
