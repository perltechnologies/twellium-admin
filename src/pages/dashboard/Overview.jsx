import React, { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import DowntimeBreakdownList from '../../components/charts/DowntimeBreakdownList';
import StoppageIncidentsChart from '../../components/charts/StoppageIncidentsChart';
import ProductionSummary from '../../components/production/ProductionSummary';
import { useApiWithFilters } from '../../utils/useApiWithFilters';
import { useFilters } from '../../context/FilterContext';
import ChartErrorBoundary, { SectionError } from '../../components/ui/ChartErrorBoundary';
import {
    SkeletonStatCards, SkeletonGauges, SkeletonChart,
    SkeletonTable, SkeletonDowntimeList
} from '../../components/ui/Skeletons';
import CorporateStatCard from '../../components/production/CorporateStatCard';
import CorporateGaugeChart from '../../components/charts/CorporateGaugeChart';

const ReactApexChart = lazy(() => import('react-apexcharts'));

/* ── helpers ─────────────────────────────────────── */
const extractList = (res) => {
    const d = res?.data;
    if (!d) return [];
    // Unwrap API envelope: { status_code, message, data: ... }
    const inner = d?.data ?? d;
    if (Array.isArray(inner)) return inner;
    if (inner?.results && Array.isArray(inner.results)) return inner.results;
    return [];
};

const formatNum = (n) => (n ?? 0).toLocaleString();

const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const clamp = (v) => Math.min(100, Math.max(0, v));

/* ── SVG Gauge ───────────────────────────────────── */
const GaugeChart = ({ value, label, color, formula, tooltip, calculation, rawValues }) => {
    const pct = Math.min(100, Math.max(0, value));
    const size = 200;
    const cx = size / 2;
    const cy = size / 2 + 20;
    const r = 65;
    const startAngle = (Math.PI * 4) / 5;
    const endAngle = Math.PI / 5;
    const range = startAngle - endAngle;
    const needleAngle = startAngle - (range * pct) / 100;

    const polarToCartesian = (angle) => ({
        x: cx + r * Math.cos(angle),
        y: cy - r * Math.sin(angle)
    });

    const createArc = (start, end) => {
        const startPoint = polarToCartesian(start);
        const endPoint = polarToCartesian(end);
        const largeArc = Math.abs(start - end) > Math.PI ? 1 : 0;
        return `M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
    };

    const zones = [
        { end: 60, color: '#ef4444' },
        { end: 85, color: '#f59e0b' },
        { end: 100, color: '#22c55e' }
    ];

    return (
        <div className="d-flex flex-column align-items-center p-3 border rounded-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)' }}>
            <h6 className="mb-3 text-center fw-semibold">{label}</h6>
            <div title={calculation || tooltip} style={{ cursor: 'help' }}>
                <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
                    <defs>
                        <filter id={`shadow-${label.replace(/\s/g, '')}`}>
                            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.2"/>
                        </filter>
                    </defs>

                    {/* Track background */}
                    <path d={createArc(startAngle, endAngle)} fill="none" stroke="#e5e7eb" strokeWidth="24" strokeLinecap="round" />

                    {/* Color zones */}
                    {zones.map((zone, i) => {
                        const prevEnd = i === 0 ? 0 : zones[i - 1].end;
                        const zStart = startAngle - (range * prevEnd) / 100;
                        const zEnd = startAngle - (range * zone.end) / 100;
                        return <path key={i} d={createArc(zStart, zEnd)} fill="none" stroke={zone.color} strokeWidth="22" strokeLinecap="round" />;
                    })}

                    {/* Tick marks */}
                    {[0, 20, 40, 60, 80, 100].map(tick => {
                        const angle = startAngle - (range * tick) / 100;
                        const inner = polarToCartesian(angle);
                        const outer = { x: cx + (r + 8) * Math.cos(angle), y: cy - (r + 8) * Math.sin(angle) };
                        const isMajor = tick % 20 === 0;
                        return (
                            <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} 
                                stroke="#9ca3af" strokeWidth={isMajor ? "2" : "1"} strokeLinecap="round" />
                        );
                    })}

                    {/* Tick labels */}
                    {[0, 25, 50, 75, 100].map(tick => {
                        const angle = startAngle - (range * tick) / 100;
                        const pos = { x: cx + (r + 20) * Math.cos(angle), y: cy - (r + 20) * Math.sin(angle) + 4 };
                        return (
                            <text key={tick} x={pos.x} y={pos.y} textAnchor="middle" fontSize="11" fontWeight="600" fill="#6b7280">
                                {tick}
                            </text>
                        );
                    })}

                    {/* Needle */}
                    <g filter={`url(#shadow-${label.replace(/\s/g, '')})`}>
                        <line x1={cx} y1={cy} x2={cx + (r - 8) * Math.cos(needleAngle)} y2={cy - (r - 8) * Math.sin(needleAngle)} 
                            stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
                        <circle cx={cx} cy={cy} r="6" fill="#1f2937" />
                        <circle cx={cx} cy={cy} r="3" fill="#ffffff" />
                    </g>

                    {/* Value */}
                    <text x={cx} y={cy + 30} textAnchor="middle" fontSize="26" fontWeight="700" fill="#111827">
                        {pct.toFixed(1)}%
                    </text>
                    <text x={cx} y={cy + 48} textAnchor="middle" fontSize="13" fontWeight="600" fill="#6b7280">
                        {label}
                    </text>
                </svg>
            </div>
        </div>
    );
};

/* ── component ───────────────────────────────────── */
const Overview = () => {
    const navigate = useNavigate();
    const { getParams, filters } = useApiWithFilters();
    const { updateFilters } = useFilters();
    const [selectedOutputPets, setSelectedOutputPets] = useState([]);

    // Independent OEE gauges date filter (defaults to previous day)
    const [oeeShowDetail, setOeeShowDetail] = useState(false);
    
    // Filters for Production Output by PET
    const [outputUseRange, setOutputUseRange] = useState(true);
    const [outputSingleDate, setOutputSingleDate] = useState('');
    const [outputStartDate, setOutputStartDate] = useState(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - dayOfWeek);
        return sunday.toISOString().split('T')[0];
    });
    const [outputEndDate, setOutputEndDate] = useState(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - dayOfWeek);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        return saturday.toISOString().split('T')[0];
    });
    const [outputPetSelected, setOutputPetSelected] = useState('');
    const [outputPeriod, setOutputPeriod] = useState('week'); // 'week' or 'month'
    const [outputPeriodReports, setOutputPeriodReports] = useState([]);
    const [outputPeriodLoading, setOutputPeriodLoading] = useState(false);

    /* Stale-while-revalidate: separate initial vs refresh state */
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const hasFetched = useRef(false);
    const abortRef = useRef(null);

    const [rawPets, setRawPets] = useState([]);
    const [hourlyReports, setHourlyReports] = useState([]);
    const [shiftOeeReports, setShiftOeeReports] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [currentShiftInfo, setCurrentShiftInfo] = useState(null);
    const [selectedShiftId, setSelectedShiftId] = useState(null);
    const [shiftLoading, setShiftLoading] = useState(false);
    const [shiftFilterDate, setShiftFilterDate] = useState('');
    const [shiftComparisonData, setShiftComparisonData] = useState({});
    const [showShiftComparison, setShowShiftComparison] = useState(false);
    const [metricsComparison, setMetricsComparison] = useState({});
    const [todayYesterdayComparison, setTodayYesterdayComparison] = useState({});
    const [materialConsumptions, setMaterialConsumptions] = useState([]);
    const [materialReportPetMap, setMaterialReportPetMap] = useState({});
    const [materialDate, setMaterialDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
    });
    const [oeeRangeData, setOeeRangeData] = useState(null);
    const [oeeDate, setOeeDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0];
    });

    const loadData = useCallback(async () => {
        /* Cancel any in-flight request */
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        /* First load → full skeleton. Subsequent → subtle refresh indicator */
        if (hasFetched.current) {
            setRefreshing(true);
        } else {
            setInitialLoading(true);
        }
        setError(null);

        try {
            const params = getParams();
            
            // Day boundary: 6am-6am. If before 6am, "today" is yesterday.
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            let boundaryDate = now.toISOString().split('T')[0];
            if (currentTime < '06:00') {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                boundaryDate = yesterday.toISOString().split('T')[0];
            }

            // Fetch shifts + new dashboard endpoints in parallel
            const [shiftsRes, metricsRes, todayYesterdayRes, petsRes] = await Promise.all([
                productionApi.getShifts(),
                productionApi.getDashboardMetricsComparison(),
                productionApi.getDashboardTodayYesterdayComparison({ date: boundaryDate }),
                productionApi.getPets(params),
            ]);

            if (controller.signal.aborted) return;

            const shiftsData = extractList(shiftsRes);
            setShifts(shiftsData);

            // Store metrics comparison data (oee, efficiency, stoppages, production, lines)
            const metricsData = metricsRes?.data?.data ?? metricsRes?.data ?? {};
            setMetricsComparison(metricsData);

            // Store today/yesterday comparison (oee, total_output, downtime, weighted avgs)
            const tyData = todayYesterdayRes?.data?.data ?? todayYesterdayRes?.data ?? {};
            setTodayYesterdayComparison(tyData);

            setRawPets(extractList(petsRes || {}).filter(pet => !pet.pet_name?.toLowerCase().includes('can')));
            hasFetched.current = true;
        } catch (err) {
            if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
            setError('Failed to load dashboard data. Please try again.');
        } finally {
            if (!controller.signal.aborted) {
                setInitialLoading(false);
                setRefreshing(false);
            }
        }
    }, [filters]);

    // Fetch material consumptions
    useEffect(() => {
        if (!materialDate) return;
        const fetchMaterials = async () => {
            try {
                const [materialsRes, reportsRes] = await Promise.all([
                    productionApi.getMaterialConsumptions({ production_date: materialDate }),
                    productionApi.getOeeSummary({ production_date: materialDate, page_size: 1000 }),
                ]);
                const toList = (payload) => {
                    if (Array.isArray(payload)) return payload;
                    if (Array.isArray(payload?.data)) return payload.data;
                    if (Array.isArray(payload?.results)) return payload.results;
                    if (Array.isArray(payload?.data?.results)) return payload.data.results;
                    return [];
                };
                const materials = toList(materialsRes.data);
                const reports = toList(reportsRes.data);
                const reportMap = {};
                reports.filter(r => !(r.pet_name || r.line_name || '').toLowerCase().includes('can')).forEach(r => {
                    const pet = r.pet_name?.match(/(\d+)/)?.[0] ? `Pet ${r.pet_name.match(/(\d+)/)[0]}` : r.pet_name;
                    if (!pet) return;
                    [r.id, r.report_id, r.pk].forEach(id => { if (id != null) reportMap[String(id)] = pet; });
                });
                setMaterialConsumptions(materials);
                setMaterialReportPetMap(reportMap);
            } catch { setMaterialConsumptions([]); setMaterialReportPetMap({}); }
        };
        fetchMaterials();
    }, [materialDate]);

    // Fetch data when week/month period is selected for Production Output
    useEffect(() => {
        if (outputPeriod && outputStartDate && outputEndDate) {
            const fetchOutputPeriodData = async () => {
                setOutputPeriodLoading(true);
                try {
                    const dates = [];
                    let current = new Date(outputStartDate);
                    const endDate = new Date(outputEndDate);
                    while (current <= endDate) {
                        dates.push(current.toISOString().split('T')[0]);
                        current.setDate(current.getDate() + 1);
                    }

                    const results = await Promise.all(
                        dates.map(date =>
                            productionApi.getOeeSummaryByDate({ production_date: date, page_size: 1000 })
                                .then(res => {
                                    const data = res?.data?.data || res?.data?.results || res?.data || [];
                                    const list = Array.isArray(data) ? data : [];
                                    return list
                                        .filter(r => !(r.pet_name || r.line_name || '').toLowerCase().includes('can'))
                                        .map(r => ({
                                            production_date: date,
                                            pet_name: r.pet_name || r.line_name || 'Unknown',
                                            total_bottles: r.metrics?.details?.total_output_pcs || 0
                                        }));
                                })
                                .catch(() => [])
                        )
                    );

                    setOutputPeriodReports(results.flat());
                } catch (error) {
                    console.error('Error fetching output period data:', error);
                    setOutputPeriodReports([]);
                } finally {
                    setOutputPeriodLoading(false);
                }
            };
            fetchOutputPeriodData();
        }
    }, [outputPeriod, outputStartDate, outputEndDate]);

    // Fetch OEE date range (defaults to previous day)
    useEffect(() => {
        const fetchOeeRange = async () => {
            try {
                const res = await productionApi.getOeeDateRange({ start_date: oeeDate, end_date: oeeDate });
                const raw = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
                const values = Object.values(raw);
                setOeeRangeData(values[0] || {});
            } catch (e) {
                console.error('Error fetching OEE date range:', e);
            }
        };
        fetchOeeRange();
    }, [oeeDate]);

    /* Load shift data using production_summary endpoint */
    const loadShiftData = useCallback(async () => {
        if (!shifts.length) return;

        setShiftLoading(true);
        try {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            let todayStr = now.toISOString().split('T')[0];
            
            // Day boundary is 6am. If before 6am, current production day is previous calendar day.
            if (currentTime < '06:00') {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                todayStr = yesterday.toISOString().split('T')[0];
            }

            const refDateStr = shiftFilterDate || todayStr;

            // Find which shift the current clock time falls in
            const currentShift = shifts.find(shift => {
                const start = shift.start_time?.slice(0, 5);
                const end = shift.end_time?.slice(0, 5);
                if (!start || !end) return false;
                if (start > end) return currentTime >= start || currentTime < end;
                return currentTime >= start && currentTime < end;
            });

            const targetShift = selectedShiftId
                ? shifts.find(s => s.id === selectedShiftId)
                : (currentShift || shifts[0]);

            if (!targetShift) {
                setShiftLoading(false);
                return;
            }

            // Fetch production summary for the date, with optional shift filter
            const params = { start_date: refDateStr, end_date: refDateStr };
            if (selectedShiftId) params.shift = targetShift.id;

            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            const dailyBreakdown = envelope.daily_breakdown || [];
            const dayData = dailyBreakdown.find(d => d.date === refDateStr) || dailyBreakdown[0] || {};
            const allPets = (dayData.pets || []).filter(r => !r.pet_name?.toLowerCase().includes('can'));

            // Filter by target shift if not already filtered by API
            let activeReports = [];
            let activeShift = targetShift;

            if (!selectedShiftId && targetShift) {
                // Try to get data for current shift
                const currentShiftData = allPets.filter(r => {
                    if (!r.shift) return false;
                    return r.shift.toLowerCase() === targetShift.name?.toLowerCase();
                });

                if (currentShiftData.length > 0) {
                    // Current shift has data — use it
                    activeReports = currentShiftData;
                } else {
                    // Current shift has no data yet — keep displaying previous shift
                    // Find the other shift (DAY ↔ NIGHT)
                    const otherShift = shifts.find(s => s.id !== targetShift.id);
                    if (otherShift) {
                        const otherShiftData = allPets.filter(r => {
                            if (!r.shift) return false;
                            return r.shift.toLowerCase() === otherShift.name?.toLowerCase();
                        });
                        if (otherShiftData.length > 0) {
                            activeShift = otherShift;
                            activeReports = otherShiftData;
                        }
                    }
                    // If still no data from other shift, use all available data
                    if (activeReports.length === 0 && allPets.length > 0) {
                        activeReports = allPets;
                    }
                }
            } else {
                // User explicitly selected a shift or no shift detection
                activeReports = allPets;
            }

            // Set shift info
            const displayShift = selectedShiftId ? targetShift : activeShift;
            setCurrentShiftInfo({
                id: displayShift.id,
                name: displayShift.name,
                start_time: displayShift.start_time,
                end_time: displayShift.end_time,
                lastUpdated: null
            });

            // Map to expected format
            const oeeData = activeReports.map(r => ({
                ...r,
                total_output: r.total_bottles_produced || 0,
                total_bottles: r.total_bottles || 0,
                total_downtime: r.total_downtime_minutes || 0,
                planned_downtime: r.planned_downtime_mins || 0,
                mechanical_downtime: r.mechanical_downtime_mins || 0,
                bottles_produced: r.total_bottles_produced || 0,
                downtime_minutes: r.total_downtime_minutes || 0,
                planned_downtime_minutes: r.planned_downtime_mins || 0,
                metrics: {
                    availability: parseFloat(r.availability) || 0,
                    performance: parseFloat(r.performance) || 0,
                    quality: parseFloat(r.quality) || 100,
                    oee: parseFloat(r.oee) || parseFloat(r.efficiency) || 0,
                    details: {
                        total_downtime_mins: r.total_downtime_minutes || 0,
                        planned_downtime_mins: r.planned_downtime_mins || 0,
                        mechanical_downtime_mins: r.mechanical_downtime_mins || 0,
                        planned_time_mins: 0,
                        total_output_pcs: r.total_bottles_produced || 0,
                    }
                }
            }));

            setShiftOeeReports(oeeData);

            const sortByPet = (arr) => arr.sort((a, b) => {
                const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });

            setHourlyReports(sortByPet(activeReports));
            
            // Store comparison data
            setShiftComparisonData(prev => ({
                ...prev,
                [`${refDateStr}_${activeShift.id}`]: {
                    date: refDateStr,
                    shift: activeShift,
                    reports: activeReports,
                    summary: {
                        total_production: activeReports.reduce((s, r) => s + (r.total_bottles_produced || r.total_bottles || 0), 0),
                        total_downtime: activeReports.reduce((s, r) => s + (r.total_downtime_minutes || 0), 0),
                        total_stoppages: activeReports.reduce((s, r) => s + (r.total_stoppage_reports_submitted || 0), 0),
                        avg_efficiency: (() => {
                            const efficients = activeReports.filter(r => (parseFloat(r.efficiency) || 0) > 0);
                            return efficients.length > 0 ? efficients.reduce((s, r) => s + (parseFloat(r.efficiency) || 0), 0) / efficients.length : 0;
                        })(),
                    },
                    timestamp: new Date().toISOString()
                }
            }));
        } catch (err) {
            console.error('Failed to load shift data:', err);
        } finally {
            setShiftLoading(false);
        }
    }, [shifts, selectedShiftId, shiftFilterDate, filters]);

    /* Re-fetch whenever filters change */
    useEffect(() => {
        loadData();
        return () => { if (abortRef.current) abortRef.current.abort(); };
    }, [loadData]);
    
    /* Load shift data when shifts or selectedShiftId changes */
    useEffect(() => {
        loadShiftData();
    }, [loadShiftData]);

    /* PETs available for the selected date (derived from reports) */
    const availablePets = useMemo(() => {
        return rawPets;
    }, [rawPets]);

    /* ── Derived data (recomputed when filter or raw data changes) ── */
    const { stats, oee, oeeByLine, oeeDetailReports, downtimeCategories } = useMemo(() => {
        const reports = [];

        /* Stats from metricsComparison endpoint */
        const mc = metricsComparison;
        const ty = todayYesterdayComparison;
        const todayMetrics = ty?.today || {};

        const totalDowntime = todayMetrics.downtime || 0;
        const totalProduced = todayMetrics.total_output || 0;
        const activeLines = mc?.lines?.active || 0;

        const stats = {
            activeLines,
            shiftsStarted: reports.length,
            totalDowntime: Math.round(totalDowntime),
            mechDowntime: 0,
            plannedDowntime: 0,
            stoppagesToday: mc?.total_stoppages?.today || 0,
            recentReports: reports.length,
            totalProduced,
        };

        /* Global OEE from today_yesterday_comparison */
        const availability = todayMetrics.availability_weighted_avg || 0;
        const quality = todayMetrics.quality_weighted_avg || 0;
        const performance = todayMetrics.performance_weighted_avg || 0;
        const oeeValue = todayMetrics.oee || 0;

        const totalPlannedMins = reports.reduce((s, r) => s + (r.metrics?.details?.planned_time_mins || 0), 0);
        const totalRejects = reports.reduce((s, r) => s + (r.metrics?.details?.rejects_pcs || 0), 0);
        const totalDowntimeMins = reports.reduce((s, r) => s + (r.metrics?.details?.total_downtime_mins || 0), 0);
        const mechDowntimeMins = reports.reduce((s, r) => s + (r.metrics?.details?.mechanical_downtime_mins || 0), 0);
        const plannedDowntimeMins = reports.reduce((s, r) => s + (r.metrics?.details?.planned_downtime_mins || 0), 0);
        const totalProducedFromReports = reports.reduce((s, r) => s + (r.metrics?.details?.total_output_pcs || 0), 0);

        // Compute elapsed shift time (capped at full shift duration)
        let elapsedMins = totalPlannedMins;
        if (currentShiftInfo?.start_time) {
            const now = new Date();
            const refDate = shiftFilterDate || now.toISOString().split('T')[0];
            const shiftStart = new Date(`${refDate}T${currentShiftInfo.start_time.slice(0, 5)}:00`);
            if (currentShiftInfo.end_time && currentShiftInfo.start_time.slice(0, 5) > currentShiftInfo.end_time.slice(0, 5) && now < shiftStart) {
                shiftStart.setDate(shiftStart.getDate() - 1);
            }
            elapsedMins = Math.min(totalPlannedMins, Math.max(0, Math.round((now - shiftStart) / 60000)));
        }
        if (totalPlannedMins > 0) {
            elapsedMins = elapsedMins < 60 ? 60 : Math.floor(elapsedMins / 60) * 60;
        }

        const oee = {
            availability: clamp(reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.availability || 0), 0) / reports.length : availability),
            quality: clamp(reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.quality || 0), 0) / reports.length : quality),
            performance: clamp(reports.length > 0 ? (() => { const op = elapsedMins - plannedDowntimeMins; return op > 0 ? ((elapsedMins - totalDowntimeMins) / op) * 100 : 0; })() : performance),
            oee: clamp(reports.length > 0 ? (() => { const a = reports.reduce((s, r) => s + (r.metrics?.availability || 0), 0) / reports.length; const q = reports.reduce((s, r) => s + (r.metrics?.quality || 0), 0) / reports.length; const op = elapsedMins - plannedDowntimeMins; const p = op > 0 ? ((elapsedMins - totalDowntimeMins) / op) * 100 : 0; return (a / 100) * (q / 100) * (p / 100) * 100; })() : oeeValue),
            rawValues: {
                plannedMins: totalPlannedMins,
                elapsedMins,
                totalDowntimeMins,
                mechDowntimeMins,
                plannedDowntimeMins,
                totalProduction: totalProducedFromReports || totalProduced,
                fillerRejects: totalRejects,
            }
        };

        /* OEE by Line from oeeReports */
        const lineMap = {};
        reports.forEach(r => {
            const name = r.pet_name;
            if (!lineMap[name]) {
                lineMap[name] = { name, reports: 0, availability: 0, quality: 0, performance: 0, oee: 0, production: 0, dates: [], plannedMins: 0, totalDowntimeMins: 0, plannedDowntimeMins: 0 };
            }
            lineMap[name].reports += 1;
            lineMap[name].availability += r.metrics?.availability || 0;
            lineMap[name].quality += r.metrics?.quality || 0;
            lineMap[name].performance += r.metrics?.performance || 0;
            lineMap[name].oee += r.metrics?.oee || 0;
            lineMap[name].production += r.metrics?.details?.total_output_pcs || 0;
            lineMap[name].plannedMins += r.metrics?.details?.planned_time_mins || 0;
            lineMap[name].totalDowntimeMins += r.metrics?.details?.total_downtime_mins || 0;
            lineMap[name].plannedDowntimeMins += r.metrics?.details?.planned_downtime_mins || 0;
            if (r.report_code) lineMap[name].dates.push({ code: r.report_code, shift: r.shift_name });
        });

        const oeeByLine = Object.values(lineMap).map(l => {
            const latest = l.dates.reduce((best, entry) => {
                const match = entry.code.match(/PR-(\d{4}-\d{2}-\d{2})/);
                if (!match) return best;
                return !best || match[1] > best.date ? { date: match[1], shift: entry.shift } : best;
            }, null);
            return {
                name: l.name,
                reports: l.reports,
                availability: clamp(l.availability / l.reports),
                quality: clamp(l.quality / l.reports),
                performance: clamp((l.plannedMins - l.plannedDowntimeMins) > 0 ? ((l.plannedMins - l.totalDowntimeMins) / (l.plannedMins - l.plannedDowntimeMins)) * 100 : 0),
                oee: clamp(l.oee / l.reports),
                production: l.production,
                date: latest?.date || null,
                shift: latest?.shift || null,
            };
        }).sort((a, b) => {
            const aNum = parseInt(a.name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });

        /* Downtime breakdown - empty since we no longer fetch stoppages with incidents */
        const downtimeCategories = [];

        // Individual report rows for detail view
        const oeeDetailReports = reports.map(r => {
            const match = r.report_code?.match(/PR-(\d{4}-\d{2}-\d{2})/);
            return {
                name: r.pet_name,
                report_code: r.report_code || '-',
                date: match ? match[1] : r.log_date || '-',
                shift: r.shift_name || '-',
                availability: clamp(r.metrics?.availability || 0),
                quality: clamp(r.metrics?.quality || 0),
                performance: clamp((() => { const pt = r.metrics?.details?.planned_time_mins || 0; const td = r.metrics?.details?.total_downtime_mins || 0; const pd = r.metrics?.details?.planned_downtime_mins || 0; const etRaw = Math.min(pt, elapsedMins); const et = pt > 0 ? (etRaw < 60 ? 60 : Math.floor(etRaw / 60) * 60) : 0; const op = et - pd; return op > 0 ? ((et - td) / op) * 100 : 0; })()),
                oee: clamp(r.metrics?.oee || 0),
                production: r.metrics?.details?.total_output_pcs || 0,
            };
        }).sort((a, b) => {
            const aNum = parseInt(a.name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum || a.shift.localeCompare(b.shift);
        });

        return { stats, oee, oeeByLine, oeeDetailReports, downtimeCategories };
    }, [metricsComparison, todayYesterdayComparison, rawPets, currentShiftInfo, shiftFilterDate]);

    /* Hourly OEE by Line for per-PET gauges */
    const hourlyOeeByLine = useMemo(() => {
        const lineMap = {};
        // key: lowercase pet_name → canonical display name from rawPets
        const nameKey = (n) => n?.toLowerCase().trim();
        
        // Start with all available PETs from rawPets
        rawPets.forEach(pet => {
            lineMap[nameKey(pet.pet_name)] = { 
                name: pet.pet_name, 
                reports: 0, 
                oee: 0, 
                performance: 0,
                production: 0, 
                downtime: 0,
                plannedDowntime: 0,
                plannedTimeMins: 0,
                efficiency: 0
            };
        });
        
        // Add data from hourly reports (from production_summary endpoint)
        hourlyReports.forEach(r => {
            const name = nameKey(r.pet_name);
            // Create entry if it doesn't exist (for cases where rawPets is empty)
            if (!lineMap[name]) {
                lineMap[name] = { 
                    name: r.pet_name, 
                    reports: 0, 
                    oee: 0, 
                    performance: 0,
                    production: 0, 
                    downtime: 0,
                    plannedDowntime: 0,
                    plannedTimeMins: 0,
                    efficiency: 0
                };
            }
            
            if (lineMap[name]) {
                lineMap[name].reports += 1;
                const efficiency = parseFloat(r.efficiency) || parseFloat(r.oee) || r.metrics?.oee || 0;
                lineMap[name].oee += efficiency;
                lineMap[name].performance += parseFloat(r.performance) || 0;
                lineMap[name].production += r.total_bottles_produced || r.total_bottles || r.bottles_produced || r.total_bottles_produced || r.metrics?.details?.total_output_pcs || 0;
                lineMap[name].downtime += r.total_downtime_minutes || r.total_downtime || r.downtime_minutes || r.metrics?.details?.total_downtime_mins || 0;
                lineMap[name].plannedDowntime += r.planned_downtime_mins || r.planned_downtime || r.planned_downtime_minutes || r.metrics?.details?.planned_downtime_mins || 0;
                lineMap[name].plannedTimeMins += r.metrics?.details?.planned_time_mins || 0;
            }
        });

        // Compute elapsed shift time for performance formula
        let elapsedMins = 0;
        if (currentShiftInfo?.start_time && currentShiftInfo?.end_time) {
            const now = new Date();
            const refDate = shiftFilterDate || now.toISOString().split('T')[0];
            const shiftStart = new Date(`${refDate}T${currentShiftInfo.start_time.slice(0, 5)}:00`);
            // Handle overnight shifts
            if (currentShiftInfo.start_time.slice(0, 5) > currentShiftInfo.end_time.slice(0, 5) && now < shiftStart) {
                shiftStart.setDate(shiftStart.getDate() - 1);
            }
            const shiftEnd = new Date(`${refDate}T${currentShiftInfo.end_time.slice(0, 5)}:00`);
            if (currentShiftInfo.end_time.slice(0, 5) <= currentShiftInfo.start_time.slice(0, 5)) {
                shiftEnd.setDate(shiftEnd.getDate() + 1);
            }
            const shiftDurationMins = Math.round((shiftEnd - shiftStart) / 60000);
            elapsedMins = Math.min(shiftDurationMins, Math.max(0, Math.round((now - shiftStart) / 60000)));
            if (elapsedMins > 0) {
                elapsedMins = elapsedMins < 60 ? 60 : Math.floor(elapsedMins / 60) * 60;
            }
        }

        return Object.values(lineMap).map(l => {
            const td = l.downtime;
            const pd = l.plannedDowntime;
            const perf = l.reports > 0 ? clamp(l.performance / l.reports) : 0;
            return {
                name: l.name,
                reports: l.reports,
                oee: l.reports > 0 ? clamp(l.oee / l.reports) : 0,
                performance: perf,
                perfRaw: { plannedTime: elapsedMins, totalDowntime: td, plannedDowntime: pd },
                production: l.production,
                downtime: l.downtime,
                lastUpdated: l.lastUpdated ? l.lastUpdated.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                }) : null,
            };
        }).sort((a, b) => {
            const aNum = parseInt(a.name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [hourlyReports, rawPets, currentShiftInfo, shiftFilterDate]);

    const gaugeColor = (v) => v >= 85 ? '#22c55e' : v >= 60 ? '#f59e0b' : '#ef4444';
    const isLoading = initialLoading || refreshing;

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <div className="d-flex align-items-center gap-2">
                    <h4 className="mb-0">Dashboard</h4>
                    {refreshing && (
                        <span className="spinner-border spinner-border-sm text-primary" role="status" />
                    )}
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button 
                        onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            updateFilters({ log_date: today, start_date: null, end_date: null });
                        }}
                        className={`btn btn-sm ${filters.log_date === new Date().toISOString().split('T')[0] && !filters.start_date ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        <i className="ti ti-calendar-today me-1"></i>Current
                    </button>
                    <button 
                        onClick={() => {
                            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                            updateFilters({ log_date: yesterday, start_date: null, end_date: null });
                        }}
                        className={`btn btn-sm ${filters.log_date === new Date(Date.now() - 86400000).toISOString().split('T')[0] && !filters.start_date ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        <i className="ti ti-calendar-minus me-1"></i>Previous Day
                    </button>
                    <button 
                        onClick={() => {
                            const today = new Date();
                            updateFilters({ 
                                start_date: today.toISOString().split('T')[0], 
                                end_date: today.toISOString().split('T')[0], 
                                log_date: null 
                            });
                        }}
                        className={`btn btn-sm ${filters.start_date && filters.end_date ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                        <i className="ti ti-calendar-week me-1"></i>Week
                    </button>
                    <button onClick={() => navigate('/dashboard/production/overview')} className="btn btn-outline-primary btn-sm shadow">
                        <i className="ti ti-chart-bar me-1"></i>Production Charts
                    </button>
                    <button className="btn btn-icon btn-outline-light shadow" title="Refresh" onClick={loadData} disabled={refreshing}>
                        <i className={`ti ti-refresh${refreshing ? ' spin' : ''}`}></i>
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center mb-4">
                    <i className="ti ti-alert-circle fs-4 me-2"></i>
                    <div className="flex-grow-1">{error}</div>
                    <button className="btn btn-outline-danger btn-sm ms-2" onClick={loadData}>
                        <i className="ti ti-refresh me-1"></i>Retry
                    </button>
                </div>
            )}

            {/* Per-PET Metrics (Current Shift) */}
            {!isLoading && hourlyOeeByLine.length > 0 && (
                <div className="card border mb-4">
                    <div className="card-header bg-light border-bottom py-3">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div>
                                <h6 className="mb-0 fw-semibold">
                                    <i className="ti ti-clock-hour-4 me-2"></i>
                                    Shift Production Metrics
                                    {currentShiftInfo && (
                                        <span className="badge bg-primary text-white ms-2" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                            {currentShiftInfo.name}
                                        </span>
                                    )}
                                </h6>
                                {currentShiftInfo?.lastUpdated && (
                                    <div className="text-muted mt-1" style={{ fontSize: '0.85rem' }}>
                                        Last Updated: {currentShiftInfo.lastUpdated}
                                    </div>
                                )}
                                {currentShiftInfo?.start_time && currentShiftInfo?.end_time && (
                                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                                        Shift Time: {(() => {
                                            const now = new Date();
                                            const currentTime = now.toTimeString().slice(0, 5);
                                            let refDate = shiftFilterDate || now.toISOString().split('T')[0];
                                            
                                            // If before 6am and no manual filter, use previous day
                                            if (!shiftFilterDate && currentTime < '06:00') {
                                                const yesterday = new Date(now);
                                                yesterday.setDate(yesterday.getDate() - 1);
                                                refDate = yesterday.toISOString().split('T')[0];
                                            }
                                            
                                            const startTime = currentShiftInfo.start_time.slice(0, 5);
                                            const endTime = currentShiftInfo.end_time.slice(0, 5);
                                            
                                            // Check if shift crosses midnight
                                            if (startTime > endTime) {
                                                const startDate = new Date(refDate);
                                                const endDate = new Date(refDate);
                                                endDate.setDate(endDate.getDate() + 1);
                                                
                                                return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${startTime} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${endTime}`;
                                            }
                                            
                                            return `${new Date(refDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${startTime} - ${endTime}`;
                                        })()}
                                    </div>
                                )}
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    style={{ width: '140px' }}
                                    value={shiftFilterDate}
                                    onChange={(e) => setShiftFilterDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                                <div className="btn-group btn-group-sm" role="group">
                                    {shifts.sort((a, b) => {
                                        if (a.name === 'DAY') return -1;
                                        if (b.name === 'DAY') return 1;
                                        return 0;
                                    }).map(shift => (
                                        <button
                                            key={shift.id}
                                            className={`btn ${currentShiftInfo?.id === shift.id ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setSelectedShiftId(shift.id)}
                                        >
                                            {shift.name}
                                        </button>
                                    ))}
                                </div>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: 'auto' }}
                                    value={filters.pet || ''}
                                    onChange={(e) => updateFilters({ pet: e.target.value || null })}
                                >
                                    <option value="">All PETs</option>
                                    {rawPets.sort((a, b) => {
                                        const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                                        const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                                        return aNum - bNum;
                                    }).map(pet => (
                                        <option key={pet.id} value={pet.id}>{pet.pet_name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => navigate('/dashboard/production')}
                                    className="btn btn-outline-secondary btn-sm"
                                >
                                    <i className="ti ti-list me-1"></i>All Shifts
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="card-body">
                        {/* Summary Stats Row */}
                        <div className="row g-3 mb-4">
                            {(() => {
                                const totalProduction = hourlyOeeByLine.reduce((sum, line) => sum + line.production, 0);
                                const totalDowntime = hourlyOeeByLine.reduce((sum, line) => sum + line.downtime, 0);
                                const avgOEE = hourlyOeeByLine.length > 0
                                    ? (hourlyOeeByLine.reduce((sum, line) => sum + line.oee, 0) / hourlyOeeByLine.length).toFixed(1)
                                    : 0;
                                const bestPerformer = [...hourlyOeeByLine].sort((a, b) => b.performance - a.performance)[0];

                                return (
                                    <>
                                        <div className="col-4">
                                            <div className="border rounded p-3 bg-light">
                                                <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>Total Production for all 6 Pets</div>
                                                <div className="fw-bold" style={{ fontSize: '1.25rem' }}>
                                                    {formatNum(Math.round(totalProduction))}
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>bottles</div>
                                            </div>
                                        </div>
                                        <div className="col-4">
                                            <div className="border rounded p-3 bg-light">
                                                <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>Total Downtime across all lines{currentShiftInfo?.name ? ` (${currentShiftInfo.name})` : ''}</div>
                                                <div className={`fw-bold ${totalDowntime <= 60 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1.25rem' }}>
                                                    {formatDuration(totalDowntime)}
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {totalDowntime <= 60 ? 'On target' : 'Above target'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-4">
                                            <div className="border rounded p-3 bg-light">
                                                <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>Best Performing Line</div>
                                                <div className="fw-bold text-dark" style={{ fontSize: '1.25rem' }}>
                                                    {bestPerformer?.name || 'N/A'}
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {bestPerformer?.performance.toFixed(1) || 0}% Performance
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Additional Shift Metrics */}
                        {(() => {
                            const currentKey = `${shiftFilterDate || new Date().toISOString().split('T')[0]}_${currentShiftInfo?.id}`;
                            const shiftData = shiftComparisonData[currentKey];
                            if (!shiftData?.summary) return null;

                            const { summary } = shiftData;
                            return (
                                <div className="row g-3 mb-4">
                                    <div className="col-12">
                                        <h6 className="mb-3 fw-semibold" style={{ fontSize: '0.9rem' }}>
                                            <i className="ti ti-chart-donut me-2"></i>
                                            Shift Stoppages Summary
                                        </h6>
                                    </div>
                                    <div className="col-6">
                                        <div className="border rounded p-3 bg-light">
                                            <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>
                                                <i className="ti ti-alert-triangle me-1"></i>
                                                Total Stoppages across all 6 Pets
                                            </div>
                                            <div className="fw-bold text-danger" style={{ fontSize: '1.25rem' }}>
                                                {summary.total_stoppages || 0}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>incidents</div>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="border rounded p-3 bg-light">
                                            <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>
                                                <i className="ti ti-percentage me-1"></i>
                                                Avg Efficiency for all lines
                                            </div>
                                            <div className={`fw-bold ${summary.avg_efficiency >= 85 ? 'text-success' : summary.avg_efficiency >= 60 ? 'text-warning' : 'text-danger'}`} style={{ fontSize: '1.25rem' }}>
                                                {(summary.avg_efficiency || 0).toFixed(1)}%
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                {summary.avg_efficiency >= 85 ? 'Excellent' : summary.avg_efficiency >= 60 ? 'Acceptable' : 'Needs improvement'}
                                            </div>
                                        </div>
                                    </div>
                                    {summary.top_stoppage_reasons && summary.top_stoppage_reasons.length > 0 && (
                                        <div className="col-12">
                                            <div className="border rounded p-3 bg-light">
                                                <div className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                                                    <i className="ti ti-list-ordered me-1"></i>
                                                    Top Stoppage Reasons
                                                </div>
                                                <div className="row g-2">
                                                    {summary.top_stoppage_reasons.slice(0, 5).map((reason, idx) => (
                                                        <div key={idx} className="col-12 col-md">
                                                            <div className="d-flex align-items-center gap-2 p-2 bg-white rounded border">
                                                                <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>#{idx + 1}</span>
                                                                <div className="flex-grow-1">
                                                                    <div className="fw-semibold" style={{ fontSize: '0.8rem' }}>{reason.category || reason.name || 'Unknown'}</div>
                                                                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                                        {formatDuration(reason.duration || reason.total_minutes || 0)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Production Output by PET */}
                        <h6 className="mb-3 fw-semibold" style={{ fontSize: '0.9rem' }}>Production Output by PET</h6>
                        <div className="row g-3 mb-4">
                            {hourlyOeeByLine.map((line) => (
                                <div key={`output-${line.name}`} className="col-6 col-lg-4 col-xl">
                                    <CorporateStatCard
                                        title={line.name}
                                        value={Math.round(line.production)}
                                        unit="bottles"
                                        icon="bottle"
                                        lastUpdated={line.lastUpdated}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Downtime by PET */}
                        <h6 className="mb-3 fw-semibold" style={{ fontSize: '0.9rem' }}>Downtime by PET</h6>
                        <div className="row g-3 mb-4">
                            {hourlyOeeByLine.map((line) => {
                                const targetDowntime = 30;
                                const downtimeStatus = line.downtime <= targetDowntime ? 'Within Target' : 'Exceeds Target';
                                return (
                                    <div key={`downtime-${line.name}`} className="col-6 col-lg-4 col-xl">
                                        <CorporateStatCard
                                            title={line.name}
                                            value={Math.round(line.downtime)}
                                            unit="min"
                                            icon="clock-pause"
                                            subtitle={downtimeStatus}
                                            lastUpdated={line.lastUpdated}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Performance by PET */}
                        <h6 className="mb-3 fw-semibold" style={{ fontSize: '0.9rem' }}>Performance by PET</h6>
                        <div className="row g-3">
                            {hourlyOeeByLine.map((line) => (
                                <div key={`oee-${line.name}`} className="col">
                                    <CorporateGaugeChart
                                        value={line.performance}
                                        label={line.name}
                                        size={160}
                                        lastUpdated={line.lastUpdated}
                                        rawValues={line.perfRaw}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Shift Comparison Section */}
                        {showShiftComparison && Object.keys(shiftComparisonData).length > 0 && (
                            <div className="mt-4 pt-4 border-top">
                                <h6 className="mb-3 fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    <i className="ti ti-chart-bar me-2"></i>
                                    Shift Comparison
                                </h6>
                                <div className="table-responsive">
                                    <table className="table table-bordered table-hover align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th style={{ fontSize: '0.8rem' }}>Date</th>
                                                <th style={{ fontSize: '0.8rem' }}>Shift</th>
                                                <th style={{ fontSize: '0.8rem' }}>Total Production</th>
                                                <th style={{ fontSize: '0.8rem' }}>Total Downtime</th>
                                                <th style={{ fontSize: '0.8rem' }}>Avg Efficiency</th>
                                                <th style={{ fontSize: '0.8rem' }}>Stoppages</th>
                                                <th style={{ fontSize: '0.8rem' }}>Avg Efficiency</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.values(shiftComparisonData)
                                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                                                .slice(0, 10)
                                                .map((data, idx) => {
                                                    const { date, shift, reports, summary } = data;
                                                    const totalProd = reports.reduce((sum, r) => sum + (r.bottles_produced || r.total_bottles_produced || r.metrics?.details?.total_output_pcs || 0), 0);
                                                    const totalDown = reports.reduce((sum, r) => sum + (r.downtime_minutes || r.metrics?.details?.total_downtime_mins || 0), 0);
                                                    const _totalBottles = reports.reduce((sum, r) => sum + (r.total_bottles_produced || r.total_bottles || 0), 0);
                                                    const avgOee = reports.length > 0
                                                        ? (_totalBottles > 0
                                                            ? (reports.reduce((sum, r) => sum + (parseFloat(r.efficiency) || r.metrics?.oee || 0) * (r.total_bottles_produced || r.total_bottles || 0), 0) / _totalBottles)
                                                            : reports.reduce((sum, r) => sum + (parseFloat(r.efficiency) || r.metrics?.oee || 0), 0) / reports.length
                                                          ).toFixed(1)
                                                        : 0;

                                                    return (
                                                        <tr key={idx} className={currentShiftInfo?.id === shift.id && shiftFilterDate === date ? 'table-primary' : ''}>
                                                            <td style={{ fontSize: '0.8rem' }}>{date}</td>
                                                            <td style={{ fontSize: '0.8rem' }}>
                                                                <span className="badge bg-primary">{shift.name}</span>
                                                            </td>
                                                            <td className="fw-semibold" style={{ fontSize: '0.8rem' }}>{formatNum(Math.round(totalProd))}</td>
                                                            <td style={{ fontSize: '0.8rem' }}>
                                                                <span className={totalDown <= 60 ? 'text-success' : 'text-danger'}>
                                                                    {formatDuration(totalDown)}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: '0.8rem' }}>
                                                                <span className={avgOee >= 85 ? 'text-success' : avgOee >= 60 ? 'text-warning' : 'text-danger'}>
                                                                    {avgOee}%
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: '0.8rem' }}>{summary.total_stoppages || 0}</td>
                                                            <td style={{ fontSize: '0.8rem' }}>
                                                                <span className={summary.avg_efficiency >= 85 ? 'text-success' : summary.avg_efficiency >= 60 ? 'text-warning' : 'text-danger'}>
                                                                    {(summary.avg_efficiency || 0).toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* OEE Gauges */}
            {isLoading ? <SkeletonGauges count={4} /> : (
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <ChartErrorBoundary fallbackMessage="Failed to render Efficiency gauges">
                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">
                                Overall Equipment Effectiveness (Efficiency)
                                <span className="badge bg-soft-info text-info ms-2 fs-11">
                                    <i className="ti ti-calendar me-1"></i>
                                    {(() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        const y = new Date(); y.setDate(y.getDate() - 1);
                                        const yesterday = y.toISOString().split('T')[0];
                                        if (oeeDate === today) return 'Today';
                                        if (oeeDate === yesterday) return 'Yesterday';
                                        return oeeDate;
                                    })()}
                                </span>
                            </h6>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={oeeDate}
                                    onChange={(e) => { setOeeRangeData(null); setOeeDate(e.target.value); }}
                                    style={{ width: 'auto' }}
                                />
                                <button onClick={() => navigate('/dashboard/formulas')} className="btn btn-outline-light shadow btn-xs">
                                    <i className="ti ti-math-function me-1"></i>View Formulas
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                                {(() => {
                                    if (!oeeRangeData) {
                                        return <SkeletonGauges count={4} />;
                                    }
                                    const avail = oeeRangeData.availability_weighted_avg || 0;
                                    const qual = oeeRangeData.quality_weighted_avg || 0;
                                    const perf = oeeRangeData.performance_weighted_avg || 0;
                                    const oeeVal = oeeRangeData.oee || 0;
                                    if (!oeeVal && !avail && !qual && !perf) {
                                        return (
                                            <div className="alert alert-warning d-flex align-items-center">
                                                <i className="ti ti-alert-circle fs-4 me-2"></i>
                                                <div><strong>No data available</strong> for this period.</div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="row g-3">
                                            <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                                <GaugeChart value={avail} label="Availability" color={gaugeColor(avail)} />
                                            </div>
                                            <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                                <GaugeChart value={qual} label="Quality" color={gaugeColor(qual)} />
                                            </div>
                                            <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                                <GaugeChart value={perf} label="Performance" color={gaugeColor(perf)} />
                                            </div>
                                            <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                                <GaugeChart value={oeeVal} label="Efficiency" color={gaugeColor(oeeVal)} />
                                            </div>
                                        </div>
                                    );
                                })()}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                </div>
            </div>
            )}

            {/* Production Summary */}
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <ProductionSummary reports={hourlyReports} loading={isLoading} pets={availablePets} shiftInfo={currentShiftInfo} shiftDate={shiftFilterDate} />
                </div>
            </div>

            {/* Material Consumptions */}
            {(() => {
                const normPet = (name) => { const num = name?.match(/(\d+)/)?.[0]; return num ? `Pet ${num}` : name; };
                const sortPetByNumber = (a, b) => parseInt(a?.match(/(\d+)/)?.[0] || '999') - parseInt(b?.match(/(\d+)/)?.[0] || '999');
                const resolvePet = (m) => {
                    const reportRef = m?.report?.id ?? m?.report;
                    const fromReport = reportRef != null ? materialReportPetMap[String(reportRef)] : null;
                    if (fromReport) return fromReport;
                    if (m.pet_name) return normPet(m.pet_name);
                    if (m.line_name) return normPet(m.line_name);
                    return 'Unassigned';
                };
                const materialTypes = {};
                materialConsumptions.forEach(m => {
                    const type = m.material_type;
                    if (!materialTypes[type]) materialTypes[type] = { label: m.material_type_display, unit: m.unit, pets: {} };
                    const pet = resolvePet(m);
                    if (!materialTypes[type].pets[pet]) materialTypes[type].pets[pet] = { used: 0, losses: 0 };
                    materialTypes[type].pets[pet].used += parseFloat(m.used) || 0;
                    materialTypes[type].pets[pet].losses += parseFloat(m.losses) || 0;
                });
                const COLORS = { PREFORMS: '#f59e0b', CLOSURES: '#8b5cf6', LABELS: '#0ea5e9', SHRINK: '#ec4899', GLUE: '#16a34a' };
                const types = Object.entries(materialTypes).sort((a, b) => (a[1].label || a[0]).localeCompare(b[1].label || b[0]));
                const petNames = rawPets.map(p => normPet(p.pet_name)).filter(Boolean);
                const detectedPets = new Set(types.flatMap(([, info]) => Object.keys(info.pets || {})));
                const unknownPets = Array.from(detectedPets).filter(n => !/^pet\s*\d+/i.test(n)).sort();
                const allPets = [...new Set([...petNames, ...unknownPets])].sort(sortPetByNumber);
                const yieldColor = (v) => v >= 98 ? '#16a34a' : v >= 95 ? '#d97706' : '#dc2626';
                const totalsByPet = {};
                allPets.forEach(pet => { totalsByPet[pet] = { used: 0, losses: 0 }; });
                types.forEach(([, info]) => {
                    allPets.forEach(pet => {
                        const v = info.pets[pet];
                        if (!v) return;
                        totalsByPet[pet].used += v.used;
                        totalsByPet[pet].losses += v.losses;
                    });
                });
                const petYieldSummary = allPets.map(pet => {
                    const v = totalsByPet[pet] || { used: 0, losses: 0 };
                    const y = v.used > 0 ? ((v.used - v.losses) / v.used * 100) : 0;
                    return { pet, yield: y };
                });
                const bestPet = petYieldSummary.length ? [...petYieldSummary].sort((a, b) => b.yield - a.yield)[0] : null;
                const worstPet = petYieldSummary.length ? [...petYieldSummary].sort((a, b) => a.yield - b.yield)[0] : null;

                return (
                    <div className="card mb-4">
                        <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
                            <i className="ti ti-stack text-warning"></i>
                            <h6 className="mb-0 fw-bold" style={{ fontSize: '0.82rem' }}>Material Consumptions</h6>
                            <div className="d-flex align-items-center gap-1 ms-1 px-1 py-0 rounded-2" style={{ border: '1px solid #fde68a', background: '#fffbeb' }}>
                                <i className="ti ti-calendar" style={{ fontSize: '0.68rem', color: '#b45309' }}></i>
                                <input
                                    type="date"
                                    className="form-control form-control-sm border-0 p-0"
                                    value={materialDate}
                                    onChange={(e) => setMaterialDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    style={{ width: 118, fontSize: '0.65rem', background: 'transparent', boxShadow: 'none' }}
                                    title="Material consumptions date"
                                />
                            </div>
                            <span className="badge bg-soft-secondary text-secondary" style={{ fontSize: '0.65rem' }}>PETs: {allPets.length}</span>
                            {bestPet && <span className="badge bg-soft-success text-success" style={{ fontSize: '0.65rem' }}>Best: {bestPet.pet} ({bestPet.yield.toFixed(1)}%)</span>}
                            {worstPet && <span className="badge bg-soft-danger text-danger" style={{ fontSize: '0.65rem' }}>Low: {worstPet.pet} ({worstPet.yield.toFixed(1)}%)</span>}
                        </div>
                        <div className="card-body p-0">
                            {!types.length ? (
                                <div className="text-center py-4 text-muted">No material consumption data for this date</div>
                            ) : (
                            <div className="table-responsive" style={{ maxHeight: 300 }}>
                                <table className="table table-sm table-bordered mb-0" style={{ fontSize: '0.66rem', lineHeight: 1.2 }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#f8fafc', fontWeight: 700, whiteSpace: 'nowrap', padding: '2px 6px' }}>Material</th>
                                            {allPets.map(pet => (
                                                <th key={pet} className="text-center" style={{ fontWeight: 700, padding: '2px 4px', whiteSpace: 'nowrap' }}>{pet}</th>
                                            ))}
                                            <th className="text-center" style={{ position: 'sticky', right: 0, zIndex: 2, background: '#f8fafc', fontWeight: 700, padding: '2px 4px' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {types.map(([type, info], rowIndex) => {
                                            const color = COLORS[type] || '#64748b';
                                            const totalUsed = Object.values(info.pets || {}).reduce((s, v) => s + v.used, 0);
                                            const totalLosses = Object.values(info.pets || {}).reduce((s, v) => s + v.losses, 0);
                                            const totalYield = totalUsed > 0 ? ((totalUsed - totalLosses) / totalUsed * 100) : 0;
                                            return (
                                                <tr key={type} style={{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc66' }}>
                                                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc', padding: '2px 6px', borderLeft: `3px solid ${color}`, whiteSpace: 'nowrap' }}>
                                                        <b style={{ color }}>{info.label}</b> <span style={{ color: '#94a3b8' }}>({info.unit})</span>
                                                    </td>
                                                    {allPets.map(pet => {
                                                        const v = info.pets[pet];
                                                        if (!v) return (
                                                            <td key={pet} className="text-center" style={{ padding: '2px 4px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                                                <span style={{ fontWeight: 700 }}>0.0%</span><span style={{ color: '#cbd5e1' }}> · 0</span>
                                                            </td>
                                                        );
                                                        const pYield = v.used > 0 ? ((v.used - v.losses) / v.used * 100) : 0;
                                                        return (
                                                            <td key={pet} className="text-center" style={{ padding: '2px 4px', whiteSpace: 'nowrap' }}>
                                                                <span style={{ fontWeight: 800, color: yieldColor(pYield) }}>{pYield.toFixed(1)}%</span>
                                                                <span style={{ color: '#64748b' }}> · {v.used.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                                {v.losses > 0 && <span style={{ color: '#dc2626' }}> / -{v.losses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="text-center" style={{ position: 'sticky', right: 0, zIndex: 1, padding: '2px 4px', background: '#f8fafc', whiteSpace: 'nowrap' }}>
                                                        <span className="px-1 rounded-pill" style={{ fontWeight: 800, fontSize: '0.72rem', color: '#fff', background: yieldColor(totalYield) }}>{totalYield.toFixed(1)}%</span>
                                                        <span style={{ color: '#64748b' }}> {totalUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Stoppage Incidents Chart */}
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <ChartErrorBoundary fallbackMessage="Failed to render stoppage incidents chart">
                        <StoppageIncidentsChart />
                    </ChartErrorBoundary>
                </div>
            </div>

            {/* Production Output by PET */}
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <ChartErrorBoundary fallbackMessage="Failed to render production output chart">
                    {isLoading ? <SkeletonChart height={350} title /> : (
                    <div className="card">
                        <div className="card-header">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                <div>
                                    <h6 className="mb-0">Production Output by PET</h6>
                                    <small className="text-muted">Production trends over time</small>
                                </div>
                            </div>
                            
                            {/* Filters */}
                            <div className="row mb-3 align-items-end">
                                <div className="col-md-4">
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <label className="form-label mb-0 small">Date</label>
                                        <div className="form-check form-switch">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                checked={outputUseRange}
                                                onChange={(e) => {
                                                    setOutputUseRange(e.target.checked);
                                                    if (e.target.checked) setOutputSingleDate('');
                                                    else { setOutputStartDate(''); setOutputEndDate(''); }
                                                }}
                                            />
                                            <label className="form-check-label small">Range</label>
                                        </div>
                                    </div>
                                    {!outputUseRange ? (
                                        <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            value={outputSingleDate}
                                            onChange={(e) => setOutputSingleDate(e.target.value)}
                                        />
                                    ) : (
                                        <div className="d-flex gap-2">
                                            <input
                                                type="date"
                                                className="form-control form-control-sm"
                                                placeholder="Start"
                                                value={outputStartDate}
                                                onChange={(e) => setOutputStartDate(e.target.value)}
                                            />
                                            <input
                                                type="date"
                                                className="form-control form-control-sm"
                                                placeholder="End"
                                                value={outputEndDate}
                                                onChange={(e) => setOutputEndDate(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label small">PET</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={outputPetSelected}
                                        onChange={(e) => setOutputPetSelected(e.target.value)}
                                    >
                                        <option value="">All</option>
                                        {availablePets.sort((a, b) => {
                                            const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                                            const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                                            return aNum - bNum;
                                        }).map(pet => (
                                            <option key={pet.id} value={pet.id}>{pet.pet_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label small">Period</label>
                                    <div className="btn-group btn-group-sm w-100">
                                        <button 
                                            className={`btn ${outputPeriod === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => {
                                                const today = new Date();
                                                const dayOfWeek = today.getDay();
                                                const sunday = new Date(today);
                                                sunday.setDate(today.getDate() - dayOfWeek);
                                                const saturday = new Date(sunday);
                                                saturday.setDate(sunday.getDate() + 6);
                                                setOutputUseRange(true);
                                                setOutputStartDate(sunday.toISOString().split('T')[0]);
                                                setOutputEndDate(saturday.toISOString().split('T')[0]);
                                                setOutputSingleDate('');
                                                setOutputPeriod('week');
                                            }}
                                        >
                                            Week
                                        </button>
                                        <button 
                                            className={`btn ${outputPeriod === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => {
                                                const today = new Date();
                                                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                                setOutputUseRange(true);
                                                setOutputStartDate(firstDay.toISOString().split('T')[0]);
                                                setOutputEndDate(lastDay.toISOString().split('T')[0]);
                                                setOutputSingleDate('');
                                                setOutputPeriod('month');
                                            }}
                                        >
                                            Month
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {outputPeriodLoading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (() => {
                                // Use period reports when week/month is active, otherwise use outputPeriodReports
                                let filteredReports = [...outputPeriodReports].map(r => {
                                    // Ensure production_date exists — extract from report_code or fall back to log_date
                                    let prodDate = r.production_date;
                                    if (!prodDate && r.report_code) {
                                        const match = r.report_code.match(/PR-(\d{4}-\d{2}-\d{2})/);
                                        if (match) prodDate = match[1];
                                    }
                                    prodDate = (prodDate || r.log_date || '').split('T')[0];
                                    return { ...r, production_date: prodDate };
                                });
                                
                                if (outputUseRange) {
                                    if (outputStartDate) filteredReports = filteredReports.filter(r => r.production_date >= outputStartDate);
                                    if (outputEndDate) filteredReports = filteredReports.filter(r => r.production_date <= outputEndDate);
                                } else if (outputSingleDate) {
                                    filteredReports = filteredReports.filter(r => r.production_date === outputSingleDate);
                                }
                                
                                // Filter by PET dropdown
                                if (outputPetSelected) {
                                    const selectedPetName = availablePets.find(p => p.id === parseInt(outputPetSelected))?.pet_name;
                                    if (selectedPetName) {
                                        filteredReports = filteredReports.filter(r => r.pet_name === selectedPetName);
                                    }
                                }

                                // Generate date range based on filtered data or defaults
                                let dates = [];
                                
                                if (outputUseRange && outputStartDate && outputEndDate) {
                                    // Use specified range
                                    const start = new Date(outputStartDate);
                                    const end = new Date(outputEndDate);
                                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                        dates.push(d.toISOString().split('T')[0]);
                                    }
                                } else if (outputSingleDate) {
                                    // Single date
                                    dates = [outputSingleDate];
                                } else {
                                    // Default: last 7 days
                                    const now = new Date();
                                    for (let i = 6; i >= 0; i--) {
                                        const d = new Date(now);
                                        d.setDate(now.getDate() - i);
                                        dates.push(d.toISOString().split('T')[0]);
                                    }
                                }

                                // Build a case-insensitive lookup: normalize all pet_name values to a canonical form
                                const normalizePet = (name) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');

                                // Group reports by date and normalized PET name
                                const grouped = {};
                                filteredReports.forEach(r => {
                                    const date = r.production_date;
                                    if (!date) return;
                                    if (!grouped[date]) grouped[date] = {};
                                    const key = normalizePet(r.pet_name);
                                    if (!key) return;
                                    if (!grouped[date][key]) grouped[date][key] = 0;
                                    grouped[date][key] += r.total_bottles_produced || r.total_bottles || r.bottles_produced || r.total_bottles_produced || r.metrics?.details?.total_output_pcs || 0;
                                });

                                // Discover actual PET names from data, build display map
                                const petDisplayNames = {};
                                filteredReports.forEach(r => {
                                    const key = normalizePet(r.pet_name);
                                    if (key && !petDisplayNames[key]) petDisplayNames[key] = r.pet_name.trim();
                                });

                                // Always show Pet 1–6, matching by normalized key
                                const allPets = ['Pet 1', 'Pet 2', 'Pet 3', 'Pet 4', 'Pet 5', 'Pet 6'];

                                const series = allPets.map(pet => {
                                    const key = normalizePet(pet);
                                    const displayName = petDisplayNames[key] || pet;
                                    return {
                                        name: displayName,
                                        data: dates.map(date => grouped[date]?.[key] || 0)
                                    };
                                });

                                console.log('Chart series:', series);
                                console.log('Dates:', dates);

                                return series.length === 0 ? (
                                    <div className="text-center text-muted py-4">No production data available</div>
                                ) : (
                                    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>}>
                                        <ReactApexChart
                                            options={{
                                                chart: { 
                                                    type: 'line', 
                                                    height: 350, 
                                                    toolbar: { show: false },
                                                    zoom: { enabled: false }
                                                },
                                                stroke: { curve: 'smooth', width: 3 },
                                                xaxis: { 
                                                    categories: dates,
                                                    labels: { 
                                                        rotate: -45,
                                                        formatter: (val) => {
                                                            const d = new Date(val);
                                                            const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
                                                            if (outputPeriod === 'week') {
                                                                const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
                                                                return `${dateStr}\n${day}`;
                                                            }
                                                            return dateStr;
                                                        }
                                                    }
                                                },
                                                yaxis: { 
                                                    title: { text: 'Production Output (pcs)' },
                                                    labels: { formatter: (val) => formatNum(val) }
                                                },
                                                markers: { size: 5, hover: { size: 7 } },
                                                legend: { position: 'top', horizontalAlign: 'right' },
                                                colors: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                                                tooltip: { 
                                                    shared: true,
                                                    intersect: false,
                                                    y: { formatter: (val) => formatNum(val) + ' bottles' } 
                                                },
                                                grid: { borderColor: '#e7e7e7' },
                                                dataLabels: { enabled: false }
                                            }}
                                            series={series}
                                            type="line"
                                            height={350}
                                        />
                                    </Suspense>
                                );
                            })()}
                        </div>
                    </div>
                    )}
                    </ChartErrorBoundary>
                </div>
            </div>
        </>
    );
};

export default Overview;
