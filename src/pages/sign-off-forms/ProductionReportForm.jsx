import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';
import { inventoryApi } from '../../api/inventory';

const STORAGE_KEY = 'productionReportForm_filters';

// Generic editable input that preserves its own state while syncing with initial value changes
const EditableField = ({ value, type = 'text', className = '', onChange, step, min, max, readOnly }) => {
    const [val, setVal] = useState(() =>
        value === null || value === undefined || value === '' ? '' : String(value)
    );
    useEffect(() => {
        setVal(value === null || value === undefined || value === '' ? '' : String(value));
    }, [value]);
    return (
        <input
            type={type}
            step={step}
            min={min}
            max={max}
            readOnly={readOnly}
            className={`form-control form-control-sm ${className}`}
            style={{ minWidth: '60px', textAlign: 'right' }}
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

const ProductionReportForm = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [products, setProducts] = useState([]);
    const [reportsList, setReportsList] = useState([]);
    const [productionStartTime, setProductionStartTime] = useState('');
    const [productionEndTime, setProductionEndTime] = useState('');
    const [totalProductionTimeHrs, setTotalProductionTimeHrs] = useState('');
    const storedFilters = getStoredFilters();
    const [selectedPet, setSelectedPet] = useState(storedFilters?.selectedPet || '');
    const [selectedShift, setSelectedShift] = useState(storedFilters?.selectedShift || '');
    const [selectedProduct, setSelectedProduct] = useState(storedFilters?.selectedProduct || '');
    const [selectedDate, setSelectedDate] = useState(() => {
        if (storedFilters?.selectedDate) return storedFilters.selectedDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    });

    // Persist filters to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            selectedPet,
            selectedShift,
            selectedProduct,
            selectedDate,
        }));
    }, [selectedPet, selectedShift, selectedProduct, selectedDate]);

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
        const fetchProducts = async () => {
            try {
                const res = await inventoryApi.getProducts({ page_size: 100 });
                const productList = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? [];
                const allProducts = Array.isArray(productList) ? productList : productList.results || [];
                setProducts(allProducts);
            } catch (err) {
                console.error('Failed to fetch products:', err);
            }
        };
        fetchPets();
        fetchShifts();
        fetchProducts();
    }, []);

    const fetchData = async (date, petId, shiftId, product) => {
        setLoading(true);
        setError(null);
        try {
            const params = { start_date: date, end_date: date };
            if (petId) params.pet = petId;
            if (shiftId) params.shift = shiftId;
            if (product) params.product = product;
            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            console.log('Production Summary Response:', envelope);
            setData(envelope);

            // Also fetch individual reports for production times
            const reportParams = { page_size: 100, production_date: date };
            if (petId) reportParams.pet = petId;
            if (shiftId) reportParams.shift = shiftId;
            const reportRes = await productionApi.getReports(reportParams);
            const reportData = reportRes?.data?.data ?? reportRes?.data ?? {};
            let reportList = [];
            if (Array.isArray(reportData)) {
                reportList = reportData;
            } else if (reportData.results && Array.isArray(reportData.results)) {
                reportList = reportData.results;
            } else if (reportData.data && Array.isArray(reportData.data)) {
                reportList = reportData.data;
            }
            // Filter by product if selected
            if (product) {
                reportList = reportList.filter(r => r.product_name === product);
            }
            reportList = reportList.filter(r => !r.pet_name?.toLowerCase().includes('can'));
            setReportsList(reportList);
        } catch (err) {
            console.error('Failed to fetch production summary:', err);
            setError(err?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedDate, selectedPet, selectedShift, selectedProduct);
    }, [selectedDate, selectedPet, selectedShift, selectedProduct]);

    // Auto-fill production times based on fetched data + shift master
    useEffect(() => {
        if (!data) return;

        const summary = data?.summary || {};
        const dailyBreakdown = data?.daily_breakdown || [];
        const dayData = dailyBreakdown.find(d => d.date === selectedDate) || dailyBreakdown[0] || {};
        const allPetsUnfiltered = (dayData?.pets || []).filter(p => !p.pet_name?.toLowerCase().includes('can'));
        const allPets = selectedProduct
            ? allPetsUnfiltered.filter(p => p.product_name === selectedProduct)
            : allPetsUnfiltered;

        const startTimes = [
            ...allPets.map(p => p.production_start_time || p.start_time),
            ...allPetsUnfiltered.map(p => p.production_start_time || p.start_time),
            ...reportsList.map(r => r.start_time || r.production_start_time || r.user_defined_shift_start_time),
            dayData.production_start_time,
            summary.production_start_time,
        ].filter(Boolean).sort();
        const endTimes = [
            ...allPets.map(p => p.production_end_time || p.end_time),
            ...allPetsUnfiltered.map(p => p.production_end_time || p.end_time),
            ...reportsList.map(r => r.end_time || r.production_end_time || r.user_defined_shift_end_time),
            dayData.production_end_time,
            summary.production_end_time,
        ].filter(Boolean).sort();

        let start = startTimes[0] || summary.production_start_time || '';
        let end = endTimes[endTimes.length - 1] || summary.production_end_time || '';

        // Fallback to selected shift master times
        if (!start || !end) {
            const shift = shifts.find(s => String(s.id) === String(selectedShift));
            if (shift) {
                if (!start) start = shift.start_time?.slice(0, 5) || '';
                if (!end) end = shift.end_time?.slice(0, 5) || '';
            }
        }

        setProductionStartTime(start || '');
        setProductionEndTime(end || '');

        const hrs = allPets.reduce((sum, p) => sum + (parseFloat(p.total_production_time_hrs) || parseFloat(p.total_production_time_hours) || 0), 0)
            || allPetsUnfiltered.reduce((sum, p) => sum + (parseFloat(p.total_production_time_hrs) || parseFloat(p.total_production_time_hours) || 0), 0)
            || reportsList.reduce((sum, r) => sum + (parseFloat(r.total_production_time_hours) || parseFloat(r.total_production_time_hrs) || parseFloat(r.production_hours) || 0), 0)
            || parseFloat(dayData.total_production_time_hrs) || parseFloat(summary.total_production_time_hrs) || parseFloat(summary.total_production_time_hours) || 0;
        if (hrs) {
            setTotalProductionTimeHrs(hrs.toFixed(1));
        } else if (start && end) {
            const startDate = new Date(`${selectedDate}T${start}`);
            let endDate = new Date(`${selectedDate}T${end}`);
            if (endDate <= startDate) {
                endDate.setDate(endDate.getDate() + 1); // night shift crosses midnight
            }
            const diff = (endDate - startDate) / (1000 * 60 * 60);
            setTotalProductionTimeHrs(diff > 0 ? diff.toFixed(1) : '');
        } else {
            setTotalProductionTimeHrs(summary.total_production_time_hrs || summary.total_production_time_hours || '');
        }
    }, [data, reportsList, selectedShift, shifts, selectedDate, selectedProduct]);

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
    const productNames = products.length > 0
        ? products.map(p => p.name).filter(Boolean).sort()
        : [...new Set(allPetsUnfiltered.map(p => p.product_name).filter(Boolean))].sort();
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

    // Group pets by line AND product (each pet+product combination gets its own row)
    const petsByLineProduct = {};
    allPets.forEach(pet => {
        const petKey = pet.pet_id || pet.pet_name;
        const productKey = pet.product_name || 'Unknown';
        const key = `${petKey}__${productKey}`;
        if (!petsByLineProduct[key]) {
            petsByLineProduct[key] = {
                pet_name: pet.pet_name,
                product_name: productKey,
                total_bottles: 0,
                total_packs: 0,
                total_downtime_mins: 0,
                planned_downtime_mins: 0,
                mechanical_downtime_mins: 0,
                shifts: [],
            };
        }
        petsByLineProduct[key].total_bottles += (pet.total_bottles || 0);
        petsByLineProduct[key].total_packs += (pet.total_packs || 0);
        petsByLineProduct[key].planned_downtime_mins += (pet.planned_downtime_mins || 0);
        petsByLineProduct[key].mechanical_downtime_mins += (pet.mechanical_downtime_mins || 0);
        petsByLineProduct[key].total_downtime_mins = petsByLineProduct[key].planned_downtime_mins + petsByLineProduct[key].mechanical_downtime_mins;
        if (pet.shift && !petsByLineProduct[key].shifts.includes(pet.shift)) {
            petsByLineProduct[key].shifts.push(pet.shift);
        }
    });
    const lineRows = Object.values(petsByLineProduct).sort((a, b) => {
        const numA = parseInt(a.pet_name?.match(/\d+/)?.[0]) || 0;
        const numB = parseInt(b.pet_name?.match(/\d+/)?.[0]) || 0;
        if (numA !== numB) return numA - numB;
        return (a.product_name || '').localeCompare(b.product_name || '');
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

    // Calculate hours between two HH:MM times (handles night shifts crossing midnight)
    const calculateHours = (start, end) => {
        if (!start || !end || !selectedDate) return '';
        const startDate = new Date(`${selectedDate}T${start}`);
        let endDate = new Date(`${selectedDate}T${end}`);
        if (endDate <= startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }
        const diff = (endDate - startDate) / (1000 * 60 * 60);
        return diff > 0 ? diff.toFixed(1) : '';
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
                            style={{ width: '200px' }}
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

                            {/* Active Filters Display */}
                            <div className="active-filters-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '6px 10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '11px' }}>
                                <span><strong>Date:</strong> {selectedDate}</span>
                                <span><strong>Line:</strong> {selectedPet ? (pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '') : 'All Lines'}</span>
                                <span><strong>Shift:</strong> {selectedShift ? (shifts.find(s => String(s.id) === String(selectedShift))?.name || 'All Shifts') : 'All Shifts'}</span>
                                <span><strong>Product:</strong> {selectedProduct || 'All Products'}</span>
                            </div>

                            {/* Product Details - shown when a product or specific PET is selected */}
                            {(selectedProduct || selectedPet) && (
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
                                    {(() => {
                                        // Group unique products from pet entries
                                        const uniqueProducts = [];
                                        const seen = new Set();
                                        allPets.forEach(pet => {
                                            const name = pet.product_name;
                                            if (name && !seen.has(name)) {
                                                seen.add(name);
                                                uniqueProducts.push(pet);
                                            }
                                        });
                                        // If no pet entries but selectedProduct, use product catalog
                                        if (uniqueProducts.length === 0 && selectedProduct) {
                                            const p = products.find(pr => pr.name === selectedProduct);
                                            const fallback = allPetsUnfiltered.find(pe => pe.product_name === selectedProduct && pe.bottle_size) || {};
                                            return (
                                                <tr>
                                                    <td className="label-cell">{selectedProduct}</td>
                                                    <td className="input-cell numeric"><EditableField value={fallback.bottle_size || p?.bottle_size || (p?.size ? `${p.size}ml` : '') || summary.bottle_size || ''} /></td>
                                                    <td className="input-cell numeric"><EditableField value={fallback.line_speed || p?.target_speed_bph || p?.line_speed || summary.line_speed || ''} /></td>
                                                    <td className="input-cell numeric"><EditableField value={fallback.bottles_per_pack || p?.bottles_per_pack || summary.bottles_per_pack || ''} /></td>
                                                    <td className="input-cell numeric"><EditableField value={fallback.packs_per_pallet || p?.packs_per_pallet || summary.packs_per_pallet || ''} /></td>
                                                </tr>
                                            );
                                        }
                                        return uniqueProducts.map((petEntry, idx) => {
                                            const p = products.find(pr => pr.name === petEntry.product_name);
                                            // Fallback: find same product from unfiltered entries that has values filled
                                            const fallback = allPetsUnfiltered.find(pe => pe.product_name === petEntry.product_name && pe.bottle_size) || {};
                                            const bottleSize = petEntry.bottle_size || fallback.bottle_size || p?.size || p?.bottle_size || summary.bottle_size || '';
                                            const lineSpeed = petEntry.line_speed || fallback.line_speed || p?.target_speed_bph || p?.line_speed || summary.line_speed || '';
                                            const bottlesPerPack = petEntry.bottles_per_pack || fallback.bottles_per_pack || p?.bottles_per_pack || summary.bottles_per_pack || '';
                                            const packsPerPallet = petEntry.packs_per_pallet || fallback.packs_per_pallet || p?.packs_per_pallet || summary.packs_per_pallet || '';
                                            return (
                                                <tr key={idx}>
                                                    <td className="label-cell">{petEntry.product_name}</td>
                                                    <td className="input-cell numeric"><EditableField value={bottleSize} /></td>
                                                    <td className="input-cell numeric"><EditableField value={lineSpeed} /></td>
                                                    <td className="input-cell numeric"><EditableField value={bottlesPerPack} /></td>
                                                    <td className="input-cell numeric"><EditableField value={packsPerPallet} /></td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                            )}

                            {/* Production Info Table */}
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={6}>Production Information</th>
                                    </tr>
                                </thead>
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
                                        <td className="input-cell">
                                            <input
                                                type="time"
                                                className="form-control form-control-sm"
                                                value={productionStartTime}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProductionStartTime(val);
                                                    setTotalProductionTimeHrs(calculateHours(val, productionEndTime));
                                                }}
                                            />
                                        </td>
                                        <td className="label-cell">Production End Time</td>
                                        <td className="input-cell">
                                            <input
                                                type="time"
                                                className="form-control form-control-sm"
                                                value={productionEndTime}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setProductionEndTime(val);
                                                    setTotalProductionTimeHrs(calculateHours(productionStartTime, val));
                                                }}
                                            />
                                        </td>
                                        <td className="label-cell">Total Production Time (Hrs)</td>
                                        <td className="input-cell">
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="form-control form-control-sm"
                                                value={totalProductionTimeHrs}
                                                onChange={(e) => setTotalProductionTimeHrs(e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Bottles</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.total_bottles || allPets.reduce((sum, p) => sum + (p.total_bottles || 0), 0)} /></td>
                                        <td className="label-cell">Total Packs</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.total_packs || allPets.reduce((sum, p) => sum + (p.total_packs || 0), 0)} /></td>
                                        <td className="label-cell">Packs/Pallet</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.packs_per_pallet || allPets.find(p => p.packs_per_pallet)?.packs_per_pallet || reportsList.find(r => r.packs_per_pallet)?.packs_per_pallet || (selectedProduct && products.find(pr => pr.name === selectedProduct)?.packs_per_pallet) || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Workers Count</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={(() => { const count = allPets.reduce((sum, p) => sum + (p.workers?.worker_count || 0), 0); return count || summary.workers_count || summary.worker_count || ''; })()} /></td>
                                        <td className="label-cell">Bottles/Pack</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.bottles_per_pack || allPets.find(p => p.bottles_per_pack)?.bottles_per_pack || reportsList.find(r => r.bottles_per_pack)?.bottles_per_pack || (selectedProduct && products.find(pr => pr.name === selectedProduct)?.bottles_per_pack) || ''} /></td>
                                        <td className="label-cell">Total Bottles (R.W)</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.total_bottles_produced || allPets.reduce((sum, p) => sum + (p.total_bottles_produced || p.total_bottles || 0), 0)} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Downtime (min)</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.total_downtime_mins || ((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0))} /></td>
                                        <td className="label-cell">Planned Downtime (min)</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.planned_downtime_mins} /></td>
                                        <td className="label-cell">Mechanical Downtime (min)</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.mechanical_downtime_mins} /></td>
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
                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={summary.oee || ''} /></td>
                                        <td className="label-cell">Availability</td>
                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={summary.avg_availability || ''} /></td>
                                        <td className="label-cell">Performance (Efficiency)</td>
                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={summary.avg_performance || ''} /></td>
                                        <td className="label-cell">Quality</td>
                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={summary.avg_quality || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Syrup Yield</td>
                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={syrupMeters.syrup_yield_percent != null ? syrupMeters.syrup_yield_percent : (summary.avg_syrup_yield || '')} /></td>
                                        <td className="label-cell">CO2 Yield</td>
                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={summary.avg_co2_yield || ''} /></td>
                                        <td className="label-cell">Target Met</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={summary.target_met_count || ''} /></td>
                                        <td className="label-cell"></td>
                                        <td className="input-cell numeric"></td>
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
                                            <td className="input-cell"><EditableField value={line.product_name} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={line.total_bottles} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={line.total_packs} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={line.planned_downtime_mins} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={line.mechanical_downtime_mins} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={line.total_downtime_mins} /></td>
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
                                            <td className="input-cell numeric"><EditableField type="number" value={summary.total_bottles} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={summary.total_packs} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={lineRows.reduce((s, l) => s + l.planned_downtime_mins, 0)} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={lineRows.reduce((s, l) => s + l.mechanical_downtime_mins, 0)} /></td>
                                            <td className="input-cell numeric"><EditableField type="number" value={lineRows.reduce((s, l) => s + l.total_downtime_mins, 0)} /></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            )}


                            {/* Per-Product Breakdown (when a PET is selected and has multiple products) */}
                            {selectedPet && !selectedProduct && (() => {
                                const uniqueProducts = [...new Set(allPetsUnfiltered.map(p => p.product_name).filter(Boolean))].sort();
                                if (uniqueProducts.length <= 1) return null;
                                return (
                                    <table className="form-table section-table">
                                        <thead>
                                            <tr className="section-header-row">
                                                <th colSpan={8}>Product Breakdown — {pets.find(p => String(p.id) === String(selectedPet))?.pet_name || ''}</th>
                                            </tr>
                                            <tr className="sub-header-row">
                                                <th style={{ width: '20%' }}>Product</th>
                                                <th style={{ width: '14%' }}>Total Units</th>
                                                <th style={{ width: '12%' }}>Total Packs</th>
                                                <th style={{ width: '11%' }}>Efficiency</th>
                                                <th style={{ width: '11%' }}>Prod. Hrs</th>
                                                <th style={{ width: '11%' }}>Planned (min)</th>
                                                <th style={{ width: '11%' }}>Mech. (min)</th>
                                                <th style={{ width: '10%' }}>Downtime (min)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uniqueProducts.map((prodName) => {
                                                const prodEntries = allPetsUnfiltered.filter(p => p.product_name === prodName);
                                                const prodBottles = prodEntries.reduce((sum, p) => sum + (p.total_bottles || p.total_units || 0), 0);
                                                const prodPacks = prodEntries.reduce((sum, p) => sum + (p.total_packs || 0), 0);
                                                const prodProdHrs = prodEntries.reduce((sum, p) => sum + (p.total_production_time_hrs || 0), 0);
                                                const prodEfficiency = prodEntries.length > 0
                                                    ? (prodEntries.reduce((sum, p) => sum + (p.efficiency || p.avg_efficiency || 0), 0) / prodEntries.length).toFixed(1)
                                                    : '';
                                                const prodPlanned = prodEntries.reduce((sum, p) => sum + (p.planned_downtime_mins || 0), 0);
                                                const prodMechanical = prodEntries.reduce((sum, p) => sum + (p.mechanical_downtime_mins || 0), 0);
                                                return (
                                                    <tr key={prodName}>
                                                        <td className="label-cell">{prodName}</td>
                                                        <td className="input-cell numeric"><EditableField type="number" value={prodBottles} /></td>
                                                        <td className="input-cell numeric"><EditableField type="number" value={prodPacks} /></td>
                                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={prodEfficiency && Number(prodEfficiency) > 0 ? prodEfficiency : ''} /></td>
                                                        <td className="input-cell numeric"><EditableField type="number" step="0.1" value={prodProdHrs ? prodProdHrs.toFixed(1) : ''} /></td>
                                                        <td className="input-cell numeric"><EditableField type="number" value={prodPlanned} /></td>
                                                        <td className="input-cell numeric"><EditableField type="number" value={prodMechanical} /></td>
                                                        <td className="input-cell numeric"><EditableField type="number" value={prodPlanned + prodMechanical} /></td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                                <td className="label-cell">TOTAL</td>
                                                <td className="input-cell numeric"><EditableField type="number" value={allPetsUnfiltered.reduce((sum, p) => sum + (p.total_bottles || p.total_units || 0), 0)} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={allPetsUnfiltered.reduce((sum, p) => sum + (p.total_packs || 0), 0)} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" step="0.1" value={(() => { const avg = allPetsUnfiltered.length > 0 ? (allPetsUnfiltered.reduce((sum, p) => sum + (p.efficiency || p.avg_efficiency || 0), 0) / allPetsUnfiltered.length).toFixed(1) : ''; return avg && Number(avg) > 0 ? avg : ''; })()} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" step="0.1" value={(() => { const hrs = allPetsUnfiltered.reduce((sum, p) => sum + (p.total_production_time_hrs || 0), 0); return hrs ? hrs.toFixed(1) : ''; })()} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={allPetsUnfiltered.reduce((sum, p) => sum + (p.planned_downtime_mins || 0), 0)} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={allPetsUnfiltered.reduce((sum, p) => sum + (p.mechanical_downtime_mins || 0), 0)} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={allPetsUnfiltered.reduce((sum, p) => sum + (p.planned_downtime_mins || 0) + (p.mechanical_downtime_mins || 0), 0)} /></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                );
                            })()}

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
                                                <td className="unit-cell"><EditableField value={mat.unit || defaultUnit} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_used || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_losses || ''} /></td>
                                                <td className="input-cell numeric"><EditableField value={lossPercent ? `${lossPercent}%` : ''} /></td>
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
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (co2Meters.start_reading_kg != null ? co2Meters.start_reading_kg : '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Start up Reading:</span>
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.start_reading != null ? syrupMeters.start_reading : '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Reading:</span>
                                                <EditableField value={productionMeters.filler_reading != null ? productionMeters.filler_reading : ''} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading (Kg):</span>
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (co2Meters.end_reading_kg != null ? co2Meters.end_reading_kg : '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading:</span>
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.end_reading != null ? syrupMeters.end_reading : '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading:</span>
                                                <EditableField value={productionMeters.shrink_reading != null ? productionMeters.shrink_reading : ''} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (kg):</span>
                                                <EditableField value={co2Meters.total_co2_consumed_kg != null ? co2Meters.total_co2_consumed_kg : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Filler Rejects (M/C):</span>
                                                <EditableField value={productionMeters.filler_rejects_mc != null ? productionMeters.filler_rejects_mc : ''} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Std. CO2 Consumption (kg):</span>
                                                <EditableField value={co2Meters.std_co2_consumption_kg != null ? co2Meters.std_co2_consumption_kg : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Unit (L, m3, kg):</span>
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.unit || '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Blower Rejects (Manual Count):</span>
                                                <EditableField value={productionMeters.blower_rejects_manual != null ? productionMeters.blower_rejects_manual : ''} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 Yield (%):</span>
                                                <EditableField value={co2Meters.co2_yield_percent != null ? co2Meters.co2_yield_percent : (summary.avg_co2_yield || '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Density (kg/L):</span>
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.syrup_density_kg_per_l != null ? syrupMeters.syrup_density_kg_per_l : '')} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading / T. Packs (%):</span>
                                                <EditableField value={productionMeters.shrink_reading_packs_percent != null ? productionMeters.shrink_reading_packs_percent : ''} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total Syrup Used (L):</span>
                                                <EditableField value={syrupMeters.total_syrup_used_l != null ? syrupMeters.total_syrup_used_l : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Dilution Ratio:</span>
                                                <EditableField value={!selectedPet ? 'NOT APPLICABLE' : (syrupMeters.syrup_dilution_ratio != null ? syrupMeters.syrup_dilution_ratio : '')} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Std. Syrup Consumption (L):</span>
                                                <EditableField value={syrupMeters.std_syrup_consumption_l != null ? syrupMeters.std_syrup_consumption_l : ''} />
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td></td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Syrup Yield (%):</span>
                                                <EditableField value={syrupMeters.syrup_yield_percent != null ? syrupMeters.syrup_yield_percent : (summary.avg_syrup_yield || '')} />
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
                                                <td className="input-cell numeric"><EditableField type="number" value={cat.total_duration_mins || ''} /></td>
                                                <td className="input-cell numeric"><EditableField value={cat.percentage_of_total ? `${cat.percentage_of_total}%` : ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={cat.incident_count || ''} /></td>
                                            </tr>
                                        ))}
                                        <tr className="fw-bold">
                                            <td className="label-cell">TOTAL</td>
                                            <td className="input-cell numeric"><EditableField type="number" value={data.downtime_breakdown.total_downtime_mins || data.downtime_breakdown.categories.reduce((s, c) => s + (c.total_duration_mins || 0), 0)} /></td>
                                            <td className="input-cell numeric">100%</td>
                                            <td className="input-cell numeric"><EditableField type="number" value={data.downtime_breakdown.total_incidents || data.downtime_breakdown.categories.reduce((s, c) => s + (c.incident_count || 0), 0) || ''} /></td>
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
