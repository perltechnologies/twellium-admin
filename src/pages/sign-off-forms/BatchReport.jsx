import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';

const BatchReport = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [selectedPets, setSelectedPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [selectedShift, setSelectedShift] = useState('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    });
    const [reports, setReports] = useState([]);
    const [summaryData, setSummaryData] = useState(null);

    // Fetch pets and products
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
            const params = { page_size: 100 };
            if (startDate === endDate) {
                params.production_date = startDate;
            } else {
                params.datetime_start_time = `${startDate}T00:00:00Z`;
                params.datetime_end_time = `${endDate}T23:59:59Z`;
            }
            if (selectedShift) params.shift = selectedShift;
            const res = await productionApi.getReports(params);
            const responseData = res?.data?.data ?? res?.data ?? {};
            let reportList = [];
            if (Array.isArray(responseData)) {
                reportList = responseData;
            } else if (responseData.results && Array.isArray(responseData.results)) {
                reportList = responseData.results;
            } else if (responseData.data && Array.isArray(responseData.data)) {
                reportList = responseData.data;
            }
            console.log('Batch Reports Response:', reportList);
            setReports(reportList);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
            setError(err?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const fetchSummary = async () => {
            try {
                const params = { start_date: startDate, end_date: endDate };
                if (selectedShift) params.shift = selectedShift;
                const res = await productionApi.getProductionSummary(params);
                const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
                setSummaryData(envelope?.summary || {});
            } catch (err) {
                console.error('Failed to fetch production summary:', err);
            }
        };
        fetchSummary();
    }, [startDate, endDate, selectedShift]);

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

    // Filter reports based on selections
    const filteredReports = reports.filter(r => {
        if (selectedProduct && r.product_name?.toLowerCase() !== selectedProduct.toLowerCase()) return false;
        if (selectedShift && String(r.shift) !== String(selectedShift) && String(r.shift_id) !== String(selectedShift)) return false;
        if (selectedPets.length > 0) {
            const petNames = pets.filter(p => selectedPets.includes(String(p.id))).map(p => p.pet_name?.toLowerCase());
            if (!petNames.includes(r.pet_name?.toLowerCase())) return false;
        }
        if (r.pet_name?.toLowerCase().includes('can')) return false;
        return true;
    });

    // Extract all batch entries with their report context
    const batchDetails = filteredReports.flatMap(report => {
        const batches = report.batches || [];
        return batches.map(batch => ({
            time: batch.start_time || '',
            date: report.production_date || '',
            batch_number: batch.batch_number || '',
            syrup_liters: batch.syrup_liters || 0,
            start_time: batch.start_time || '',
            pet_name: report.pet_name || '',
            product_name: report.product_name || '',
        }));
    }).sort((a, b) => {
        // Sort by date then time
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
    });

    // Summary: group by product
    const summaryByProduct = {};
    batchDetails.forEach(b => {
        const key = b.product_name || 'Unknown';
        if (!summaryByProduct[key]) {
            summaryByProduct[key] = {
                product: key,
                batch_numbers: [],
                total_liters: 0,
                pets: new Set(),
            };
        }
        if (b.batch_number && !summaryByProduct[key].batch_numbers.includes(b.batch_number)) {
            summaryByProduct[key].batch_numbers.push(b.batch_number);
        }
        summaryByProduct[key].total_liters += parseFloat(b.syrup_liters) || 0;
        if (b.pet_name) summaryByProduct[key].pets.add(b.pet_name);
    });
    const summaryRows = Object.values(summaryByProduct);

    // Format number
    const fmt = (val, decimals = 0) => {
        if (val === null || val === undefined) return '';
        return Number(val).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Get unique product names from reports for filter
    const reportProducts = [...new Set(reports.map(r => r.product_name).filter(Boolean))].sort();

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
                                        const batchNums = row.batch_numbers;
                                        return (
                                            <tr key={idx}>
                                                <td className="input-cell">{row.product}</td>
                                                <td className="input-cell" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{batchNums.join(', ')} <span style={{ fontSize: '9px', color: '#666' }}>({batchNums.length})</span></td>
                                                <td className="input-cell numeric">{fmt(row.total_liters)} liters</td>
                                                <td className="input-cell">{[...row.pets].join(', ')}</td>
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
                                        <th style={{ width: '15%' }}>Start Time</th>
                                        <th style={{ width: '25%' }}>Pet</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batchDetails.length > 0 ? batchDetails.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="input-cell numeric">{row.time}</td>
                                            <td className="input-cell numeric">{row.date}</td>
                                            <td className="input-cell numeric">{row.batch_number}</td>
                                            <td className="input-cell numeric">{fmt(parseFloat(row.syrup_liters))}</td>
                                            <td className="input-cell numeric">{row.start_time}</td>
                                            <td className="input-cell">{row.pet_name}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="input-cell text-center">No batch details available</td>
                                        </tr>
                                    )}
                                    {batchDetails.length > 0 && (
                                        <tr className="fw-bold">
                                            <td className="label-cell" colSpan={3}>TOTAL</td>
                                            <td className="input-cell numeric">{fmt(batchDetails.reduce((sum, b) => sum + (parseFloat(b.syrup_liters) || 0), 0))} liters</td>
                                            <td className="input-cell numeric" colSpan={2}>{batchDetails.length} batches</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Report Info */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Workers</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}>{summaryData?.worker_count || ''}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Reports</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}>{filteredReports.length || ''}</td>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Batches</td>
                                        <td className="input-cell numeric" style={{ width: '25%' }}>{batchDetails.length || ''}</td>
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

export default BatchReport;
