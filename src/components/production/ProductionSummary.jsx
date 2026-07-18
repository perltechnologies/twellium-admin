import React, { useState, useMemo, lazy, Suspense, useEffect, useRef } from 'react';
import { useFilters } from '../../context/FilterContext';
import { productionApi } from '../../api/production';

const ReactApexChart = lazy(() => import('react-apexcharts'));

// Helper: map API daily_breakdown to flat records
const mapBreakdownToRecords = (dailyBreakdown) => {
    const records = [];
    dailyBreakdown.forEach(day => {
        const petList = (day.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can'));
        if (petList.length > 0) {
            petList.forEach(p => {
                records.push({
                    production_date: day.date,
                    pet_name: p.pet_name || 'Unknown',
                    oee: p.oee || 0,
                    efficiency: p.efficiency || 0,
                    availability: p.availability || 0,
                    performance: p.performance || 0,
                    quality: p.quality || 0,
                    total_bottles_produced: p.total_bottles_produced || 0,
                    metrics: {
                        oee: p.oee || 0,
                        availability: p.availability || 0,
                        performance: p.performance || 0,
                        quality: p.quality || 0,
                        details: {
                            total_output_pcs: p.total_bottles_produced || 0,
                            total_downtime_mins: p.total_downtime_minutes || 0,
                            planned_downtime_mins: p.planned_downtime_mins || 0,
                            mechanical_downtime_mins: p.mechanical_downtime_mins || 0,
                        }
                    }
                });
            });
        } else {
            records.push({
                production_date: day.date,
                pet_name: 'All',
                oee: day.oee || 0,
                efficiency: day.avg_efficiency || 0,
                availability: day.avg_availability || 0,
                performance: day.avg_performance || 0,
                quality: day.avg_quality || 0,
                total_bottles_produced: day.total_bottles_produced || 0,
                metrics: {
                    oee: day.oee || 0,
                    availability: day.avg_availability || 0,
                    performance: day.avg_performance || 0,
                    quality: day.avg_quality || 0,
                    details: {
                        total_output_pcs: day.total_bottles_produced || 0,
                        total_downtime_mins: day.total_downtime_minutes || 0,
                        planned_downtime_mins: day.planned_downtime_mins || 0,
                        mechanical_downtime_mins: day.mechanical_downtime_mins || 0,
                    }
                }
            });
        }
    });
    return records;
};

const ProductionSummary = ({ reports = [], loading = false, pets = [], shiftInfo = null, shiftDate = '' }) => {
    const { filters } = useFilters();
    const selectedPet = filters.pet || '';

    // ── Summary Stats: own state ──
    const [summaryPeriod, setSummaryPeriod] = useState('today');
    const [summaryStartDate, setSummaryStartDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [summaryEndDate, setSummaryEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [summaryReports, setSummaryReports] = useState([]);
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const summaryAbortRef = useRef(null);

    // ── Chart: own state ──
    const [chartPeriod, setChartPeriod] = useState('week');
    const [chartStartDate, setChartStartDate] = useState(() => {
        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        return start.toISOString().split('T')[0];
    });
    const [chartEndDate, setChartEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [chartReports, setChartReports] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);
    const chartAbortRef = useRef(null);

    // Fetch data for Summary Stats
    useEffect(() => {
        if (!summaryStartDate || !summaryEndDate) return;
        if (summaryAbortRef.current) summaryAbortRef.current.abort();
        const controller = new AbortController();
        summaryAbortRef.current = controller;

        const fetchData = async () => {
            setSummaryLoading(true);
            setSummaryReports([]);
            setSummaryData(null);
            try {
                const res = await productionApi.getProductionSummary({ start_date: summaryStartDate, end_date: summaryEndDate });
                if (controller.signal.aborted) return;
                const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
                if (!controller.signal.aborted) {
                    setSummaryData(envelope.summary || null);
                    setSummaryReports(mapBreakdownToRecords(envelope.daily_breakdown || []));
                }
            } catch (error) {
                if (error?.name === 'CanceledError' || error?.name === 'AbortError') return;
                console.error('Error fetching summary data:', error);
                if (!controller.signal.aborted) { setSummaryReports([]); setSummaryData(null); }
            } finally {
                if (!controller.signal.aborted) setSummaryLoading(false);
            }
        };
        fetchData();
        return () => { controller.abort(); };
    }, [summaryStartDate, summaryEndDate]);

    // Fetch data for Chart
    useEffect(() => {
        if (!chartStartDate || !chartEndDate) return;
        if (chartAbortRef.current) chartAbortRef.current.abort();
        const controller = new AbortController();
        chartAbortRef.current = controller;

        const fetchData = async () => {
            setChartLoading(true);
            setChartReports([]);
            try {
                const res = await productionApi.getProductionSummary({ start_date: chartStartDate, end_date: chartEndDate });
                if (controller.signal.aborted) return;
                const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
                const records = mapBreakdownToRecords(envelope.daily_breakdown || []);
                if (!controller.signal.aborted) setChartReports(records);
            } catch (error) {
                if (error?.name === 'CanceledError' || error?.name === 'AbortError') return;
                console.error('Error fetching chart data:', error);
                if (!controller.signal.aborted) setChartReports([]);
            } finally {
                if (!controller.signal.aborted) setChartLoading(false);
            }
        };
        fetchData();
        return () => { controller.abort(); };
    }, [chartStartDate, chartEndDate]);

    const chartData = useMemo(() => {
        let filtered = chartReports;

        // Filter by PET
        if (selectedPet) {
            const selectedPetName = pets.find(p => p.id === parseInt(selectedPet))?.pet_name;
            if (selectedPetName) {
                filtered = filtered.filter(r => r.pet_name === selectedPetName);
            }
        }

        // Generate date range
        const dates = [];
        const firstDay = new Date(chartStartDate || new Date());
        const lastDay = new Date(chartEndDate || new Date());
        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d).toISOString().split('T')[0]);
        }

        // Dates from today onward should not plot values
        const today = new Date().toISOString().split('T')[0];

        // Group by date
        const grouped = {};
        filtered.forEach(r => {
            const date = r.production_date || r.log_date || '';
            if (!grouped[date]) grouped[date] = {};

            const rawName = (r.pet_name || 'Unknown').toLowerCase().trim();
            const petNum = rawName.match(/pet\s*(\d+)/);
            const petName = petNum ? `Pet ${petNum[1]}` : rawName.replace(/\b\w/g, c => c.toUpperCase());
            
            if (!grouped[date][petName]) {
                grouped[date][petName] = { oee: 0, count: 0 };
            }
            grouped[date][petName].oee += r.metrics?.oee || parseFloat(r.efficiency) || r.oee || 0;
            grouped[date][petName].count += 1;
        });

        // Include all available PETs (from props), plus any discovered in data
        const discoveredPets = new Set();
        Object.values(grouped).forEach(dateGroup => {
            Object.keys(dateGroup).forEach(pet => discoveredPets.add(pet));
        });
        const propPetNames = (pets || [])
            .filter(p => !(p.pet_name || '').toLowerCase().includes('can'))
            .map(p => {
            const raw = (p.pet_name || '').toLowerCase().trim();
            const num = raw.match(/pet\s*(\d+)/);
            return num ? `Pet ${num[1]}` : raw.replace(/\b\w/g, c => c.toUpperCase());
        }).filter(Boolean);
        const allPets = Array.from(new Set([...propPetNames, ...discoveredPets]))
            .filter(name => !name.toLowerCase().includes('can'))
            .sort((a, b) => {
            const aNum = parseInt(a.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
        const petList = allPets.length > 0 ? allPets : ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];

        const series = petList.map(pet => ({
            name: pet,
            data: dates.map(date => {
                if (date > today) return null;
                const data = grouped[date]?.[pet];
                return data ? parseFloat((data.oee / data.count).toFixed(1)) : 0;
            })
        }));

        return { dates, series };
    }, [chartReports, chartStartDate, chartEndDate, selectedPet, pets]);

    const summary = useMemo(() => {
        const s = summaryData || {};
        return {
            totalProduction: s.total_bottles_produced || s.total_output || 0,
            totalBottles: s.total_bottles || 0,
            avgOee: s.oee || s.avg_efficiency || 0,
            totalDowntime: s.total_downtime_minutes || 0,
            plannedDowntime: s.planned_downtime_mins || 0,
            mechDowntime: s.mechanical_downtime_mins || 0,
            reports: s.total_reports || 0,
            avgPerformance: s.avg_performance || 0,
            avgAvailability: s.avg_availability || 0,
            avgQuality: s.avg_quality || 0,
            targetMet: s.target_met_count || 0,
            totalStoppageReports: s.total_stoppage_reports || 0,
        };
    }, [summaryData]);

    const hasActiveFilter = !!(chartStartDate || chartEndDate || selectedPet);

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-3 pb-0">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <div>
                        <h6 className="mb-0 fw-semibold">Production Summary</h6>
                        <small className="text-muted">Efficiency trends and multi-line comparison</small>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <input
                            type="date"
                            className="form-control form-control-sm"
                            value={summaryStartDate}
                            onChange={(e) => setSummaryStartDate(e.target.value)}
                            style={{ width: 130, fontSize: '0.75rem' }}
                        />
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>to</span>
                        <input
                            type="date"
                            className="form-control form-control-sm"
                            value={summaryEndDate}
                            onChange={(e) => setSummaryEndDate(e.target.value)}
                            style={{ width: 130, fontSize: '0.75rem' }}
                        />
                        <div className="btn-group">
                            <button
                                className={`btn btn-sm ${summaryPeriod === 'today' ? 'btn-primary' : 'btn-outline-primary'}`}
                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                onClick={() => {
                                    setSummaryPeriod('today');
                                    const today = new Date().toISOString().split('T')[0];
                                    setSummaryStartDate(today);
                                    setSummaryEndDate(today);
                                }}
                            >Today</button>
                            <button
                                className={`btn btn-sm ${summaryPeriod === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                onClick={() => {
                                    setSummaryPeriod('week');
                                    const today = new Date();
                                    const start = new Date(today);
                                    start.setDate(today.getDate() - 6);
                                    setSummaryStartDate(start.toISOString().split('T')[0]);
                                    setSummaryEndDate(today.toISOString().split('T')[0]);
                                }}
                            >Week</button>
                            <button
                                className={`btn btn-sm ${summaryPeriod === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                onClick={() => {
                                    setSummaryPeriod('month');
                                    const today = new Date();
                                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                    setSummaryStartDate(firstDay.toISOString().split('T')[0]);
                                    setSummaryEndDate(lastDay.toISOString().split('T')[0]);
                                }}
                            >Month</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="card-body">

                {/* Summary Stats */}
                <div className={`position-relative${summaryLoading ? ' opacity-50' : ''}`} style={{ transition: 'opacity 0.2s' }}>
                {summaryLoading && (
                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 10 }}>
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                )}
                <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-2 mb-2">
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-primary h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="bg-primary rounded-circle p-2">
                                        <i className="ti ti-bottle text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Total Output</small>
                                <h6 className="mb-0 text-primary fw-bold">{(summary.totalProduction || summary.totalBottles).toLocaleString()}</h6>
                                <small className="text-muted fs-11">{summary.totalProduction ? 'pcs' : 'bottles (live)'}</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-success h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="bg-success rounded-circle p-2">
                                        <i className="ti ti-chart-pie text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Avg Efficiency</small>
                                <h6 className="mb-0 text-success fw-bold">{summary.avgOee.toFixed(1)}%</h6>
                                <small className="text-muted fs-11">efficiency</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-danger h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="bg-danger rounded-circle p-2">
                                        <i className="ti ti-clock-pause text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Total Downtime</small>
                                <h6 className="mb-0 text-danger fw-bold">{Math.round(summary.totalDowntime)}m</h6>
                                <small className="text-muted fs-11">{Math.round(summary.totalDowntime / 60)}h {Math.round(summary.totalDowntime % 60)}m</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-info h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="bg-info rounded-circle p-2">
                                        <i className="ti ti-file-analytics text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Reports</small>
                                <h6 className="mb-0 text-info fw-bold">{summary.reports}</h6>
                                <small className="text-muted fs-11">in period</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="row row-cols-1 row-cols-sm-2 row-cols-md-5 g-2 mb-4">
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-purple h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="rounded-circle p-2" style={{backgroundColor: '#8b5cf6'}}>
                                        <i className="ti ti-gauge-filled text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Performance</small>
                                <h6 className="mb-0 fw-bold" style={{color: '#8b5cf6'}}>{summary.avgPerformance.toFixed(1)}%</h6>
                                <small className="text-muted fs-11">rate</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-teal h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="rounded-circle p-2" style={{backgroundColor: '#06b6d4'}}>
                                        <i className="ti ti-activity text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Availability</small>
                                <h6 className="mb-0 fw-bold" style={{color: '#06b6d4'}}>{summary.avgAvailability.toFixed(1)}%</h6>
                                <small className="text-muted fs-11">uptime</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-indigo h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="rounded-circle p-2" style={{backgroundColor: '#4f46e5'}}>
                                        <i className="ti ti-award text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Quality</small>
                                <h6 className="mb-0 fw-bold" style={{color: '#4f46e5'}}>{summary.avgQuality.toFixed(1)}%</h6>
                                <small className="text-muted fs-11">rate</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-warning h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="bg-warning rounded-circle p-2">
                                        <i className="ti ti-calendar-time text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Planned Downtime</small>
                                <h6 className="mb-0 text-warning fw-bold">{Math.round(summary.plannedDowntime)}m</h6>
                                <small className="text-muted fs-11">{Math.round(summary.plannedDowntime / 60)}h {Math.round(summary.plannedDowntime % 60)}m</small>
                            </div>
                        </div>
                    </div>
                    <div className="col">
                        <div className="card production-summary-stat-card border-0 shadow-sm bg-soft-secondary h-100">
                            <div className="card-body text-center py-2 px-2">
                                <div className="d-flex align-items-center justify-content-center mb-2">
                                    <div className="bg-secondary rounded-circle p-2">
                                        <i className="ti ti-tool text-white fs-5"></i>
                                    </div>
                                </div>
                                <small className="text-muted d-block fs-11 text-uppercase fw-semibold mb-1">Mech Downtime</small>
                                <h6 className="mb-0 text-secondary fw-bold">{Math.round(summary.mechDowntime)}m</h6>
                                <small className="text-muted fs-11">{Math.round(summary.mechDowntime / 60)}h {Math.round(summary.mechDowntime % 60)}m</small>
                            </div>
                        </div>
                    </div>
                </div>
                </div>{/* end loading wrapper */}

                {/* Chart */}
                {chartLoading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                ) : chartData.series.length === 0 || chartData.dates.length === 0 ? (
                    <div className="text-center text-muted py-5">
                        <i className="ti ti-chart-line fs-1 mb-3 d-block"></i>
                        <p className="mb-0">No data available for the selected period</p>
                        <small>Try adjusting the date filters or period selection</small>
                    </div>
                ) : (
                    <Suspense fallback={
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }>
                        <div className="border rounded p-3 bg-soft-light">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                <h6 className="fw-semibold mb-0" style={{ fontSize: '0.875rem', color: '#374151' }}>OEE by Production Line</h6>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={chartStartDate}
                                        onChange={(e) => setChartStartDate(e.target.value)}
                                        style={{ width: 130, fontSize: '0.75rem' }}
                                    />
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>to</span>
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={chartEndDate}
                                        onChange={(e) => setChartEndDate(e.target.value)}
                                        style={{ width: 130, fontSize: '0.75rem' }}
                                    />
                                    <div className="btn-group">
                                        <button
                                            className={`btn btn-sm ${chartPeriod === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                            onClick={() => {
                                                setChartPeriod('week');
                                                const today = new Date();
                                                const start = new Date(today);
                                                start.setDate(today.getDate() - 6);
                                                setChartStartDate(start.toISOString().split('T')[0]);
                                                setChartEndDate(today.toISOString().split('T')[0]);
                                            }}
                                        >Week</button>
                                        <button
                                            className={`btn btn-sm ${chartPeriod === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                            onClick={() => {
                                                setChartPeriod('month');
                                                const today = new Date();
                                                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                                setChartStartDate(firstDay.toISOString().split('T')[0]);
                                                setChartEndDate(lastDay.toISOString().split('T')[0]);
                                            }}
                                        >Month</button>
                                    </div>
                                </div>
                            </div>
                            <ReactApexChart
                                options={{
                                    chart: {
                                        type: 'line',
                                        height: 350,
                                        toolbar: { show: false },
                                        zoom: { enabled: false },
                                        animations: { enabled: true, easing: 'easeinout', speed: 800 }
                                    },
                                    stroke: { curve: 'smooth', width: 3 },
                                    xaxis: {
                                        categories: chartData.dates,
                                        labels: { 
                                            rotate: -45, 
                                            style: { fontSize: 11 },
                                            formatter: (val) => {
                                                if (chartPeriod === 'week') {
                                                    const d = new Date(val);
                                                    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
                                                    return `${d.getMonth() + 1}/${d.getDate()}\n${day}`;
                                                }
                                                return val;
                                            }
                                        },
                                        tooltip: { enabled: false },
                                        axisBorder: { show: false },
                                        axisTicks: { show: false }
                                    },
                                    yaxis: {
                                        title: { text: 'OEE (%)', style: { fontSize: 11, color: '#6c757d' } },
                                        min: 0,
                                        max: 100,
                                        labels: { 
                                            formatter: (val) => val ? val.toFixed(0) + '%' : '0%',
                                            style: { fontSize: 11 }
                                        }
                                    },
                                    markers: { size: 5, hover: { size: 7 }, strokeColors: '#fff', strokeWidth: 2 },
                                    legend: { 
                                        position: 'top', 
                                        horizontalAlign: 'right',
                                        fontSize: '12px',
                                        markers: { radius: 5 }
                                    },
                                    tooltip: {
                                        shared: true,
                                        intersect: false,
                                        theme: 'light',
                                        style: { fontSize: '12px' },
                                        y: { formatter: (val) => val ? `${val.toFixed(1)}%` : 'N/A' },
                                        x: { formatter: (val) => val }
                                    },
                                    grid: { 
                                        borderColor: '#e9ecef',
                                        strokeDashArray: 4,
                                        xaxis: { lines: { show: true } },
                                        yaxis: { lines: { show: true } }
                                    },
                                    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'],
                                    dataLabels: {
                                        enabled: hasActiveFilter,
                                        formatter: (val) => val > 0 ? `${val}%` : '',
                                        style: { fontSize: '10px', fontWeight: 600, colors: ['#374151'] },
                                        background: { enabled: true, borderRadius: 3, padding: 3, foreColor: '#fff', borderWidth: 0, dropShadow: { enabled: false } },
                                        offsetY: -6
                                    },
                                    theme: { mode: 'light' }
                                }}
                                series={chartData.series}
                                type="line"
                                height={350}
                            />
                        </div>
                    </Suspense>
                )}
            </div>
        </div>
    );
};

export default ProductionSummary;
