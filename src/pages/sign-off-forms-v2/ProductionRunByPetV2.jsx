import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';
import '../sign-off-forms/css/Sign-Off-Styles.css';

const STORAGE_KEY = 'productionRunByPetV2_filters';

// Format a value for display: if it is a pure number that has a fractional
// part, render it with exactly 2 decimal places. Integers, non-numeric strings
// (dates, times, units, ratios like "1:5"), and empty values are left as-is.
const formatDisplayValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const s = String(value).trim();
    if (/^-?\d+\.\d+$/.test(s)) {
        const n = Number(s);
        if (Number.isFinite(n)) return n.toFixed(2);
    }
    return s;
};

// Generic editable input that preserves its own state while syncing with initial value changes
const EditableField = ({ value, type = 'text', className = '', onChange, step, min, max, readOnly }) => {
    const [val, setVal] = useState(() => formatDisplayValue(value));
    useEffect(() => {
        setVal(formatDisplayValue(value));
    }, [value]);
    const alignment = type === 'number' ? 'right' : 'left';
    return (
        <input
            type={type}
            step={step}
            min={min}
            max={max}
            readOnly={readOnly}
            className={`form-control form-control-sm border-0 rounded-0 shadow-none ${className}`}
            style={{
                minWidth: '48px',
                height: '1.6rem',
                padding: '0.1rem 0.25rem',
                textAlign: alignment,
                backgroundColor: 'transparent',
                borderBottom: '1px dashed rgba(33, 37, 41, 0.35)',
                color: '#212529',
                fontSize: '0.85rem'
            }}
            value={val}
            onChange={(e) => {
                setVal(e.target.value);
                if (onChange) onChange(e.target.value);
            }}
        />
    );
};

const getStoredFilters = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch { return null; }
};

// Unwrap the API envelope: { status_code, message, data: {...} }. The live
// endpoint may double-wrap, so drill down until we reach the object that
// actually carries the report payload (identified by the `run` key).
const unwrapReport = (res) => {
    let d = res?.data ?? {};
    // Peel nested { data: {...} } wrappers until we find the report fields.
    for (let i = 0; i < 4; i += 1) {
        if (d && typeof d === 'object' && !('run' in d) && d.data && typeof d.data === 'object') {
            d = d.data;
        } else {
            break;
        }
    }
    return d && typeof d === 'object' ? d : {};
};

