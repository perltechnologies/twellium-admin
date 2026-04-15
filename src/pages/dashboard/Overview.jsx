import React, { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import DowntimeBreakdownList from '../../components/charts/DowntimeBreakdownList';
import StoppageIncidentsChart from '../../components/charts/StoppageIncidentsChart';
import ProductionSummary from '../../components/production/ProductionSummary';
import FilterInputs from '../../components/FilterInputs';
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
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (d?.data?.data && Array.isArray(d.data.data)) return d.data.data;
    if (d?.data?.results && Array.isArray(d.data.results)) return d.data.results;
    if (d?.results && Array.isArray(d.results)) return d.results;
    if (d?.data && Array.isArray(d.data)) return d.data;
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
            {rawValues && (
                <div className="mt-3 text-center" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                    {pct === 0 ? (
                        <div className="badge bg-soft-warning text-warning px-2 py-1">
                            <i className="ti ti-alert-circle me-1"></i>
                            {rawValues.reason || 'No data available'}
                        </div>
                    ) : (
                        <div className="text-muted font-monospace">{rawValues.display}</div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── component ───────────────────────────────────── */
const Overview = () => {
    const navigate = useNavigate();
    const { getParams, filters } = useApiWithFilters();
    const { updateFilters } = useFilters();
    const [selectedPet, setSelectedPet] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedOutputPets, setSelectedOutputPets] = useState([]);

    // Independent OEE gauges date filter (defaults to previous day)
    const [oeeDate, setOeeDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [oeeReports, setOeeReports] = useState([]);
    const [oeeLoading, setOeeLoading] = useState(false);
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

    const [rawReports, setRawReports] = useState([]);
    const [rawPets, setRawPets] = useState([]);
    const [rawStoppages, setRawStoppages] = useState([]);
    const [allReports, setAllReports] = useState([]);
    const [hourlyReports, setHourlyReports] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [currentShiftInfo, setCurrentShiftInfo] = useState(null);
    const [selectedShiftId, setSelectedShiftId] = useState(null);
    const [shiftLoading, setShiftLoading] = useState(false);
    const [shiftFilterDate, setShiftFilterDate] = useState('');
    const [shiftComparisonData, setShiftComparisonData] = useState({});
    const [showShiftComparison, setShowShiftComparison] = useState(false);

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
            const stoppageParams = getParams({}, true);
            
            // Ensure datetime parameters are always set for OEE summary
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 0);
            
            const oeeSummaryParams = {
                ...params,
                datetime_start_time: params.datetime_start_time || todayStart.toISOString().replace(/\.\d{3}Z$/, 'Z'),
                datetime_end_time: params.datetime_end_time || todayEnd.toISOString().replace(/\.\d{3}Z$/, 'Z')
            };
            
            const allReportsParams = { 
                datetime_start_time: todayStart.toISOString().replace(/\.\d{3}Z$/, 'Z'),
                datetime_end_time: todayEnd.toISOString().replace(/\.\d{3}Z$/, 'Z')
            };
            
            // Fetch shifts from API
            const shiftsRes = await productionApi.getShifts();
            const shiftsData = shiftsRes?.data?.data || shiftsRes?.data || [];
            setShifts(shiftsData);
            
            const [oeeSummaryRes, petsRes, stoppagesRes, allReportsRes] = await Promise.all([
                productionApi.getOeeSummary(oeeSummaryParams),
                productionApi.getPets(params),
                productionApi.getStoppages(stoppageParams),
                productionApi.getOeeSummary(allReportsParams),
            ]);

            if (controller.signal.aborted) return;

            const reports = extractList(oeeSummaryRes || {}).filter(r => !r.pet_name?.toLowerCase().includes('can'));
            const allReportsData = extractList(allReportsRes || {}).filter(r => !r.pet_name?.toLowerCase().includes('can'));
            // Sort reports by PET name
            const sortByPet = (arr) => arr.sort((a, b) => {
                const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });

            setRawReports(sortByPet(reports));
            setRawPets(extractList(petsRes || {}).filter(pet => !pet.pet_name?.toLowerCase().includes('can')));
            setRawStoppages(extractList(stoppagesRes || {}).filter(s => !(s.pet_name || s.line_name || '').toLowerCase().includes('can')));
            setAllReports(sortByPet(allReportsData));
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

    // Fetch data when week/month period is selected for Production Output
    useEffect(() => {
        if (outputPeriod && outputStartDate && outputEndDate) {
            const fetchOutputPeriodData = async () => {
                setOutputPeriodLoading(true);
                try {
                    const startDateTime = new Date(outputStartDate);
                    startDateTime.setHours(0, 0, 0, 0);
                    const endDateTime = new Date(outputEndDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    
                    const params = {
                        datetime_start_time: startDateTime.toISOString().replace(/\\.\\d{3}Z$/, 'Z'),
                        datetime_end_time: endDateTime.toISOString().replace(/\\.\\d{3}Z$/, 'Z')
                    };
                    
                    const response = await productionApi.getOeeSummary(params);
                    const data = response?.data?.data || response?.data?.results || response?.data || [];
                    setOutputPeriodReports(data.filter(r => !r.pet_name?.toLowerCase().includes('can')));
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

    // Fetch OEE data independently based on oeeDate
    useEffect(() => {
        if (!oeeDate) return;
        const fetchOeeData = async () => {
            setOeeLoading(true);
            try {
                const start = `${oeeDate}T00:00:00Z`;
                const end = `${oeeDate}T23:59:59Z`;
                const res = await productionApi.getOeeSummary({ datetime_start_time: start, datetime_end_time: end });
                const data = res?.data?.data || res?.data?.results || res?.data || [];
                setOeeReports(data.filter(r => !r.pet_name?.toLowerCase().includes('can')));
            } catch (e) {
                console.error('Error fetching OEE data:', e);
                setOeeReports([]);
            } finally {
                setOeeLoading(false);
            }
        };
        fetchOeeData();
    }, [oeeDate]);

    /* Load shift data separately */
    const loadShiftData = useCallback(async () => {
        if (!shifts.length) return;

        setShiftLoading(true);
        try {
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            let todayStr = now.toISOString().split('T')[0];
            
            // If before 6am, use previous day for shift data
            if (currentTime < '06:00') {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                todayStr = yesterday.toISOString().split('T')[0];
            }

            // Use shiftFilterDate if set, otherwise use calculated date
            const refDateStr = shiftFilterDate || todayStr;

            // Find which shift the current clock time falls in (for auto-selection)
            const currentShift = shifts.find(shift => {
                const start = shift.start_time?.slice(0, 5);
                const end = shift.end_time?.slice(0, 5);
                if (!start || !end) return false;
                if (start > end) {
                    return currentTime >= start || currentTime < end;
                }
                return currentTime >= start && currentTime < end;
            });

            const targetShift = selectedShiftId
                ? shifts.find(s => s.id === selectedShiftId)
                : (currentShift || shifts[0]);

            if (!targetShift) {
                setShiftLoading(false);
                return;
            }

            setCurrentShiftInfo({
                id: targetShift.id,
                name: targetShift.name,
                start_time: targetShift.start_time,
                end_time: targetShift.end_time,
                lastUpdated: null
            });

            // Calculate shift date range based on shift times
            const shiftStart = targetShift.start_time?.slice(0, 5);
            const shiftEnd = targetShift.end_time?.slice(0, 5);
            
            let startDateTime, endDateTime;
            
            if (shiftStart && shiftEnd && shiftStart > shiftEnd) {
                // Night shift: crosses midnight (e.g., 18:00 to 06:00)
                // Start on refDateStr, end on next day
                const startDate = new Date(refDateStr + 'T' + shiftStart + ':00Z');
                const endDate = new Date(refDateStr + 'T' + shiftEnd + ':59Z');
                endDate.setDate(endDate.getDate() + 1);
                startDateTime = startDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');
                endDateTime = endDate.toISOString().replace(/\\.\\d{3}Z$/, 'Z');
            } else {
                // Day shift: same day
                startDateTime = `${refDateStr}T${shiftStart || '06:00'}:00Z`;
                endDateTime = `${refDateStr}T${shiftEnd || '18:00'}:59Z`;
            }

            const shiftParams = {
                start_datetime: startDateTime,
                end_datetime: endDateTime,
                shift: targetShift.id
            };

            // Include PET filter if selected
            if (filters.pet) {
                shiftParams.pet = filters.pet;
            }

            const shiftReportsRes = await productionApi.getStoppagesSummary(shiftParams);
            
            // Handle nested response: response.data.data contains the actual data object
            const outerData = shiftReportsRes?.data?.data || shiftReportsRes?.data || {};
            const stoppagesArray = outerData.data || [];
            const shiftReports = stoppagesArray.filter(r => !r.pet_name?.toLowerCase().includes('can'));
            
            const overallTotals = outerData.overall_totals || {};
            const stoppagesSummary = {
                total_production: overallTotals.bottles_produced || 0,
                total_downtime: overallTotals.downtime_minutes || 0,
                total_stoppages: outerData.count || 0,
                avg_efficiency: parseFloat(overallTotals.efficiency) || 0,
                downtime_breakdown: outerData.downtime_breakdown || {},
                top_stoppage_reasons: outerData.top_stoppage_reasons || [],
                shift_start_time: outerData.shift_start_time,
                shift_end_time: outerData.shift_end_time,
            };

            // Get the latest log_time from the reports
            const latestTime = shiftReports.reduce((latest, report) => {
                if (report.log_time) {
                    const time = new Date(report.log_date + 'T' + report.log_time);
                    return !latest || time > latest ? time : latest;
                }
                return latest;
            }, null);

            if (latestTime) {
                setCurrentShiftInfo(prev => ({
                    ...prev,
                    lastUpdated: latestTime.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    })
                }));
            }

            const sortByPet = (arr) => arr.sort((a, b) => {
                const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });

            setHourlyReports(sortByPet(shiftReports));
            
            // Store comparison data for shift comparison feature
            setShiftComparisonData(prev => ({
                ...prev,
                [`${refDateStr}_${targetShift.id}`]: {
                    date: refDateStr,
                    shift: targetShift,
                    reports: shiftReports,
                    summary: stoppagesSummary,
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
        let reports = oeeReports.length > 0 ? oeeReports : rawReports;
        if (selectedPet) {
            reports = reports.filter(r => r.pet_name === selectedPet);
        }

        let stoppages = rawStoppages;
        if (selectedPet) {
            stoppages = stoppages.filter(s => (s.pet_name || s.line_name || '') === selectedPet);
        }

        /* Stats from reports (source of truth for downtime) */
        const totalDowntime = reports.reduce((s, r) => s + (r.metrics?.details?.total_downtime_mins || 0), 0);
        const mechDowntime = reports.reduce((s, r) => s + (r.metrics?.details?.mechanical_downtime_mins || 0), 0);
        const plannedDowntime = reports.reduce((s, r) => s + (r.metrics?.details?.planned_downtime_mins || 0), 0);

        const totalProduced = reports.reduce((s, r) => s + (r.metrics?.details?.total_output_pcs || 0), 0);
        const activeLines = selectedPet ? 1 : new Set(reports.map(r => r.pet_name).filter(Boolean)).size;

        const stats = {
            activeLines,
            shiftsStarted: reports.length,
            totalDowntime: Math.round(totalDowntime),
            mechDowntime: Math.round(mechDowntime),
            plannedDowntime: Math.round(plannedDowntime),
            stoppagesToday: stoppages.length,
            recentReports: reports.length,
            totalProduced,
        };

        /* Global OEE from API */
        const totalPlannedMins = reports.reduce((s, r) => s + (r.metrics?.details?.planned_time_mins || 0), 0);
        const totalRejects = reports.reduce((s, r) => s + (r.metrics?.details?.rejects_pcs || 0), 0);

        const availability = reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.availability || 0), 0) / reports.length : 0;
        const operationalTime = totalPlannedMins - plannedDowntime;
        const performance = operationalTime > 0 ? ((totalPlannedMins - totalDowntime) / operationalTime) * 100 : 0;
        const quality = reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.quality || 0), 0) / reports.length : 0;
        const oeeValue = reports.length > 0 ? (availability / 100) * (performance / 100) * (quality / 100) * 100 : 0;

        const oee = {
            availability: clamp(availability),
            quality: clamp(quality),
            performance: clamp(performance),
            oee: clamp(oeeValue),
            rawValues: {
                plannedMins: totalPlannedMins,
                totalDowntimeMins: totalDowntime,
                mechDowntimeMins: mechDowntime,
                plannedDowntimeMins: plannedDowntime,
                totalProduction: totalProduced,
                fillerRejects: totalRejects,
            }
        };

        /* OEE by Line from API */
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
            // Pick the entry with the most recent date from report_codes (format: PR-YYYY-MM-DD-SHIFT)
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

        /* If a specific PET is selected, use its OEE */
        let displayOee = oee;
        if (selectedPet && oeeByLine.length > 0) {
            const selectedLineOee = oeeByLine[0];
            const selectedReports = reports.filter(r => r.pet_name === selectedPet);
            const linePlannedMins = selectedReports.reduce((s, r) => s + (r.metrics?.details?.planned_time_mins || 0), 0);
            const lineDowntime = selectedReports.reduce((s, r) => s + (r.metrics?.details?.total_downtime_mins || 0), 0);
            const lineMechDowntime = selectedReports.reduce((s, r) => s + (r.metrics?.details?.mechanical_downtime_mins || 0), 0);
            const linePlannedDowntime = selectedReports.reduce((s, r) => s + (r.metrics?.details?.planned_downtime_mins || 0), 0);
            const lineProduced = selectedReports.reduce((s, r) => s + (r.metrics?.details?.total_output_pcs || 0), 0);
            const lineRejects = selectedReports.reduce((s, r) => s + (r.metrics?.details?.rejects_pcs || 0), 0);

            displayOee = {
                availability: selectedLineOee.availability,
                quality: selectedLineOee.quality,
                performance: selectedLineOee.performance,
                oee: selectedLineOee.oee,
                rawValues: {
                    plannedMins: linePlannedMins,
                    totalDowntimeMins: lineDowntime,
                    mechDowntimeMins: lineMechDowntime,
                    plannedDowntimeMins: linePlannedDowntime,
                    totalProduction: lineProduced,
                    fillerRejects: lineRejects,
                }
            };
        }

        /* Downtime breakdown from stoppages incidents */
        const incidentMap = {};
        stoppages.forEach(stoppage => {
            (stoppage.incidents || []).forEach(incident => {
                const category = incident.downtime_category_name || 'Uncategorized';
                const duration = parseFloat(incident.incident_duration || 0);
                
                if (!incidentMap[category]) {
                    incidentMap[category] = 0;
                }
                incidentMap[category] += duration;
            });
        });

        const categoryColors = {
            'Mechanical Downtime': '#ef4444',
            'Planned Downtime': '#3b82f6',
            'Electrical': '#f59e0b',
            'Quality': '#8b5cf6',
            'Material': '#10b981',
            'Other': '#6b7280',
        };

        const downtimeCategories = Object.entries(incidentMap)
            .map(([name, value]) => ({
                name,
                value: Math.round(value),
                color: categoryColors[name] || categoryColors['Other']
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);

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
                performance: clamp(r.metrics?.performance || 0),
                oee: clamp(r.metrics?.oee || 0),
                production: r.metrics?.details?.total_output_pcs || 0,
            };
        }).sort((a, b) => {
            const aNum = parseInt(a.name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum || a.shift.localeCompare(b.shift);
        });

        return { stats, oee: displayOee, oeeByLine, oeeDetailReports, downtimeCategories };
    }, [oeeReports, rawReports, rawPets, rawStoppages, selectedPet, selectedDate]);

    /* Hourly OEE by Line for per-PET gauges */
    const hourlyOeeByLine = useMemo(() => {
        // Compute shift duration in minutes from currentShiftInfo
        let shiftMins = 0;
        if (currentShiftInfo?.start_time && currentShiftInfo?.end_time) {
            const [sh, sm] = currentShiftInfo.start_time.slice(0, 5).split(':').map(Number);
            const [eh, em] = currentShiftInfo.end_time.slice(0, 5).split(':').map(Number);
            shiftMins = (eh * 60 + em) - (sh * 60 + sm);
            if (shiftMins <= 0) shiftMins += 24 * 60; // crosses midnight
        }

        const lineMap = {};
        
        // Start with all available PETs from rawPets
        rawPets.forEach(pet => {
            lineMap[pet.pet_name] = { 
                name: pet.pet_name, 
                reports: 0, 
                oee: 0, 
                production: 0, 
                downtime: 0,
                plannedDowntime: 0,
                efficiency: 0
            };
        });
        
        // Add data from hourly reports (from stoppages summary endpoint)
        hourlyReports.forEach(r => {
            const name = r.pet_name;
            // Create entry if it doesn't exist (for cases where rawPets is empty)
            if (!lineMap[name]) {
                lineMap[name] = { 
                    name: name, 
                    reports: 0, 
                    oee: 0, 
                    production: 0, 
                    downtime: 0,
                    plannedDowntime: 0,
                    efficiency: 0
                };
            }
            
            if (lineMap[name]) {
                lineMap[name].reports += 1;
                // Use efficiency from API response (convert string to number), fallback to OEE from metrics
                const efficiency = parseFloat(r.efficiency) || r.metrics?.oee || 0;
                lineMap[name].oee += efficiency;
                lineMap[name].production += r.bottles_produced || r.total_bottles_produced || r.metrics?.details?.total_output_pcs || 0;
                lineMap[name].downtime += r.downtime_minutes || r.metrics?.details?.total_downtime_mins || 0;
                lineMap[name].plannedDowntime += r.planned_downtime_minutes || r.metrics?.details?.planned_downtime_mins || 0;
                
                // Track last updated time
                if (r.log_time) {
                    const time = new Date(r.log_date + 'T' + r.log_time);
                    if (!lineMap[name].lastUpdated || time > lineMap[name].lastUpdated) {
                        lineMap[name].lastUpdated = time;
                    }
                }
            }
        });

        return Object.values(lineMap).map(l => {
            // Performance = (Planned Time - Total Downtime) / (Planned Time - Planned Downtime) × 100
            const plannedTime = shiftMins * l.reports;
            const operationalTime = plannedTime - l.plannedDowntime;
            const perf = operationalTime > 0 ? ((plannedTime - l.downtime) / operationalTime) * 100 : 0;
            return {
            name: l.name,
            reports: l.reports,
            oee: l.reports > 0 ? clamp(l.oee / l.reports) : 0,
            performance: clamp(perf),
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
    }, [hourlyReports, rawPets, currentShiftInfo]);

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

            {/* Filters */}
            <FilterInputs />

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
                                const bestPerformer = [...hourlyOeeByLine].sort((a, b) => b.oee - a.oee)[0];

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
                                                <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>Total Downtime across all lines</div>
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
                                                    {bestPerformer?.oee.toFixed(1) || 0}% Efficiency
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
                                                    const avgOee = reports.length > 0 
                                                        ? (reports.reduce((sum, r) => sum + (parseFloat(r.efficiency) || r.metrics?.oee || 0), 0) / reports.length).toFixed(1)
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
                                    <i className="ti ti-calendar me-1"></i>{oeeDate}
                                </span>
                            </h6>
                            <div className="d-flex align-items-center gap-2">
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={oeeDate}
                                    onChange={(e) => setOeeDate(e.target.value)}
                                    style={{ width: 'auto' }}
                                />
                                <button onClick={() => navigate('/dashboard/formulas')} className="btn btn-outline-light shadow btn-xs">
                                    <i className="ti ti-math-function me-1"></i>View Formulas
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                                {oeeLoading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : !error && oeeReports.length === 0 ? (
                                    <div className="alert alert-warning d-flex align-items-center">
                                        <i className="ti ti-alert-circle fs-4 me-2"></i>
                                        <div>
                                            <strong>No data available</strong> for {oeeDate}. Please select a different date.
                                        </div>
                                    </div>
                                ) : (
                                <div className="row g-3">
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart 
                                            value={oee.availability} 
                                            label="Availability" 
                                            color={gaugeColor(oee.availability)}
                                            formula="(Planned Time - Total Downtime) / (Planned Time - Mechanical Downtime) × 100"
                                            calculation={oee.rawValues ? `(${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.totalDowntimeMins || 0).toFixed(0)}) / (${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.mechDowntimeMins || 0).toFixed(0)}) × 100 = ${oee.availability.toFixed(1)}%` : ''}
                                            rawValues={oee.rawValues ? {
                                                display: `(${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.totalDowntimeMins || 0).toFixed(0)}) / (${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.mechDowntimeMins || 0).toFixed(0)}) × 100`,
                                                reason: oee.availability === 0 ? (oee.rawValues.plannedMins === 0 ? 'Planned Time = 0' : 'Availability = 0%') : null
                                            } : null}
                                        />
                                    </div>
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart 
                                            value={oee.quality} 
                                            label="Quality" 
                                            color={gaugeColor(oee.quality)}
                                            formula="(Total Production - Filler Reject) / Total Production × 100"
                                            calculation={oee.rawValues ? `(${Number(oee.rawValues.totalProduction || 0).toLocaleString()} - ${Number(oee.rawValues.fillerRejects || 0).toLocaleString()}) / ${Number(oee.rawValues.totalProduction || 0).toLocaleString()} × 100 = ${oee.quality.toFixed(1)}%` : ''}
                                            rawValues={oee.rawValues ? {
                                                display: `(${Number(oee.rawValues.totalProduction || 0).toLocaleString()} - ${Number(oee.rawValues.fillerRejects || 0).toLocaleString()}) / ${Number(oee.rawValues.totalProduction || 0).toLocaleString()} × 100`,
                                                reason: oee.quality === 0 ? (oee.rawValues.totalProduction === 0 ? 'Total Production = 0' : 'Quality = 0%') : null
                                            } : null}
                                        />
                                    </div>
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart 
                                            value={oee.performance} 
                                            label="Performance" 
                                            color={gaugeColor(oee.performance)}
                                            formula="(Planned Time - Total Downtime) / (Planned Time - Planned Downtime) × 100"
                                            calculation={oee.rawValues ? `(${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.totalDowntimeMins || 0).toFixed(0)}) / (${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.plannedDowntimeMins || 0).toFixed(0)}) × 100 = ${oee.performance.toFixed(1)}%` : ''}
                                            rawValues={oee.rawValues ? {
                                                display: `(${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.totalDowntimeMins || 0).toFixed(0)}) / (${Number(oee.rawValues.plannedMins || 0).toFixed(0)} - ${Number(oee.rawValues.plannedDowntimeMins || 0).toFixed(0)}) × 100`,
                                                reason: oee.performance === 0 ? ((oee.rawValues.plannedMins - oee.rawValues.plannedDowntimeMins) === 0 ? 'Operational Time = 0' : 'Performance = 0%') : null
                                            } : null}
                                        />
                                    </div>
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart 
                                            value={oee.oee} 
                                            label="Efficiency" 
                                            color={gaugeColor(oee.oee)}
                                            formula="A × Q × P"
                                            calculation={`${(oee.availability/100).toFixed(3)} × ${(oee.quality/100).toFixed(3)} × ${(oee.performance/100).toFixed(3)} = ${oee.oee.toFixed(1)}%`}
                                            rawValues={{
                                                display: `${(oee.availability/100).toFixed(3)} × ${(oee.quality/100).toFixed(3)} × ${(oee.performance/100).toFixed(3)}`,
                                                reason: oee.oee === 0 ? (
                                                    oee.availability === 0 ? 'Availability = 0%' :
                                                    oee.quality === 0 ? 'Quality = 0%' :
                                                    oee.performance === 0 ? 'Performance = 0%' : 'Efficiency = 0%'
                                                ) : null
                                            }}
                                        />
                                    </div>
                                </div>
                                )}
                        </div>
                    </div>
                    </ChartErrorBoundary>
                </div>
            </div>
            )}

            {/* Production Summary */}
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <ProductionSummary reports={allReports} loading={isLoading} pets={availablePets} />
                </div>
            </div>

            {/* Downtime Breakdown + OEE by Line */}
            <div className="row row-gap-3 mb-4">
                {/* Downtime Breakdown */}
                <div className="col-5 col-md-5 d-flex">
                    {isLoading ? <SkeletonDowntimeList /> : (
                        <DowntimeBreakdownList 
                            downtimeCategories={downtimeCategories}
                            loading={false}
                            showDetailsButton={true}
                            detailsRoute="/dashboard/production/stoppages"
                        />
                    )}
                </div>
                {/* OEE by Line Table */}
                <div className="col-xl-7 d-flex">
                    {isLoading ? <SkeletonTable rows={4} cols={6} /> : (
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">Efficiency by Production Line</h6>
                            <div className="d-flex gap-2">
                                <button onClick={() => setOeeShowDetail(v => !v)} className="btn btn-outline-secondary btn-xs">
                                    <i className={`ti ti-${oeeShowDetail ? 'list' : 'report-analytics'} me-1`}></i>
                                    {oeeShowDetail ? 'Summary' : 'Detail'}
                                </button>
                                <button onClick={() => navigate('/dashboard/production/overview')} className="btn btn-primary btn-xs">View Charts</button>
                            </div>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive" style={{ maxHeight: oeeShowDetail ? '400px' : 'none', overflowY: oeeShowDetail ? 'auto' : 'visible' }}>
                                <table className="table table-hover mb-0">
                                    <thead className="table-light" style={{ position: oeeShowDetail ? 'sticky' : 'static', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th className="ps-3">Line</th>
                                            <th className="text-center">{oeeShowDetail ? 'Report' : 'Date'}</th>
                                            <th className="text-center">{oeeShowDetail ? 'Shift' : 'Reports'}</th>
                                            <th className="text-center" title="(Planned - Downtime) / Planned × 100">
                                                Availability <i className="ti ti-info-circle fs-12 text-muted"></i>
                                            </th>
                                            <th className="text-center" title="(Total - Waste) / Total × 100">
                                                Quality <i className="ti ti-info-circle fs-12 text-muted"></i>
                                            </th>
                                            <th className="text-center" title="Actual / (Speed × Hours) × 100">
                                                Performance <i className="ti ti-info-circle fs-12 text-muted"></i>
                                            </th>
                                            <th className="text-center" title="A × Q × P">
                                                Efficiency <i className="ti ti-info-circle fs-12 text-muted"></i>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const rows = oeeShowDetail ? oeeDetailReports : oeeByLine;
                                            if (rows.length === 0) return (
                                                <tr><td colSpan="7" className="text-center text-muted py-4">No data available</td></tr>
                                            );
                                            return rows.map((line, idx) => (
                                                <tr key={oeeShowDetail ? `${line.report_code}-${idx}` : line.name}>
                                                    <td className="ps-3 fw-medium">{line.name}</td>
                                                    <td className="text-center text-muted" style={{ fontSize: '0.8rem' }}>
                                                        {oeeShowDetail ? line.report_code : (
                                                            <>
                                                                {line.date || '-'}
                                                                {line.shift && line.shift !== '-' && (
                                                                    <span className={`badge ms-1 bg-soft-${line.shift.toUpperCase() === 'DAY' ? 'warning' : 'dark'} text-${line.shift.toUpperCase() === 'DAY' ? 'warning' : 'dark'}`}>
                                                                        {line.shift}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="text-center" style={{ fontSize: '0.8rem' }}>
                                                        {oeeShowDetail ? (
                                                            <span className={`badge bg-soft-${line.shift?.toUpperCase() === 'DAY' ? 'warning' : 'dark'} text-${line.shift?.toUpperCase() === 'DAY' ? 'warning' : 'dark'}`}>
                                                                {line.shift}
                                                            </span>
                                                        ) : line.reports}
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge bg-soft-${line.availability >= 85 ? 'success' : line.availability >= 60 ? 'warning' : 'danger'} text-${line.availability >= 85 ? 'success' : line.availability >= 60 ? 'warning' : 'danger'}`}>
                                                            {line.availability.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge bg-soft-${line.quality >= 85 ? 'success' : line.quality >= 60 ? 'warning' : 'danger'} text-${line.quality >= 85 ? 'success' : line.quality >= 60 ? 'warning' : 'danger'}`}>
                                                            {line.quality.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`badge bg-soft-${line.performance >= 85 ? 'success' : line.performance >= 60 ? 'warning' : 'danger'} text-${line.performance >= 85 ? 'success' : line.performance >= 60 ? 'warning' : 'danger'}`}>
                                                            {line.performance.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className={`fw-bold ${line.oee >= 85 ? 'text-success' : line.oee >= 60 ? 'text-warning' : 'text-danger'}`}>
                                                            {line.oee.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>

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
                                // Use period reports when week/month is active, otherwise use allReports
                                let filteredReports = (outputPeriod ? [...outputPeriodReports] : [...allReports]).map(r => {
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
                                    grouped[date][key] += r.bottles_produced || r.total_bottles_produced || r.metrics?.details?.total_output_pcs || 0;
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
