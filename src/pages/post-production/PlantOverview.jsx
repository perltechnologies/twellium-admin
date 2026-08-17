import React, { useState, useEffect, useMemo } from 'react';
import { productionApi } from '../../api/production';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const OEE_TARGET = 85;
const SYRUP_TARGET = 98;
const CO2_TARGET = 90;

// Circular gauge component
const CircularGauge = ({ value, label, size = 70, color }) => {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(Math.max(value || 0, 0), 100);
    const strokeDashoffset = circumference - (pct / 100) * circumference;
    const gaugeColor = color || (pct >= 85 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444');

    return (
        <div className="text-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                    cx={size / 2} cy={size / 2} r={radius} fill="none"
                    stroke={gaugeColor} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={size > 60 ? 14 : 11} fontWeight="bold" fill={gaugeColor}>
                    {pct > 0 ? `${pct.toFixed(0)}%` : 'N/A'}
                </text>
            </svg>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        </div>
    );
};

// Status badge
const StatusBadge = ({ status }) => {
    const config = {
        RUNNING: { bg: '#16a34a', text: 'RUNNING' },
        MECHANICAL_FAULT: { bg: '#dc2626', text: 'MECHANICAL FAULT' },
        IDLE: { bg: '#64748b', text: 'IDLE' },
        PLANNED_STOP: { bg: '#2563eb', text: 'PLANNED STOP' },
    };
    const c = config[status] || config.RUNNING;
    return (
        <div style={{ background: c.bg, color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 12px', borderRadius: 12, textAlign: 'center', letterSpacing: '0.5px' }}>
            ● {c.text}
        </div>
    );
};

const PlantOverview = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [selectedShift, setSelectedShift] = useState('');
    const [shifts, setShifts] = useState([]);

    useEffect(() => {
        const fetchShifts = async () => {
            try {
                const res = await productionApi.getShifts();
                const list = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? [];
                setShifts(Array.isArray(list) ? list : list.results || []);
            } catch (e) { console.error(e); }
        };
        fetchShifts();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = { start_date: selectedDate, end_date: selectedDate };
                if (selectedShift) params.shift = selectedShift;
                const res = await productionApi.getProductionSummary(params);
                const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
                setData(envelope);
            } catch (e) {
                console.error('Failed to fetch plant overview:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedDate, selectedShift]);

    const summary = data?.summary || {};
    const dailyBreakdown = data?.daily_breakdown || [];
    const dayData = dailyBreakdown[0] || {};
    const allPets = useMemo(() =>
        (dayData?.pets || []).filter(p => !(p.pet_name || '').toLowerCase().includes('can'))
    , [dayData]);

    // Group by pet line (aggregate products into one line card)
    const lineCards = useMemo(() => {
        const lineMap = {};
        allPets.forEach(pet => {
            const name = pet.pet_name;
            if (!lineMap[name]) {
                lineMap[name] = {
                    pet_name: name,
                    product_name: pet.product_name,
                    products: [],
                    oee: 0, availability: 0, performance: 0, quality: 0,
                    total_bottles: 0, total_packs: 0,
                    total_downtime_minutes: 0, planned_downtime_mins: 0, mechanical_downtime_mins: 0,
                    syrup_yield: null, co2_yield: null,
                    syrup_total_actual: 0, syrup_total_std: 0,
                    co2_total_actual: 0, co2_total_std: 0,
                    count: 0,
                };
            }
            const line = lineMap[name];
            line.products.push(pet.product_name);
            line.oee += (pet.oee || pet.efficiency || 0);
            line.availability += (pet.availability || 0);
            line.performance += (pet.performance || 0);
            line.quality += (pet.quality || 0);
            line.total_bottles += (pet.total_bottles || 0);
            line.total_packs += (pet.total_packs || 0);
            line.total_downtime_minutes += (pet.total_downtime_minutes || 0);
            line.planned_downtime_mins += (pet.planned_downtime_mins || 0);
            line.mechanical_downtime_mins += (pet.mechanical_downtime_mins || 0);
            if (pet.syrup_yield !== null && pet.syrup_yield !== undefined) {
                line.syrup_yield = (line.syrup_yield || 0) + pet.syrup_yield;
                // Cumulative weighting by volume
                const actualSyrup = pet.meters_reading?.syrup?.total_syrup_used_l
                    || pet.total_syrup_used_l || pet.syrup_used_liters || 0;
                const stdSyrup = pet.meters_reading?.syrup?.std_syrup_consumption_l
                    || pet.std_syrup_consumption_l || 0;
                if (actualSyrup > 0 && stdSyrup > 0) {
                    line.syrup_total_actual += actualSyrup;
                    line.syrup_total_std += stdSyrup;
                } else {
                    const weight = actualSyrup > 0 ? actualSyrup : (pet.total_bottles_produced || pet.total_bottles || pet.total_packs || 1);
                    line.syrup_total_actual += weight;
                    line.syrup_total_std += weight * (pet.syrup_yield / 100);
                }
            }
            if (pet.co2_yield !== null && pet.co2_yield !== undefined) {
                line.co2_yield = (line.co2_yield || 0) + pet.co2_yield;
                const actualCo2 = pet.meters_reading?.co2?.total_co2_consumed_kg
                    || pet.total_co2_consumed_kg || 0;
                const stdCo2 = pet.meters_reading?.co2?.std_co2_consumption_kg
                    || pet.std_co2_consumption_kg || 0;
                if (actualCo2 > 0 && stdCo2 > 0) {
                    line.co2_total_actual += actualCo2;
                    line.co2_total_std += stdCo2;
                } else {
                    const weight = actualCo2 > 0 ? actualCo2 : (pet.total_bottles_produced || pet.total_bottles || pet.total_packs || 1);
                    line.co2_total_actual += weight;
                    line.co2_total_std += weight * (pet.co2_yield / 100);
                }
            }
            line.count += 1;
        });

        return Object.values(lineMap).map(line => ({
            ...line,
            oee: line.count > 0 ? line.oee / line.count : 0,
            availability: line.count > 0 ? line.availability / line.count : 0,
            performance: line.count > 0 ? line.performance / line.count : 0,
            quality: line.count > 0 ? line.quality / line.count : 0,
            syrup_yield: line.syrup_total_actual > 0 ? (line.syrup_total_std / line.syrup_total_actual) * 100 : null,
            co2_yield: line.co2_total_actual > 0 ? (line.co2_total_std / line.co2_total_actual) * 100 : null,
            product_name: [...new Set(line.products)].join(', '),
            status: line.mechanical_downtime_mins > line.planned_downtime_mins ? 'MECHANICAL_FAULT' : 'RUNNING',
        })).sort((a, b) => {
            const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [allPets]);

    // Downtime Pareto data
    const downtimePareto = useMemo(() => {
        return lineCards.map(line => ({
            name: line.pet_name?.replace(/pet\s*/i, 'Line '),
            Mechanical: Math.round(line.mechanical_downtime_mins),
            Planned: Math.round(line.planned_downtime_mins),
        }));
    }, [lineCards]);

    // Yield tracker data
    const yieldData = useMemo(() => {
        return lineCards.map(line => ({
            name: line.pet_name?.replace(/pet\s*/i, 'Line '),
            syrup_yield: line.syrup_yield !== null ? parseFloat(line.syrup_yield.toFixed(1)) : null,
            co2_yield: line.co2_yield !== null ? parseFloat(line.co2_yield.toFixed(1)) : null,
        }));
    }, [lineCards]);

    const shiftLabel = selectedShift ? shifts.find(s => String(s.id) === String(selectedShift))?.name || '' : 'All Shifts';

    const fmt = (v) => v != null ? Number(v).toLocaleString() : '0';

    return (
        <div style={{ background: '#0f172a', minHeight: '100vh', padding: '16px', color: '#e2e8f0', margin: '-24px', marginBottom: '-48px' }}>
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0 fw-bold" style={{ color: '#f1f5f9', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '15px' }}>
                    Total PET Beverage Production Plant Overview | Live Dashboard | {shiftLabel}
                </h5>
                <div className="d-flex gap-2 align-items-center no-print">
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        style={{ width: 150, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    <select
                        className="form-select form-select-sm"
                        style={{ width: 140, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }}
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                    >
                        <option value="">All Shifts</option>
                        {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5"><span className="spinner-border text-primary"></span></div>
            ) : (
                <>
                    {/* Global Plant Summary */}
                    <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 20px', marginBottom: 16, border: '1px solid #334155' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Global Plant Summary</div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <CircularGauge value={summary.oee || summary.avg_efficiency || 0} label="Average OEE" size={65} />
                                <div>
                                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>TOTAL BOTTLES</div>
                                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9' }}>{fmt(summary.total_bottles)}</div>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>TOTAL PACKS</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9' }}>{fmt(summary.total_packs)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>TOTAL REPORTS</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9' }}>{summary.total_reports || 0}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>ACTIVE DOWNTIME</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, color: '#ef4444' }}>{Math.round(summary.total_downtime_minutes || 0)}m</div>
                            </div>
                        </div>
                    </div>

                    {/* Per-Line Cards */}
                    <div className="row g-3 mb-4">
                        {lineCards.map((line, idx) => (
                            <div key={idx} className="col-xl-3 col-lg-4 col-md-6">
                                <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px', border: '1px solid #334155', height: '100%' }}>
                                    {/* Line header */}
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>
                                            [{line.pet_name}: {line.product_name?.split(',')[0] || ''}]
                                        </span>
                                    </div>
                                    <StatusBadge status={line.status} />

                                    {/* OEE Gauges */}
                                    <div className="d-flex justify-content-between mt-3 mb-2">
                                        <CircularGauge value={line.oee} label="OEE" size={55} />
                                        <CircularGauge value={line.availability} label="Avail" size={55} />
                                        <CircularGauge value={line.performance} label="Perf" size={55} />
                                        <CircularGauge value={line.quality} label="Quality" size={55} />
                                    </div>

                                    {/* Bottles & Packs */}
                                    <div className="d-flex justify-content-between mt-2" style={{ fontSize: '10px', color: '#94a3b8' }}>
                                        <div>
                                            <div>NUMBER OF BOTTLES</div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>{fmt(line.total_bottles)}</div>
                                        </div>
                                        <div className="text-end">
                                            <div>NUMBER OF PACKS</div>
                                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>{fmt(line.total_packs)}</div>
                                        </div>
                                    </div>

                                    {/* Downtime & Yield row */}
                                    <div className="d-flex justify-content-between align-items-end mt-2 pt-2" style={{ borderTop: '1px solid #334155' }}>
                                        <div className="d-flex gap-2" style={{ fontSize: '9px', color: '#94a3b8' }}>
                                            <div className="text-center">
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{(line.total_downtime_minutes || 0).toFixed(1)}</div>
                                                <div>TOTAL DT</div>
                                            </div>
                                            <div className="text-center">
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{(line.mechanical_downtime_mins || 0).toFixed(1)}</div>
                                                <div>MECH</div>
                                            </div>
                                            <div className="text-center">
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>{(line.planned_downtime_mins || 0).toFixed(1)}</div>
                                                <div>PLANNED</div>
                                            </div>
                                        </div>
                                        <div className="d-flex gap-2" style={{ fontSize: '9px', color: '#94a3b8' }}>
                                            <div className="text-center">
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: line.syrup_yield != null && line.syrup_yield >= SYRUP_TARGET ? '#22c55e' : '#f59e0b' }}>
                                                    {line.syrup_yield != null ? `${line.syrup_yield.toFixed(0)}%` : 'N/A'}
                                                </div>
                                                <div>SYRUP</div>
                                            </div>
                                            <div className="text-center">
                                                <div style={{ fontSize: '13px', fontWeight: 700, color: line.co2_yield != null && line.co2_yield >= CO2_TARGET ? '#22c55e' : '#f59e0b' }}>
                                                    {line.co2_yield != null ? `${line.co2_yield.toFixed(0)}%` : 'N/A'}
                                                </div>
                                                <div>CO2</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Row: Downtime Pareto + Yield Trackers */}
                    <div className="row g-3">
                        {/* Downtime Pareto */}
                        <div className="col-lg-6">
                            <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155' }}>
                                <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                                    Downtime Pareto Analysis (By Category)
                                </h6>
                                {downtimePareto.length > 0 ? (
                                    <div style={{ width: '100%', height: 250 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={downtimePareto} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                                <Tooltip
                                                    contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6, color: '#e2e8f0' }}
                                                    labelStyle={{ color: '#f1f5f9' }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                                                <Bar dataKey="Mechanical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Planned" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="text-center py-4" style={{ color: '#64748b' }}>No downtime data available</div>
                                )}
                            </div>
                        </div>

                        {/* Yield Trackers */}
                        <div className="col-lg-6">
                            <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px', border: '1px solid #334155' }}>
                                <h6 style={{ color: '#f1f5f9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                                    Yield & Waste Trackers (Average)
                                </h6>
                                <div className="row">
                                    {/* Syrup Yield vs Target */}
                                    <div className="col-6">
                                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Syrup Yield vs. Target</div>
                                        {yieldData.map((line, idx) => (
                                            <div key={idx} className="d-flex align-items-center mb-2 gap-2">
                                                <span style={{ fontSize: '10px', color: '#94a3b8', width: 50, flexShrink: 0 }}>{line.name}</span>
                                                <div style={{ flex: 1, background: '#0f172a', borderRadius: 4, height: 14, position: 'relative', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min((line.syrup_yield || 0), 120) / 1.2}%`,
                                                        height: '100%',
                                                        background: line.syrup_yield != null && line.syrup_yield >= SYRUP_TARGET ? '#22c55e' : '#f59e0b',
                                                        borderRadius: 4,
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                    {/* Target line */}
                                                    <div style={{ position: 'absolute', left: `${SYRUP_TARGET / 1.2}%`, top: 0, bottom: 0, width: 2, background: '#fff', opacity: 0.5 }} />
                                                </div>
                                                <span style={{ fontSize: '10px', color: '#f1f5f9', width: 35, textAlign: 'right' }}>
                                                    {line.syrup_yield != null ? `${line.syrup_yield}%` : 'N/A'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* CO2 Yield vs Target */}
                                    <div className="col-6">
                                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>CO2 Yield vs. Target</div>
                                        {yieldData.map((line, idx) => (
                                            <div key={idx} className="d-flex align-items-center mb-2 gap-2">
                                                <span style={{ fontSize: '10px', color: '#94a3b8', width: 50, flexShrink: 0 }}>{line.name}</span>
                                                <div style={{ flex: 1, background: '#0f172a', borderRadius: 4, height: 14, position: 'relative', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min((line.co2_yield || 0), 120) / 1.2}%`,
                                                        height: '100%',
                                                        background: line.co2_yield != null && line.co2_yield >= CO2_TARGET ? '#22c55e' : '#f59e0b',
                                                        borderRadius: 4,
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                    <div style={{ position: 'absolute', left: `${CO2_TARGET / 1.2}%`, top: 0, bottom: 0, width: 2, background: '#fff', opacity: 0.5 }} />
                                                </div>
                                                <span style={{ fontSize: '10px', color: '#f1f5f9', width: 35, textAlign: 'right' }}>
                                                    {line.co2_yield != null ? `${line.co2_yield}%` : 'N/A'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PlantOverview;
