import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';

const ProductionRunByPet = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const [selectedPet, setSelectedPet] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });

    // Fetch available pets/lines (exclude can lines)
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
        fetchPets();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { start_date: startDate, end_date: endDate };
            if (selectedPet) params.pet = selectedPet;
            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            setData(envelope);
        } catch (err) {
            console.error('Failed to fetch production data:', err);
            setError(err?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [startDate, endDate, selectedPet]);

    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = `Production Run - ${selectedPetName || 'All Lines'} - ${startDate} to ${endDate}`;
        window.print();
        document.title = prevTitle;
    };

    // Extract data
    const summary = data?.summary || {};
    const dailyBreakdown = data?.daily_breakdown || [];
    const materials = data?.material_consumptions?.materials || [];
    const selectedPetName = pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '';

    // Get product names from daily breakdown
    const allPetEntries = dailyBreakdown.flatMap(d => (d.pets || []).filter(p => !p.pet_name?.toLowerCase().includes('can')));
    const productNames = [...new Set(allPetEntries.map(p => p.product_name).filter(Boolean))];

    // Calculate Total Btls/Hr: total_bottles / total_production_hours
    // Approximate production hours from number of reports * 8hrs minus downtime
    const totalDowntimeHrs = (summary.total_downtime_mins || 0) / 60;
    const approxProductionHrs = (summary.total_reports || 0) * 8 - totalDowntimeHrs;
    const totalBtlsPerHr = approxProductionHrs > 0 ? Math.round(summary.total_bottles / approxProductionHrs) : 0;

    // Helper to find material by type
    const getMaterial = (type) => materials.find(m => m.material_type === type) || {};

    // Format number
    const fmt = (val, decimals = 0) => {
        if (val === null || val === undefined) return '';
        return Number(val).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Format date range display
    const formatDateRange = () => {
        const s = new Date(startDate);
        const e = new Date(endDate);
        const fmtD = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${fmtD(s)} TO ${fmtD(e)}`;
    };

    return (
        <div className="page-wrapper">
            <div className="content">
                {/* Header with Controls */}
                <div className="d-flex justify-content-between align-items-center mb-3 no-print">
                    <div>
                        <h4 className="fw-bold mb-1">Production Run Report by Line</h4>
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
                                    <span style={{ fontSize: '11px' }}>Title: Production Report</span>
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

                            {/* Row 4-6: Date, Shift, Flavor */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '8%' }}>Date</td>
                                        <td className="input-cell" style={{ width: '25%' }}>{formatDateRange()}</td>
                                        <td className="label-cell" style={{ width: '10%' }}>Line Speed</td>
                                        <td className="input-cell" style={{ width: '10%' }}></td>
                                        <td className="label-cell" style={{ width: '10%' }}>Total Units</td>
                                        <td className="input-cell" style={{ width: '12%' }}>{fmt(summary.total_bottles)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Shift</td>
                                        <td className="input-cell">All Shifts</td>
                                        <td className="label-cell">Batch N°</td>
                                        <td className="input-cell"></td>
                                        <td className="label-cell">Syrup (Lts)</td>
                                        <td className="input-cell"></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Flavor</td>
                                        <td className="input-cell" colSpan={5}>{productNames.join(', ') || ''}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 21-23: Package & Production Totals */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Package</td>
                                        <td className="input-cell" style={{ width: '15%' }}></td>
                                        <td className="input-cell" style={{ width: '15%' }}></td>
                                        <td className="input-cell" style={{ width: '15%' }}></td>
                                        <td className="label-cell" style={{ width: '15%' }}></td>
                                        <td className="input-cell" style={{ width: '25%' }}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Physical Box</td>
                                        <td className="input-cell"></td>
                                        <td className="input-cell"></td>
                                        <td className="input-cell"></td>
                                        <td className="label-cell"></td>
                                        <td className="input-cell"></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Btls/Hr</td>
                                        <td className="input-cell">{totalBtlsPerHr ? fmt(totalBtlsPerHr) : ''}</td>
                                        <td className="label-cell">Efficiency</td>
                                        <td className="input-cell">{summary.avg_efficiency ? `${summary.avg_efficiency}%` : ''}</td>
                                        <td className="label-cell">Total (Lts)</td>
                                        <td className="input-cell"></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 25-26: Production / Yield / Final Production */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th className="section-label" style={{ width: '15%' }}>Production</th>
                                        <th style={{ width: '15%' }}>Yield %</th>
                                        <th style={{ width: '20%' }}>Final Production</th>
                                        <th style={{ width: '15%' }}>T. Shrink</th>
                                        <th style={{ width: '15%' }}>Total Carton</th>
                                        <th style={{ width: '20%' }}>Total Packs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="input-cell"></td>
                                        <td className="input-cell">{summary.avg_syrup_yield ? `${summary.avg_syrup_yield}%` : ''}</td>
                                        <td className="input-cell">{fmt(summary.total_bottles_produced || summary.total_packs)}</td>
                                        <td className="input-cell"></td>
                                        <td className="input-cell"></td>
                                        <td className="input-cell">{fmt(summary.total_packs)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 28-34: Paid Hours / Time / Workers */}
                            <table className="form-table">
                                <tbody>
                                    <tr className="section-header-row">
                                        <td className="label-cell" style={{ width: '30%' }}><strong>Paid Hours (overtime)</strong></td>
                                        <td className="label-cell" style={{ width: '15%' }}><strong>Time</strong></td>
                                        <td className="input-cell" style={{ width: '20%' }}></td>
                                        <td className="label-cell" style={{ width: '15%' }}><strong>Workers</strong></td>
                                        <td className="input-cell" style={{ width: '20%' }}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Start Up Production</td>
                                        <td className="input-cell" colSpan={2}></td>
                                        <td className="input-cell" colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Shut Down Production</td>
                                        <td className="input-cell" colSpan={2}></td>
                                        <td className="input-cell" colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Production Hrs</td>
                                        <td className="input-cell" colSpan={2}></td>
                                        <td className="input-cell" colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Cumulative Stoppage Time/min</td>
                                        <td className="input-cell" colSpan={2}>{fmt((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0))}</td>
                                        <td className="input-cell" colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Working Labours On Line</td>
                                        <td className="input-cell" colSpan={4}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Name Of Absent Labours</td>
                                        <td className="input-cell" colSpan={4}></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 36-41: Materials Consumption */}
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
                                    {[
                                        { type: 'PREFORMS', label: 'Preforms Consumption', defaultUnit: 'Pcs' },
                                        { type: 'CLOSURES', label: 'Closure Consumption', defaultUnit: 'Pcs' },
                                        { type: 'LABELS', label: 'Label Consumption', defaultUnit: 'Kg' },
                                        { type: 'SHRINK', label: 'Shrink PRINTED', defaultUnit: 'Pcs' },
                                        { type: 'STRETCH_FILM', label: 'Shrink Plain', defaultUnit: 'Kg' },
                                    ].map(({ type, label, defaultUnit }) => {
                                        const mat = getMaterial(type);
                                        const lossPercent = mat.total_used
                                            ? ((mat.total_losses / mat.total_used) * 100).toFixed(1)
                                            : '';
                                        return (
                                            <tr key={type}>
                                                <td className="label-cell">{label}</td>
                                                <td className="unit-cell">{mat.unit || defaultUnit}</td>
                                                <td className="input-cell"></td>
                                                <td className="input-cell"></td>
                                                <td className="input-cell">{fmt(mat.total_used)}</td>
                                                <td className="input-cell"></td>
                                                <td className="input-cell">{fmt(mat.total_losses)}</td>
                                                <td className="input-cell">{lossPercent ? `${lossPercent}%` : ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Row 43-49: Meters Reading */}
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
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Combi Reading:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading (Kg):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Difference in Balance:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (Kg):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/l:</span>
                                                <span className="meter-value">{summary.avg_co2_yield ? `${summary.avg_co2_yield}%` : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/Btl:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td></td>
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

export default ProductionRunByPet;
