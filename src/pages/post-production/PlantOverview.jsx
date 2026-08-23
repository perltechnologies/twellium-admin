import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { productionApi } from '../../api/production';
import { useTheme } from '../../context/ThemeContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    Activity, Clock, Droplet, Calendar, RefreshCw,
    Download, Filter, Package, Layers, Sun, Moon
} from 'lucide-react';
import { exportToExcel } from '../../utils/exportUtils';

const OEE_TARGET = 85;
const AVAIL_TARGET = 90;
const PERF_TARGET = 95;
const QUAL_TARGET = 99;
const SYRUP_TARGET = 98;
const CO2_TARGET = 90;

// Theme-aware Modern Circular Gauge
const ModernGauge = ({ value, label, size = 64, strokeWidth = 5, target = 85, isDark = false }) => {
    const val = value !== null && value !== undefined && !isNaN(value) ? Number(value) : null;
    const pct = val !== null ? Math.min(Math.max(val, 0), 100) : 0;
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    const getColor = () => {
        if (val === null) return isDark ? '#64748b' : '#94a3b8';
        if (val >= target) return '#22c55e';
        if (val >= target - 15) return '#f59e0b';
        return '#ef4444';
    };

    const color = getColor();
    const trackColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#f8fafc' : '#1e293b';
    const labelColor = isDark ? '#94a3b8' : '#64748b';

    return (
        <div className="d-flex flex-column align-items-center">
            <div style={{ width: size, height: size, position: 'relative' }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={trackColor}
                        strokeWidth={strokeWidth}
                    />
                    {val !== null && (
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                    )}
                </svg>
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                    }}
                >
                    <span className="fw-bold" style={{ fontSize: size > 60 ? '0.8rem' : '0.7rem', color: val !== null ? textColor : labelColor }}>
                        {val !== null ? `${Math.round(val)}%` : '—'}
                    </span>
                </div>
            </div>
            {label && (
                <span className="text-uppercase fw-semibold mt-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px', color: labelColor }}>
                    {label}
                </span>
            )}
        </div>
    );
};

// Clean status badge
const StatusBadge = ({ status }) => {
    const config = {
        RUNNING: { bg: 'bg-soft-success', text: 'text-success', border: 'border-success', label: 'RUNNING', dot: '#22c55e' },
        MECHANICAL_FAULT: { bg: 'bg-soft-danger', text: 'text-danger', border: 'border-danger', label: 'FAULT STOP', dot: '#ef4444' },
        IDLE: { bg: 'bg-soft-secondary', text: 'text-secondary', border: 'border-secondary', label: 'IDLE', dot: '#64748b' },
        PLANNED_STOP: { bg: 'bg-soft-primary', text: 'text-primary', border: 'border-primary', label: 'PLANNED STOP', dot: '#3b82f6' },
    };
    const c = config[status] || config.RUNNING;
    return (
        <span className={`badge ${c.bg} ${c.text} border ${c.border} rounded-pill px-2.5 py-1 small d-inline-flex align-items-center gap-1.5 fw-semibold`}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.dot }}></span>
            {c.label}
        </span>
    );
};

