import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';
import '../sign-off-forms/css/Sign-Off-Styles.css';

const STORAGE_KEY = 'batchReportV2_filters';

const getStoredFilters = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch { return null; }
};

const BatchReportV2 = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const storedFilters = getStoredFilters();
    const [selectedProduct, setSelectedProduct] = useState(storedFilters?.selectedProduct || '');
    const [selectedPets, setSelectedPets] = useState(storedFilters?.selectedPets || []);
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState(storedFilters?.selectedShift || '');
    const [startDate, setStartDate] = useState(() => {
        if (storedFilters?.startDate) return storedFilters.startDate;
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        if (storedFilters?.endDate) return storedFilters.endDate;
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [reportData, setReportData] = useState({});

    // Persist filters to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            selectedProduct,
            selectedPets,
            selectedShift,
            startDate,
            endDate,
        }));
    }, [selectedProduct, selectedPets, selectedShift, startDate, endDate]);

    // Fetch pets and shifts for dropdowns
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

    // Fetch batch report from the dedicated sign-off endpoint
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = { start_date: startDate, end_date: endDate };
                if (selectedPets.length > 0) params.pet = parseInt(selectedPets[0], 10);
                if (selectedShift) params.shift = parseInt(selectedShift, 10);
                if (selectedProduct) params.product = selectedProduct;
                const res = await productionApi.getSignOffBatchReport(params);
                // Unwrap the envelope defensively — the endpoint may double-wrap
                // as { status_code, message, data: { status_code, message, data: {...} } }.
                let data = res?.data ?? {};
                while (data && typeof data === 'object' && 'data' in data
                    && (('status_code' in data) || ('message' in data))) {
                    data = data.data;
                }
                setReportData(data || {});
            } catch (err) {
                console.error('Failed to fetch batch report:', err);
                setError(err?.message || 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [startDate, endDate, selectedShift, selectedProduct, selectedPets]);

    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = `Batch Report - ${selectedProduct || 'All Products'} - ${startDate} to ${endDate}`;
        window.print();
        document.title = prevTitle;
    };

    const togglePet = (petId) => {
        setSelectedPets(prev =>
            prev.includes(petId)
                ? prev.filter(id => id !== petId)
                : [...prev, petId]
        );
    };

    // Format number
    const fmt = (val, decimals = 0) => {
        if (val === null || val === undefined || val === '') return '';
        return Number(val).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Bind directly to the response structure
    const summaryRows = Array.isArray(reportData?.summary_by_product) ? reportData.summary_by_product : [];
    const batches = Array.isArray(reportData?.batches) ? reportData.batches : [];
    const totals = reportData?.totals || {};

    // Product list for the filter dropdown, derived from the returned summary
    const reportProducts = [...new Set(summaryRows.map(r => r.product_name).filter(Boolean))].sort();

    return (
        <div className="page-wrapper">
            <div className="content">
                {/* Header with Controls */}
                <div className="d-flex justify-content-between align-items-center mb-3 no-print">
                    <div>
                        <h4 className="fw-bold mb-1">Batch Report</h4>
                        <p className="text-muted mb-0">Production batch report by product and line</p>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <select
                            className="form-select form-select-sm"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            style={{ width: '180px' }}
                        >
                            <option value="">All Products</option>
                            {reportProducts.map((prod) => (
                                <option key={prod} value={prod}>{prod}</option>
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
                        <div className="d-flex align-items-center gap-2">
                            <Calendar size={18} className="text-muted" />
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: '140px' }}
                            />
                            <span className="text-muted">to</span>
                            <input
                                type="date"
                                className="form-control form-control-sm"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: '140px' }}
                            />
                        </div>
                        <div className="dropdown" style={{ position: 'relative' }}>
                            <button
                                className="btn btn-outline-secondary btn-sm dropdown-toggle"
                                type="button"
                                onClick={(e) => {
                                    const menu = e.currentTarget.nextElementSibling;
                                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                                }}
                            >
                                {selectedPets.length > 0 ? `${selectedPets.length} Lines` : 'All Lines'}
                            </button>
                            <ul className="dropdown-menu p-2" style={{ minWidth: '160px', display: 'none', position: 'absolute', right: 0, zIndex: 1000, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <li className="form-check px-2 mb-1 pb-1" style={{ borderBottom: '1px solid #eee' }}>
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="pet-select-all"
                                        checked={selectedPets.length === pets.length && pets.length > 0}
                                        onChange={() => {
                                            if (selectedPets.length === pets.length) {
                                                setSelectedPets([]);
                                            } else {
                                                setSelectedPets(pets.map(p => String(p.id)));
                                            }
                                        }}
                                    />
                                    <label className="form-check-label fw-bold" htmlFor="pet-select-all">
                                        Select All
                                    </label>
                                </li>
                                {pets.map((pet) => (
                                    <li key={pet.id} className="form-check px-2">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={`pet-${pet.id}`}
                                            checked={selectedPets.includes(String(pet.id))}
                                            onChange={() => togglePet(String(pet.id))}
                                        />
                                        <label className="form-check-label" htmlFor={`pet-${pet.id}`}>
                                            {pet.pet_name}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button
                            className="btn btn-primary d-flex align-items-center gap-2"
                            onClick={handlePrint}
                            disabled={loading}
                        >
                            <Printer size={18} />
                            Print
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="d-flex justify-content-center align-items-center py-5">
                        <Loader2 size={32} className="text-primary spinning" />
                        <span className="ms-2 text-muted">Loading batch data...</span>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="alert alert-danger">{error}</div>
                )}

                {/* Printable Form */}
                {!loading && (
                    <div className="print-form-container" ref={printRef}>
                        <div className="production-report-form">
                            {/* Header */}
                            <div className="form-header">
                                <div className="header-left">
                                    <img src="/logo.jpeg" alt="Twellium" className="print-logo" />
                                    <h5 className="company-name">TWELLIUM INDUSTRIAL COMPANY LTD.</h5>
                                </div>
                                <div className="header-center">
                                    <h4 className="report-title">BATCH REPORT</h4>
                                    <span style={{ fontSize: '11px' }}>{startDate} to {endDate}</span>
                                </div>
                                <div className="header-right">
                                    <div className="header-info">
                                        <span>{selectedProduct || 'All Products'}</span>
                                        <span>{selectedPets.length > 0 ? pets.filter(p => selectedPets.includes(String(p.id))).map(p => p.pet_name).join(', ') : 'All Lines'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Active Filters Display */}
                            <div className="active-filters-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '6px 10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '11px' }}>
                                <span><strong>Date:</strong> {startDate} to {endDate}</span>
                                <span><strong>Line(s):</strong> {selectedPets.length > 0 ? pets.filter(p => selectedPets.includes(String(p.id))).map(p => p.pet_name).join(', ') : 'All Lines'}</span>
                                <span><strong>Shift:</strong> {selectedShift ? (shifts.find(s => String(s.id) === String(selectedShift))?.name || shifts.find(s => String(s.id) === String(selectedShift))?.shift_name || 'All Shifts') : 'All Shifts'}</span>
                                <span><strong>Product:</strong> {selectedProduct || 'All Products'}</span>
                            </div>

                            {/* Summary Section */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={4}>Summary</th>
                                    </tr>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '25%' }}>Product</th>
                                        <th style={{ width: '30%' }}>Batch ID</th>
                                        <th style={{ width: '20%' }}>Liters</th>
                                        <th style={{ width: '25%' }}>Pet</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryRows.length > 0 ? summaryRows.map((row, idx) => {
                                        const batchNums = Array.isArray(row.batch_numbers) ? row.batch_numbers : [];
                                        const petNames = Array.isArray(row.pet_names) ? row.pet_names : [];
                                        return (
                                            <tr key={idx}>
                                                <td className="input-cell">{row.product_name}</td>
                                                <td className="input-cell" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{batchNums.join(', ')} <span style={{ fontSize: '9px', color: '#666' }}>({batchNums.length})</span></td>
                                                <td className="input-cell numeric">{fmt(row.total_liters)} liters</td>
                                                <td className="input-cell">{petNames.join(', ')}</td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={4} className="input-cell text-center">No batch data available</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Details Section */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={6}>Details</th>
                                    </tr>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '12%' }}>Time</th>
                                        <th style={{ width: '15%' }}>Date</th>
                                        <th style={{ width: '18%' }}>Batch</th>
                                        <th style={{ width: '15%' }}>Liters</th>
                                        <th style={{ width: '15%' }}>Tank</th>
                                        <th style={{ width: '25%' }}>Pet</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.length > 0 ? batches.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="input-cell numeric">{row.start_time || ''}</td>
                                            <td className="input-cell numeric">{row.date || ''}</td>
                                            <td className="input-cell numeric">{row.batch_number || ''}</td>
                                            <td className="input-cell numeric">{fmt(row.syrup_liters)}</td>
                                            <td className="input-cell numeric">{row.tank_number || ''}</td>
                                            <td className="input-cell">{row.pet_name || ''}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="input-cell text-center">No batch details available</td>
                                        </tr>
                                    )}
                                    {batches.length > 0 && (
                                        <tr className="fw-bold">
                                            <td className="label-cell" colSpan={3}>TOTAL</td>
                                            <td className="input-cell numeric">{fmt(totals.total_liters)} liters</td>
                                            <td className="input-cell numeric" colSpan={2}>{fmt(totals.total_batches ?? batches.length)} batches</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Report Info */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Workers</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}>{fmt(totals.worker_count)}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Reports</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}>{fmt(totals.total_reports)}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Batches</td>
                                        <td className="input-cell numeric" style={{ width: '25%' }}>{fmt(totals.total_batches)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Sign Off */}
                            <div className="sign-off-section">
                                <div className="sign-off-row">
                                    <div className="sign-off-field">
                                        <label>Prepared by:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                    <div className="sign-off-field">
                                        <label>Approved by:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                </div>
                                <div className="sign-off-row">
                                    <div className="sign-off-field">
                                        <label>Signature:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                    <div className="sign-off-field">
                                        <label>Date:</label>
                                        <div className="sign-line"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BatchReportV2;
