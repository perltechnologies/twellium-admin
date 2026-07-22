import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';

const ProductionReportForm = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    });

    const fetchData = async (date) => {
        setLoading(true);
        setError(null);
        try {
            const res = await productionApi.getProductionSummary({
                start_date: date,
                end_date: date,
            });
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
        fetchData(selectedDate);
    }, [selectedDate]);

    const handlePrint = () => {
        window.print();
    };

    // Full day combined data from summary
    const summary = data?.summary || {};
    const dailyBreakdown = data?.daily_breakdown || [];
    const dayData = dailyBreakdown.find(d => d.date === selectedDate) || dailyBreakdown[0] || {};
    const allPets = dayData?.pets || [];
    const materials = data?.material_consumptions?.materials || [];

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
                shifts: [],
            };
        }
        petsByLine[key].total_bottles += (pet.total_bottles || 0);
        petsByLine[key].total_packs += (pet.total_packs || 0);
        petsByLine[key].total_downtime_mins += (pet.total_downtime_mins || 0);
        if (pet.shift && !petsByLine[key].shifts.includes(pet.shift)) {
            petsByLine[key].shifts.push(pet.shift);
        }
        if (pet.product_name && !petsByLine[key].product_names.includes(pet.product_name)) {
            petsByLine[key].product_names.push(pet.product_name);
        }
    });
    const lineRows = Object.values(petsByLine);

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
                                        <td className="input-cell" style={{ width: '20%' }}>{dayData.date || selectedDate}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Units (Bottles)</td>
                                        <td className="input-cell" style={{ width: '15%' }}>{fmt(summary.total_bottles)}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Reports</td>
                                        <td className="input-cell" style={{ width: '20%' }}>{summary.total_reports || dayData.report_count || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Packs</td>
                                        <td className="input-cell">{fmt(summary.total_packs)}</td>
                                        <td className="label-cell">Efficiency</td>
                                        <td className="input-cell">{summary.avg_efficiency ? `${summary.avg_efficiency}%` : ''}</td>
                                        <td className="label-cell">Bottles Produced</td>
                                        <td className="input-cell">{fmt(summary.total_bottles_produced)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Downtime (min)</td>
                                        <td className="input-cell">{fmt((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0))}</td>
                                        <td className="label-cell">Planned Downtime (min)</td>
                                        <td className="input-cell">{fmt(summary.planned_downtime_mins)}</td>
                                        <td className="label-cell">Mechanical Downtime (min)</td>
                                        <td className="input-cell">{fmt(summary.mechanical_downtime_mins)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Performance Summary */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={8}>Performance Summary</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="label-cell">OEE</td>
                                        <td className="input-cell">{summary.oee ? `${summary.oee}%` : ''}</td>
                                        <td className="label-cell">Availability</td>
                                        <td className="input-cell">{summary.avg_availability ? `${summary.avg_availability}%` : ''}</td>
                                        <td className="label-cell">Performance</td>
                                        <td className="input-cell">{summary.avg_performance ? `${summary.avg_performance}%` : ''}</td>
                                        <td className="label-cell">Quality</td>
                                        <td className="input-cell">{summary.avg_quality ? `${summary.avg_quality}%` : ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Syrup Yield</td>
                                        <td className="input-cell">{summary.avg_syrup_yield ? `${summary.avg_syrup_yield}%` : ''}</td>
                                        <td className="label-cell">CO2 Yield</td>
                                        <td className="input-cell">{summary.avg_co2_yield ? `${summary.avg_co2_yield}%` : ''}</td>
                                        <td className="label-cell">Bottles Produced</td>
                                        <td className="input-cell">{fmt(summary.total_bottles_produced)}</td>
                                        <td className="label-cell">Target Met</td>
                                        <td className="input-cell">{summary.target_met_count || ''}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Production by Line */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th className="section-label">Line</th>
                                        <th>Product</th>
                                        <th>Total Bottles</th>
                                        <th>Total Packs</th>
                                        <th>Downtime (min)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineRows.length > 0 ? lineRows.map((line, idx) => (
                                        <tr key={idx}>
                                            <td className="label-cell">{line.pet_name}</td>
                                            <td className="input-cell">{line.product_names.join(', ')}</td>
                                            <td className="input-cell">{fmt(line.total_bottles)}</td>
                                            <td className="input-cell">{fmt(line.total_packs)}</td>
                                            <td className="input-cell">{fmt(line.total_downtime_mins)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="input-cell text-center">No line data available</td>
                                        </tr>
                                    )}
                                    {/* Totals row */}
                                    {lineRows.length > 0 && (
                                        <tr className="fw-bold">
                                            <td className="label-cell">TOTAL</td>
                                            <td className="input-cell"></td>
                                            <td className="input-cell">{fmt(summary.total_bottles)}</td>
                                            <td className="input-cell">{fmt(summary.total_packs)}</td>
                                            <td className="input-cell">{fmt(summary.total_downtime_mins)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

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
                                                <td className="input-cell">{fmt(mat.total_used)}</td>
                                                <td className="input-cell">{fmt(mat.total_losses)}</td>
                                                <td className="input-cell">{lossPercent ? `${lossPercent}%` : ''}</td>
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
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Start up Reading:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Reading:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
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
                                                <span className="meter-label">End up Reading:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (kg):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Difference (End - Start):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Rejects (M/C):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Std. CO2 Consumption (kg):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Unit (L, m3, kg):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Blower Rejects (Manual Count):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 Yield (%):</span>
                                                <span className="meter-value">{summary.avg_co2_yield ? `${summary.avg_co2_yield}%` : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Density (kg/L):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading / T. Packs (%):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total Syrup Used (L):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Dilution Ratio:</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Std. Syrup Consumption (L):</span>
                                                <span className="meter-value"></span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Yield (%):</span>
                                                <span className="meter-value">{summary.avg_syrup_yield ? `${summary.avg_syrup_yield}%` : ''}</span>
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
                                                <td className="input-cell">{fmt(cat.total_duration_mins)}</td>
                                                <td className="input-cell">{cat.percentage_of_total ? `${cat.percentage_of_total}%` : ''}</td>
                                                <td className="input-cell">{cat.incident_count || ''}</td>
                                            </tr>
                                        ))}
                                        <tr className="fw-bold">
                                            <td className="label-cell">TOTAL</td>
                                            <td className="input-cell">{fmt(data.downtime_breakdown.total_downtime_mins)}</td>
                                            <td className="input-cell">100%</td>
                                            <td className="input-cell">{data.downtime_breakdown.total_incidents || ''}</td>
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
