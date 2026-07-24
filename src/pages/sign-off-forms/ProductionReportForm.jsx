import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';

const ProductionReportForm = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedPet, setSelectedPet] = useState('');
    const [selectedShift, setSelectedShift] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    });

    // Fetch available pets/lines (exclude can lines) and shifts
    useEffect(() => {
        const fetchPets = async () => {
            try {
                const res = await productionApi.getPets();
                const petList = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? [];
                const allPets = Array.isArray(petList) ? petList : petList.results || [];
                setPets(
                    allPets
                        .filter(p => !p.pet_name?.toLowerCase().includes('can'))
                        .sort((a, b) => {
                            const numA = parseInt(a.pet_name?.match(/\d+/)?.[0]) || 0;
                            const numB = parseInt(b.pet_name?.match(/\d+/)?.[0]) || 0;
                            return numA - numB;
                        })
                );
            } catch (err) {
                console.error('Failed to fetch pets:', err);
            }
        };
        const fetchShifts = async () => {
            try {
                const res = await productionApi.getShifts();
                const shiftList = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? [];
                setShifts(Array.isArray(shiftList) ? shiftList : shiftList.results || []);
            } catch (err) {
                console.error('Failed to fetch shifts:', err);
            }
        };
        fetchPets();
        fetchShifts();
    }, []);

    const fetchData = async (date, petId, shiftId) => {
        setLoading(true);
        setError(null);
        try {
            const params = { start_date: date, end_date: date };
            if (petId) params.pet = petId;
            if (shiftId) params.shift = shiftId;
            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            console.log('Production Summary Response:', envelope);
            setData(envelope);
        } catch (err) {
            console.error('Failed to fetch production summary:', err);
            setError(err?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedDate, selectedPet, selectedShift);
    }, [selectedDate, selectedPet, selectedShift]);

    const handlePrint = () => {
        const prevTitle = document.title;
        const petLabel = selectedPet ? pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '' : 'All Lines';
        document.title = `Production Report - ${selectedDate} - ${petLabel}`;
        window.print();
        document.title = prevTitle;
    };

    // Full day combined data from summary
    const summary = data?.summary || {};
    const dailyBreakdown = data?.daily_breakdown || [];
    const dayData = dailyBreakdown.find(d => d.date === selectedDate) || dailyBreakdown[0] || {};
    const allPetsUnfiltered = (dayData?.pets || []).filter(p => !p.pet_name?.toLowerCase().includes('can'));
    const allPets = selectedProduct
        ? allPetsUnfiltered.filter(p => p.product_name === selectedProduct)
        : allPetsUnfiltered;
    const productNames = [...new Set(allPetsUnfiltered.map(p => p.product_name).filter(Boolean))].sort();
    const materials = data?.material_consumptions?.materials || [];

    // Meters reading data
    const metersReading = data?.meters_reading || {};
    const co2Meters = metersReading.co2 || {};
    const syrupMeters = metersReading.syrup || {};
    const productionMeters = metersReading.production || {};

    // Build downtime per pet from downtime_breakdown categories
    const downtimeByPet = {};
    (data?.downtime_breakdown?.categories || []).forEach(cat => {
        (cat.sub_categories || []).forEach(sub => {
            (sub.pets_affected || []).forEach(pa => {
                const key = pa.pet_id || pa.pet_name;
                if (!downtimeByPet[key]) downtimeByPet[key] = 0;
                downtimeByPet[key] += (pa.duration_mins || 0);
            });
        });
        // Also check if pets_affected is directly on category
        (cat.pets_affected || []).forEach(pa => {
            const key = pa.pet_id || pa.pet_name;
            if (!downtimeByPet[key]) downtimeByPet[key] = 0;
            downtimeByPet[key] += (pa.duration_mins || 0);
        });
    });

    // Group pets by line for a combined view (merge day + night for same pet)
    const petsByLine = {};
    allPets.forEach(pet => {
        const key = pet.pet_id || pet.pet_name;
        if (!petsByLine[key]) {
            petsByLine[key] = {
                pet_name: pet.pet_name,
                product_names: [],
                total_bottles: 0,
                total_packs: 0,
                total_downtime_mins: 0,
                planned_downtime_mins: 0,
                mechanical_downtime_mins: 0,
                shifts: [],
            };
        }
        petsByLine[key].total_bottles += (pet.total_bottles || 0);
        petsByLine[key].total_packs += (pet.total_packs || 0);
        petsByLine[key].planned_downtime_mins += (pet.planned_downtime_mins || 0);
        petsByLine[key].mechanical_downtime_mins += (pet.mechanical_downtime_mins || 0);
        // total_downtime_mins is always the sum of planned + mechanical for consistency
        petsByLine[key].total_downtime_mins = petsByLine[key].planned_downtime_mins + petsByLine[key].mechanical_downtime_mins;
        if (pet.shift && !petsByLine[key].shifts.includes(pet.shift)) {
            petsByLine[key].shifts.push(pet.shift);
        }
        if (pet.product_name && !petsByLine[key].product_names.includes(pet.product_name)) {
            petsByLine[key].product_names.push(pet.product_name);
        }
    });
    const lineRows = Object.values(petsByLine).sort((a, b) => {
        const numA = parseInt(a.pet_name?.match(/\d+/)?.[0]) || 0;
        const numB = parseInt(b.pet_name?.match(/\d+/)?.[0]) || 0;
        return numA - numB;
    });

    // Helper to find material by type
    const getMaterial = (type) => materials.find(m => m.material_type === type) || {};

    // Format number with locale
    const fmt = (val, decimals = 0) => {
        if (val === null || val === undefined) return '';
        return Number(val).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    return (
        <div className="page-wrapper">
            <div className="content">
                {/* Header with Controls - hidden on print */}
                <div className="d-flex justify-content-between align-items-center mb-3 no-print">
                    <div>
                        <h4 className="fw-bold mb-1">Production Report - Daily Sign Off</h4>
                        <p className="text-muted mb-0">FMPSOP-2-1 | Print and sign off this production report form</p>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <div className="d-flex align-items-center gap-2">
                            <Calendar size={18} className="text-muted" />
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ width: '160px' }}
                            />
                        </div>
                        <select
                            className="form-select form-select-sm"
                            value={selectedPet}
                            onChange={(e) => setSelectedPet(e.target.value)}
                            style={{ width: '160px' }}
                        >
                            <option value="">All Lines</option>
                            {pets.map((pet) => (
                                <option key={pet.id} value={pet.id}>
                                    {pet.pet_name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            value={selectedShift}
                            onChange={(e) => setSelectedShift(e.target.value)}
                            style={{ width: '140px' }}
                        >
                            <option value="">All Shifts</option>
                            {shifts.map((shift) => (
                                <option key={shift.id} value={shift.id}>
                                    {shift.name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            style={{ width: '170px' }}
                        >
                            <option value="">All Products</option>
                            {productNames.map((prod) => (
                                <option key={prod} value={prod}>
                                    {prod}
                                </option>
                            ))}
                        </select>
                        <button
                            className="btn btn-primary d-flex align-items-center gap-2"
                            onClick={handlePrint}
                            disabled={loading || !data}
                        >
                            <Printer size={18} />
                            Print Form
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="d-flex justify-content-center align-items-center py-5">
                        <Loader2 size={32} className="text-primary spinning" />
                        <span className="ms-2 text-muted">Loading production data...</span>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="alert alert-danger">{error}</div>
                )}

                {/* Printable Form */}
                {!loading && data && (
                    <div className="print-form-container" ref={printRef}>
                        <div className="production-report-form">
                            {/* Form Header */}
                            <div className="form-header">
                                <div className="header-left">
                                    <img src="/logo.jpeg" alt="Twellium" className="print-logo" />
                                    <h5 className="company-name">TWELLIUM INDUSTRIAL COMPANY LTD.</h5>
                                </div>
                                <div className="header-center">
                                    <h4 className="report-title">PRODUCTION REPORT</h4>
                                </div>
                                <div className="header-right">
                                    <div className="header-info">
                                        <span>PRODUCTION DEPARTMENT</span>
                                        <span>SOP No: PSOP-2</span>
                                        <span>SOP TITLE: FILLING PROCEDURE</span>
                                        <span className="doc-ref">FMPSOP-2-1</span>
                                    </div>
                                </div>
                            </div>

                            {/* Production Info Table */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Date</td>
                                        <td className="input-cell numeric" style={{ width: '20%' }}>{dayData.date || selectedDate}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Shift</td>
                                        <td className="input-cell" style={{ width: '15%' }}>{selectedShift ? shifts.find(s => String(s.id) === String(selectedShift))?.name || '' : 'All Shifts'}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Line</td>
                                        <td className="input-cell" style={{ width: '20%' }}>{selectedPet ? pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '' : 'All Lines'}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Production Start Time</td>
                                        <td className="input-cell numeric">{!selectedPet ? 'NOT APPLICABLE' : (summary.production_start_time || '')}</td>
                                        <td className="label-cell">Production End Time</td>
                                        <td className="input-cell numeric">{!selectedPet ? 'NOT APPLICABLE' : (summary.production_end_time || '')}</td>
                                        <td className="label-cell">Total Production Time (Hrs)</td>
                                        <td className="input-cell numeric">{summary.total_production_time_hrs != null ? summary.total_production_time_hrs : ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Units (Bottles)</td>
                                        <td className="input-cell numeric">{fmt(summary.total_bottles)}</td>
                                        <td className="label-cell">Total Packs</td>
                                        <td className="input-cell numeric">{fmt(summary.total_packs)}</td>
                                        <td className="label-cell">Total Reports</td>
                                        <td className="input-cell numeric">{summary.total_reports || dayData.report_count || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Downtime (min)</td>
                                        <td className="input-cell numeric">{fmt(summary.total_downtime_mins || ((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0)))}</td>
                                        <td className="label-cell">Planned Downtime (min)</td>
                                        <td className="input-cell numeric">{fmt(summary.planned_downtime_mins)}</td>
                                        <td className="label-cell">Mechanical Downtime (min)</td>
                                        <td className="input-cell numeric">{fmt(summary.mechanical_downtime_mins)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Workers</td>
                                        <td className="input-cell numeric">{summary.worker_count || ''}</td>
                                        <td className="label-cell">Efficiency</td>
                                        <td className="input-cell numeric">{summary.avg_efficiency ? `${summary.avg_efficiency}%` : ''}</td>
                                        <td className="label-cell">Stoppage Reports</td>
                                        <td className="input-cell numeric">{summary.total_stoppage_reports || ''}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={8}>Performance Summary</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="label-cell">OEE</td>
                                        <td className="input-cell numeric">{summary.oee ? `${summary.oee}%` : ''}</td>
                                        <td className="label-cell">Availability</td>
                                        <td className="input-cell numeric">{summary.avg_availability ? `${summary.avg_availability}%` : ''}</td>
                                        <td className="label-cell">Performance</td>
                                        <td className="input-cell numeric">{summary.avg_performance ? `${summary.avg_performance}%` : ''}</td>
                                        <td className="label-cell">Quality</td>
                                        <td className="input-cell numeric">{summary.avg_quality ? `${summary.avg_quality}%` : ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Syrup Yield</td>
                                        <td className="input-cell numeric">{summary.avg_syrup_yield ? `${summary.avg_syrup_yield}%` : ''}</td>
                                        <td className="label-cell">CO2 Yield</td>
                                        <td className="input-cell numeric">{summary.avg_co2_yield ? `${summary.avg_co2_yield}%` : ''}</td>
                                        <td className="label-cell">Bottles Produced</td>
                                        <td className="input-cell numeric">{fmt(summary.total_bottles_produced)}</td>
                                        <td className="label-cell">Target Met</td>
                                        <td className="input-cell numeric">{summary.target_met_count || ''}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Production by Line */}
                            {!selectedPet && (
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th className="section-label">Line</th>
                                        <th>Product</th>
                                        <th>Total Bottles</th>
                                        <th>Total Packs</th>
                                        <th>Planned (min)</th>
                                        <th>Mechanical (min)</th>
                                        <th>Downtime (min)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineRows.length > 0 ? lineRows.map((line, idx) => (
                                        <tr key={idx}>
                                            <td className="label-cell">{line.pet_name}</td>
                                            <td className="input-cell">{line.product_names.join(', ')}</td>
                                            <td className="input-cell numeric">{fmt(line.total_bottles)}</td>
                                            <td className="input-cell numeric">{fmt(line.total_packs)}</td>
                                            <td className="input-cell numeric">{fmt(line.planned_downtime_mins)}</td>
                                            <td className="input-cell numeric">{fmt(line.mechanical_downtime_mins)}</td>
                                            <td className="input-cell numeric">{fmt(line.total_downtime_mins)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={7} className="input-cell text-center">No line data available</td>
                                        </tr>
                                    )}
                                    {/* Totals row */}
                                    {lineRows.length > 0 && (
                                        <tr className="fw-bold">
                                            <td className="label-cell">TOTAL</td>
                                            <td className="input-cell"></td>
                                            <td className="input-cell numeric">{fmt(summary.total_bottles)}</td>
                                            <td className="input-cell numeric">{fmt(summary.total_packs)}</td>
                                            <td className="input-cell numeric">{fmt(lineRows.reduce((s, l) => s + l.planned_downtime_mins, 0))}</td>
                                            <td className="input-cell numeric">{fmt(lineRows.reduce((s, l) => s + l.mechanical_downtime_mins, 0))}</td>
                                            <td className="input-cell numeric">{fmt(lineRows.reduce((s, l) => s + l.total_downtime_mins, 0))}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            )}

                            {/* Detailed Pet/Line Info (when a specific pet is selected) */}
                            {selectedPet && allPets.length > 0 && (
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={6}>Line Detail — {pets.find(p => String(p.id) === String(selectedPet))?.pet_name || ''}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="label-cell">Product</td>
                                        <td className="input-cell" colSpan={2}>{allPets.map(p => p.product_name).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
                                        <td className="label-cell">Status</td>
                                        <td className="input-cell" colSpan={2}>{allPets.map(p => p.status).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Bottles</td>
                                        <td className="input-cell numeric">{fmt(summary.total_bottles)}</td>
                                        <td className="label-cell">Total Packs</td>
                                        <td className="input-cell numeric">{fmt(summary.total_packs)}</td>
                                        <td className="label-cell">Bottles Produced</td>
                                        <td className="input-cell numeric">{fmt(summary.total_bottles_produced)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">OEE</td>
                                        <td className="input-cell numeric">{summary.oee ? `${summary.oee}%` : ''}</td>
                                        <td className="label-cell">Efficiency</td>
                                        <td className="input-cell numeric">{summary.avg_efficiency ? `${summary.avg_efficiency}%` : ''}</td>
                                        <td className="label-cell">Availability</td>
                                        <td className="input-cell numeric">{summary.avg_availability ? `${summary.avg_availability}%` : ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Performance</td>
                                        <td className="input-cell numeric">{summary.avg_performance ? `${summary.avg_performance}%` : ''}</td>
                                        <td className="label-cell">Quality</td>
                                        <td className="input-cell numeric">{summary.avg_quality ? `${summary.avg_quality}%` : ''}</td>
                                        <td className="label-cell">Target Met</td>
                                        <td className="input-cell numeric">{summary.target_met_count || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Syrup Yield</td>
                                        <td className="input-cell numeric">{summary.avg_syrup_yield ? `${summary.avg_syrup_yield}%` : ''}</td>
                                        <td className="label-cell">CO2 Yield</td>
                                        <td className="input-cell numeric">{summary.avg_co2_yield ? `${summary.avg_co2_yield}%` : ''}</td>
                                        <td className="label-cell">Stoppage Reports</td>
                                        <td className="input-cell numeric">{summary.total_stoppage_reports || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Downtime (min)</td>
                                        <td className="input-cell numeric">{fmt(summary.total_downtime_mins || ((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0)))}</td>
                                        <td className="label-cell">Planned (min)</td>
                                        <td className="input-cell numeric">{fmt(summary.planned_downtime_mins)}</td>
                                        <td className="label-cell">Mechanical (min)</td>
                                        <td className="input-cell numeric">{fmt(summary.mechanical_downtime_mins)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            )}

                            {/* Materials Consumption Section */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th className="section-label" colSpan={2}>Materials Consumption</th>
                                        <th>Unit</th>
                                        <th>Used</th>
                                        <th>Losses</th>
                                        <th>Loss%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { type: 'PREFORMS', label: 'Preforms Consumption', defaultUnit: 'Pcs' },
                                        { type: 'CLOSURES', label: 'Closure Consumption', defaultUnit: 'Pcs' },
                                        { type: 'LABELS', label: 'Label / Sleeve Consumption', defaultUnit: 'Pcs' },
                                        { type: 'SHRINK', label: 'Shrink Consumption', defaultUnit: 'Pcs' },
                                        { type: 'STRETCH_FILM', label: 'Stretch Film', defaultUnit: 'Kg' },
                                        { type: 'CARTON_LAYER', label: 'Carton Layer', defaultUnit: 'Pcs' },
                                        { type: 'CARTON_BOXES', label: 'Carton Boxes', defaultUnit: 'Pcs' },
                                        { type: 'GLUE', label: 'Glue Consumption', defaultUnit: 'Kg' },
                                    ].map(({ type, label, defaultUnit }) => {
                                        const mat = getMaterial(type);
                                        const lossPercent = mat.total_used
                                            ? ((mat.total_losses / mat.total_used) * 100).toFixed(1)
                                            : '';
                                        return (
                                            <tr key={type}>
                                                <td className="label-cell" colSpan={2}>{label}</td>
                                                <td className="unit-cell">{mat.unit || defaultUnit}</td>
                                                <td className="input-cell numeric">{fmt(mat.total_used)}</td>
                                                <td className="input-cell numeric">{fmt(mat.total_losses)}</td>
                                                <td className="input-cell numeric">{lossPercent ? `${lossPercent}%` : ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Meters Reading Section */}
                            <table className="form-table section-table meters-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={3}>Meters Reading</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '33%' }}>CO2</th>
                                        <th style={{ width: '33%' }}>Syrup</th>
                                        <th style={{ width: '34%' }}>Production Reading</th>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Start up Reading (Kg):</span>
                                                <span className="meter-value numeric">{!selectedPet ? 'NOT APPLICABLE' : (co2Meters.start_reading_kg != null ? fmt(co2Meters.start_reading_kg, 1) : '')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Start up Reading:</span>
                                                <span className="meter-value numeric">{!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.start_reading != null ? fmt(syrupMeters.start_reading, 1) : '')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Reading:</span>
                                                <span className="meter-value numeric">{productionMeters.filler_reading != null ? fmt(productionMeters.filler_reading) : ''}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading (Kg):</span>
                                                <span className="meter-value numeric">{!selectedPet ? 'NOT APPLICABLE' : (co2Meters.end_reading_kg != null ? fmt(co2Meters.end_reading_kg, 1) : '')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading:</span>
                                                <span className="meter-value numeric">{!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.end_reading != null ? fmt(syrupMeters.end_reading, 1) : '')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading:</span>
                                                <span className="meter-value numeric">{productionMeters.shrink_reading != null ? fmt(productionMeters.shrink_reading) : ''}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (kg):</span>
                                                <span className="meter-value numeric">{co2Meters.total_co2_consumed_kg != null ? fmt(co2Meters.total_co2_consumed_kg, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Difference (End - Start):</span>
                                                <span className="meter-value numeric">{syrupMeters.difference != null ? fmt(syrupMeters.difference, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Rejects (M/C):</span>
                                                <span className="meter-value numeric">{productionMeters.filler_rejects_mc != null ? fmt(productionMeters.filler_rejects_mc) : ''}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Std. CO2 Consumption (kg):</span>
                                                <span className="meter-value numeric">{co2Meters.std_co2_consumption_kg != null ? fmt(co2Meters.std_co2_consumption_kg, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Unit (L, m3, kg):</span>
                                                <span className="meter-value numeric">{syrupMeters.unit || ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Blower Rejects (Manual Count):</span>
                                                <span className="meter-value numeric">{productionMeters.blower_rejects_manual != null ? fmt(productionMeters.blower_rejects_manual) : ''}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 Yield (%):</span>
                                                <span className="meter-value numeric">{co2Meters.co2_yield_percent != null ? `${co2Meters.co2_yield_percent}%` : (summary.avg_co2_yield ? `${summary.avg_co2_yield}%` : '')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Density (kg/L):</span>
                                                <span className="meter-value numeric">{syrupMeters.syrup_density_kg_per_l != null ? syrupMeters.syrup_density_kg_per_l : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading / T. Packs (%):</span>
                                                <span className="meter-value numeric">{productionMeters.shrink_reading_packs_percent != null ? `${productionMeters.shrink_reading_packs_percent}%` : ''}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total Syrup Used (L):</span>
                                                <span className="meter-value numeric">{syrupMeters.total_syrup_used_l != null ? fmt(syrupMeters.total_syrup_used_l, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Dilution Ratio:</span>
                                                <span className="meter-value numeric">{syrupMeters.syrup_dilution_ratio != null ? syrupMeters.syrup_dilution_ratio : ''}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Std. Syrup Consumption (L):</span>
                                                <span className="meter-value numeric">{syrupMeters.std_syrup_consumption_l != null ? fmt(syrupMeters.std_syrup_consumption_l, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Yield (%):</span>
                                                <span className="meter-value numeric">{syrupMeters.syrup_yield_percent != null ? `${syrupMeters.syrup_yield_percent}%` : (summary.avg_syrup_yield ? `${summary.avg_syrup_yield}%` : '')}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Downtime Breakdown */}
                            {data?.downtime_breakdown?.categories?.length > 0 && (
                                <table className="form-table section-table">
                                    <thead>
                                        <tr className="section-header-row">
                                            <th className="section-label">Downtime Category</th>
                                            <th>Duration (min)</th>
                                            <th>% of Total</th>
                                            <th>Incidents</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.downtime_breakdown.categories.map((cat) => (
                                            <tr key={cat.category_id}>
                                                <td className="label-cell">{cat.category_name}</td>
                                                <td className="input-cell numeric">{fmt(cat.total_duration_mins)}</td>
                                                <td className="input-cell numeric">{cat.percentage_of_total ? `${cat.percentage_of_total}%` : ''}</td>
                                                <td className="input-cell numeric">{cat.incident_count || ''}</td>
                                            </tr>
                                        ))}
                                        <tr className="fw-bold">
                                            <td className="label-cell">TOTAL</td>
                                            <td className="input-cell numeric">{fmt(data.downtime_breakdown.total_downtime_mins || data.downtime_breakdown.categories.reduce((s, c) => s + (c.total_duration_mins || 0), 0))}</td>
                                            <td className="input-cell numeric">100%</td>
                                            <td className="input-cell numeric">{data.downtime_breakdown.total_incidents || data.downtime_breakdown.categories.reduce((s, c) => s + (c.incident_count || 0), 0) || ''}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}

                            {/* Sign Off Section */}
                            <div className="sign-off-section">
                                <div className="sign-off-row">
                                    <div className="sign-off-field">
                                        <label>Production Supervisor:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                    <div className="sign-off-field">
                                        <label>Production Manager:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                </div>
                                <div className="sign-off-row">
                                    <div className="sign-off-field">
                                        <label>Signature:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                    <div className="sign-off-field">
                                        <label>Signature:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="form-footer">
                                <span>Page 1 of 1</span>
                                <span>REVIEW No: 03</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductionReportForm;
