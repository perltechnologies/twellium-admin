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

const ReactApexChart = lazy(() => import('react-apexcharts'));

/* ── helpers ─────────────────────────────────────── */
const extractList = (res) => {
    const d = res.data;
    if (Array.isArray(d)) return d;
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
    
    // Filters for Production Output by PET
    const [outputUseRange, setOutputUseRange] = useState(false);
    const [outputSingleDate, setOutputSingleDate] = useState('');
    const [outputStartDate, setOutputStartDate] = useState('');
    const [outputEndDate, setOutputEndDate] = useState('');
    const [outputPetSelected, setOutputPetSelected] = useState('');

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
            
            // Fetch last 30 days for chart data
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
            const allReportsParams = { page_size: 1000, start_date: startDate, end_date: endDate };
            
            // Fetch shifts from API
            const shiftsRes = await productionApi.getShifts();
            const shiftsData = shiftsRes.data?.data || shiftsRes.data || [];
            setShifts(shiftsData);
            
            // Determine current shift from API data
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
            
            const currentShift = shiftsData.find(shift => {
                const start = shift.start_time?.slice(0, 5);
                const end = shift.end_time?.slice(0, 5);
                if (!start || !end) return false;
                
                // Handle shifts that cross midnight
                if (start > end) {
                    return currentTime >= start || currentTime < end;
                }
                return currentTime >= start && currentTime < end;
            });
            
            // Calculate shift start time based on selected or current shift
            const targetShift = selectedShiftId 
                ? shiftsData.find(s => s.id === selectedShiftId) 
                : currentShift;
            
            let shiftStart = new Date(now);
            if (targetShift) {
                const [hours, minutes] = targetShift.start_time.split(':');
                shiftStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                
                // If shift crosses midnight and we're before the start time, shift started yesterday
                if (targetShift.start_time > targetShift.end_time && currentTime < targetShift.start_time) {
                    shiftStart.setDate(shiftStart.getDate() - 1);
                }
                
                // Store shift info for display
                setCurrentShiftInfo({
                    id: targetShift.id,
                    name: targetShift.name,
                    startTime: shiftStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                    endTime: targetShift.end_time,
                    startDateTime: shiftStart.toISOString()
                });
            } else {
                // Fallback to hardcoded logic if no shift found
                const currentHour = now.getHours();
                let shiftStartHour;
                if (currentHour >= 6 && currentHour < 14) {
                    shiftStartHour = 6;
                } else if (currentHour >= 14 && currentHour < 22) {
                    shiftStartHour = 14;
                } else {
                    shiftStartHour = 22;
                }
                
                if (currentHour < 6) {
                    shiftStart.setDate(shiftStart.getDate() - 1);
                    shiftStart.setHours(22, 0, 0, 0);
                } else {
                    shiftStart.setHours(shiftStartHour, 0, 0, 0);
                }
            }
            
            // Calculate shift end time
            const shiftEnd = new Date(now);
            if (targetShift) {
                const [endHours, endMinutes] = targetShift.end_time.split(':');
                shiftEnd.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
                
                // If shift crosses midnight and end time is less than start time, end is tomorrow
                if (targetShift.start_time > targetShift.end_time) {
                    shiftEnd.setDate(shiftEnd.getDate() + 1);
                }
            }
            
            // Use production_date and shift for filtering instead of created timestamps
            const today = new Date().toISOString().split('T')[0];
            const shiftParams = { 
                page_size: 1000, 
                production_date: today,
                shift: targetShift?.name || currentShift?.name
            };
            
            const [oeeSummaryRes, petsRes, stoppagesRes, allReportsRes, shiftRes] = await Promise.all([
                productionApi.getOeeSummary(params),
                productionApi.getPets(params),
                productionApi.getStoppages(stoppageParams),
                productionApi.getOeeSummary(allReportsParams),
                productionApi.getOeeSummary(shiftParams),
            ]);

            if (controller.signal.aborted) return;

            const reports = extractList(oeeSummaryRes);
            const allReportsData = extractList(allReportsRes);
            const shiftData = extractList(shiftRes);
            
            // Sort reports by PET name
            const sortByPet = (arr) => arr.sort((a, b) => {
                const aName = (a.pet_name || '').toLowerCase();
                const bName = (b.pet_name || '').toLowerCase();
                
                // Canline always last
                const aIsCan = aName.includes('can');
                const bIsCan = bName.includes('can');
                if (aIsCan && !bIsCan) return 1;
                if (!aIsCan && bIsCan) return -1;
                
                // Extract numbers and sort
                const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
                const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
                return aNum - bNum;
            });

            setRawReports(sortByPet(reports));
            setRawPets(extractList(petsRes));
            setRawStoppages(extractList(stoppagesRes));
            setAllReports(sortByPet(allReportsData));
            setHourlyReports(sortByPet(shiftData));
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
    }, [filters, selectedShiftId]);

    /* Re-fetch whenever filters change */
    useEffect(() => {
        loadData();
        return () => { if (abortRef.current) abortRef.current.abort(); };
    }, [loadData]);

    /* PETs available for the selected date (derived from reports) */
    const availablePets = useMemo(() => {
        return rawPets;
    }, [rawPets]);

    /* ── Derived data (recomputed when filter or raw data changes) ── */
    const { stats, oee, oeeByLine, downtimeCategories } = useMemo(() => {
        let reports = rawReports;
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
        const performance = reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.performance || 0), 0) / reports.length : 0;
        const quality = reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.quality || 0), 0) / reports.length : 0;
        const oeeValue = reports.length > 0 ? reports.reduce((s, r) => s + (r.metrics?.oee || 0), 0) / reports.length : 0;

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
                lineMap[name] = { name, reports: 0, availability: 0, quality: 0, performance: 0, oee: 0, production: 0 };
            }
            lineMap[name].reports += 1;
            lineMap[name].availability += r.metrics?.availability || 0;
            lineMap[name].quality += r.metrics?.quality || 0;
            lineMap[name].performance += r.metrics?.performance || 0;
            lineMap[name].oee += r.metrics?.oee || 0;
            lineMap[name].production += r.metrics?.details?.total_output_pcs || 0;
        });

        const oeeByLine = Object.values(lineMap).map(l => ({
            name: l.name,
            reports: l.reports,
            availability: clamp(l.availability / l.reports),
            quality: clamp(l.quality / l.reports),
            performance: clamp(l.performance / l.reports),
            oee: clamp(l.oee / l.reports),
            production: l.production,
        })).sort((a, b) => {
            const aLower = (a.name || '').toLowerCase();
            const bLower = (b.name || '').toLowerCase();
            
            // Canline always last
            const aIsCanline = aLower.includes('can');
            const bIsCanline = bLower.includes('can');
            if (aIsCanline && !bIsCanline) return 1;
            if (!aIsCanline && bIsCanline) return -1;
            
            // Extract numbers from PET names
            const aMatch = a.name?.match(/(\d+)/);
            const bMatch = b.name?.match(/(\d+)/);
            const aNum = aMatch ? parseInt(aMatch[0]) : 999;
            const bNum = bMatch ? parseInt(bMatch[0]) : 999;
            
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

        return { stats, oee: displayOee, oeeByLine, downtimeCategories };
    }, [rawReports, rawPets, rawStoppages, selectedPet, selectedDate]);

    /* Hourly OEE by Line for per-PET gauges */
    const hourlyOeeByLine = useMemo(() => {
        // Start with all available PETs
        const lineMap = {};
        rawPets.forEach(pet => {
            lineMap[pet.pet_name] = { 
                name: pet.pet_name, 
                reports: 0, 
                oee: 0, 
                production: 0, 
                downtime: 0 
            };
        });
        
        // Add data from hourly reports
        hourlyReports.forEach(r => {
            const name = r.pet_name;
            if (lineMap[name]) {
                lineMap[name].reports += 1;
                lineMap[name].oee += r.metrics?.oee || 0;
                lineMap[name].production += r.metrics?.details?.total_output_pcs || 0;
                lineMap[name].downtime += r.metrics?.details?.total_downtime_mins || 0;
            }
        });

        return Object.values(lineMap).map(l => ({
            name: l.name,
            reports: l.reports,
            oee: l.reports > 0 ? clamp(l.oee / l.reports) : 0,
            production: l.production,
            downtime: l.downtime,
        })).sort((a, b) => {
            const aLower = (a.name || '').toLowerCase();
            const bLower = (b.name || '').toLowerCase();
            const aIsCanline = aLower.includes('can');
            const bIsCanline = bLower.includes('can');
            if (aIsCanline && !bIsCanline) return 1;
            if (!aIsCanline && bIsCanline) return -1;
            const aNum = parseInt(a.name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [hourlyReports, rawPets]);

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
                            const endDate = new Date().toISOString().split('T')[0];
                            const startDate = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
                            updateFilters({ start_date: startDate, end_date: endDate, log_date: null });
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

            {/* Active Filters Alert */}
            {(filters.log_date || filters.start_date || filters.pet) && (
                <div className="alert alert-info d-flex align-items-center mb-4">
                    <i className="ti ti-filter fs-4 me-2"></i>
                    <div className="flex-grow-1">
                        <strong>Active Filters:</strong>
                        {filters.start_date && filters.end_date ? (
                            <span className="ms-2">Date Range: {filters.start_date} to {filters.end_date}</span>
                        ) : filters.log_date ? (
                            <span className="ms-2">Date: {filters.log_date}</span>
                        ) : null}
                        {filters.pet && (
                            <span className="ms-2">• PET: {availablePets.find(p => p.id === parseInt(filters.pet))?.pet_name || filters.pet}</span>
                        )}
                    </div>
                </div>
            )}

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

            {/* No Data Alert */}
            {!isLoading && !error && rawReports.length === 0 && (
                <div className="alert alert-warning d-flex align-items-center mb-4">
                    <i className="ti ti-alert-circle fs-4 me-2"></i>
                    <div>
                        <strong>No data available</strong> for the selected date{selectedPet ? ' and PET' : ''}. Please adjust your filters.
                    </div>
                </div>
            )}

            {/* Per-PET Metrics (Current Shift) */}
            {!isLoading && hourlyOeeByLine.length > 0 && (
            <>
                {/* Section Header */}
                <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body py-2">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0 fw-semibold">
                                <i className="ti ti-clock-hour-4 me-2"></i>Shift Production Metrics
                                {currentShiftInfo && (
                                    <span className="badge bg-soft-info text-info ms-2 fs-11">
                                        {currentShiftInfo.name}: {currentShiftInfo.startTime} - {currentShiftInfo.endTime}
                                    </span>
                                )}
                            </h6>
                            <div className="d-flex align-items-center gap-2">
                                <div className="btn-group btn-group-sm">
                                    {shifts.map(shift => (
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
                </div>
                {/* Line 1: Bottles per PET - Stats Cards */}
                <div className="row g-3 mb-3">
                    {hourlyOeeByLine.map(line => (
                        <div key={`bottles-${line.name}`} className="col">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body text-center">
                                    <div className="avatar bg-soft-primary rounded-circle p-2 mb-2 mx-auto" style={{ width: 40, height: 40 }}>
                                        <i className="ti ti-bottle text-primary fs-5"></i>
                                    </div>
                                    <small className="text-muted d-block fs-11">{line.name}</small>
                                    <h5 className="mb-0 text-primary fw-bold">{formatNum(Math.round(line.production))}</h5>
                                    <small className="text-muted fs-10">bottles</small>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Line 2: Downtime per PET - Stats Cards */}
                <div className="row g-3 mb-3">
                    {hourlyOeeByLine.map(line => (
                        <div key={`downtime-${line.name}`} className="col">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body text-center">
                                    <div className="avatar bg-soft-danger rounded-circle p-2 mb-2 mx-auto" style={{ width: 40, height: 40 }}>
                                        <i className="ti ti-clock-stop text-danger fs-5"></i>
                                    </div>
                                    <small className="text-muted d-block fs-11">{line.name}</small>
                                    <h5 className="mb-0 text-danger fw-bold">{formatDuration(line.downtime)}</h5>
                                    <small className="text-muted fs-10">downtime</small>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Line 3: Efficiency per PET - Gauges */}
                <div className="row g-3 mb-4">
                    {hourlyOeeByLine.map(line => (
                        <div key={`efficiency-${line.name}`} className="col d-flex justify-content-center">
                            <GaugeChart 
                                value={line.oee} 
                                label={`${line.name} - ${line.oee.toFixed(1)}%`}
                                color={line.oee >= 85 ? '#22c55e' : line.oee >= 60 ? '#f59e0b' : '#ef4444'}
                            />
                        </div>
                    ))}
                </div>
            </>
            )}

            {/* OEE Gauges */}
            {isLoading ? <SkeletonGauges count={4} /> : (
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <ChartErrorBoundary fallbackMessage="Failed to render OEE gauges">
                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">
                                Overall Equipment Effectiveness (OEE)
                                {filters.log_date && (
                                    <span className="badge bg-soft-info text-info ms-2 fs-11">
                                        <i className="ti ti-calendar me-1"></i>{filters.log_date}
                                    </span>
                                )}
                                {filters.start_date && filters.end_date && (
                                    <span className="badge bg-soft-info text-info ms-2 fs-11">
                                        <i className="ti ti-calendar me-1"></i>{filters.start_date} - {filters.end_date}
                                    </span>
                                )}
                                {filters.pet && (
                                    <span className="badge bg-soft-primary text-primary ms-2 fs-11">
                                        <i className="ti ti-building-factory-2 me-1"></i>{availablePets.find(p => p.id === parseInt(filters.pet))?.pet_name || filters.pet}
                                    </span>
                                )}
                            </h6>
                            <button onClick={() => navigate('/dashboard/formulas')} className="btn btn-outline-light shadow btn-xs">
                                <i className="ti ti-math-function me-1"></i>View Formulas
                            </button>
                        </div>
                        <div className="card-body">
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
                                            label="OEE" 
                                            color={gaugeColor(oee.oee)}
                                            formula="A × Q × P"
                                            calculation={`${(oee.availability/100).toFixed(3)} × ${(oee.quality/100).toFixed(3)} × ${(oee.performance/100).toFixed(3)} = ${oee.oee.toFixed(1)}%`}
                                            rawValues={{
                                                display: `${(oee.availability/100).toFixed(3)} × ${(oee.quality/100).toFixed(3)} × ${(oee.performance/100).toFixed(3)}`,
                                                reason: oee.oee === 0 ? (
                                                    oee.availability === 0 ? 'Availability = 0%' :
                                                    oee.quality === 0 ? 'Quality = 0%' :
                                                    oee.performance === 0 ? 'Performance = 0%' : 'OEE = 0%'
                                                ) : null
                                            }}
                                        />
                                    </div>
                                </div>
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
                            <h6 className="mb-0">OEE by Production Line</h6>
                            <button onClick={() => navigate('/dashboard/production/overview')} className="btn btn-primary btn-xs">View Charts</button>
                        </div>
                        <div className="card-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th className="ps-3">Line</th>
                                            <th className="text-center">Reports</th>
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
                                                OEE <i className="ti ti-info-circle fs-12 text-muted"></i>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {oeeByLine.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center text-muted py-4">No data available</td>
                                            </tr>
                                        ) : (
                                            oeeByLine.map((line) => (
                                                <tr key={line.name}>
                                                    <td className="ps-3 fw-medium">{line.name}</td>
                                                    <td className="text-center">{line.reports}</td>
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
                                            ))
                                        )}
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
                                            const aName = (a.pet_name || '').toLowerCase();
                                            const bName = (b.pet_name || '').toLowerCase();
                                            const aIsCan = aName.includes('can');
                                            const bIsCan = bName.includes('can');
                                            if (aIsCan && !bIsCan) return 1;
                                            if (!aIsCan && bIsCan) return -1;
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
                                            className={`btn ${filters.log_date || (!filters.start_date && !filters.end_date) ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => {
                                                const today = new Date().toISOString().split('T')[0];
                                                updateFilters({ log_date: today, start_date: null, end_date: null });
                                            }}
                                        >
                                            Week
                                        </button>
                                        <button 
                                            className={`btn ${filters.start_date && filters.end_date ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => {
                                                const endDate = new Date().toISOString().split('T')[0];
                                                const startDate = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
                                                updateFilters({ start_date: startDate, end_date: endDate, log_date: null });
                                            }}
                                        >
                                            Month
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {(() => {
                                // Filter reports by local date filters
                                let filteredReports = [...allReports];
                                
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

                                // Group reports by date and PET
                                const grouped = {};
                                filteredReports.forEach(r => {
                                    const date = r.production_date;
                                    if (!grouped[date]) grouped[date] = {};
                                    const petName = r.pet_name;
                                    if (!grouped[date][petName]) {
                                        grouped[date][petName] = 0;
                                    }
                                    grouped[date][petName] += r.metrics?.details?.total_output_pcs || 0;
                                });

                                // Create series for each PET
                                const petNames = [...new Set(filteredReports.map(r => r.pet_name))].sort((a, b) => {
                                    const aName = (a || '').toLowerCase();
                                    const bName = (b || '').toLowerCase();
                                    const aIsCan = aName.includes('can');
                                    const bIsCan = bName.includes('can');
                                    if (aIsCan && !bIsCan) return 1;
                                    if (!aIsCan && bIsCan) return -1;
                                    const aNum = parseInt(a?.match(/(\d+)/)?.[0] || '999');
                                    const bNum = parseInt(b?.match(/(\d+)/)?.[0] || '999');
                                    return aNum - bNum;
                                });

                                const series = petNames.map(pet => ({
                                    name: pet,
                                    data: dates.map(date => grouped[date]?.[pet] || 0)
                                }));

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
                                                            return `${d.getMonth() + 1}/${d.getDate()}`;
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
