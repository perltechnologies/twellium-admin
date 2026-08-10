import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { productionApi } from '../../api/production';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useFilters } from '../../context/FilterContext';
import { SkeletonStatCards, SkeletonDonut } from '../../components/ui/Skeletons';

const ProductionList = () => {
    const navigate = useNavigate();
    const { filters: globalFilters, updateFilters } = useFilters();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filters, setFilters] = useState({
        production_date: '',
        status: '',
        search: '',
        pet: globalFilters.pet || '',
        page: 1,
        page_size: 15
    });
    const [totalCount, setTotalCount] = useState(0);
    const [paginationLinks, setPaginationLinks] = useState({ next: null, previous: null });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [pets, setPets] = useState([]);
    const [stats, setStats] = useState({
        totalReports: 0,
        completedReports: 0,
        totalOutput: 0,
        avgOutput: 0,
        activeLines: 0,
        totalStoppages: 0,
        totalDowntime: 0,
        approvalRate: 0
    });
    const [chartFilter, setChartFilter] = useState('day');
    const [chartDate, setChartDate] = useState('');
    const [chartDateRange, setChartDateRange] = useState({ start: '', end: '' });
    const [useDateRange, setUseDateRange] = useState(false);
    
    // Separate state for second chart
    const [chart2Filter, setChart2Filter] = useState('day');
    const [chart2Date, setChart2Date] = useState('');
    const [chart2DateRange, setChart2DateRange] = useState({ start: '', end: '' });
    const [useDateRange2, setUseDateRange2] = useState(false);

    const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    // Broad dataset for charts (independent of table pagination/date filters)
    const [chartReports, setChartReports] = useState([]);
    const [chartDataLoading, setChartDataLoading] = useState(true);
    const [oeeData, setOeeData] = useState([]);

    // Compute display date labels for charts
    const chart1DateLabel = useMemo(() => {
        if ((useDateRange || chartFilter === 'week' || chartFilter === 'month') && chartDateRange.start && chartDateRange.end) {
            return `${chartDateRange.start} – ${chartDateRange.end}`;
        } else if (chartDate) {
            return chartDate;
        } else if (chartFilter === 'day') {
            return new Date().toISOString().split('T')[0];
        } else if (chartFilter === 'week') {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);
            return `${start.toISOString().split('T')[0]} – ${end.toISOString().split('T')[0]}`;
        } else if (chartFilter === 'month') {
            const end = new Date();
            const start = new Date();
            start.setMonth(end.getMonth() - 1);
            return `${start.toISOString().split('T')[0]} – ${end.toISOString().split('T')[0]}`;
        }
        return '';
    }, [chartFilter, chartDate, useDateRange, chartDateRange.start, chartDateRange.end]);

    const chart2DateLabel = useMemo(() => {
        if ((useDateRange2 || chart2Filter === 'week' || chart2Filter === 'month') && chart2DateRange.start && chart2DateRange.end) {
            return `${chart2DateRange.start} – ${chart2DateRange.end}`;
        } else if (chart2Date) {
            return chart2Date;
        } else if (chart2Filter === 'day') {
            return new Date().toISOString().split('T')[0];
        } else if (chart2Filter === 'week') {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);
            return `${start.toISOString().split('T')[0]} – ${end.toISOString().split('T')[0]}`;
        } else if (chart2Filter === 'month') {
            const end = new Date();
            const start = new Date();
            start.setMonth(end.getMonth() - 1);
            return `${start.toISOString().split('T')[0]} – ${end.toISOString().split('T')[0]}`;
        }
        return '';
    }, [chart2Filter, chart2Date, useDateRange2, chart2DateRange.start, chart2DateRange.end]);

    const bottlesByPetChartData = useMemo(() => {
        return chartReports;
    }, [chartReports]);

    // Fetch quality data - shift_pet_metrics for each date in range
    useEffect(() => {
        let cancelled = false;
        const fetchQuality = async () => {
            try {
                // Determine date range
                let start, end;
                if (useDateRange2 && chart2DateRange.start && chart2DateRange.end) {
                    start = chart2DateRange.start;
                    end = chart2DateRange.end;
                } else if (chart2Filter === 'week' || chart2Filter === 'month') {
                    if (chart2DateRange.start && chart2DateRange.end) {
                        start = chart2DateRange.start;
                        end = chart2DateRange.end;
                    } else if (chart2Filter === 'week') {
                        const e = new Date();
                        const s = new Date();
                        s.setDate(e.getDate() - 6);
                        start = s.toISOString().split('T')[0];
                        end = e.toISOString().split('T')[0];
                    } else {
                        const e = new Date();
                        const s = new Date();
                        s.setMonth(e.getMonth() - 1);
                        start = s.toISOString().split('T')[0];
                        end = e.toISOString().split('T')[0];
                    }
                } else if (chart2Date) {
                    start = chart2Date;
                    end = chart2Date;
                } else if (chart2Filter === 'day') {
                    const today = new Date().toISOString().split('T')[0];
                    start = today;
                    end = today;
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    start = today;
                    end = today;
                }

                // Generate dates
                const dates = [];
                let current = new Date(start);
                const endDate = new Date(end);
                while (current <= endDate) {
                    dates.push(current.toISOString().split('T')[0]);
                    current.setDate(current.getDate() + 1);
                }

                const results = await Promise.all(
                    dates.map(date =>
                        productionApi.getDashboardShiftPetMetrics({ date })
                            .then(res => {
                                const raw = res?.data?.data ?? res?.data ?? {};
                                return (Array.isArray(raw.pets) ? raw.pets : (Array.isArray(raw) ? raw : []))
                                    .filter(r => !r.pet_name?.toLowerCase().includes('can'));
                            })
                            .catch(() => [])
                    )
                );

                if (!cancelled) setOeeData(results.flat());
            } catch (err) {
                console.error('Failed to fetch quality data:', err);
            }
        };
        fetchQuality();
        return () => { cancelled = true; };
    }, [chart2Filter, chart2Date, useDateRange2, chart2DateRange.start, chart2DateRange.end]);

    const qualityChartData = useMemo(() => {
        const grouped = {};
        oeeData.forEach(entry => {
            const name = entry.pet_name;
            if (!name) return;
            // Use efficiency as the quality contribution metric
            const q = parseFloat(entry.efficiency) || parseFloat(entry.quality) || (entry.metrics?.quality ?? 0);
            if (!grouped[name]) grouped[name] = { total: 0, count: 0 };
            grouped[name].total += q;
            grouped[name].count += 1;
        });
        return Object.entries(grouped)
            .map(([name, { total, count }]) => ({
                name,
                quality: count > 0 ? total / count : 0
            }))
            .filter(p => p.quality > 0)
            .sort((a, b) => b.quality - a.quality);
    }, [oeeData]);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setRefreshing(true);
        try {
            const params = {
                status: filters.status,
                search: filters.search,
                pet: filters.pet,
                page: filters.page,
                page_size: filters.page_size
            };
            
            // Handle date filtering
            if (globalFilters.start_date && globalFilters.end_date) {
                params.datetime_start_time = `${globalFilters.start_date}T00:00:00Z`;
                params.datetime_end_time = `${globalFilters.end_date}T23:59:59Z`;
            } else if (filters.production_date) {
                params.production_date = filters.production_date;
            }
            
            const res = await productionApi.getReports(params);
            const responseData = res.data;
            let listData = [];
            let count = 0;
            let next = null;
            let previous = null;

            if (Array.isArray(responseData)) {
                listData = responseData;
                count = responseData.length;
            } else if (responseData.results && Array.isArray(responseData.results)) {
                listData = responseData.results;
                count = responseData.count || responseData.results.length;
                next = responseData.next;
                previous = responseData.previous;
            } else if (responseData.data && Array.isArray(responseData.data)) {
                listData = responseData.data;
                count = responseData.count || responseData.total || responseData.data.length;
                next = responseData.next;
                previous = responseData.previous;
            } else if (responseData.data?.results && Array.isArray(responseData.data.results)) {
                listData = responseData.data.results;
                count = responseData.data.count || responseData.data.results.length;
                next = responseData.data.next;
                previous = responseData.data.previous;
            }

            // Filter out canlines
            listData = listData.filter(r => !r.pet_name?.toLowerCase().includes('can'));

            // Sort by PET line number (Pet 1, Pet 2, Pet 3, ...)
            listData.sort((a, b) => {
                const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });

            setReports(listData);
            setTotalCount(count);
            setPaginationLinks({ next, previous });

            // Calculate stats
            const completed = listData.filter(r => r.status === 'COMPLETED' || r.status === 'APPROVED').length;
            const approved = listData.filter(r => r.status === 'APPROVED').length;
            const uniquePets = new Set(listData.map(r => r.pet_name).filter(Boolean));

            // Fetch summary + oee_date_range + stoppages for accurate stats
            const today = new Date().toISOString().split('T')[0];
            const oeeStart = globalFilters.start_date || filters.production_date || globalFilters.log_date || today;
            const oeeEnd = globalFilters.end_date || oeeStart;
            try {
                const summaryParams = { start_date: oeeStart, end_date: oeeEnd };
                if (filters.pet) summaryParams.pet = filters.pet;
                const [summaryRes, oeeRes, stoppagesRes] = await Promise.all([
                    productionApi.getProductionSummary(summaryParams),
                    productionApi.getOeeDateRange({ start_date: oeeStart, end_date: oeeEnd }),
                    productionApi.getStoppagesSummary({ production_date: oeeStart }),
                ]);

                const summaryEnvelope = summaryRes?.data?.data?.data ?? summaryRes?.data?.data ?? summaryRes?.data ?? {};
                const summaryTotalOutput = summaryEnvelope.summary?.total_bottles_produced || summaryEnvelope.total_bottles_produced || 0;

                const oeeRaw = oeeRes?.data?.data?.data ?? oeeRes?.data?.data ?? oeeRes?.data ?? {};
                const oeeEntries = typeof oeeRaw === 'object' && !Array.isArray(oeeRaw) ? Object.entries(oeeRaw) : [];

                let oeeTotalOutput = 0;
                let totalDowntime = 0;
                oeeEntries.forEach(([, val]) => {
                    oeeTotalOutput += val?.total_bottles_produced || val?.total_output || 0;
                    totalDowntime += val?.downtime || 0;
                });

                const totalOutput = summaryTotalOutput || oeeTotalOutput;

                // Stoppages count from stoppages_summary
                const stoppagesData = stoppagesRes?.data?.data ?? stoppagesRes?.data ?? {};
                const totalStoppages = stoppagesData?.count || (Array.isArray(stoppagesData?.data) ? stoppagesData.data.length : 0);

                setStats({
                    totalReports: count,
                    completedReports: completed,
                    totalOutput,
                    avgOutput: oeeEntries.length > 0 ? Math.round(totalOutput / oeeEntries.length) : 0,
                    activeLines: uniquePets.size,
                    totalStoppages,
                    totalDowntime: Math.round(totalDowntime),
                    approvalRate: listData.length > 0 ? Math.round((approved / listData.length) * 100) : 0
                });
            } catch (oeeErr) {
                console.error('Failed to fetch stats:', oeeErr);
                const totalOutput = listData.reduce((sum, r) => sum + (r.total_bottles_produced || 0), 0);
                setStats({
                    totalReports: count,
                    completedReports: completed,
                    totalOutput,
                    avgOutput: listData.length > 0 ? Math.round(totalOutput / listData.length) : 0,
                    activeLines: uniquePets.size,
                    totalStoppages: 0,
                    totalDowntime: 0,
                    approvalRate: listData.length > 0 ? Math.round((approved / listData.length) * 100) : 0
                });
            }

            // Fetch pets for dropdown if not already loaded
            if (pets.length === 0) {
                productionApi.getPets({ page_size: 100 })
                    .then(petsRes => {
                        const petsData = Array.isArray(petsRes.data) ? petsRes.data : petsRes.data?.results || [];
                        setPets(petsData.filter(pet => !pet.pet_name?.toLowerCase().includes('can')));
                    })
                    .catch(err => console.error('Failed to load pets:', err));
            }

        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, globalFilters.start_date, globalFilters.end_date, globalFilters.log_date]);

    useEffect(() => {
        // Debounce search — only fetch when filters explicitly change
        const timeoutId = setTimeout(() => {
            fetchReports();
        }, 500);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, globalFilters.start_date, globalFilters.end_date]);

    // Fetch broad dataset for charts from production_summary (Bottles by PET)
    const fetchChartData = useCallback(async () => {
        setChartDataLoading(true);
        try {
            let lineMap = {};

            // Helper to get date range
            const getDates = () => {
                if (useDateRange && chartDateRange.start && chartDateRange.end) {
                    return { start: chartDateRange.start, end: chartDateRange.end };
                } else if (chartFilter === 'week' || chartFilter === 'month') {
                    if (chartDateRange.start && chartDateRange.end) {
                        return { start: chartDateRange.start, end: chartDateRange.end };
                    }
                    if (chartFilter === 'week') {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(end.getDate() - 6);
                        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
                    }
                    const end = new Date();
                    const start = new Date();
                    start.setMonth(end.getMonth() - 1);
                    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
                } else if (chartDate) {
                    return { start: chartDate, end: chartDate };
                } else if (chartFilter === 'day') {
                    const today = new Date().toISOString().split('T')[0];
                    return { start: today, end: today };
                }
                return { start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] };
            };

            const { start, end } = getDates();

            const res = await productionApi.getProductionSummary({ start_date: start, end_date: end });
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            const dailyBreakdown = envelope.daily_breakdown || [];

            // Aggregate bottles per PET from production_summary daily_breakdown
            dailyBreakdown.forEach(day => {
                (day.pets || [])
                    .filter(p => !p.pet_name?.toLowerCase().includes('can'))
                    .forEach(p => {
                        const name = p.pet_name || 'Unknown';
                        if (!lineMap[name]) lineMap[name] = { name, bottles: 0, planned: 0, actual: 0 };
                        const bottles = p.total_bottles_produced || p.total_bottles || p.total_output || p.total_units || 0;
                        lineMap[name].bottles += bottles;
                        lineMap[name].actual += bottles;
                    });
            });

            setChartReports(Object.values(lineMap).sort((a, b) => {
                const aNum = parseInt(a.name?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.name?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            }));
        } catch (err) {
            console.error('Failed to fetch chart data:', err);
        } finally {
            setChartDataLoading(false);
        }
    }, [chartFilter, chartDate, useDateRange, chartDateRange.start, chartDateRange.end]);

    useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const handleDelete = (item) => {
        setReportToDelete(item);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!reportToDelete) return;
        setDeleting(true);
        try {
            await productionApi.deleteReport(reportToDelete.id);
            setDeleteModalOpen(false);
            setReportToDelete(null);
            fetchReports();
        } catch (error) {
            console.error("Failed to delete report:", error);
        } finally {
            setDeleting(false);
        }
    };

    const handleStatusChange = async (report, newStatus) => {
        try {
            await productionApi.updateStatus(report.id, newStatus);
            fetchReports(); // Refresh
        } catch (error) {
            console.error('Failed to update status', error);
        }
    };

    const handleSearch = (e) => {
        setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
    };

    const STATUS_BADGES = {
        STARTED: 'badge bg-soft-info text-info',
        COMPLETED: 'badge bg-soft-success text-success',
        APPROVED: 'badge bg-soft-purple text-purple',
        DECLINED: 'badge bg-soft-danger text-danger',
        INCOMPLETE: 'badge bg-soft-warning text-warning',
        IDLE: 'badge bg-soft-secondary text-secondary',
    };

    const totalPages = Math.ceil(totalCount / filters.page_size);

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2" style={{
                animation: 'fadeInDown 0.5s ease-out'
            }}>
                <div className="d-flex align-items-center gap-2">
                    <h4 className="mb-0">Production Reports</h4>
                    {refreshing && (
                        <span className="spinner-border spinner-border-sm text-primary" role="status" />
                    )}
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button 
                        onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setFilters(prev => ({ ...prev, production_date: today, page: 1 }));
                            updateFilters({ log_date: today, start_date: null, end_date: null });
                        }}
                        className={`btn btn-sm ${filters.production_date === new Date().toISOString().split('T')[0] ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        <i className="ti ti-calendar-today me-1"></i>Current
                    </button>
                    <button 
                        onClick={() => {
                            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                            setFilters(prev => ({ ...prev, production_date: yesterday, page: 1 }));
                            updateFilters({ log_date: yesterday, start_date: null, end_date: null });
                        }}
                        className={`btn btn-sm ${filters.production_date === new Date(Date.now() - 86400000).toISOString().split('T')[0] ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        <i className="ti ti-calendar-minus me-1"></i>Previous Day
                    </button>
                    <button 
                        onClick={() => {
                            const endDate = new Date().toISOString().split('T')[0];
                            const startDate = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
                            setFilters(prev => ({ ...prev, production_date: '', page: 1 }));
                            updateFilters({ start_date: startDate, end_date: endDate, log_date: null });
                        }}
                        className={`btn btn-sm ${globalFilters.start_date && globalFilters.end_date ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        <i className="ti ti-calendar-week me-1"></i>Week
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard/production/new')}>
                        <i className="ti ti-plus me-2"></i>Create New Report
                    </button>
                </div>
            </div>

            {/* Top Filters - Date and PET */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.5s ease-out 0.05s both' }}>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-3">
                            <div className="d-flex align-items-center gap-2 mb-2">
                                <label className="form-label fw-medium mb-0">Production Date</label>
                                <div className="form-check form-switch">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={globalFilters.start_date && globalFilters.end_date}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const endDate = new Date().toISOString().split('T')[0];
                                                const startDate = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
                                                updateFilters({ start_date: startDate, end_date: endDate, log_date: null });
                                                setFilters(prev => ({ ...prev, production_date: '' }));
                                            } else {
                                                updateFilters({ start_date: null, end_date: null });
                                            }
                                        }}
                                    />
                                    <label className="form-check-label small">Range</label>
                                </div>
                            </div>
                            {!(globalFilters.start_date && globalFilters.end_date) ? (
                                <input
                                    type="date"
                                    className="form-control"
                                    value={filters.production_date}
                                    onChange={(e) => setFilters(prev => ({ ...prev, production_date: e.target.value, page: 1 }))}
                                />
                            ) : (
                                <div className="d-flex gap-2">
                                    <input
                                        type="date"
                                        className="form-control"
                                        placeholder="Start"
                                        value={globalFilters.start_date || ''}
                                        onChange={(e) => updateFilters({ start_date: e.target.value })}
                                    />
                                    <input
                                        type="date"
                                        className="form-control"
                                        placeholder="End"
                                        value={globalFilters.end_date || ''}
                                        onChange={(e) => updateFilters({ end_date: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="col-md-3">
                            <label className="form-label fw-medium">PET Line</label>
                            <select
                                className="form-select"
                                value={filters.pet}
                                onChange={(e) => setFilters(prev => ({ ...prev, pet: e.target.value, page: 1 }))}
                            >
                                <option value="">All Lines</option>
                                {pets.sort((a, b) => {
                                    const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                                    const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                                    return aNum - bNum;
                                }).map(pet => (
                                    <option key={pet.id} value={pet.id}>{pet.pet_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-primary w-100" onClick={fetchReports}>
                                <i className={`ti ti-filter${loading ? ' spin' : ''} me-2`}></i>Apply Filter
                            </button>
                        </div>
                        <div className="col-md-2">
                            <button 
                                className="btn btn-outline-secondary w-100" 
                                onClick={() => setFilters({ production_date: '', status: '', search: '', pet: '', page: 1, page_size: 15 })}
                            >
                                <i className="ti ti-x me-2"></i>Clear All
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Horizontal Layout */}
            {loading ? <SkeletonStatCards count={4} /> : (
            <div className="row row-gap-3 mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>

                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Completed</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.completedReports}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-success border border-success">
                                    <i className="ti ti-check fs-16 text-success"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Total Output</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.totalOutput.toLocaleString()}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-info border border-info">
                                    <i className="ti ti-bottle fs-16 text-info"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Total Stoppages</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : stats.totalStoppages}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-warning border border-warning">
                                    <i className="ti ti-alert-triangle fs-16 text-warning"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xl-3 col-sm-6">
                    <div className="card mb-0">
                        <div className="card-body">
                            <div className="d-flex align-items-start justify-content-between">
                                <div>
                                    <p className="fs-14 mb-1">Total Downtime</p>
                                    <h2 className="mb-1 fs-16">{loading ? '...' : `${stats.totalDowntime} min`}</h2>
                                </div>
                                <span className="avatar avatar-md rounded-circle bg-soft-danger border border-danger">
                                    <i className="ti ti-clock-pause fs-16 text-danger"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Pie Charts Row */}
            {chartDataLoading ? (
                <div className="row mb-4">
                    <div className="col-lg-6"><SkeletonDonut /></div>
                    <div className="col-lg-6"><SkeletonDonut /></div>
                </div>
            ) : (
            <div className="row mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.25s both' }}>
                <div className="col-lg-6">
                    <div className="card">
                        <div className="card-header">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <div>
                                    <h6 className="mb-0">Bottles by PET</h6>
                                    <small className="text-muted">Production distribution across lines</small>
                                    {chart1DateLabel && <span className="badge bg-soft-primary text-primary fs-11 ms-1">{chart1DateLabel}</span>}
                                </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-between gap-3">
                                {/* Date inputs on left */}
                                <div className="flex-grow-1">
                                    <div className="row g-2">
                                        <div className="col-12">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="form-check form-switch">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="dateRangeToggle1"
                                                        checked={useDateRange}
                                                        onChange={(e) => setUseDateRange(e.target.checked)}
                                                    />
                                                    <label className="form-check-label" htmlFor="dateRangeToggle1">
                                                        Date Range
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        {!useDateRange && chartFilter !== 'week' && chartFilter !== 'month' ? (
                                            <div className="col-12">
                                                <input 
                                                    type="date" 
                                                    className="form-control form-control-sm"
                                                    value={chartDate}
                                                    onChange={(e) => setChartDate(e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="col-6">
                                                    <input 
                                                        type="date" 
                                                        className="form-control form-control-sm"
                                                        value={chartDateRange.start}
                                                        onChange={(e) => setChartDateRange({...chartDateRange, start: e.target.value})}
                                                    />
                                                </div>
                                                <div className="col-6">
                                                    <input 
                                                        type="date" 
                                                        className="form-control form-control-sm"
                                                        value={chartDateRange.end}
                                                        onChange={(e) => setChartDateRange({...chartDateRange, end: e.target.value})}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* Buttons on right */}
                                <div className="btn-group btn-sm" role="group" style={{ whiteSpace: 'nowrap' }}>
                                    <button 
                                        type="button" 
                                        className={`btn ${chartFilter === 'day' ? 'btn-danger' : 'btn-light border'}`}
                                        onClick={() => setChartFilter('day')}
                                    >
                                        Day
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`btn ${chartFilter === 'week' ? 'btn-danger' : 'btn-light border'}`}
                                        onClick={() => {
                                            setChartFilter('week');
                                            setChartDate('');
                                            const end = new Date();
                                            const start = new Date();
                                            start.setDate(end.getDate() - 6);
                                            setChartDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
                                        }}
                                    >
                                        Week
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`btn ${chartFilter === 'month' ? 'btn-danger' : 'btn-light border'}`}
                                        onClick={() => {
                                            setChartFilter('month');
                                            setChartDate('');
                                            const end = new Date();
                                            const start = new Date();
                                            start.setMonth(end.getMonth() - 1);
                                            setChartDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
                                        }}
                                    >
                                        Month
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {loading || bottlesByPetChartData.length === 0 ? (
                                <p className="text-center text-muted py-5 mb-0">No data</p>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={bottlesByPetChartData} cx="50%" cy="50%" outerRadius={90}
                                                paddingAngle={2} dataKey="bottles" 
                                                label={(entry) => entry.bottles > 0 ? `${entry.name}: ${(entry.bottles || 0).toLocaleString()}` : entry.name}>
                                                {bottlesByPetChartData.map((entry, idx) => (
                                                    <Cell key={entry.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => [v.toLocaleString() + ' bottles', 'Production']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-3">
                                        {bottlesByPetChartData.map((l, idx) => {
                                            const total = bottlesByPetChartData.reduce((s, t) => s + t.bottles, 0);
                                            const pct = total > 0 ? ((l.bottles / total) * 100).toFixed(1) : 0;
                                            return (
                                                <div key={l.name} className="d-flex align-items-center justify-content-between mb-2">
                                                    <p className="f-14 fw-medium text-dark mb-0">
                                                        <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                        {l.name}
                                                    </p>
                                                    <p className="f-14 fw-medium text-dark mb-0">{pct}% ({l.bottles.toLocaleString()})</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-lg-6">
                    <div className="card">
                        <div className="card-header">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <div>
                                    <h6 className="mb-0">PET Contribution to Quality</h6>
                                    <small className="text-muted">Quality performance by line</small>
                                    {chart2DateLabel && <span className="badge bg-soft-primary text-primary fs-11 ms-1">{chart2DateLabel}</span>}
                                </div>
                            </div>
                            <div className="d-flex align-items-center justify-content-between gap-3">
                                {/* Date inputs on left */}
                                <div className="flex-grow-1">
                                    <div className="row g-2">
                                        <div className="col-12">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="form-check form-switch">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="dateRangeToggle2"
                                                        checked={useDateRange2}
                                                        onChange={(e) => setUseDateRange2(e.target.checked)}
                                                    />
                                                    <label className="form-check-label" htmlFor="dateRangeToggle2">
                                                        Date Range
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        {!useDateRange2 && chart2Filter !== 'week' && chart2Filter !== 'month' ? (
                                            <div className="col-12">
                                                <input 
                                                    type="date" 
                                                    className="form-control form-control-sm"
                                                    value={chart2Date}
                                                    onChange={(e) => setChart2Date(e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="col-6">
                                                    <input 
                                                        type="date" 
                                                        className="form-control form-control-sm"
                                                        value={chart2DateRange.start}
                                                        onChange={(e) => setChart2DateRange({...chart2DateRange, start: e.target.value})}
                                                    />
                                                </div>
                                                <div className="col-6">
                                                    <input 
                                                        type="date" 
                                                        className="form-control form-control-sm"
                                                        value={chart2DateRange.end}
                                                        onChange={(e) => setChart2DateRange({...chart2DateRange, end: e.target.value})}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* Buttons on right */}
                                <div className="btn-group btn-sm" role="group" style={{ whiteSpace: 'nowrap' }}>
                                    <button 
                                        type="button" 
                                        className={`btn ${chart2Filter === 'day' ? 'btn-danger' : 'btn-light border'}`}
                                        onClick={() => setChart2Filter('day')}
                                    >
                                        Day
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`btn ${chart2Filter === 'week' ? 'btn-danger' : 'btn-light border'}`}
                                        onClick={() => {
                                            setChart2Filter('week');
                                            setChart2Date('');
                                            const end = new Date();
                                            const start = new Date();
                                            start.setDate(end.getDate() - 6);
                                            setChart2DateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
                                        }}
                                    >
                                        Week
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`btn ${chart2Filter === 'month' ? 'btn-danger' : 'btn-light border'}`}
                                        onClick={() => {
                                            setChart2Filter('month');
                                            setChart2Date('');
                                            const end = new Date();
                                            const start = new Date();
                                            start.setMonth(end.getMonth() - 1);
                                            setChart2DateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
                                        }}
                                    >
                                        Month
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {loading || qualityChartData.length === 0 ? (
                                <p className="text-center text-muted py-5 mb-0">No data</p>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie 
                                                data={qualityChartData}
                                                cx="50%" cy="50%" outerRadius={90}
                                                paddingAngle={2} dataKey="quality" 
                                                label={(entry) => `${entry.name}: ${entry.quality.toFixed(1)}%`}>
                                                {qualityChartData.map((entry, idx) => (
                                                    <Cell key={entry.name} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Quality']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-3">
                                        {qualityChartData.map((l, idx) => {
                                            const qualityBadge = l.quality >= 95 ? 'success' : l.quality >= 85 ? 'warning' : 'danger';
                                            return (
                                                <div key={l.name} className="d-flex align-items-center justify-content-between mb-2">
                                                    <p className="f-14 fw-medium text-dark mb-0">
                                                        <i className="ti ti-circle-filled me-1" style={{ color: DONUT_COLORS[idx % DONUT_COLORS.length], fontSize: 8 }}></i>
                                                        {l.name}
                                                    </p>
                                                    <span className={`badge bg-soft-${qualityBadge} text-${qualityBadge} fs-10`}>
                                                        {l.quality.toFixed(1)}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Additional Filters */}
            <div className="card mb-4" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-5">
                            <label className="form-label">Search</label>
                            <div className="input-group">
                                <span className="input-group-text"><i className="ti ti-search"></i></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Search by report code..."
                                    value={filters.search}
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Status</label>
                            <select
                                className="form-select"
                                value={filters.status}
                                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                            >
                                <option value="">All Statuses</option>
                                {['STARTED', 'COMPLETED', 'APPROVED', 'DECLINED', 'INCOMPLETE', 'IDLE'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                            <button className="btn btn-outline-secondary w-100" onClick={fetchReports}>
                                <i className={`ti ti-refresh${loading ? ' spin' : ''} me-2`}></i>Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="card" style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}>
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">All Reports ({totalCount})</h6>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="ti ti-file-off fs-1 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-0">No reports found</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Code</th>
                                        <th>Date</th>
                                        <th>PET Line</th>
                                        <th>Shift</th>
                                        <th>Output</th>
                                        <th>Packs/Pallet</th>
                                        <th>Status</th>
                                        <th className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row, idx) => (
                                        <tr key={row.id} style={{
                                            animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both`,
                                            cursor: 'pointer'
                                        }} onClick={() => navigate(`/dashboard/production/${row.id}`)}>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="avatar avatar-sm bg-soft-primary text-primary">
                                                        <i className="ti ti-file-text"></i>
                                                    </span>
                                                    <span className="fw-medium">{row.report_code}</span>
                                                </div>
                                            </td>
                                            <td>{format(new Date(row.production_date), 'MMM dd, yyyy')}</td>
                                            <td>{row.pet_name || '-'}</td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {row.shift_name}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-success fw-medium">
                                                    <i className="ti ti-trending-up me-1"></i>
                                                    {row.total_bottles_produced?.toLocaleString() || 0}
                                                </span>
                                            </td>
                                            <td>{row.packs_per_pallet || '-'}</td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <select
                                                    value={row.status || 'STARTED'}
                                                    onChange={(e) => handleStatusChange(row, e.target.value)}
                                                    className={`form-select form-select-sm ${STATUS_BADGES[row.status || 'STARTED']}`}
                                                    style={{ width: 'auto', cursor: 'pointer' }}
                                                >
                                                    {['STARTED', 'COMPLETED', 'APPROVED', 'DECLINED', 'INCOMPLETE', 'IDLE'].map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                                <div className="d-flex gap-2 justify-content-end">
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-primary"
                                                        onClick={() => navigate(`/dashboard/production/${row.id}`)}
                                                        title="View"
                                                    >
                                                        <i className="ti ti-eye"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-info"
                                                        onClick={() => navigate(`/dashboard/production/${row.id}/edit`)}
                                                        title="Edit"
                                                    >
                                                        <i className="ti ti-edit"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-icon btn-outline-danger"
                                                        onClick={() => handleDelete(row)}
                                                        title="Delete"
                                                    >
                                                        <i className="ti ti-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="card-footer d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <p className="mb-0 text-muted">
                            Showing {((filters.page - 1) * filters.page_size) + 1} to {Math.min(filters.page * filters.page_size, totalCount)} of {totalCount} entries
                        </p>
                        <div className="d-flex align-items-center gap-1">
                            <label className="text-muted small mb-0">Per page</label>
                            <select
                                className="form-select form-select-sm"
                                style={{ width: 'auto' }}
                                value={filters.page_size}
                                onChange={(e) => setFilters(prev => ({ ...prev, page_size: Number(e.target.value), page: 1 }))}
                            >
                                {[5, 10, 15, 25, 50].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <nav>
                        <ul className="pagination mb-0">
                            <li className={`page-item ${!paginationLinks.previous ? 'disabled' : ''}`}>
                                <button className="page-link" onClick={() => handlePageChange(filters.page - 1)} disabled={!paginationLinks.previous}>
                                    <i className="ti ti-chevron-left"></i>
                                </button>
                            </li>
                            {[...Array(totalPages)].map((_, i) => {
                                const pageNum = i + 1;
                                const startPage = Math.max(1, Math.min(filters.page - 2, totalPages - 4));
                                const endPage = Math.min(totalPages, startPage + 4);
                                if (pageNum < startPage || pageNum > endPage) return null;
                                return (
                                    <li key={pageNum} className={`page-item ${filters.page === pageNum ? 'active' : ''}`}>
                                        <button className="page-link" onClick={() => handlePageChange(pageNum)}>
                                            {pageNum}
                                        </button>
                                    </li>
                                );
                            })}
                            <li className={`page-item ${!paginationLinks.next ? 'disabled' : ''}`}>
                                <button className="page-link" onClick={() => handlePageChange(filters.page + 1)} disabled={!paginationLinks.next}>
                                    <i className="ti ti-chevron-right"></i>
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="modal fade show d-block" style={{ 
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setDeleteModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()} style={{
                        animation: 'shake 0.5s ease-out'
                    }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Delete Report</h5>
                                <button type="button" className="btn-close" onClick={() => setDeleteModalOpen(false)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-0">Are you sure you want to delete this report? This action cannot be undone.</p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
                                <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                                    {deleting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="ti ti-trash me-2"></i>Delete Report
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductionList;
