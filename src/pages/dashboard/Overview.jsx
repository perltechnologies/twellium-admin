import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';
import { groupDowntimeAndSum } from '../../utils/downtime';

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

const computeLineOee = (l) => {
    const PT  = l.plannedMins / 60;
    const TDT = l.downtimeMins / 60;
    const MDT = (l.mechDowntime || 0) / 60;
    const PDT = (l.plannedDowntime || 0) / 60;
    const TP  = l.fillerReading || 0;
    const FR  = l.fillerRejects || 0;

    const aDen = PT - MDT;
    const a = aDen > 0 ? ((PT - TDT) / aDen) * 100 : 0;
    const pDen = PT - PDT;
    const p = pDen > 0 ? ((PT - TDT) / pDen) * 100 : 0;
    const q = TP > 0 ? ((TP - FR) / TP) * 100 : 0;

    const oeeVal = (Math.min(1, a / 100) * Math.min(1, q / 100) * Math.min(1, p / 100)) * 100;
    return {
        name: l.name,
        availability: clamp(a),
        quality: clamp(q),
        performance: clamp(p),
        oee: clamp(oeeVal),
        reports: l.reports,
    };
};

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
        <div className="d-flex flex-column align-items-center">
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
    const [loading, setLoading] = useState(true);
    const [selectedPet, setSelectedPet] = useState('');   // '' = All Lines
    const [selectedDate, setSelectedDate] = useState(''); // '' = All Dates (YYYY-MM-DD)

    /* raw data from API */
    const [rawReports, setRawReports] = useState([]);
    const [rawPets, setRawPets] = useState([]);
    const [rawStoppages, setRawStoppages] = useState([]);
    const [rawShifts, setRawShifts] = useState([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [reportsRes, petsRes, stoppagesRes, shiftsRes] = await Promise.all([
                productionApi.getReports({ page_size: 500 }),
                productionApi.getPets({ page_size: 100 }),
                productionApi.getStoppages({ page_size: 1000 }),
                productionApi.getShifts(),
            ]);
            setRawReports(extractList(reportsRes));
            setRawPets(extractList(petsRes));
            setRawStoppages(extractList(stoppagesRes));
            setRawShifts(extractList(shiftsRes));
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    /* PETs available for the selected date (derived from reports) */
    const availablePets = useMemo(() => {
        let filtered = rawReports;
        if (selectedDate) {
            filtered = filtered.filter(r => (r.production_date || '').slice(0, 10) === selectedDate);
        }
        const petNames = [...new Set(filtered.map(r => r.pet_name).filter(Boolean))];
        return rawPets.filter(p => petNames.includes(p.pet_name || p.name));
    }, [rawReports, rawPets, selectedDate]);

    /* Reset PET selection when date changes and current PET has no data for that date */
    useEffect(() => {
        if (selectedPet && availablePets.length > 0) {
            const stillAvailable = availablePets.some(p => (p.pet_name || p.name) === selectedPet);
            if (!stillAvailable) setSelectedPet('');
        }
    }, [availablePets, selectedPet]);

    /* ── Derived data (recomputed when filter or raw data changes) ── */
    const { stats, oee, oeeByLine, downtimeCategories } = useMemo(() => {
        const pets = rawPets;
        const shifts = rawShifts;

        /* Filter reports by date first, then by PET */
        let reports = selectedDate
            ? rawReports.filter(r => (r.production_date || '').slice(0, 10) === selectedDate)
            : rawReports;
        if (selectedPet) {
            reports = reports.filter(r => (r.pet_name || '') === selectedPet);
        }

        let stoppages = rawStoppages;
        if (selectedDate) {
            stoppages = stoppages.filter(s => {
                const d = (s.created_at || s.start_time || '').slice(0, 10);
                return d === selectedDate;
            });
        }
        if (selectedPet) {
            stoppages = stoppages.filter(s => (s.pet_name || s.line_name || '') === selectedPet);
        }

        /* Stats */
        const refDate = selectedDate || new Date().toISOString().slice(0, 10);
        const startedShifts = reports.filter(r => r.status === 'STARTED').length;
        const stoppagesToday = stoppages.filter(s => {
            const d = (s.created_at || s.start_time || '').slice(0, 10);
            return d === refDate;
        }).length;
        let totalDowntime = 0;
        stoppages.forEach(s => { totalDowntime += s.downtime_minutes || s.duration || 0; });
        let totalProduced = 0;
        reports.forEach(r => { totalProduced += r.total_bottles_produced || 0; });

        let mechDowntime = 0, plannedDowntime = 0;
        stoppages.forEach(s => {
            (s.incidents || []).forEach(inc => {
                const cat = (inc.downtime_category_name || '').toLowerCase();
                const dur = inc.incident_duration || 0;
                if (cat.includes('mechanical')) mechDowntime += dur;
                else if (cat.includes('planned')) plannedDowntime += dur;
            });
        });

        const stats = {
            activeLines: selectedPet ? 1 : pets.length,
            shiftsStarted: startedShifts,
            totalDowntime: Math.round(totalDowntime),
            mechDowntime: Math.round(mechDowntime),
            plannedDowntime: Math.round(plannedDowntime),
            stoppagesToday,
            recentReports: Math.min(reports.length, 10),
            totalProduced,
        };

        /* OEE */
        let totalPlannedMins = 0;
        let totalFillerReading = 0, totalFillerRejects = 0;
        const lineOeeMap = {};

        // Planned time from reports start/end times; filler data from meter_readings
        reports.forEach(r => {
            let plannedMins = 0;
            if (r.start_time && r.end_time) {
                const [sh, sm] = r.start_time.split(':').map(Number);
                const [eh, em] = r.end_time.split(':').map(Number);
                let startM = sh * 60 + sm, endM = eh * 60 + em;
                if (endM <= startM) endM += 24 * 60;
                plannedMins = endM - startM;
            } else if (r.total_production_time_hours) {
                plannedMins = parseFloat(r.total_production_time_hours) * 60;
            }
            totalPlannedMins += plannedMins;

            (r.meter_readings || []).forEach(m => {
                totalFillerReading += parseFloat(m.filler_reading || 0);
                totalFillerRejects += parseFloat(m.filler_rejects || 0);
            });

            const lineName = r.pet_name || 'Unknown';
            if (!lineOeeMap[lineName]) {
                lineOeeMap[lineName] = { name: lineName, plannedMins: 0, downtimeMins: 0, mechDowntime: 0, plannedDowntime: 0, fillerReading: 0, fillerRejects: 0, reports: 0 };
            }
            lineOeeMap[lineName].plannedMins += plannedMins;
            lineOeeMap[lineName].reports += 1;
            (r.meter_readings || []).forEach(m => {
                lineOeeMap[lineName].fillerReading += parseFloat(m.filler_reading || 0);
                lineOeeMap[lineName].fillerRejects += parseFloat(m.filler_rejects || 0);
            });
        });

        // Total/Mechanical/Planned downtime per line from stoppages
        stoppages.forEach(s => {
            const lineName = s.pet_name || s.line_name || 'Unknown';
            if (!lineOeeMap[lineName]) {
                lineOeeMap[lineName] = { name: lineName, plannedMins: 0, downtimeMins: 0, mechDowntime: 0, plannedDowntime: 0, fillerReading: 0, fillerRejects: 0, reports: 0 };
            }
            lineOeeMap[lineName].downtimeMins += (s.downtime_minutes || 0);
            (s.incidents || []).forEach(inc => {
                const dur = parseFloat(inc.incident_duration || 0);
                const cat = (inc.downtime_category_name || '').toLowerCase();
                if (cat.includes('mechanical')) lineOeeMap[lineName].mechDowntime += dur;
                if (cat.includes('planned'))    lineOeeMap[lineName].plannedDowntime += dur;
            });
        });

        // Global OEE using confirmed formula variables
        const totalDowntimeMins   = stats.totalDowntime;
        // Sum from lineOeeMap to avoid string-concatenation bug on incident_duration (API returns string)
        const totalMechMins      = Object.values(lineOeeMap).reduce((s, l) => s + l.mechDowntime, 0);
        const totalPlannedDtMins = Object.values(lineOeeMap).reduce((s, l) => s + l.plannedDowntime, 0);

        const PT  = totalPlannedMins / 60;
        const TDT = totalDowntimeMins / 60;
        const MDT = totalMechMins / 60;
        const PDT = totalPlannedDtMins / 60;

        const aDen = PT - MDT;
        const availability = aDen > 0 ? ((PT - TDT) / aDen) * 100 : 0;
        const pDen = PT - PDT;
        const performance  = pDen > 0 ? ((PT - TDT) / pDen) * 100 : 0;
        const quality      = totalFillerReading > 0 ? ((totalFillerReading - totalFillerRejects) / totalFillerReading) * 100 : 0;

        const a01 = Math.min(1, Math.max(0, availability / 100));
        const q01 = Math.min(1, Math.max(0, quality / 100));
        const p01 = Math.min(1, Math.max(0, performance / 100));

        const oee = {
            availability: clamp(availability),
            quality: clamp(quality),
            performance: clamp(performance),
            oee: clamp(a01 * q01 * p01 * 100),
            rawValues: {
                plannedMins: totalPlannedMins,
                totalDowntimeMins,
                mechDowntimeMins: totalMechMins,
                plannedDowntimeMins: totalPlannedDtMins,
                fillerReading: totalFillerReading,
                fillerRejects: totalFillerRejects,
            }
        };

        const oeeByLine = Object.values(lineOeeMap)
            .map(computeLineOee)
            .sort((a, b) => b.oee - a.oee);

        /* If a specific PET is selected, use its OEE for the gauges */
        let displayOee = oee;
        if (selectedPet && oeeByLine.length > 0) {
            const selectedLineOee = oeeByLine.find(l => l.name === selectedPet);
            if (selectedLineOee) {
                const ld = lineOeeMap[selectedPet];
                displayOee = {
                    availability: selectedLineOee.availability,
                    quality: selectedLineOee.quality,
                    performance: selectedLineOee.performance,
                    oee: selectedLineOee.oee,
                    rawValues: {
                        plannedMins: ld.plannedMins,
                        totalDowntimeMins: ld.downtimeMins,
                        mechDowntimeMins: ld.mechDowntime,
                        plannedDowntimeMins: ld.plannedDowntime,
                        fillerReading: ld.fillerReading,
                        fillerRejects: ld.fillerRejects,
                    }
                };
            }
        }

        /* Downtime breakdown by category (from stoppages → incidents) */
        const groupedDowntime = groupDowntimeAndSum(stoppages);

        const categoryColors = {
            'Mechanical Downtime': '#ef4444',
            'Mechanical': '#ef4444',
            'Planned Downtime': '#3b82f6',
            'Planned': '#3b82f6',
            'Electrical': '#f59e0b',
            'Quality': '#8b5cf6',
            'Material': '#10b981',
            'Other': '#6b7280',
            'Uncategorized': '#9ca3af',
            'No Incidents Logged': '#d1d5db',
        };

        const categorisedMins = groupedDowntime.reduce((s, d) => s + (parseFloat(d.totalDowntimeMinutes) || 0), 0);
        const noIncidentMins = Math.round(stats.totalDowntime) - Math.round(categorisedMins);

        const downtimeCategories = [
            ...groupedDowntime.map(item => ({
                name: item.category,
                value: Math.round(Number(item.totalDowntimeMinutes) || 0),
                color: categoryColors[item.category] || categoryColors['Other'],
            })),
            ...(noIncidentMins > 0 ? [{
                name: 'No Incidents Logged',
                value: noIncidentMins,
                color: categoryColors['No Incidents Logged'],
            }] : []),
        ].filter(d => d.value > 0).sort((a, b) => b.value - a.value);

        return { stats, oee: displayOee, oeeByLine, downtimeCategories };
    }, [rawReports, rawPets, rawStoppages, rawShifts, selectedPet, selectedDate]);

    const statCards = [
        {
            label: selectedPet || 'Active PET Lines',
            value: selectedPet ? stats.recentReports : stats.activeLines,
            subtext: selectedPet ? `${stats.shiftsStarted} shifts currently started` : `${stats.shiftsStarted} shifts currently started`,
            icon: 'ti-building-factory-2', color: 'success', elemnt: 'elemnt-02',
        },
        {
            label: 'Total Downtime', value: formatDuration(stats.totalDowntime),
            subtext: 'All production stoppages',
            icon: 'ti-clock-pause', color: 'danger', elemnt: 'elemnt-04',
        },
        {
            label: 'Recent Reports', value: stats.recentReports,
            subtext: 'Latest submissions',
            icon: 'ti-file-report', color: 'primary', elemnt: 'elemnt-01',
        },
        {
            label: 'Total Produced', value: formatNum(stats.totalProduced),
            subtext: selectedPet ? `Bottles on ${selectedPet}` : 'Bottles across all lines',
            icon: 'ti-bottle', color: 'warning', elemnt: 'elemnt-03',
        },
    ];

    const gaugeColor = (v) => v >= 85 ? '#22c55e' : v >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <>
            {/* Page Header */}
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                <h4 className="mb-0">Dashboard</h4>
                <div className="d-flex align-items-center gap-2">
                    <button onClick={() => navigate('/dashboard/production/overview')} className="btn btn-outline-primary btn-sm shadow">
                        <i className="ti ti-chart-bar me-1"></i>Production Charts
                    </button>
                    <button className="btn btn-icon btn-outline-light shadow" title="Refresh" onClick={loadData}>
                        <i className={`ti ti-refresh${loading ? ' spin' : ''}`}></i>
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
                <div className="d-flex align-items-center gap-2">
                    <i className="ti ti-filter fs-16 text-muted"></i>
                    <input
                        type="date"
                        className="form-control form-control-sm shadow"
                        style={{ width: 160 }}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    {selectedDate && (
                        <button
                            className="btn btn-outline-secondary btn-sm shadow px-2"
                            title="Clear date"
                            onClick={() => setSelectedDate('')}
                        >
                            <i className="ti ti-x fs-14"></i>
                        </button>
                    )}
                </div>
                <select
                    className="form-select form-select-sm shadow"
                    style={{ width: 200 }}
                    value={selectedPet}
                    onChange={(e) => setSelectedPet(e.target.value)}
                >
                    <option value="">All PET Lines{selectedDate ? ` (${availablePets.length})` : ''}</option>
                    {availablePets.map(p => (
                        <option key={p.id} value={p.pet_name || p.name}>
                            {p.pet_name || p.name}
                        </option>
                    ))}
                </select>
                {(selectedDate || selectedPet) && (
                    <button
                        className="btn btn-soft-danger btn-sm"
                        onClick={() => { setSelectedDate(''); setSelectedPet(''); }}
                    >
                        <i className="ti ti-filter-off me-1"></i>Clear Filters
                    </button>
                )}
            </div>

            {/* Stat Cards */}
            <div className="row row-gap-3 mb-4">
                {statCards.map((card) => (
                    <div key={card.label} className="col-xl-3 col-sm-6 d-flex">
                        <div className="card flex-fill mb-0 position-relative overflow-hidden">
                            <div className="card-body position-relative z-1">
                                <div className="d-flex align-items-start justify-content-between">
                                    <div className="d-flex align-items-start justify-content-between">
                                        <div>
                                            <p className="fs-14 mb-1">{card.label}</p>
                                            <h2 className="mb-1 fs-16">{loading ? '…' : card.value}</h2>
                                            <p className="text-muted mb-0 fs-13">{loading ? '' : card.subtext}</p>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className={`avatar avatar-md rounded-circle bg-soft-${card.color} border border-${card.color}`}>
                                            <i className={`ti ${card.icon} fs-16 text-${card.color}`}></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <img src={`/assets/img/icons/${card.elemnt}.svg`} alt="" className="img-fluid position-absolute top-0 start-0" />
                        </div>
                    </div>
                ))}
            </div>

            {/* OEE Gauges */}
            <div className="row row-gap-3 mb-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <h6 className="mb-0">Overall Equipment Effectiveness (OEE)</h6>
                            <button onClick={() => navigate('/dashboard/formulas')} className="btn btn-outline-light shadow btn-xs">
                                <i className="ti ti-math-function me-1"></i>View Formulas
                            </button>
                        </div>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>
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
                                            calculation={oee.rawValues ? `(${Number(oee.rawValues.fillerReading || 0).toLocaleString()} - ${Number(oee.rawValues.fillerRejects || 0).toLocaleString()}) / ${Number(oee.rawValues.fillerReading || 0).toLocaleString()} × 100 = ${oee.quality.toFixed(1)}%` : ''}
                                            rawValues={oee.rawValues ? {
                                                display: `(${Number(oee.rawValues.fillerReading || 0).toLocaleString()} - ${Number(oee.rawValues.fillerRejects || 0).toLocaleString()}) / ${Number(oee.rawValues.fillerReading || 0).toLocaleString()} × 100`,
                                                reason: oee.quality === 0 ? (oee.rawValues.fillerReading === 0 ? 'Filler Reading = 0' : 'Quality = 0%') : null
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
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Downtime Breakdown + OEE by Line */}
            <div className="row row-gap-3 mb-4">
                {/* Downtime Breakdown */}
                <div className="col-5 col-md-5 d-flex">
                    <div className="card flex-fill">
                        <div className="card-header d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="mb-0">Downtime Breakdown (Minutes)</h6>
                                <small className="text-muted">Impacts Availability = (Planned - Downtime) / Planned × 100</small>
                            </div>
                            <button onClick={() => navigate('/dashboard/production/stoppages')} className="btn btn-primary btn-xs">
                                <i className="ti ti-external-link me-1"></i>Details
                            </button>
                        </div>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center py-5"><span className="spinner-border spinner-border-sm"></span></div>
                            ) : (() => {
                                const totalDowntime = downtimeCategories.reduce((sum, d) => sum + d.value, 0);
                                return downtimeCategories.length === 0 || totalDowntime === 0 ? (
                                    <div className="text-center text-muted py-5">
                                        <i className="ti ti-clock-pause fs-1 mb-3 d-block"></i>
                                        <p className="mb-0">No downtime recorded</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Total Summary */}
                                        <div className="alert alert-light border mb-4">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div>
                                                    <small className="text-muted d-block mb-1">Total Downtime</small>
                                                    <h4 className="mb-0">{formatDuration(totalDowntime)}</h4>
                                                </div>
                                                <span className="avatar avatar-lg bg-soft-danger text-danger">
                                                    <i className="ti ti-clock-pause fs-4"></i>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Category Breakdown */}
                                        <div className="d-flex flex-column gap-3">
                                            {downtimeCategories.map(cat => {
                                                const percentage = totalDowntime > 0 ? ((cat.value / totalDowntime) * 100).toFixed(1) : 0;
                                                return (
                                                    <div key={cat.name} className="border rounded p-3" style={{
                                                        transition: 'all 0.3s ease',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="avatar avatar-sm" style={{ backgroundColor: cat.color }}>
                                                                    <i className={`ti ${cat.name === 'No Incidents Logged' ? 'ti-question-mark' : 'ti-alert-triangle'} text-white`}></i>
                                                                </span>
                                                                <span className="fw-semibold">{cat.name}</span>
                                                            </div>
                                                            <div className="text-end">
                                                                <div className="fw-bold">{formatDuration(cat.value)}</div>
                                                                <small className="text-muted">{percentage}%</small>
                                                            </div>
                                                        </div>
                                                        <div className="progress" style={{ height: 8, backgroundColor: '#f3f4f6' }}>
                                                            <div
                                                                className="progress-bar"
                                                                role="progressbar"
                                                                style={{
                                                                    width: `${percentage}%`,
                                                                    backgroundColor: cat.color,
                                                                    transition: 'width 0.8s ease'
                                                                }}
                                                                aria-valuenow={percentage}
                                                                aria-valuemin="0"
                                                                aria-valuemax="100"
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
                {/* OEE by Line Table */}
                <div className="col-xl-7 d-flex">
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
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="text-center text-muted py-4">
                                                    <span className="spinner-border spinner-border-sm me-2"></span> Loading…
                                                </td>
                                            </tr>
                                        ) : oeeByLine.length === 0 ? (
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
                </div>
            </div>
        </>
    );
};

export default Overview;
