import React, { useRef, useState, useEffect } from 'react';
import { Printer, Loader2, Calendar } from 'lucide-react';
import { productionApi } from '../../api/production';
import { workersApi } from '../../api/workers';
import { inventoryApi } from '../../api/inventory';

const STORAGE_KEY = 'productionRunByPet_filters';

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
    const materials = data?.material_consumptions?.materials || [];
    const metersReading = data?.meters_reading || {};
    const co2Meters = metersReading.co2 || {};
    const productionMeters = metersReading.production || {};
    const selectedPetName = pets.find(p => String(p.id) === String(selectedPet))?.pet_name || '';

    // Get product names from daily breakdown (unfiltered for dropdown)
    const allPetEntriesUnfiltered = dailyBreakdown.flatMap(d => (d.pets || []).filter(p => !p.pet_name?.toLowerCase().includes('can')));
    const productNames = [...new Set(allPetEntriesUnfiltered.map(p => p.product_name).filter(Boolean))].sort();

    // Filter by selected product
    const allPetEntries = selectedProduct
        ? allPetEntriesUnfiltered.filter(p => p.product_name === selectedProduct)
        : allPetEntriesUnfiltered;

    // Derived values from per-pet data
    const totalProductionHrs = allPetEntries.reduce((sum, p) => sum + (p.total_production_time_hrs || 0), 0);
    const productionStartTimes = allPetEntries.map(p => p.production_start_time).filter(Boolean).sort();
    const productionEndTimes = allPetEntries.map(p => p.production_end_time).filter(Boolean).sort();
    const totalPaidHours = allPetEntries.reduce((sum, p) => sum + (p.workers?.paid_hours || 0), 0);
    const totalOvertimeHours = allPetEntries.reduce((sum, p) => sum + (p.workers?.overtime_hours || 0), 0);
    const absentWorkerNames = [...new Set(allPetEntries.flatMap(p => p.workers?.absent_worker_names || []))];
    const batchNumbers = [...new Set(allPetEntries.flatMap(p => (p.batches || []).map(b => b.batch_number)).filter(Boolean))];
    const totalSyrupLiters = allPetEntries.reduce((sum, p) => sum + (p.meters_reading?.syrup?.total_syrup_used_l || 0), 0) || (data?.meters_reading?.syrup?.total_syrup_used_l || 0);

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
    const totalDowntimeHrs = (summary.total_downtime_mins || 0) / 60;
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

                            {/* Active Filters Display */}
                            <div className="active-filters-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '6px 10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6', fontSize: '11px' }}>
                                <span><strong>Date:</strong> {formatDateRange()}</span>
                                <span><strong>Line:</strong> {selectedPetName || 'All Lines'}</span>
                                <span><strong>Shift:</strong> {selectedShift ? (shifts.find(s => String(s.id) === String(selectedShift))?.name || shifts.find(s => String(s.id) === String(selectedShift))?.shift_name || 'All Shifts') : 'All Shifts'}</span>
                                <span><strong>Product:</strong> {selectedProduct || 'All Products'}</span>
                            </div>

                            {/* Row 4-6: Date, Shift, Flavor */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '8%' }}>Date</td>
                                        <td className="input-cell numeric" style={{ width: '25%' }}>{formatDateRange()}</td>
                                        <td className="label-cell" style={{ width: '10%' }}>Line Speed</td>
                                        <td className="input-cell numeric" style={{ width: '10%' }}>{summary.line_speed || allPetEntries.find(p => p.line_speed)?.line_speed || ''}</td>
                                        <td className="label-cell" style={{ width: '10%' }}>Total Units</td>
                                        <td className="input-cell numeric" style={{ width: '12%' }}>{fmt(displayTotalBottles)}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Shift</td>
                                        <td className="input-cell">{selectedShift ? (shifts.find(s => String(s.id) === String(selectedShift))?.name || shifts.find(s => String(s.id) === String(selectedShift))?.shift_name || '') : 'All Shifts'}</td>
                                        <td className="label-cell">Batch N°</td>
                                        <td className="input-cell">{batchNumbers.length > 0 ? batchNumbers.join(', ') : (summary.batch_numbers?.length > 0 ? summary.batch_numbers.join(', ') : '')}</td>
                                        <td className="label-cell">Syrup (Lts)</td>
                                        <td className="input-cell numeric">{summary.total_syrup_liters ? fmt(summary.total_syrup_liters, 1) : (totalSyrupLiters ? fmt(totalSyrupLiters, 1) : '')}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Flavor</td>
                                        <td className="input-cell" colSpan={5}>{selectedProduct || productNames.join(', ') || ''}</td>
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
                                                    <td className="input-cell numeric">{bottleSize}</td>
                                                    <td className="input-cell numeric">{lineSpeed}</td>
                                                    <td className="input-cell numeric">{bottlesPerPack}</td>
                                                    <td className="input-cell numeric">{packsPerPallet}</td>
                                                    <td className="input-cell numeric">{singlePacks}</td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                            )}

                            {/* Row 21-23: Package & Production Totals */}
                            <table className="form-table">
                                <tbody>
                                    <tr>
                                        <td className="label-cell" style={{ width: '15%' }}>Package</td>
                                        <td className="input-cell" style={{ width: '15%' }}>{summary.bottle_size || summary.package_type || allPetEntries.find(p => p.bottle_size)?.bottle_size || ''}</td>
                                        <td className="input-cell" style={{ width: '15%' }}></td>
                                        <td className="input-cell" style={{ width: '15%' }}></td>
                                        <td className="label-cell" style={{ width: '15%' }}></td>
                                        <td className="input-cell" style={{ width: '25%' }}></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Physical Box</td>
                                        <td className="input-cell numeric">{summary.bottles_per_pack || allPetEntries.find(p => p.bottles_per_pack)?.bottles_per_pack || fmt(displayTotalPhysicalBoxes || cartonMat.total_used) || ''}</td>
                                        <td className="input-cell"></td>
                                        <td className="input-cell"></td>
                                        <td className="label-cell"></td>
                                        <td className="input-cell"></td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Btls/Hr</td>
                                        <td className="input-cell numeric">{summary.total_bottles_per_hr ? fmt(summary.total_bottles_per_hr) : (totalBtlsPerHr ? fmt(totalBtlsPerHr) : '')}</td>
                                        <td className="label-cell">Efficiency</td>
                                        <td className="input-cell numeric">{displayAvgEfficiency ? `${displayAvgEfficiency}%` : ''}</td>
                                        <td className="label-cell">Bev. (Lts)</td>
                                        <td className="input-cell numeric">{summary.total_beverage_liters ? fmt(summary.total_beverage_liters, 1) : (totalSyrupLiters ? fmt(totalSyrupLiters, 1) : '')}</td>
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
                                        <td className="input-cell numeric">{fmt(displayTotalBottles)}</td>
                                        <td className="input-cell numeric">{displayAvgSyrupYield ? `${displayAvgSyrupYield}%` : ''}</td>
                                        <td className="input-cell numeric">{fmt(displayTotalBottlesProduced)}</td>
                                        <td className="input-cell numeric">{fmt(summary.total_shrink_packs || shrinkMat.total_used)}</td>
                                        <td className="input-cell numeric">{fmt(summary.total_carton_packs || cartonMat.total_used)}</td>
                                        <td className="input-cell numeric">{fmt(displayTotalPacks)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Row 28-34: Paid Hours / Time / Workers */}
                            <table className="form-table">
                                <tbody>
                                    <tr className="section-header-row">
                                        <td className="label-cell" style={{ width: '30%' }}><strong>Paid Hours (overtime)</strong></td>
                                        <td className="label-cell" style={{ width: '15%' }}><strong>Time</strong></td>
                                        <td className="input-cell" colSpan={2}>{summary.paid_hours ? `${summary.paid_hours}h` : (totalPaidHours ? `${totalPaidHours}h${totalOvertimeHours ? ` (OT: ${totalOvertimeHours}h)` : ''}` : '')}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Start Up Production</td>
                                        <td className="input-cell" colSpan={3}>{summary.production_start_time || productionStartTimes[0] || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Shut Down Production</td>
                                        <td className="input-cell" colSpan={3}>{summary.production_end_time || productionEndTimes[productionEndTimes.length - 1] || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Total Production Hrs</td>
                                        <td className="input-cell" colSpan={3}>{summary.total_production_time_hrs || (totalProductionHrs ? totalProductionHrs.toFixed(1) : '')}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Cumulative Stoppage Time/min</td>
                                        <td className="input-cell numeric" colSpan={3}>{fmt((summary.planned_downtime_mins || 0) + (summary.mechanical_downtime_mins || 0))}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Working Labours On Line</td>
                                        <td className="input-cell" colSpan={3}>{workers.length > 0 ? workers.map(w => `${w.first_name || ''} ${w.surname || ''}`.trim()).filter(Boolean).join(', ') : (summary.worker_names?.length > 0 ? summary.worker_names.join(', ') : '')}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Workers Count</td>
                                        <td className="input-cell numeric" colSpan={3}>{workers.length || summary.worker_count || ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="label-cell">Name Of Absent Labours</td>
                                        <td className="input-cell" colSpan={3}>{absentWorkerNames.length > 0 ? absentWorkerNames.join(', ') : (summary.absent_worker_names?.length > 0 ? summary.absent_worker_names.join(', ') : '')}</td>
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
                                                <td className="input-cell numeric">{fmt(mat.expected_usage)}</td>
                                                <td className="input-cell numeric">{fmt(mat.received || mat.total_received)}</td>
                                                <td className="input-cell numeric">{fmt(mat.total_used)}</td>
                                                <td className="input-cell numeric">{fmt(mat.returned || mat.total_returned)}</td>
                                                <td className="input-cell numeric">{fmt(mat.total_losses)}</td>
                                                <td className="input-cell numeric">{lossPercent ? `${lossPercent}%` : ''}</td>
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
                                                <span className="meter-value numeric">{co2Meters.start_reading_kg != null ? fmt(co2Meters.start_reading_kg, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Combi Reading:</span>
                                                <span className="meter-value numeric">{productionMeters.combi_reading != null ? fmt(productionMeters.combi_reading) : (co2Meters.combi_reading != null ? fmt(co2Meters.combi_reading) : (productionMeters.filler_reading != null ? fmt(productionMeters.filler_reading) : ''))}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">End up Reading (Kg):</span>
                                                <span className="meter-value numeric">{co2Meters.end_reading_kg != null ? fmt(co2Meters.end_reading_kg, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Shrink Reading:</span>
                                                <span className="meter-value numeric">{productionMeters.shrink_reading != null ? fmt(productionMeters.shrink_reading) : ''}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Difference in Balance:</span>
                                                <span className="meter-value numeric">{co2Meters.difference_in_balance != null ? fmt(co2Meters.difference_in_balance, 1) : (co2Meters.difference_in_balance_kg != null ? fmt(co2Meters.difference_in_balance_kg, 1) : (co2Meters.start_reading_kg != null && co2Meters.end_reading_kg != null ? fmt(co2Meters.end_reading_kg - co2Meters.start_reading_kg, 1) : ''))}</span>
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">Total CO2 Consumed (Kg):</span>
                                                <span className="meter-value numeric">{co2Meters.total_co2_consumed_kg != null ? fmt(co2Meters.total_co2_consumed_kg, 1) : ''}</span>
                                            </div>
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/l:</span>
                                                <span className="meter-value numeric">{co2Meters.co2_g_per_liter != null ? co2Meters.co2_g_per_liter : (co2Meters.co2_grams_per_liter != null ? co2Meters.co2_grams_per_liter : (co2Meters.total_co2_consumed_kg && summary.total_beverage_liters ? ((co2Meters.total_co2_consumed_kg * 1000) / summary.total_beverage_liters).toFixed(2) : ''))}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="meter-field">
                                                <span className="meter-label">CO2 g/Btl:</span>
                                                <span className="meter-value numeric">{co2Meters.co2_g_per_bottle != null ? co2Meters.co2_g_per_bottle : (co2Meters.co2_grams_per_bottle != null ? co2Meters.co2_grams_per_bottle : (co2Meters.total_co2_consumed_kg && displayTotalBottles ? ((co2Meters.total_co2_consumed_kg * 1000) / displayTotalBottles).toFixed(2) : ''))}</span>
                                            </div>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>

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
