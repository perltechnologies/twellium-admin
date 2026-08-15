import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar, Plus, X } from 'lucide-react';
import { productionApi } from '../../api/production';
import { workersApi } from '../../api/workers';
import { inventoryApi } from '../../api/inventory';

const STORAGE_KEY = 'productionRunByPet_filters';

// Generic editable input that preserves its own state while syncing with initial value changes
const EditableField = ({ value, type = 'text', className = '', onChange, step, min, max, readOnly }) => {
    const [val, setVal] = useState(() =>
        value === null || value === undefined || value === '' ? '' : String(value)
    );
    useEffect(() => {
        setVal(value === null || value === undefined || value === '' ? '' : String(value));
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

const ProductionRunByPet = () => {
    const printRef = useRef();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [pets, setPets] = useState([]);
    const storedFilters = getStoredFilters();
    const [selectedPet, setSelectedPet] = useState(storedFilters?.selectedPet || '');
    const [selectedProduct, setSelectedProduct] = useState(storedFilters?.selectedProduct || '');
    const [shifts, setShifts] = useState([]);
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

    // Fetch workers
    const [workers, setWorkers] = useState([]);
    useEffect(() => {
        const fetchWorkers = async () => {
            try {
                const params = { page_size: 100 };
                if (selectedPet) params.worker_group = selectedPet;
                const res = await workersApi.getWorkers(params);
                const resData = res?.data;
                const list = Array.isArray(resData?.data) ? resData.data
                    : Array.isArray(resData?.results) ? resData.results
                    : Array.isArray(resData) ? resData : [];
                setWorkers(list);
            } catch (err) {
                console.error('Failed to fetch workers:', err);
            }
        };
        fetchWorkers();
    }, [selectedPet]);

    // Fetch products for fallback lookup
    const [products, setProducts] = useState([]);
    const [reportsList, setReportsList] = useState([]);
    // Track which shrink rows are visible: 'printed', 'plain'
    const [shrinkRows, setShrinkRows] = useState([]);
    useEffect(() => {
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
        fetchProducts();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { start_date: startDate, end_date: endDate };
            if (selectedPet) params.pet = selectedPet;
            if (selectedShift) params.shift = selectedShift;
            if (selectedProduct) params.product = selectedProduct;
            const res = await productionApi.getProductionSummary(params);
            const envelope = res?.data?.data?.data ?? res?.data?.data ?? res?.data ?? {};
            setData(envelope);

            // Also fetch individual reports to get detailed batch data
            const reportParams = { page_size: 100 };
            if (startDate === endDate) {
                reportParams.production_date = startDate;
            } else {
                reportParams.datetime_start_time = `${startDate}T00:00:00Z`;
                reportParams.datetime_end_time = `${endDate}T23:59:59Z`;
            }
            if (selectedPet) reportParams.pet = selectedPet;
            if (selectedShift) reportParams.shift = selectedShift;
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
            if (selectedProduct) {
                reportList = reportList.filter(r => r.product_name === selectedProduct);
            }
            setReportsList(reportList);
        } catch (err) {
            console.error('Failed to fetch production data:', err);
            setError(err?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, selectedPet, selectedShift, selectedProduct]);

    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = `Production Run - ${selectedPetName || 'All Lines'}${selectedProduct ? ` - ${selectedProduct}` : ''} - ${startDate} to ${endDate}`;
        window.print();
        document.title = prevTitle;
    };

    // Extract data
    const summary = data?.summary || {};
    const dailyBreakdown = data?.daily_breakdown || [];
    const metersReading = data?.meters_reading || {};
    const co2Meters = metersReading.co2 || {};
    const productionMeters = metersReading.production || {};
    const syrupMeters = metersReading.syrup || {};
    const selectedPetName = pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '';

    // Get product names from daily breakdown (unfiltered for dropdown)
    const allPetEntriesUnfiltered = dailyBreakdown.flatMap(d => (d.pets || []).filter(p => !p.pet_name?.toLowerCase().includes('can')));
    const productNames = [...new Set(allPetEntriesUnfiltered.map(p => p.product_name).filter(Boolean))].sort();

    // Auto-select first product only on initial load (not on every data change)
    const initialProductSet = useRef(false);
    useEffect(() => {
        if (initialProductSet.current) return;
        if (productNames.length > 0 && (!selectedProduct || !productNames.includes(selectedProduct))) {
            setSelectedProduct(productNames[0]);
            initialProductSet.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productNames.length]);

    // Filter by selected product
    const allPetEntries = selectedProduct
        ? allPetEntriesUnfiltered.filter(p => p.product_name === selectedProduct)
        : allPetEntriesUnfiltered;

    // Materials: aggregate from filtered pet entries when product is selected, otherwise use top-level
    const materials = (() => {
        if (!selectedProduct) return data?.material_consumptions?.materials || [];
        const matMap = {};
        allPetEntries.forEach(pet => {
            (pet.material_consumptions || []).forEach(mat => {
                if (!matMap[mat.material_type]) {
                    matMap[mat.material_type] = { material_type: mat.material_type, material_type_display: mat.material_type_display, unit: mat.unit, total_used: 0, total_losses: 0, yield_percentage: 0 };
                }
                matMap[mat.material_type].total_used += (mat.total_used || 0);
                matMap[mat.material_type].total_losses += (mat.total_losses || 0);
            });
        });
        Object.values(matMap).forEach(m => {
            m.yield_percentage = m.total_used > 0 ? ((m.total_used - m.total_losses) / m.total_used * 100) : 0;
        });
        return Object.values(matMap);
    })();

    // Determine production dates: which dates within the range had actual production for the selected product
    const productionDates = (() => {
        const dates = new Set();
        // From daily breakdown — each day has a date and pets array
        dailyBreakdown.forEach(day => {
            const dayDate = day.date || day.production_date;
            if (!dayDate) return;
            const dayPets = day.pets || [];
            const matchingPets = selectedProduct
                ? dayPets.filter(p => p.product_name === selectedProduct)
                : dayPets;
            if (matchingPets.length > 0) {
                dates.add(dayDate);
            }
        });
        // From reports list as fallback
        reportsList.forEach(r => {
            const rDate = r.production_date || (r.datetime_start_time ? r.datetime_start_time.split('T')[0] : null);
            if (rDate) dates.add(rDate);
        });
        return [...dates].sort();
    })();

    // Format production dates for display
    const formatProductionDates = () => {
        if (productionDates.length === 0) return '';
        return productionDates.map(d => {
            const dt = new Date(d);
            return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }).join(', ');
    };

    // Derived values from per-pet data
    const totalProductionHrs = allPetEntries.reduce((sum, p) => sum + (p.total_production_time_hrs || 0), 0)
        || reportsList.reduce((sum, r) => sum + (r.total_production_time_hrs || r.production_hours || 0), 0);
    const productionStartTimes = [
        ...allPetEntries.map(p => p.production_start_time),
        ...reportsList.map(r => r.production_start_time || r.start_time)
    ].filter(Boolean).sort();
    const productionEndTimes = [
        ...allPetEntries.map(p => p.production_end_time),
        ...reportsList.map(r => r.production_end_time || r.end_time)
    ].filter(Boolean).sort();
    const totalPaidHours = allPetEntries.reduce((sum, p) => sum + (p.workers?.paid_hours || 0), 0)
        || reportsList.reduce((sum, r) => sum + (r.paid_hours || r.workers_paid_hours || 0), 0);
    const totalOvertimeHours = allPetEntries.reduce((sum, p) => sum + (p.workers?.overtime_hours || 0), 0)
        || reportsList.reduce((sum, r) => sum + (r.overtime_hours || r.workers_overtime_hours || 0), 0);
    const absentWorkerNames = [...new Set([
        ...allPetEntries.flatMap(p => p.workers?.absent_worker_names || []),
        ...reportsList.flatMap(r => r.absent_worker_names || r.absent_workers || [])
    ])];
    const batchNumbers = [...new Set([
        ...allPetEntries.flatMap(p => p.batch_numbers || (p.batches || []).map(b => b.batch_number)),
        ...reportsList.flatMap(r => r.batch_numbers || (r.batches || []).map(b => b.batch_number))
    ].filter(Boolean))];
    const totalSyrupLiters = allPetEntries.reduce((sum, p) => sum + (p.meters_reading?.syrup?.total_syrup_used_l || 0), 0)
        || reportsList.reduce((sum, r) => sum + (r.total_syrup_used_l || r.syrup_liters || 0), 0)
        || (data?.meters_reading?.syrup?.total_syrup_used_l || 0);
    const totalBeverageLiters = allPetEntries.reduce((sum, p) => sum + (p.meters_reading?.beverage?.total_beverage_liters || p.beverage_liters || 0), 0)
        || reportsList.reduce((sum, r) => sum + (r.total_beverage_liters || r.beverage_liters || 0), 0)
        || (data?.meters_reading?.beverage?.total_beverage_liters || summary.total_beverage_liters || 0);

    // Derive totals from filtered allPetEntries so product filter is respected
    const filteredTotalBottles = allPetEntries.reduce((sum, p) => sum + (p.total_bottles || p.total_units || 0), 0);
    const filteredTotalPacks = allPetEntries.reduce((sum, p) => sum + (p.total_packs || 0), 0);
    const filteredTotalBottlesProduced = allPetEntries.reduce((sum, p) => sum + (p.total_bottles_produced || p.total_packs || 0), 0);
    const filteredTotalPhysicalBoxes = allPetEntries.reduce((sum, p) => sum + (p.total_physical_boxes || p.physical_boxes || 0), 0);
    const filteredAvgEfficiency = allPetEntries.length > 0
        ? (allPetEntries.reduce((sum, p) => sum + (p.efficiency || p.avg_efficiency || 0), 0) / allPetEntries.length).toFixed(1)
        : null;
    const filteredAvgSyrupYield = allPetEntries.length > 0
        ? (allPetEntries.reduce((sum, p) => sum + (p.syrup_yield || p.avg_syrup_yield || 0), 0) / allPetEntries.length).toFixed(1)
        : null;

    // Use filtered values when a product filter is active, otherwise fall back to API summary
    const displayTotalBottles = selectedProduct ? filteredTotalBottles : (summary.total_bottles || filteredTotalBottles);
    const displayTotalPacks = selectedProduct ? filteredTotalPacks : (summary.total_packs || filteredTotalPacks);
    const displayTotalBottlesProduced = selectedProduct ? filteredTotalBottlesProduced : (summary.total_bottles_produced || summary.total_packs || filteredTotalBottlesProduced);
    const displayTotalPhysicalBoxes = selectedProduct ? filteredTotalPhysicalBoxes : (summary.total_physical_boxes || filteredTotalPhysicalBoxes);
    const displayAvgEfficiency = selectedProduct ? filteredAvgEfficiency : (summary.avg_efficiency || filteredAvgEfficiency);
    const displayAvgSyrupYield = selectedProduct ? filteredAvgSyrupYield : (summary.avg_syrup_yield || filteredAvgSyrupYield);

    // Calculate Total Btls/Hr: total_bottles / total_production_hours
    const totalDowntimeHrs = (summary.total_downtime_minutes || 0) / 60;
    const approxProductionHrs = totalProductionHrs || ((summary.total_reports || 0) * 8 - totalDowntimeHrs);
    const totalBtlsPerHr = approxProductionHrs > 0 ? Math.round(displayTotalBottles / approxProductionHrs) : 0;

    // T. Shrink and Total Carton from materials
    const shrinkMat = materials.find(m => m.material_type === 'SHRINK') || {};
    const cartonMat = materials.find(m => m.material_type === 'CARTON_BOXES' || m.material_type === 'CARTON_LAYER') || {};

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
                                <span><strong>Shift:</strong> {selectedShift ? (shifts.find(s => String(s.id) === String(selectedShift))?.name || shifts.find(s => String(s.id) === String(selectedShift))?.shift_name || 'All Shifts') : 'All Shifts'}</span>
                            </div>

                            {/* Row 4-6: Date, Shift, Flavor */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '8%' }}>Date</td>
                                        <td className="input-cell numeric" style={{ width: '25%' }}><EditableField value={formatDateRange()} /></td>
                                        <td className="label-cell" style={{ width: '10%' }}>Line Speed</td>
                                        <td className="input-cell numeric" style={{ width: '10%' }}><EditableField value={allPetEntries.find(p => p.line_speed)?.line_speed || summary.line_speed || ''} /></td>
                                        <td className="label-cell" style={{ width: '10%' }}>Total Units</td>
                                        <td className="input-cell numeric" style={{ width: '12%' }}><EditableField type="number" value="" /></td>
                                    </tr>
                                    {/* Production Date(s) — dates within range when product was actually produced */}
                                    {selectedProduct && productionDates.length > 0 && (
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
                                        <td className="input-cell"><EditableField value={selectedShift ? (shifts.find(s => String(s.id) === String(selectedShift))?.name || shifts.find(s => String(s.id) === String(selectedShift))?.shift_name || '') : 'All Shifts'} /></td>
                                        <td className="label-cell">Total Batches</td>
                                        <td className="input-cell numeric"><EditableField type="number" value={batchNumbers.length || ''} /></td>
                                        <td className="label-cell">Syrup (Lts)</td>
                                        <td className="input-cell numeric"><EditableField value={totalSyrupLiters ? fmt(totalSyrupLiters, 1) : (summary.total_syrup_liters ? fmt(summary.total_syrup_liters, 1) : '')} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Product Details Breakdown */}
                            {allPetEntries.length > 0 && (
                            <table className="form-table section-table">
                                <thead>
                                    <tr className="section-header-row">
                                        <th colSpan={6}>Product Details</th>
                                    </tr>
                                    <tr className="sub-header-row">
                                        <th style={{ width: '25%' }}>Product</th>
                                        <th style={{ width: '15%' }}>Bottle Size</th>
                                        <th style={{ width: '15%' }}>Line Speed (BPH)</th>
                                        <th style={{ width: '15%' }}>Bottles/Pack</th>
                                        <th style={{ width: '15%' }}>Packs/Pallet</th>
                                        <th style={{ width: '15%' }}>Single Packs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const uniqueProducts = [];
                                        const seen = new Set();
                                        allPetEntries.forEach(pet => {
                                            const name = pet.product_name;
                                            if (name && !seen.has(name)) {
                                                seen.add(name);
                                                uniqueProducts.push(pet);
                                            }
                                        });
                                        return uniqueProducts.map((petEntry, idx) => {
                                            // Fallback: find same product from all entries (any shift/day) that has values filled
                                            const fallback = allPetEntriesUnfiltered.find(p => p.product_name === petEntry.product_name && p.bottle_size) || {};
                                            // Fallback: products API (has 'size' as ml number e.g. 350)
                                            const productCatalog = products.find(pr => pr.name === petEntry.product_name) || {};
                                            const bottleSize = petEntry.bottle_size || fallback.bottle_size || (productCatalog.size ? `${productCatalog.size}ml` : '') || summary.bottle_size || '';
                                            const lineSpeed = petEntry.line_speed || fallback.line_speed || productCatalog.target_speed_bph || productCatalog.line_speed || summary.line_speed || '';
                                            const bottlesPerPack = petEntry.bottles_per_pack || fallback.bottles_per_pack || productCatalog.bottles_per_pack || summary.bottles_per_pack || '';
                                            const packsPerPallet = petEntry.packs_per_pallet || fallback.packs_per_pallet || productCatalog.packs_per_pallet || summary.packs_per_pallet || '';
                                            const singlePacks = petEntry.single_packs || fallback.single_packs || productCatalog.single_packs || summary.single_packs || '';
                                            return (
                                                <tr key={idx}>
                                                    <td className="label-cell">{petEntry.product_name}</td>
                                                    <td className="input-cell numeric"><EditableField value={bottleSize} /></td>
                                                    <td className="input-cell numeric"><EditableField value={lineSpeed} /></td>
                                                    <td className="input-cell numeric"><EditableField value={bottlesPerPack} /></td>
                                                    <td className="input-cell numeric"><EditableField value={packsPerPallet} /></td>
                                                    <td className="input-cell numeric"><EditableField value={singlePacks} /></td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                            )}

                            {/* Row 21-23: Production Totals */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Total Btls/Hr</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}><EditableField type="number" value={summary.total_bottles_per_hr || totalBtlsPerHr || ''} /></td>
                                        <td className="label-cell" style={{ width: '15%' }}>Efficiency</td>
                                        <td className="input-cell numeric" style={{ width: '15%' }}><EditableField value={displayAvgEfficiency ? `${displayAvgEfficiency}%` : ''} /></td>
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
                                        <td className="input-cell numeric" style={{ width: '40%' }}><EditableField value={displayAvgSyrupYield ? `${displayAvgSyrupYield}%` : ''} /></td>
                                        <td className="label-cell" style={{ width: '12%' }}>Total Pack</td>
                                        <td className="input-cell numeric" style={{ width: '38%' }}><EditableField type="number" value={displayTotalPacks || ''} /></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 28-34: Paid Hours / Time / Workers */}
                            {/* Batch Details Table */}
                            {(() => {
                                // Default batch numbers to always show
                                const defaultBatchNumbers = ['323', '320', '108', '477', '105', '476', '106', '107', '256', '321', '162', '322'];

                                // Dilution ratio for computing beverage liters from syrup
                                const dilutionRatio = parseFloat(syrupMeters.syrup_dilution_ratio) || 0;

                                // Collect batch data from reports list (individual reports have detailed batch info)
                                const batchMap = {};
                                defaultBatchNumbers.forEach(bNum => {
                                    batchMap[bNum] = { batch_number: bNum, syrup_liters: 0, beverage_liters: 0 };
                                });

                                // From individual reports (most detailed source)
                                reportsList.forEach(report => {
                                    (report.batches || []).forEach(batch => {
                                        const bNum = String(batch.batch_number || '');
                                        if (!bNum) return;
                                        if (!batchMap[bNum]) {
                                            batchMap[bNum] = { batch_number: bNum, syrup_liters: 0, beverage_liters: 0 };
                                        }
                                        const syrup = parseFloat(batch.syrup_liters || batch.syrup_used_l || batch.total_syrup_used_l || 0);
                                        const bev = parseFloat(batch.beverage_liters || batch.bev_liters || batch.total_beverage_liters || 0);
                                        batchMap[bNum].syrup_liters += syrup;
                                        // Use beverage_liters if available, otherwise compute from syrup × dilution ratio
                                        batchMap[bNum].beverage_liters += bev > 0 ? bev : (dilutionRatio > 0 && syrup > 0 ? syrup * dilutionRatio : 0);
                                    });
                                });

                                // Also check pet entries from production summary as fallback
                                allPetEntries.forEach(pet => {
                                    (pet.batches || []).forEach(batch => {
                                        const bNum = String(batch.batch_number || '');
                                        if (!bNum) return;
                                        if (!batchMap[bNum]) {
                                            batchMap[bNum] = { batch_number: bNum, syrup_liters: 0, beverage_liters: 0 };
                                        }
                                        // Only add if not already populated from reports
                                        if (batchMap[bNum].syrup_liters === 0) {
                                            const syrup = parseFloat(batch.syrup_liters || batch.syrup_used_l || batch.total_syrup_used_l || 0);
                                            batchMap[bNum].syrup_liters += syrup;
                                            if (batchMap[bNum].beverage_liters === 0) {
                                                const bev = parseFloat(batch.beverage_liters || batch.bev_liters || batch.total_beverage_liters || 0);
                                                batchMap[bNum].beverage_liters += bev > 0 ? bev : (dilutionRatio > 0 && syrup > 0 ? syrup * dilutionRatio : 0);
                                            }
                                        }
                                    });
                                });

                                // Ensure default batches come first in order, then any additional from API
                                const batchRows = [
                                    ...defaultBatchNumbers.map(bNum => batchMap[bNum]),
                                    ...Object.values(batchMap).filter(b => !defaultBatchNumbers.includes(b.batch_number))
                                ];

                                return (
                                    <table className="form-table section-table">
                                        <thead>
                                            <tr className="section-header-row">
                                                <th colSpan={3}>Batch Details</th>
                                            </tr>
                                            <tr className="sub-header-row">
                                                <th style={{ width: '40%' }}>Batch No</th>
                                                <th style={{ width: '30%' }}>Syrup (Lts)</th>
                                                <th style={{ width: '30%' }}>Bev (Lts)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchRows.map((batch, idx) => (
                                                <tr key={idx}>
                                                    <td className="label-cell">{batch.batch_number}</td>
                                                    <td className="input-cell numeric"><EditableField value={batch.syrup_liters ? fmt(batch.syrup_liters, 1) : ''} /></td>
                                                    <td className="input-cell numeric"><EditableField value={batch.beverage_liters ? fmt(batch.beverage_liters, 1) : ''} /></td>
                                                </tr>
                                            ))}
                                            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                                <td className="label-cell">TOTAL</td>
                                                <td className="input-cell numeric"><EditableField value={fmt(batchRows.reduce((s, b) => s + b.syrup_liters, 0), 1)} /></td>
                                                <td className="input-cell numeric"><EditableField value={fmt(batchRows.reduce((s, b) => s + b.beverage_liters, 0), 1)} /></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                );
                            })()}

                            {/* Time / Workers */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell">Start Up Production</td>
                                        <td className="input-cell" colSpan={3}><EditableField value={productionStartTimes[0] || summary.production_start_time || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Shut Down Production</td>
                                        <td className="input-cell" colSpan={3}><EditableField value={productionEndTimes[productionEndTimes.length - 1] || summary.production_end_time || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Production Hrs</td>
                                        <td className="input-cell" colSpan={3}><EditableField type="number" step="0.1" value={totalProductionHrs ? totalProductionHrs.toFixed(1) : (summary.total_production_time_hrs || '')} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Cumulative Stoppage Time/min</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField type="number" value={selectedProduct ? allPetEntries.reduce((sum, p) => sum + (p.total_downtime_minutes || 0), 0) || '' : ((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0)) || ''} /></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Workers Count</td>
                                        <td className="input-cell numeric" colSpan={3}><EditableField type="number" value={selectedProduct ? allPetEntries.reduce((sum, p) => sum + (p.workers?.worker_count || 0), 0) || '' : (workers.length || summary.worker_count || '')} /></td>
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
                                    ].map(({ type, label, defaultUnit }) => {
                                        const mat = getMaterial(type);
                                        const lossPercent = mat.total_used
                                            ? ((mat.total_losses / mat.total_used) * 100).toFixed(1)
                                            : '';
                                        return (
                                            <tr key={type}>
                                                <td className="label-cell">{label}</td>
                                                <td className="unit-cell"><EditableField value={mat.unit || defaultUnit} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.expected_usage || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.received || mat.total_received || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_used || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.returned || mat.total_returned || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_losses || ''} /></td>
                                                <td className="input-cell numeric"><EditableField value={lossPercent ? `${lossPercent}%` : ''} /></td>
                                            </tr>
                                        );
                                    })}
                                    {/* Dynamic Shrink rows */}
                                    {shrinkRows.includes('printed') && (() => {
                                        const mat = getMaterial('SHRINK');
                                        const lossPercent = mat.total_used
                                            ? ((mat.total_losses / mat.total_used) * 100).toFixed(1)
                                            : '';
                                        return (
                                            <tr>
                                                <td className="label-cell">
                                                    Shrink PRINTED
                                                    <button
                                                        className="btn btn-link btn-sm p-0 ms-2 no-print text-danger"
                                                        onClick={() => setShrinkRows(prev => prev.filter(r => r !== 'printed'))}
                                                        title="Remove Shrink Printed row"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </td>
                                                <td className="unit-cell"><EditableField value={mat.unit || 'Pcs'} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.expected_usage || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.received || mat.total_received || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_used || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.returned || mat.total_returned || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_losses || ''} /></td>
                                                <td className="input-cell numeric"><EditableField value={lossPercent ? `${lossPercent}%` : ''} /></td>
                                            </tr>
                                        );
                                    })()}
                                    {shrinkRows.includes('plain') && (() => {
                                        const mat = getMaterial('STRETCH_FILM');
                                        const lossPercent = mat.total_used
                                            ? ((mat.total_losses / mat.total_used) * 100).toFixed(1)
                                            : '';
                                        return (
                                            <tr>
                                                <td className="label-cell">
                                                    Shrink Plain
                                                    <button
                                                        className="btn btn-link btn-sm p-0 ms-2 no-print text-danger"
                                                        onClick={() => setShrinkRows(prev => prev.filter(r => r !== 'plain'))}
                                                        title="Remove Shrink Plain row"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </td>
                                                <td className="unit-cell"><EditableField value={mat.unit || 'Kg'} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.expected_usage || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.received || mat.total_received || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_used || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.returned || mat.total_returned || ''} /></td>
                                                <td className="input-cell numeric"><EditableField type="number" value={mat.total_losses || ''} /></td>
                                                <td className="input-cell numeric"><EditableField value={lossPercent ? `${lossPercent}%` : ''} /></td>
                                            </tr>
                                        );
                                    })()}
                                    {/* Add Shrink button row */}
                                    {(shrinkRows.length < 2) && (
                                    <tr className="no-print">
                                        <td colSpan={8} style={{ padding: '4px 8px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <Plus size={14} className="text-primary" />
                                                {!shrinkRows.includes('printed') && (
                                                    <button
                                                        className="btn btn-outline-primary btn-sm py-0 px-2"
                                                        style={{ fontSize: '0.75rem' }}
                                                        onClick={() => setShrinkRows(prev => [...prev, 'printed'])}
                                                    >
                                                        + Shrink Printed
                                                    </button>
                                                )}
                                                {!shrinkRows.includes('plain') && (
                                                    <button
                                                        className="btn btn-outline-primary btn-sm py-0 px-2"
                                                        style={{ fontSize: '0.75rem' }}
                                                        onClick={() => setShrinkRows(prev => [...prev, 'plain'])}
                                                    >
                                                        + Shrink Plain
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    )}
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
                                                <EditableField value={co2Meters.start_reading_kg != null ? co2Meters.start_reading_kg : ''} />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Combi Reading:</span>
                                                <EditableField value={productionMeters.combi_reading != null ? productionMeters.combi_reading : (co2Meters.combi_reading != null ? co2Meters.combi_reading : (productionMeters.filler_reading != null ? productionMeters.filler_reading : ''))} />
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
                                                <EditableField value={co2Meters.difference_in_balance != null ? co2Meters.difference_in_balance : (co2Meters.difference_in_balance_kg != null ? co2Meters.difference_in_balance_kg : (co2Meters.start_reading_kg != null && co2Meters.end_reading_kg != null ? (co2Meters.end_reading_kg - co2Meters.start_reading_kg).toFixed(1) : ''))} />
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (Kg):</span>
                                                <EditableField value={co2Meters.total_co2_consumed_kg != null ? co2Meters.total_co2_consumed_kg : ''} />
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/l:</span>
                                                <EditableField value={co2Meters.co2_g_per_liter != null ? co2Meters.co2_g_per_liter : (co2Meters.co2_grams_per_liter != null ? co2Meters.co2_grams_per_liter : (co2Meters.total_co2_consumed_kg && summary.total_beverage_liters ? ((co2Meters.total_co2_consumed_kg * 1000) / summary.total_beverage_liters).toFixed(2) : ''))} />
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/Btl:</span>
                                                <EditableField value={co2Meters.co2_g_per_bottle != null ? co2Meters.co2_g_per_bottle : (co2Meters.co2_grams_per_bottle != null ? co2Meters.co2_grams_per_bottle : (co2Meters.total_co2_consumed_kg && displayTotalBottles ? ((co2Meters.total_co2_consumed_kg * 1000) / displayTotalBottles).toFixed(2) : ''))} />
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Downtime Section */}
                            {(() => {
                                // Use per-pet downtime_breakdown when product filter is active
                                let totalDowntimeMins = 0;
                                let plannedDowntimeMins = 0;
                                let mechanicalDowntimeMins = 0;

                                if (selectedProduct && allPetEntries.length > 0) {
                                    // Aggregate from filtered pet entries' downtime_breakdown
                                    allPetEntries.forEach(pet => {
                                        const petDowntime = pet.downtime_breakdown;
                                        if (petDowntime?.categories) {
                                            petDowntime.categories.forEach(cat => {
                                                if (cat.category_name?.toLowerCase().includes('planned')) {
                                                    plannedDowntimeMins += (cat.total_duration_mins || 0);
                                                } else if (cat.category_name?.toLowerCase().includes('mechanical')) {
                                                    mechanicalDowntimeMins += (cat.total_duration_mins || 0);
                                                }
                                            });
                                        }
                                        totalDowntimeMins += (pet.total_downtime_minutes || 0);
                                    });
                                } else {
                                    // Use top-level downtime_breakdown or summary
                                    const dtBreakdown = data?.downtime_breakdown;
                                    if (dtBreakdown?.categories?.length > 0) {
                                        dtBreakdown.categories.forEach(cat => {
                                            if (cat.category_name?.toLowerCase().includes('planned')) {
                                                plannedDowntimeMins += (cat.total_duration_mins || 0);
                                            } else if (cat.category_name?.toLowerCase().includes('mechanical')) {
                                                mechanicalDowntimeMins += (cat.total_duration_mins || 0);
                                            }
                                        });
                                        totalDowntimeMins = dtBreakdown.total_downtime_minutes || (plannedDowntimeMins + mechanicalDowntimeMins);
                                    } else {
                                        plannedDowntimeMins = summary.planned_downtime_mins || 0;
                                        mechanicalDowntimeMins = summary.mechanical_downtime_mins || 0;
                                        totalDowntimeMins = summary.total_downtime_minutes || (plannedDowntimeMins + mechanicalDowntimeMins);
                                    }
                                }

                                return (
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
                                                <td className="input-cell numeric"><EditableField value={fmt(plannedDowntimeMins, 1)} /></td>
                                            </tr>
                                            <tr>
                                                <td className="label-cell">Total Mechanical Downtime</td>
                                                <td className="input-cell numeric"><EditableField value={fmt(mechanicalDowntimeMins, 1)} /></td>
                                            </tr>
                                            <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                                <td className="label-cell">TOTAL</td>
                                                <td className="input-cell numeric"><EditableField value={fmt(totalDowntimeMins, 1)} /></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                );
                            })()}

                            {/* Line Detail — Per-Product Breakdown (shown when a PET is selected and has multiple products) */}
                            {selectedPet && productNames.length > 1 && !selectedProduct && (
                                <table className="form-table section-table" style={{ marginTop: '12px' }}>
                                    <thead>
                                        <tr className="section-header-row">
                                            <th colSpan={8}>Line Detail — {selectedPetName}</th>
                                        </tr>
                                        <tr className="sub-header-row">
                                            <th style={{ width: '20%' }}>Product</th>
                                            <th style={{ width: '12%' }}>Total Units</th>
                                            <th style={{ width: '12%' }}>Btls/Hr</th>
                                            <th style={{ width: '10%' }}>Efficiency</th>
                                            <th style={{ width: '10%' }}>Yield %</th>
                                            <th style={{ width: '12%' }}>Prod. Hrs</th>
                                            <th style={{ width: '12%' }}>Packs</th>
                                            <th style={{ width: '12%' }}>Syrup (Lts)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productNames.map((prodName) => {
                                            const prodEntries = allPetEntriesUnfiltered.filter(p => p.product_name === prodName);
                                            const prodBottles = prodEntries.reduce((sum, p) => sum + (p.total_bottles || p.total_units || 0), 0);
                                            const prodProdHrs = prodEntries.reduce((sum, p) => sum + (p.total_production_time_hrs || 0), 0);
                                            const prodBtlsPerHr = prodProdHrs > 0 ? Math.round(prodBottles / prodProdHrs) : 0;
                                            const prodEfficiency = prodEntries.length > 0
                                                ? (prodEntries.reduce((sum, p) => sum + (p.efficiency || p.avg_efficiency || 0), 0) / prodEntries.length).toFixed(1)
                                                : '';
                                            const prodYield = prodEntries.length > 0
                                                ? (prodEntries.reduce((sum, p) => sum + (p.syrup_yield || p.avg_syrup_yield || 0), 0) / prodEntries.length).toFixed(1)
                                                : '';
                                            const prodPacks = prodEntries.reduce((sum, p) => sum + (p.total_packs || 0), 0);
                                            const prodSyrup = prodEntries.reduce((sum, p) => sum + (p.meters_reading?.syrup?.total_syrup_used_l || 0), 0);
                                            return (
                                                <tr key={prodName}>
                                                    <td className="label-cell">{prodName}</td>
                                                    <td className="input-cell numeric">{fmt(prodBottles)}</td>
                                                    <td className="input-cell numeric">{prodBtlsPerHr ? fmt(prodBtlsPerHr) : ''}</td>
                                                    <td className="input-cell numeric">{prodEfficiency && Number(prodEfficiency) > 0 ? `${prodEfficiency}%` : ''}</td>
                                                    <td className="input-cell numeric">{prodYield && Number(prodYield) > 0 ? `${prodYield}%` : ''}</td>
                                                    <td className="input-cell numeric">{prodProdHrs ? prodProdHrs.toFixed(1) : ''}</td>
                                                    <td className="input-cell numeric">{fmt(prodPacks)}</td>
                                                    <td className="input-cell numeric">{prodSyrup ? fmt(prodSyrup, 1) : ''}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Totals row */}
                                        <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                            <td className="label-cell">TOTAL</td>
                                            <td className="input-cell numeric">{fmt(filteredTotalBottles)}</td>
                                            <td className="input-cell numeric">{totalBtlsPerHr ? fmt(totalBtlsPerHr) : ''}</td>
                                            <td className="input-cell numeric">{filteredAvgEfficiency && Number(filteredAvgEfficiency) > 0 ? `${filteredAvgEfficiency}%` : ''}</td>
                                            <td className="input-cell numeric">{filteredAvgSyrupYield && Number(filteredAvgSyrupYield) > 0 ? `${filteredAvgSyrupYield}%` : ''}</td>
                                            <td className="input-cell numeric">{totalProductionHrs ? totalProductionHrs.toFixed(1) : ''}</td>
                                            <td className="input-cell numeric">{fmt(filteredTotalPacks)}</td>
                                            <td className="input-cell numeric">{totalSyrupLiters ? fmt(totalSyrupLiters, 1) : ''}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}

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
