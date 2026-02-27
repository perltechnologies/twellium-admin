import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionApi } from '../../api/production';

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
    const a = l.plannedMins > 0 ? ((l.plannedMins - l.downtimeMins) / l.plannedMins) * 100 : 0;
    const q = l.target > 0 ? (l.actual / l.target) * 100 : 0;
    const runH = (l.plannedMins - l.downtimeMins) / 60;
    let p = 0;
    if (l.speedline > 0 && runH > 0) {
        p = (l.actual / (l.speedline * runH)) * 100;
    } else if (l.target > 0) {
        p = (l.actual / l.target) * 100;
    }
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
const GaugeChart = ({ value, label, color }) => {
    const pct = Math.min(100, Math.max(0, value));
    const cx = 100, cy = 90, r = 70;
    const trackColor = '#e9ecef';
    const fillColor = color || (pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444');

    const startX = cx - r, startY = cy;
    const endFull = { x: cx + r, y: cy };

    const angle = Math.PI * (1 - pct / 100);
    const endX = +(cx + r * Math.cos(angle)).toFixed(2);
    const endY = +(cy - r * Math.sin(angle)).toFixed(2);
    const largeArc = pct > 50 ? 1 : 0;

    return (
        <div className="text-center">
            <svg width="200" height="120" viewBox="0 0 200 120">
                <path
                    d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endFull.x} ${endFull.y}`}
                    fill="none" stroke={trackColor} strokeWidth="14" strokeLinecap="round"
                />
                {pct > 0.5 && (
                    <path
                        d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
                        fill="none" stroke={fillColor} strokeWidth="14" strokeLinecap="round"
                    />
                )}
                <text x={cx} y={cy - 12} textAnchor="middle" fontSize="24" fontWeight="bold" fill="#1f2937">
                    {pct.toFixed(1)}%
                </text>
                <text x={cx} y={cy + 8} textAnchor="middle" fontSize="12" fill="#6b7280">
                    {label}
                </text>
            </svg>
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

        const stats = {
            activeLines: selectedPet ? 1 : pets.length,
            shiftsStarted: startedShifts,
            totalDowntime: Math.round(totalDowntime),
            stoppagesToday,
            recentReports: Math.min(reports.length, 10),
            totalProduced,
        };

        /* OEE */
        const shiftHours = shifts.length > 0 ? (shifts[0].duration_hours || 8) : 8;
        let totalPlannedMins = 0, totalDowntimeMins = 0, totalActual = 0, totalTarget = 0;
        const lineOeeMap = {};

        reports.forEach(r => {
            const plannedMins = (r.shift_duration_hours || shiftHours) * 60;
            let reportDowntime = 0;
            (r.stoppage_logs || []).forEach(log => {
                reportDowntime += log.downtime_minutes || 0;
                (log.incidents || []).forEach(inc => { reportDowntime += inc.incident_duration || 0; });
            });
            const actual = r.total_bottles_produced || 0;
            const target = r.target_output || r.planned_output || 0;

            totalPlannedMins += plannedMins;
            totalDowntimeMins += reportDowntime;
            totalActual += actual;
            totalTarget += target > 0 ? target : actual;

            const lineName = r.pet_name || 'Unknown';
            if (!lineOeeMap[lineName]) {
                lineOeeMap[lineName] = { name: lineName, plannedMins: 0, downtimeMins: 0, actual: 0, target: 0, speedline: 0, reports: 0 };
            }
            lineOeeMap[lineName].plannedMins += plannedMins;
            lineOeeMap[lineName].downtimeMins += reportDowntime;
            lineOeeMap[lineName].actual += actual;
            lineOeeMap[lineName].target += target > 0 ? target : actual;
            lineOeeMap[lineName].reports += 1;

            const pet = pets.find(p => (p.pet_name || p.name) === lineName);
            if (pet && pet.speedline) lineOeeMap[lineName].speedline = pet.speedline;
        });

        const availability = totalPlannedMins > 0
            ? ((totalPlannedMins - totalDowntimeMins) / totalPlannedMins) * 100 : 0;
        const quality = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

        let performance = 0;
        const totalSpeedCapacity = Object.values(lineOeeMap).reduce((sum, l) => {
            return sum + (l.speedline > 0 ? l.speedline * (l.plannedMins - l.downtimeMins) / 60 : 0);
        }, 0);
        if (totalSpeedCapacity > 0) {
            performance = (totalActual / totalSpeedCapacity) * 100;
        } else if (totalTarget > 0) {
            performance = (totalActual / totalTarget) * 100;
        }

        const a01 = Math.min(1, Math.max(0, availability / 100));
        const q01 = Math.min(1, Math.max(0, quality / 100));
        const p01 = Math.min(1, Math.max(0, performance / 100));

        const oee = {
            availability: clamp(availability),
            quality: clamp(quality),
            performance: clamp(performance),
            oee: clamp(a01 * q01 * p01 * 100),
        };

        const oeeByLine = Object.values(lineOeeMap)
            .map(computeLineOee)
            .sort((a, b) => b.oee - a.oee);

        /* Downtime breakdown by category (from stoppage_logs → incidents) */
        const downtimeMap = {};
        reports.forEach(r => {
            (r.stoppage_logs || []).forEach(log => {
                (log.incidents || []).forEach(inc => {
                    const cat = inc.downtime_category_name || 'Other';
                    const dur = inc.incident_duration || 0;
                    downtimeMap[cat] = (downtimeMap[cat] || 0) + dur;
                });
            });
        });
        
        const categoryColors = {
            'Mechanical': '#ef4444',
            'Planned': '#3b82f6',
            'Electrical': '#f59e0b',
            'Quality': '#8b5cf6',
            'Material': '#10b981',
            'Other': '#6b7280'
        };
        
        const downtimeCategories = Object.entries(downtimeMap)
            .map(([name, value]) => ({
                name: name,
                value: Math.round(Number(value) || 0),
                color: categoryColors[name] || categoryColors['Other']
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);

        return { stats, oee, oeeByLine, downtimeCategories };
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
            subtext: `${stats.stoppagesToday} stoppages${selectedDate ? '' : ' recorded today'}`,
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
                                        <GaugeChart value={oee.availability} label="Availability" color={gaugeColor(oee.availability)} />
                                    </div>
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart value={oee.quality} label="Quality" color={gaugeColor(oee.quality)} />
                                    </div>
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart value={oee.performance} label="Performance" color={gaugeColor(oee.performance)} />
                                    </div>
                                    <div className="col-lg-3 col-sm-6 d-flex justify-content-center">
                                        <GaugeChart value={oee.oee} label="OEE" color={gaugeColor(oee.oee)} />
                                    </div>
                                </div>
                            )}
                            {/* Legend */}
                            {!loading && (
                                <div className="d-flex align-items-center justify-content-center gap-4 mt-3 pt-3 border-top">
                                    <span className="d-flex align-items-center gap-1 fs-13">
                                        <i className="ti ti-circle-filled" style={{ color: '#22c55e', fontSize: 8 }}></i> ≥85% World Class
                                    </span>
                                    <span className="d-flex align-items-center gap-1 fs-13">
                                        <i className="ti ti-circle-filled" style={{ color: '#f59e0b', fontSize: 8 }}></i> 60–84% Acceptable
                                    </span>
                                    <span className="d-flex align-items-center gap-1 fs-13">
                                        <i className="ti ti-circle-filled" style={{ color: '#ef4444', fontSize: 8 }}></i> &lt;60% Needs Improvement
                                    </span>
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
                            <h6 className="mb-0">Downtime Breakdown (Minutes)</h6>
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
                                                                    <i className="ti ti-alert-triangle text-white"></i>
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
                                            <th className="text-center">Availability</th>
                                            <th className="text-center">Quality</th>
                                            <th className="text-center">Performance</th>
                                            <th className="text-center">OEE</th>
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