const PlantOverview = () => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [selectedShift, setSelectedShift] = useState('');
    const [shifts, setShifts] = useState([]);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

    const fetchShifts = useCallback(async () => {
        try {
            const res = await productionApi.getShifts();
            const list = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? [];
            setShifts(Array.isArray(list) ? list : list.results || []);
        } catch (e) {
            console.error('Failed to load shifts:', e);
        }
    }, []);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

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
            setRefreshing(false);
        }
    }, [selectedDate, selectedShift]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
            product_name: [...new Set(line.products.filter(Boolean))].join(', ') || 'No SKU logged',
            status: line.mechanical_downtime_mins > line.planned_downtime_mins && line.mechanical_downtime_mins > 30
                ? 'MECHANICAL_FAULT'
                : line.total_bottles > 0
                ? 'RUNNING'
                : 'IDLE',
        })).sort((a, b) => {
            const aNum = parseInt(a.pet_name?.match(/(\d+)/)?.[0] || '999');
            const bNum = parseInt(b.pet_name?.match(/(\d+)/)?.[0] || '999');
            return aNum - bNum;
        });
    }, [allPets]);

    // Downtime Pareto data
    const downtimePareto = useMemo(() => {
        return lineCards.map(line => ({
            name: line.pet_name?.replace(/pet\s*/i, 'L'),
            fullName: line.pet_name,
            Mechanical: Math.round(line.mechanical_downtime_mins),
            Planned: Math.round(line.planned_downtime_mins),
        }));
    }, [lineCards]);

    // Yield tracker data
    const yieldData = useMemo(() => {
        return lineCards.map(line => ({
            name: line.pet_name?.replace(/pet\s*/i, 'L'),
            fullName: line.pet_name,
            syrup_yield: line.syrup_yield !== null ? parseFloat(line.syrup_yield.toFixed(1)) : null,
            co2_yield: line.co2_yield !== null ? parseFloat(line.co2_yield.toFixed(1)) : null,
        }));
    }, [lineCards]);

    const shiftLabel = selectedShift ? shifts.find(s => String(s.id) === String(selectedShift))?.name || 'Shift' : 'All Shifts';
    const fmt = (v) => v != null ? Number(v).toLocaleString() : '0';

    const handleExport = () => {
        const exportRows = lineCards.map(line => ({
            'PET Line': line.pet_name,
            'Product(s)': line.product_name,
            'Status': line.status,
            'OEE (%)': Math.round(line.oee),
            'Availability (%)': Math.round(line.availability),
            'Performance (%)': Math.round(line.performance),
            'Quality (%)': Math.round(line.quality),
            'Bottles Produced': line.total_bottles,
            'Packs Produced': line.total_packs,
            'Total Downtime (mins)': Math.round(line.total_downtime_minutes),
            'Mechanical Downtime (mins)': Math.round(line.mechanical_downtime_mins),
            'Planned Downtime (mins)': Math.round(line.planned_downtime_mins),
            'Syrup Yield (%)': line.syrup_yield != null ? Math.round(line.syrup_yield) : 'N/A',
            'CO2 Yield (%)': line.co2_yield != null ? Math.round(line.co2_yield) : 'N/A',
        }));
        exportToExcel(exportRows, `Plant_Overview_${selectedDate}_${shiftLabel.replace(/\s+/g, '_')}`);
    };

    // Color theme variables based on isDark
    const themeStyles = {
        bg: isDark ? '#0f172a' : '#f8fafc',
        cardBg: isDark ? '#1e293b' : '#ffffff',
        cardHeaderBg: isDark ? '#1e293b' : '#f8fafc',
        innerBoxBg: isDark ? '#0f172a' : '#f8fafc',
        border: isDark ? '#334155' : '#e2e8f0',
        textPrimary: isDark ? '#f8fafc' : '#1e293b',
        textMuted: isDark ? '#94a3b8' : '#64748b',
        gridLine: isDark ? '#334155' : '#f1f5f9',
        tooltipBg: isDark ? '#1e293b' : '#ffffff',
        tooltipBorder: isDark ? '#475569' : '#e2e8f0',
    };

    return (
        <div
            className="container-fluid px-0 transition-colors"
            style={{
                backgroundColor: themeStyles.bg,
                color: themeStyles.textPrimary,
                borderRadius: '8px',
                padding: '4px 0',
                transition: 'background-color 0.25s ease, color 0.25s ease'
            }}
        >
            {/* Header Toolbar */}
            <div
                className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2"
                style={{ borderBottom: `1px solid ${themeStyles.border}` }}
            >
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <h4 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>
                            Plant Production Telemetry & Overview
                        </h4>
                        <span className="badge bg-soft-primary text-primary px-2.5 py-1 rounded-pill small fw-semibold">
                            {shiftLabel}
                        </span>
                    </div>
                    <p className="small mb-0" style={{ color: themeStyles.textMuted }}>
                        Live beverage plant monitoring, multi-line OEE telemetry, downtime pareto & yield tracking
                    </p>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 no-print">
                    {/* Theme Toggle Button */}
                    <button
                        className="btn btn-sm d-flex align-items-center gap-1.5 shadow-sm border"
                        style={{
                            backgroundColor: themeStyles.cardBg,
                            color: isDark ? '#f59e0b' : '#64748b',
                            borderColor: themeStyles.border
                        }}
                        onClick={toggleTheme}
                        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                    >
                        {isDark ? <Sun size={15} className="text-warning" /> : <Moon size={15} />}
                        <span className="small fw-semibold">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>

                    {/* Date Picker */}
                    <div
                        className="d-flex align-items-center gap-1.5 border rounded px-2.5 py-1 shadow-sm"
                        style={{ backgroundColor: themeStyles.cardBg, borderColor: themeStyles.border }}
                    >
                        <Calendar size={14} style={{ color: themeStyles.textMuted }} />
                        <input
                            type="date"
                            className="form-control form-control-sm border-0 p-0 shadow-none bg-transparent"
                            style={{
                                width: '130px',
                                fontSize: '0.82rem',
                                color: themeStyles.textPrimary,
                                colorScheme: isDark ? 'dark' : 'light'
                            }}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    {/* Shift Selector */}
                    <div
                        className="d-flex align-items-center gap-1.5 border rounded px-2.5 py-1 shadow-sm"
                        style={{ backgroundColor: themeStyles.cardBg, borderColor: themeStyles.border }}
                    >
                        <Filter size={14} style={{ color: themeStyles.textMuted }} />
                        <select
                            className="form-select form-select-sm border-0 p-0 shadow-none bg-transparent cursor-pointer"
                            style={{ width: '120px', fontSize: '0.82rem', color: themeStyles.textPrimary }}
                            value={selectedShift}
                            onChange={(e) => setSelectedShift(e.target.value)}
                        >
                            <option value="" style={{ background: themeStyles.cardBg, color: themeStyles.textPrimary }}>All Shifts</option>
                            {shifts.map(s => (
                                <option key={s.id} value={s.id} style={{ background: themeStyles.cardBg, color: themeStyles.textPrimary }}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        className="btn btn-sm d-flex align-items-center gap-1 shadow-sm border"
                        style={{ backgroundColor: themeStyles.cardBg, color: themeStyles.textPrimary, borderColor: themeStyles.border }}
                        onClick={() => fetchData(true)}
                        disabled={loading || refreshing}
                        title="Refresh plant telemetry"
                    >
                        <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
                        <span>{refreshing ? 'Updating…' : 'Refresh'}</span>
                    </button>

                    {/* Export Button */}
                    <button
                        className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                        onClick={handleExport}
                        disabled={lineCards.length === 0}
                    >
                        <Download size={14} />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary mb-2" role="status"></div>
                    <p className="small" style={{ color: themeStyles.textMuted }}>Loading plant telemetry data…</p>
                </div>
            ) : (
                <>
                    {/* Executive Global Plant Summary Banner */}
                    <div
                        className="card mb-4 shadow-none"
                        style={{
                            backgroundColor: themeStyles.cardBg,
                            borderColor: themeStyles.border,
                            borderWidth: 1,
                            borderStyle: 'solid'
                        }}
                    >
                        <div
                            className="card-header py-2 px-3 d-flex align-items-center justify-content-between"
                            style={{
                                backgroundColor: themeStyles.cardHeaderBg,
                                borderBottom: `1px solid ${themeStyles.border}`
                            }}
                        >
                            <span className="small fw-bold text-uppercase" style={{ color: themeStyles.textMuted }}>
                                Global Plant KPI Summary
                            </span>
                            <span
                                className="badge small border"
                                style={{
                                    backgroundColor: themeStyles.innerBoxBg,
                                    color: themeStyles.textPrimary,
                                    borderColor: themeStyles.border
                                }}
                            >
                                {lineCards.length} Active PET Lines
                            </span>
                        </div>
                        <div className="card-body p-3">
                            <div className="row g-3 align-items-center">
                                {/* Global OEE */}
                                <div className="col-xl-3 col-md-6 border-end-xl" style={{ borderColor: themeStyles.border }}>
                                    <div className="d-flex align-items-center gap-3">
                                        <ModernGauge
                                            value={summary.oee || summary.avg_efficiency || 0}
                                            label="Plant OEE"
                                            size={72}
                                            strokeWidth={6}
                                            target={OEE_TARGET}
                                            isDark={isDark}
                                        />
                                        <div>
                                            <span className="small fw-semibold text-uppercase d-block" style={{ color: themeStyles.textMuted }}>
                                                Plant Performance
                                            </span>
                                            <h3 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>
                                                {summary.oee != null ? `${Math.round(summary.oee)}%` : `${Math.round(summary.avg_efficiency || 0)}%`}
                                            </h3>
                                            <div className="d-flex align-items-center gap-1 mt-1">
                                                <span className={`badge ${(summary.oee || summary.avg_efficiency || 0) >= OEE_TARGET ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'} small`}>
                                                    Target: {OEE_TARGET}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Bottles */}
                                <div className="col-xl-3 col-md-6 border-end-xl" style={{ borderColor: themeStyles.border }}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="avatar avatar-md bg-soft-primary rounded-circle d-flex align-items-center justify-content-center">
                                            <Package size={20} className="text-primary" />
                                        </div>
                                        <div>
                                            <span className="small fw-semibold text-uppercase d-block" style={{ color: themeStyles.textMuted }}>
                                                Total Bottles
                                            </span>
                                            <h3 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>{fmt(summary.total_bottles)}</h3>
                                            <small style={{ color: themeStyles.textMuted }}>Bottles produced across lines</small>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Packs */}
                                <div className="col-xl-3 col-md-6 border-end-xl" style={{ borderColor: themeStyles.border }}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="avatar avatar-md bg-soft-success rounded-circle d-flex align-items-center justify-content-center">
                                            <Layers size={20} className="text-success" />
                                        </div>
                                        <div>
                                            <span className="small fw-semibold text-uppercase d-block" style={{ color: themeStyles.textMuted }}>
                                                Total Packs
                                            </span>
                                            <h3 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>{fmt(summary.total_packs)}</h3>
                                            <small style={{ color: themeStyles.textMuted }}>Finished packaged bundles</small>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Downtime */}
                                <div className="col-xl-3 col-md-6">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="avatar avatar-md bg-soft-danger rounded-circle d-flex align-items-center justify-content-center">
                                            <Clock size={20} className="text-danger" />
                                        </div>
                                        <div>
                                            <span className="small fw-semibold text-uppercase d-block" style={{ color: themeStyles.textMuted }}>
                                                Active Downtime
                                            </span>
                                            <h3 className="fw-bold mb-0 text-danger">{Math.round(summary.total_downtime_minutes || 0)} <span className="fs-16 fw-normal" style={{ color: themeStyles.textMuted }}>mins</span></h3>
                                            <small style={{ color: themeStyles.textMuted }}>{summary.total_reports || 0} production report(s)</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section Header & View Mode Switcher */}
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                            <Activity size={18} className="text-primary" />
                            <h6 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>PET Line Real-Time Telemetry Cards</h6>
                            <span className="badge border small" style={{ backgroundColor: themeStyles.cardBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>
                                {lineCards.length} Lines Online
                            </span>
                        </div>
                        <div className="btn-group btn-group-sm shadow-sm">
                            <button
                                className={`btn ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setViewMode('cards')}
                                style={viewMode !== 'cards' ? { backgroundColor: themeStyles.cardBg, color: themeStyles.textPrimary, borderColor: themeStyles.border } : {}}
                            >
                                Cards View
                            </button>
                            <button
                                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setViewMode('table')}
                                style={viewMode !== 'table' ? { backgroundColor: themeStyles.cardBg, color: themeStyles.textPrimary, borderColor: themeStyles.border } : {}}
                            >
                                Table View
                            </button>
                        </div>
                    </div>

                    {/* Line Cards Grid */}
                    {viewMode === 'cards' ? (
                        <div className="row g-3 mb-4">
                            {lineCards.map((line, idx) => (
                                <div key={idx} className="col-xxl-3 col-xl-4 col-md-6">
                                    <div
                                        className="card h-100 shadow-none hover-shadow transition-all"
                                        style={{
                                            backgroundColor: themeStyles.cardBg,
                                            borderColor: themeStyles.border,
                                            borderWidth: 1,
                                            borderStyle: 'solid'
                                        }}
                                    >
                                        {/* Line Header */}
                                        <div
                                            className="card-header py-2 px-3 d-flex align-items-center justify-content-between"
                                            style={{
                                                backgroundColor: themeStyles.cardHeaderBg,
                                                borderBottom: `1px solid ${themeStyles.border}`
                                            }}
                                        >
                                            <div>
                                                <span className="fw-bold" style={{ color: themeStyles.textPrimary }}>{line.pet_name}</span>
                                                <small
                                                    className="d-block"
                                                    style={{
                                                        fontSize: '0.72rem',
                                                        maxWidth: '160px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        color: themeStyles.textMuted
                                                    }}
                                                    title={line.product_name}
                                                >
                                                    {line.product_name}
                                                </small>
                                            </div>
                                            <StatusBadge status={line.status} />
                                        </div>

                                        <div className="card-body p-3">
                                            {/* Gauges Row */}
                                            <div
                                                className="d-flex justify-content-between align-items-center py-2 px-1 rounded mb-3"
                                                style={{
                                                    backgroundColor: themeStyles.innerBoxBg,
                                                    border: `1px solid ${themeStyles.border}`
                                                }}
                                            >
                                                <ModernGauge value={line.oee} label="OEE" size={54} strokeWidth={4} target={OEE_TARGET} isDark={isDark} />
                                                <ModernGauge value={line.availability} label="Avail" size={54} strokeWidth={4} target={AVAIL_TARGET} isDark={isDark} />
                                                <ModernGauge value={line.performance} label="Perf" size={54} strokeWidth={4} target={PERF_TARGET} isDark={isDark} />
                                                <ModernGauge value={line.quality} label="Qual" size={54} strokeWidth={4} target={QUAL_TARGET} isDark={isDark} />
                                            </div>

                                            {/* Output stats */}
                                            <div className="row g-2 mb-3 text-center">
                                                <div className="col-6">
                                                    <div
                                                        className="p-2 rounded"
                                                        style={{
                                                            backgroundColor: themeStyles.innerBoxBg,
                                                            border: `1px solid ${themeStyles.border}`
                                                        }}
                                                    >
                                                        <small className="d-block text-uppercase" style={{ fontSize: '0.65rem', color: themeStyles.textMuted }}>Bottles</small>
                                                        <span className="fw-bold fs-15" style={{ color: themeStyles.textPrimary }}>{fmt(line.total_bottles)}</span>
                                                    </div>
                                                </div>
                                                <div className="col-6">
                                                    <div
                                                        className="p-2 rounded"
                                                        style={{
                                                            backgroundColor: themeStyles.innerBoxBg,
                                                            border: `1px solid ${themeStyles.border}`
                                                        }}
                                                    >
                                                        <small className="d-block text-uppercase" style={{ fontSize: '0.65rem', color: themeStyles.textMuted }}>Packs</small>
                                                        <span className="fw-bold fs-15" style={{ color: themeStyles.textPrimary }}>{fmt(line.total_packs)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Downtime & Yield Matrix */}
                                            <div className="pt-2" style={{ borderTop: `1px solid ${themeStyles.border}` }}>
                                                {/* Downtime row */}
                                                <div className="d-flex justify-content-between align-items-center mb-2 small">
                                                    <span className="d-flex align-items-center gap-1" style={{ color: themeStyles.textMuted }}>
                                                        <Clock size={12} /> Downtime:
                                                    </span>
                                                    <div>
                                                        <span className="badge bg-soft-danger text-danger me-1">Mech: {Math.round(line.mechanical_downtime_mins)}m</span>
                                                        <span className="badge bg-soft-primary text-primary">Plan: {Math.round(line.planned_downtime_mins)}m</span>
                                                    </div>
                                                </div>

                                                {/* Yield row */}
                                                <div className="d-flex justify-content-between align-items-center small">
                                                    <span className="d-flex align-items-center gap-1" style={{ color: themeStyles.textMuted }}>
                                                        <Droplet size={12} /> Yields:
                                                    </span>
                                                    <div className="d-flex gap-1.5">
                                                        <span className={`badge ${line.syrup_yield != null && line.syrup_yield >= SYRUP_TARGET ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                                                            Syrup: {line.syrup_yield != null ? `${Math.round(line.syrup_yield)}%` : '—'}
                                                        </span>
                                                        <span className={`badge ${line.co2_yield != null && line.co2_yield >= CO2_TARGET ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                                                            CO2: {line.co2_yield != null ? `${Math.round(line.co2_yield)}%` : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Table View */
                        <div
                            className="card mb-4 shadow-none"
                            style={{
                                backgroundColor: themeStyles.cardBg,
                                borderColor: themeStyles.border,
                                borderWidth: 1,
                                borderStyle: 'solid'
                            }}
                        >
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead
                                            className="small"
                                            style={{
                                                backgroundColor: themeStyles.cardHeaderBg,
                                                color: themeStyles.textMuted,
                                                borderColor: themeStyles.border
                                            }}
                                        >
                                            <tr>
                                                <th style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Line</th>
                                                <th style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>SKU / Product</th>
                                                <th style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Status</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>OEE</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Avail</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Perf</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Qual</th>
                                                <th className="text-end" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Bottles</th>
                                                <th className="text-end" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Packs</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Downtime</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>Syrup Yield</th>
                                                <th className="text-center" style={{ backgroundColor: themeStyles.cardHeaderBg, color: themeStyles.textMuted, borderColor: themeStyles.border }}>CO2 Yield</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lineCards.map((line, idx) => (
                                                <tr key={idx} style={{ borderColor: themeStyles.border }}>
                                                    <td className="fw-bold" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.border }}>{line.pet_name}</td>
                                                    <td className="small" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: themeStyles.textMuted, borderColor: themeStyles.border }}>
                                                        {line.product_name}
                                                    </td>
                                                    <td style={{ borderColor: themeStyles.border }}><StatusBadge status={line.status} /></td>
                                                    <td className="text-center" style={{ borderColor: themeStyles.border }}>
                                                        <span className={`badge ${line.oee >= OEE_TARGET ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'} fw-bold`}>
                                                            {Math.round(line.oee)}%
                                                        </span>
                                                    </td>
                                                    <td className="text-center small" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.border }}>{Math.round(line.availability)}%</td>
                                                    <td className="text-center small" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.border }}>{Math.round(line.performance)}%</td>
                                                    <td className="text-center small" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.border }}>{Math.round(line.quality)}%</td>
                                                    <td className="text-end fw-semibold" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.border }}>{fmt(line.total_bottles)}</td>
                                                    <td className="text-end fw-semibold" style={{ color: themeStyles.textPrimary, borderColor: themeStyles.border }}>{fmt(line.total_packs)}</td>
                                                    <td className="text-center small" style={{ borderColor: themeStyles.border }}>
                                                        <span className="text-danger fw-semibold">{Math.round(line.mechanical_downtime_mins)}m</span>
                                                        <span style={{ color: themeStyles.textMuted }}> / </span>
                                                        <span className="text-primary">{Math.round(line.planned_downtime_mins)}m</span>
                                                    </td>
                                                    <td className="text-center small" style={{ borderColor: themeStyles.border }}>
                                                        {line.syrup_yield != null ? (
                                                            <span className={`badge ${line.syrup_yield >= SYRUP_TARGET ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                                                                {Math.round(line.syrup_yield)}%
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="text-center small" style={{ borderColor: themeStyles.border }}>
                                                        {line.co2_yield != null ? (
                                                            <span className={`badge ${line.co2_yield >= CO2_TARGET ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                                                                {Math.round(line.co2_yield)}%
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Analytics Row: Downtime Pareto & Yield Benchmarks */}
                    <div className="row g-3">
                        {/* Downtime Pareto Chart */}
                        <div className="col-lg-6">
                            <div
                                className="card h-100 shadow-none"
                                style={{
                                    backgroundColor: themeStyles.cardBg,
                                    borderColor: themeStyles.border,
                                    borderWidth: 1,
                                    borderStyle: 'solid'
                                }}
                            >
                                <div
                                    className="card-header py-2.5 px-3 d-flex align-items-center justify-content-between"
                                    style={{
                                        backgroundColor: themeStyles.cardHeaderBg,
                                        borderBottom: `1px solid ${themeStyles.border}`
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <Clock size={16} className="text-danger" />
                                        <h6 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>Downtime Pareto Analysis (Mins)</h6>
                                    </div>
                                    <span className="badge bg-soft-danger text-danger small">Mechanical vs Planned</span>
                                </div>
                                <div className="card-body p-3">
                                    {downtimePareto.length > 0 ? (
                                        <div style={{ height: 260 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={downtimePareto} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={themeStyles.gridLine} />
                                                    <XAxis dataKey="name" tick={{ fill: themeStyles.textMuted, fontSize: 11 }} />
                                                    <YAxis tick={{ fill: themeStyles.textMuted, fontSize: 11 }} />
                                                    <Tooltip
                                                        content={({ active, payload, label }) => {
                                                            if (active && payload && payload.length) {
                                                                const dataItem = payload[0].payload;
                                                                return (
                                                                    <div
                                                                        className="p-2 rounded shadow-sm border small"
                                                                        style={{
                                                                            backgroundColor: themeStyles.tooltipBg,
                                                                            borderColor: themeStyles.tooltipBorder,
                                                                            color: themeStyles.textPrimary
                                                                        }}
                                                                    >
                                                                        <p className="fw-bold mb-1">{dataItem.fullName || label}</p>
                                                                        <div className="text-danger">Mechanical: {dataItem.Mechanical} mins</div>
                                                                        <div className="text-primary">Planned: {dataItem.Planned} mins</div>
                                                                        <div className="fw-semibold mt-1 pt-1" style={{ borderTop: `1px solid ${themeStyles.border}` }}>
                                                                            Total: {dataItem.Mechanical + dataItem.Planned} mins
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6, color: themeStyles.textMuted }} />
                                                    <Bar dataKey="Mechanical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} name="Mechanical Downtime" />
                                                    <Bar dataKey="Planned" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Planned Downtime" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 small" style={{ color: themeStyles.textMuted }}>
                                            No downtime data recorded for this period
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Material Yield Trackers vs Benchmark Targets */}
                        <div className="col-lg-6">
                            <div
                                className="card h-100 shadow-none"
                                style={{
                                    backgroundColor: themeStyles.cardBg,
                                    borderColor: themeStyles.border,
                                    borderWidth: 1,
                                    borderStyle: 'solid'
                                }}
                            >
                                <div
                                    className="card-header py-2.5 px-3 d-flex align-items-center justify-content-between"
                                    style={{
                                        backgroundColor: themeStyles.cardHeaderBg,
                                        borderBottom: `1px solid ${themeStyles.border}`
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-2">
                                        <Droplet size={16} className="text-primary" />
                                        <h6 className="fw-bold mb-0" style={{ color: themeStyles.textPrimary }}>Material Yield vs Benchmark Targets</h6>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <span className="badge bg-soft-success text-success small">Syrup: {SYRUP_TARGET}%</span>
                                        <span className="badge bg-soft-info text-info small">CO2: {CO2_TARGET}%</span>
                                    </div>
                                </div>
                                <div className="card-body p-3">
                                    <div className="row g-3">
                                        {/* Syrup Yield Progress */}
                                        <div className="col-6 border-end" style={{ borderColor: themeStyles.border }}>
                                            <div
                                                className="d-flex align-items-center justify-content-between mb-2 pb-1"
                                                style={{ borderBottom: `1px solid ${themeStyles.border}` }}
                                            >
                                                <span className="text-uppercase fw-bold" style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>Syrup Yield by Line</span>
                                                <small style={{ color: themeStyles.textMuted }}>Target ≥ {SYRUP_TARGET}%</small>
                                            </div>
                                            <div className="d-flex flex-column gap-2.5">
                                                {yieldData.map((line, idx) => (
                                                    <div key={idx} className="small">
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="fw-semibold" style={{ color: themeStyles.textPrimary }}>{line.fullName || line.name}</span>
                                                            <span className={`fw-bold ${line.syrup_yield != null && line.syrup_yield >= SYRUP_TARGET ? 'text-success' : 'text-warning'}`}>
                                                                {line.syrup_yield != null ? `${line.syrup_yield}%` : 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div className="progress position-relative" style={{ height: '7px', backgroundColor: themeStyles.innerBoxBg }}>
                                                            <div
                                                                className={`progress-bar ${line.syrup_yield != null && line.syrup_yield >= SYRUP_TARGET ? 'bg-success' : 'bg-warning'}`}
                                                                style={{ width: `${Math.min((line.syrup_yield || 0), 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* CO2 Yield Progress */}
                                        <div className="col-6">
                                            <div
                                                className="d-flex align-items-center justify-content-between mb-2 pb-1"
                                                style={{ borderBottom: `1px solid ${themeStyles.border}` }}
                                            >
                                                <span className="text-uppercase fw-bold" style={{ fontSize: '0.72rem', color: themeStyles.textMuted }}>CO2 Yield by Line</span>
                                                <small style={{ color: themeStyles.textMuted }}>Target ≥ {CO2_TARGET}%</small>
                                            </div>
                                            <div className="d-flex flex-column gap-2.5">
                                                {yieldData.map((line, idx) => (
                                                    <div key={idx} className="small">
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="fw-semibold" style={{ color: themeStyles.textPrimary }}>{line.fullName || line.name}</span>
                                                            <span className={`fw-bold ${line.co2_yield != null && line.co2_yield >= CO2_TARGET ? 'text-success' : 'text-warning'}`}>
                                                                {line.co2_yield != null ? `${line.co2_yield}%` : 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div className="progress position-relative" style={{ height: '7px', backgroundColor: themeStyles.innerBoxBg }}>
                                                            <div
                                                                className={`progress-bar ${line.co2_yield != null && line.co2_yield >= CO2_TARGET ? 'bg-info' : 'bg-warning'}`}
                                                                style={{ width: `${Math.min((line.co2_yield || 0), 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
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