const ProductionRunByPetV2 = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const storedFilters = getStoredFilters();
    const [selectedPet, setSelectedPet] = useState(storedFilters?.selectedPet || '');
    const [selectedProduct, setSelectedProduct] = useState(storedFilters?.selectedProduct || '');
    const [selectedShift, setSelectedShift] = useState(storedFilters?.selectedShift || '');
    const [startDate, setStartDate] = useState(() => {
        if (storedFilters?.startDate) return storedFilters.startDate;
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        if (storedFilters?.endDate) return storedFilters.endDate;
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });

    // Persist filters to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            selectedPet,
            selectedProduct,
            selectedShift,
            startDate,
            endDate,
        }));
    }, [selectedPet, selectedProduct, selectedShift, startDate, endDate]);

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

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { start_date: startDate, end_date: endDate };
            if (selectedPet) params.pet = selectedPet;
            if (selectedShift) params.shift = selectedShift;
            if (selectedProduct) params.product = selectedProduct;
            const res = await productionApi.getSignOffProductReport(params);
            setData(unwrapReport(res));
        } catch (err) {
            console.error('Failed to fetch product report:', err);
            setError(err?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, selectedPet, selectedShift, selectedProduct]);

    const selectedPetName = pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '';

    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = `Product Report - ${selectedPetName || 'All Lines'}${selectedProduct ? ` - ${selectedProduct}` : ''} - ${startDate} to ${endDate}`;
        window.print();
        document.title = prevTitle;
    };

    // ---- Bind directly to the dedicated endpoint response structure ----
    const run = data?.run || {};
    const products = Array.isArray(data?.products) ? data.products : [];
    const batches = Array.isArray(data?.batches) ? data.batches : [];
    const workers = data?.workers || {};
    const materials = Array.isArray(data?.materials) ? data.materials : [];
    const meters = data?.meters || {};
    const co2Meters = meters.co2 || {};
    const syrupMeters = meters.syrup || {};
    const productionMeters = meters.production || {};
    const downtime = data?.downtime || {};

    // Product dropdown options come from the returned products list
    const productNames = [...new Set(products.map(p => p.product_name).filter(Boolean))].sort();

    // Format number with thousands separators / fixed decimals
    const fmt = (val, decimals = 0) => {
        if (val === null || val === undefined || val === '') return '';
        const n = Number(val);
        if (!Number.isFinite(n)) return '';
        return n.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Loss% for a material row
    const lossPct = (mat) => {
        if (!mat || !mat.total_used) return '';
        const pct = (mat.total_losses / mat.total_used) * 100;
        if (!Number.isFinite(pct)) return '';
        return `${pct.toFixed(1)}%`;
    };

    // Format the selected filter date range
    const formatDateRange = () => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const fmtD = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${fmtD(s)} TO ${fmtD(e)}`;
    };

    // Format the production dates returned by the API
    const formatProductionDates = () => {
        const dates = Array.isArray(run.production_dates) ? run.production_dates : [];
        if (dates.length === 0) return '';
        return dates.map(d => {
            const dt = new Date(d);
            return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }).join(', ');
    };
    const productionDates = Array.isArray(run.production_dates) ? run.production_dates : [];

    const shiftLabel = selectedShift
        ? (shifts.find(s => String(s.id) === String(selectedShift))?.name
            || shifts.find(s => String(s.id) === String(selectedShift))?.shift_name
            || 'All Shifts')
        : 'All Shifts';

    return (
        <div className="page-wrapper">
            <div className="content">
                {/* Header with Controls */}
                <div className="d-flex justify-content-between align-items-center mb-3 no-print">
                    <div>
                        <h4 className="fw-bold mb-1">Product Report</h4>
                        <p className="text-muted mb-0">FP-DR-008-Rev.A | Multi-day production run report per line</p>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                        <div className="d-flex align-items-center gap-2">
                            <Calendar size={18} className="text-muted" />
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: '145px' }}
                            />
                            <span className="text-muted">to</span>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: '145px' }}
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
                            style={{ width: '160px' }}
                        >
                            <option value="">All Shifts</option>
                            {shifts.map((shift) => (
                                <option key={shift.id} value={shift.id}>
                                    {shift.name || shift.shift_name}
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

                {/* Loading */}
                {loading && (
                    <div className="d-flex justify-content-center align-items-center py-5">
                        <Loader2 size={32} className="text-primary spinning" />
                        <span className="ms-2 text-muted">Loading production data...</span>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="alert alert-danger">{error}</div>
                )}

                {/* Printable Form */}
                {!loading && data && (
                    <div className="print-form-container" ref={printRef}>
                        <div className="production-report-form">

                            {/* Row 1-2: Header */}
                            <div className="form-header">
                                <div className="header-left">
                                    <img src="/logo.jpeg" alt="Twellium" className="print-logo" />
                                    <h5 className="company-name">TWELLIUM INDUSTRIAL COMPANY LTD.</h5>
                                    <span style={{ fontSize: '11px' }}>Title: Product Sign Off Report</span>
                                </div>
                                <div className="header-center">
                                    <h4 className="report-title">{selectedPetName || 'ALL LINES'}</h4>
                                </div>
                                <div className="header-right">
                                    <div className="header-info">
                                        <span className="doc-ref">FP-DR-008-Rev.A</span>
                                        <span>Page 1 of 1</span>
                                    </div>
                                </div>
                            </div>

                            {/* Active Filters Display */}
                            <div className="active-filters-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '6px 10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '11px' }}>
                                <span><strong>Date:</strong> {formatDateRange()}</span>
                                <span><strong>Line:</strong> {selectedPetName || 'All Lines'}</span>
                                <span><strong>Shift:</strong> {shiftLabel}</span>
                                {selectedProduct && <span><strong>Product:</strong> {selectedProduct}</span>}
                            </div>

                            {/* Row 4-6: Date, Line Speed, Shift, Batches */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '8%' }}>Date</td>
                                        <td className="input-cell numeric" style={{ width: '25%' }}><EditableField value={formatDateRange()} /></td>
                                        <td className="label-cell" style={{ width: '10%' }}>Line Speed</td>
                                        <td className="input-cell numeric" style={{ width: '10%' }}><EditableField value={run.line_speed != null ? run.line_speed : ''} /></td>
                                        <td className="label-cell" style={{ width: '10%' }}>Total Units</td>
                                        <td className="input-cell numeric" style={{ width: '12%' }}><EditableField value={run.total_bottles_produced != null ? fmt(run.total_bottles_produced) : ''} /></td>
                                    </tr>
                                    {/* Production Date(s) returned by the API */}
                                    {productionDates.length > 0 && (
                                    <tr>
                                        <td className="label-cell">Prod. Date(s)</td>
                                        <td className="input-cell" colSpan={5} style={{ fontSize: '0.8rem' }}>
                                            <textarea
                                                className="form-control form-control-sm border-0 rounded-0 shadow-none"
                                                style={{
                                                    minHeight: '2.4rem',
                                                    padding: '0.2rem 0.25rem',
                                                    backgroundColor: 'transparent',
                                                    borderBottom: '1px dashed rgba(33, 37, 41, 0.35)',
                                                    color: '#212529',
                                                    fontSize: '0.8rem',
                                                    resize: 'vertical',
                                                    lineHeight: '1.4'
                                                }}
                                                rows={Math.ceil(productionDates.length / 4) || 1}
                                                defaultValue={formatProductionDates()}
                                            />
                                        </td>
                                    </tr>
                                    )}
                                    <tr>
                                        <td className="label-cell">Shift</td>
                                        <td className="input-cell"><EditableField value={shiftLabel} /></td>
                                        <td className="label-cell">Total Batches</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField type="number" value={batches.length || ''} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Product Details Breakdown */}
                            {products.length > 0 && (
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={5}>Product Details</th>
                                    </tr>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '28%' }}>Product</th>
                                        <th style={{ width: '18%' }}>Bottle Size</th>
                                        <th style={{ width: '18%' }}>Line Speed (BPH)</th>
                                        <th style={{ width: '18%' }}>Bottles/Pack</th>
                                        <th style={{ width: '18%' }}>Packs/Pallet</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((prod, idx) => (
                                        <tr key={idx}>
                                            <td className="label-cell">{prod.product_name}</td>
                                            <td className="input-cell numeric"><EditableField value={prod.bottle_size != null ? prod.bottle_size : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={prod.line_speed != null ? prod.line_speed : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={prod.bottles_per_pack != null ? prod.bottles_per_pack : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={prod.packs_per_pallet != null ? prod.packs_per_pallet : ''} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            )}

                            {/* Row 21-23: Production Totals */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Btls/Hr</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}><EditableField value={run.total_bottles_per_hr != null ? fmt(run.total_bottles_per_hr) : ''} /></td>
                                        <td className="label-cell" style={{ width: '15%' }}>Efficiency</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}><EditableField value={run.avg_efficiency != null ? `${run.avg_efficiency}%` : ''} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Production */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={4}>Production</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '10%' }}>Yield</td>
                                        <td className="input-cell numeric" style={{ width: '40%' }}><EditableField value={run.avg_syrup_yield != null ? `${run.avg_syrup_yield}%` : ''} /></td>
                                        <td className="label-cell" style={{ width: '12%' }}>Total Pack</td>
                                        <td className="input-cell numeric" style={{ width: '38%' }}><EditableField value={run.total_packs != null ? fmt(run.total_packs) : ''} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Batch Details Table — from data.batches */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={5}>Batch Details</th>
                                    </tr>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '20%' }}>Batch No</th>
                                        <th style={{ width: '20%' }}>Syrup (Lts)</th>
                                        <th style={{ width: '20%' }}>Bev (Lts)</th>
                                        <th style={{ width: '20%' }}>Tank</th>
                                        <th style={{ width: '20%' }}>Start Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.length > 0 ? batches.map((batch, idx) => (
                                        <tr key={idx}>
                                            <td className="label-cell">{batch.batch_number || '—'}</td>
                                            <td className="input-cell numeric"><EditableField value={batch.syrup_liters != null ? fmt(batch.syrup_liters, 1) : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={batch.beverage_liters != null ? fmt(batch.beverage_liters, 1) : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={batch.tank_number != null ? batch.tank_number : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={batch.start_time != null ? batch.start_time : ''} /></td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td className="input-cell text-center" colSpan={5}>No batch data available</td>
                                        </tr>
                                    )}
                                    {batches.length > 0 && (
                                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                        <td className="label-cell">TOTAL</td>
                                        <td className="input-cell numeric"><EditableField value={fmt(batches.reduce((s, b) => s + (Number(b.syrup_liters) || 0), 0), 1)} /></td>
                                        <td className="input-cell numeric"><EditableField value={fmt(batches.reduce((s, b) => s + (Number(b.beverage_liters) || 0), 0), 1)} /></td>
                                        <td className="input-cell numeric"></td>
                                        <td className="input-cell numeric"></td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Time / Workers */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell">Start Up Production</td>
                                        <td className="input-cell" colSpan={3}><EditableField value={run.production_start_time || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Shut Down Production</td>
                                        <td className="input-cell" colSpan={3}><EditableField value={run.production_end_time || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Production Hrs</td>
                                        <td className="input-cell" colSpan={3}><EditableField type="number" step="0.1" value={run.total_production_hours != null ? run.total_production_hours : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Cumulative Stoppage Time/min</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField value={run.total_downtime_minutes != null ? fmt(run.total_downtime_minutes, 1) : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Workers Count</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField type="number" value={workers.worker_count != null ? workers.worker_count : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Paid Hours</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField value={workers.paid_hours != null ? workers.paid_hours : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Overtime Hours</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField value={workers.overtime_hours != null ? workers.overtime_hours : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Workers</td>
                                        <td className="input-cell" colSpan={3}><EditableField value={Array.isArray(workers.worker_names) ? workers.worker_names.join(', ') : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Absent Workers</td>
                                        <td className="input-cell" colSpan={3}><EditableField value={Array.isArray(workers.absent_worker_names) && workers.absent_worker_names.length ? workers.absent_worker_names.join(', ') : '—'} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 36-41: Materials Consumption — from data.materials */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th className="section-label" style={{ width: '20%' }}>Material</th>
                                        <th style={{ width: '6%' }}>Unit</th>
                                        <th style={{ width: '14%' }}>Expected to be use</th>
                                        <th style={{ width: '14%' }}>Received</th>
                                        <th style={{ width: '14%' }}>Used</th>
                                        <th style={{ width: '12%' }}>Returned</th>
                                        <th style={{ width: '10%' }}>Losses</th>
                                        <th style={{ width: '10%' }}>Loss%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {materials.length > 0 ? materials.map((mat, idx) => (
                                        <tr key={mat.material_type || idx}>
                                            <td className="label-cell">{mat.material_type_display || mat.material_type || '—'}</td>
                                            <td className="unit-cell"><EditableField value={mat.unit || ''} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={mat.expected_usage != null ? mat.expected_usage : ''} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={mat.received != null ? mat.received : ''} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={mat.total_used != null ? mat.total_used : ''} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={mat.returned != null ? mat.returned : ''} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={mat.total_losses != null ? mat.total_losses : ''} /></td>
                                            <td className="input-cell numeric"><EditableField value={lossPct(mat)} /></td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td className="input-cell text-center" colSpan={8}>No material data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Row 43-49: Meters Reading — from data.meters */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={3}>Meters Reading</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '50%' }}>CO2</th>
                                        <th colSpan={2} style={{ width: '50%' }}>Production Reading</th>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Start up Reading (Kg):</span>
                                                <EditableField value={co2Meters.start_reading_kg != null ? co2Meters.start_reading_kg : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Combi Reading:</span>
                                                <EditableField value={productionMeters.combi_reading != null ? productionMeters.combi_reading : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading (Kg):</span>
                                                <EditableField value={co2Meters.end_reading_kg != null ? co2Meters.end_reading_kg : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading:</span>
                                                <EditableField value={productionMeters.shrink_reading != null ? productionMeters.shrink_reading : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Difference in Balance:</span>
                                                <EditableField value={co2Meters.difference_in_balance != null ? co2Meters.difference_in_balance : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Reading:</span>
                                                <EditableField value={productionMeters.filler_reading != null ? productionMeters.filler_reading : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (Kg):</span>
                                                <EditableField value={co2Meters.total_co2_consumed_kg != null ? co2Meters.total_co2_consumed_kg : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Used (L):</span>
                                                <EditableField value={syrupMeters.total_syrup_used_l != null ? syrupMeters.total_syrup_used_l : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/l:</span>
                                                <EditableField value={co2Meters.co2_g_per_liter != null ? co2Meters.co2_g_per_liter : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Dilution Ratio:</span>
                                                <EditableField value={syrupMeters.syrup_dilution_ratio != null ? syrupMeters.syrup_dilution_ratio : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/Btl:</span>
                                                <EditableField value={co2Meters.co2_g_per_bottle != null ? co2Meters.co2_g_per_bottle : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Yield %:</span>
                                                <EditableField value={syrupMeters.syrup_yield_percent != null ? `${syrupMeters.syrup_yield_percent}%` : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Downtime Section — from data.downtime */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={2}>Downtime</th>
                                    </tr>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '65%' }}>Category</th>
                                        <th style={{ width: '35%' }}>Duration (min)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="label-cell">Total Planned Downtime</td>
                                        <td className="input-cell numeric"><EditableField value={downtime.total_planned_downtime_mins != null ? fmt(downtime.total_planned_downtime_mins, 1) : ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Mechanical Downtime</td>
                                        <td className="input-cell numeric"><EditableField value={downtime.total_mechanical_downtime_mins != null ? fmt(downtime.total_mechanical_downtime_mins, 1) : ''} /></td>
                                    </tr>
                                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                        <td className="label-cell">TOTAL</td>
                                        <td className="input-cell numeric"><EditableField value={downtime.total_downtime_minutes != null ? fmt(downtime.total_downtime_minutes, 1) : ''} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 52-53: Sign Off */}
                            <div className="sign-off-section">
                                <div className="sign-off-row">
                                    <div className="sign-off-field">
                                        <label>Name:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                    <div className="sign-off-field">
                                        <label>Issue Date:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                </div>
                                <div className="sign-off-row">
                                    <div className="sign-off-field">
                                        <label>Signature:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                    <div className="sign-off-field"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductionRunByPetV2;
