import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Loader2, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { productionApi } from '../../api/production';
import '../sign-off-forms/css/Sign-Off-Styles.css';

const STORAGE_KEY = 'productionRunByPetV2_filters';

const unwrapReport = (response) => {
    let value = response?.data ?? {};
    for (let index = 0; index < 4; index += 1) {
        if (value && typeof value === 'object' && !value.run && value.data && typeof value.data === 'object') value = value.data;
        else break;
    }
    return value && typeof value === 'object' ? value : {};
};

const firstValue = (source, keys, fallback = '') => {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== null && value !== undefined && value !== '') return value;
    }
    return fallback;
};

const formatValue = (value, unit = '') => {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    const displayed = Number.isFinite(numeric)
        ? numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })
        : String(value);
    return unit ? `${displayed} ${unit}` : displayed;
};

const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).split('T')[0]
        : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatProductionTime = (value) => {
    if (!value) return '';
    const text = String(value).trim();
    const timeMatch = text.match(/(?:^|T|\s)(\d{1,2}):(\d{2})/);
    return timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : text;
};

const compareBatchNumbers = (left, right) => {
    const leftNumber = parseInt(String(left).match(/\d+/)?.[0] ?? '', 10);
    const rightNumber = parseInt(String(right).match(/\d+/)?.[0] ?? '', 10);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) return leftNumber - rightNumber;
    return String(left).localeCompare(String(right), undefined, { numeric: true });
};

const productIdentity = (product) => String(firstValue(product, ['id', 'product_id', 'name', 'product_name']));
const productName = (product) => firstValue(product, ['product_name', 'name']);
const productFilterValue = (product) => String(firstValue(product, ['product_slug', 'slug', 'product_name', 'name', 'product_code', 'id', 'product_id']));

const belongsToProduct = (record, product) => {
    const recordId = firstValue(record, ['product_id', 'product']);
    const recordName = firstValue(record, ['product_name', 'name']);
    const selectedId = firstValue(product, ['id', 'product_id']);
    const selectedName = productName(product);
    return (recordId !== '' && selectedId !== '' && String(recordId) === String(selectedId))
        || (recordName !== '' && selectedName !== '' && recordName === selectedName);
};

const reportIdFor = (scope, run) => firstValue(scope, ['report_id', 'source_report_id', 'production_report_id'],
    firstValue(run, ['report_id', 'source_report_id', 'production_report_id', 'id']));

const ReadOnlyField = ({ value, align = 'right' }) => (
    <input className="form-control form-control-sm border-0 rounded-0 shadow-none" style={{
        minWidth: 48, height: '1.6rem', padding: '0.1rem 0.25rem', textAlign: align,
        backgroundColor: 'transparent', color: '#212529', fontSize: '0.85rem', fontWeight: 500,
    }} value={value ?? ''} readOnly />
);

const ManualEntryField = ({ label }) => (
    <input
        type="number"
        min="0"
        step="1"
        className="manual-entry-input"
        aria-label={`${label} manual entry`}
        placeholder=" "
        defaultValue=""
    />
);

const PersistedField = ({ value, field, reportId, type = 'number', unit, onSaved, onValueChange }) => {
    const normalized = value ?? '';
    const [inputValue, setInputValue] = useState(normalized);
    const [saving, setSaving] = useState(false);

    useEffect(() => setInputValue(normalized), [normalized]);

    const save = async () => {
        if (String(inputValue) === String(normalized)) return;
        if (!reportId) {
            toast.error('This response has no source report id, so the value cannot be saved.');
            return;
        }
        setSaving(true);
        try {
            await productionApi.updateReport(reportId, { [field]: inputValue === '' ? null : inputValue });
            toast.success('Report input saved');
            onSaved?.();
        } catch (error) {
            toast.error(error?.response?.data?.message || `Unable to save ${field.replaceAll('_', ' ')}`);
        } finally {
            setSaving(false);
        }
    };

    return <div className="d-flex align-items-center gap-1">
        <input type={type} step={type === 'number' ? '0.001' : undefined} min={type === 'number' ? 0 : undefined}
            className="form-control form-control-sm rounded-0 shadow-none"
            style={{ minWidth: type === 'date' ? 135 : (type === 'time' ? 100 : 76), height: '1.8rem', fontSize: '0.8rem' }}
            value={inputValue} disabled={saving} onChange={(event) => {
                setInputValue(event.target.value);
                onValueChange?.(event.target.value);
            }} onBlur={save} />
        {unit && <span className="text-nowrap" style={{ fontSize: '0.72rem' }}>{unit}</span>}
        {saving && <Loader2 size={13} className="spinning no-print" />}
    </div>;
};

const ProductionRunByPetV2 = () => {
    const stored = useMemo(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
    }, []);
    const [startDate, setStartDate] = useState(stored.startDate || '2026-08-28');
    const [endDate, setEndDate] = useState(stored.endDate || '2026-09-02');
    const [selectedPet, setSelectedPet] = useState(stored.selectedPet || '');
    const [selectedShift, setSelectedShift] = useState(stored.selectedShift || '');
    const [selectedProduct, setSelectedProduct] = useState(stored.selectedProduct || '');
    const [pets, setPets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [catalogReport, setCatalogReport] = useState(null);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [materialPieceWeights, setMaterialPieceWeights] = useState({ LABELS: '', SHRINK: '' });
    const requestSequence = useRef(0);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate, endDate, selectedPet, selectedShift, selectedProduct }));
    }, [startDate, endDate, selectedPet, selectedShift, selectedProduct]);

    useEffect(() => {
        const loadOptions = async () => {
            try {
                const [petResponse, shiftResponse] = await Promise.all([productionApi.getPets(), productionApi.getShifts()]);
                const petPayload = petResponse?.data?.data?.data ?? petResponse?.data?.data ?? petResponse?.data ?? [];
                const shiftPayload = shiftResponse?.data?.data?.data ?? shiftResponse?.data?.data ?? shiftResponse?.data ?? [];
                const petList = Array.isArray(petPayload) ? petPayload : petPayload.results || [];
                const shiftList = Array.isArray(shiftPayload) ? shiftPayload : shiftPayload.results || [];
                setPets(petList.filter((pet) => !pet.pet_name?.toLowerCase().includes('can')));
                setShifts(shiftList);
            } catch (loadError) {
                console.error('Unable to load product-report filter options', loadError);
            }
        };
        loadOptions();
    }, []);

    const reportParams = (product) => {
        const params = { start_date: startDate, end_date: endDate };
        if (selectedPet) params.pet = selectedPet;
        if (selectedShift) params.shift = selectedShift;
        if (product) params.product = product;
        return params;
    };

    const fetchReports = async () => {
        const requestId = requestSequence.current + 1;
        requestSequence.current = requestId;
        setLoading(true);
        setError('');
        try {
            const existingProducts = Array.isArray(catalogReport?.products) ? catalogReport.products : [];
            const existingSelection = existingProducts.find((product) => (
                productFilterValue(product) === selectedProduct || productIdentity(product) === selectedProduct
            ));
            const productQuery = existingSelection ? productFilterValue(existingSelection) : selectedProduct;
            const [catalogResponse, scopedResponse] = await Promise.all([
                productionApi.getSignOffProductReport(reportParams()),
                productQuery
                    ? productionApi.getSignOffProductReport(reportParams(productQuery))
                    : Promise.resolve(null),
            ]);
            if (requestSequence.current !== requestId) return;

            const catalogPayload = unwrapReport(catalogResponse);
            const nextProducts = Array.isArray(catalogPayload?.products) ? catalogPayload.products : [];
            const nextSelection = selectedProduct ? nextProducts.find((product) => (
                productFilterValue(product) === selectedProduct || productIdentity(product) === selectedProduct
            )) : null;

            setCatalogReport(catalogPayload);
            if (selectedProduct && !nextSelection) {
                setSelectedProduct('');
                setReport(catalogPayload);
            } else if (nextSelection && productFilterValue(nextSelection) !== selectedProduct) {
                // Migrate an older persisted internal id to the endpoint's product value.
                setSelectedProduct(productFilterValue(nextSelection));
                setReport(catalogPayload);
            } else {
                setReport(scopedResponse ? unwrapReport(scopedResponse) : catalogPayload);
            }
        } catch (fetchError) {
            if (requestSequence.current !== requestId) return;
            setCatalogReport(null);
            setReport(null);
            setError(fetchError?.response?.data?.message || fetchError?.message || 'Failed to load the product sign-off report.');
        } finally {
            if (requestSequence.current === requestId) setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, selectedPet, selectedShift, selectedProduct]);

    const run = report?.run || {};
    const products = useMemo(() => Array.isArray(catalogReport?.products) ? catalogReport.products : [], [catalogReport]);
    const selectedCatalogProduct = products.find((product) => (
        productFilterValue(product) === selectedProduct || productIdentity(product) === selectedProduct
    )) || null;
    const selectedProductData = (Array.isArray(report?.products)
        ? report.products.find((product) => productName(product) === productName(selectedCatalogProduct))
        : null) || selectedCatalogProduct;

    const reloadReport = fetchReports;

    const scope = selectedProductData || run;
    const productCalculations = selectedProductData && Array.isArray(report?.calculations?.products)
        ? report.calculations.products.find((entry) => belongsToProduct(entry, selectedProductData)) : null;
    const calculations = selectedProductData?.calculations || productCalculations || (!selectedProductData ? report?.calculations : {}) || {};
    const materials = useMemo(() => {
        const allMaterials = Array.isArray(report?.materials) ? report.materials : [];
        return selectedProductData
            ? (Array.isArray(selectedProductData.materials) ? selectedProductData.materials : allMaterials)
            : allMaterials;
    }, [report, selectedProductData]);

    useEffect(() => {
        const findMaterial = (...types) => materials.find((item) => (
            types.includes(String(firstValue(item, ['material_type', 'type', 'code'])).toUpperCase())
        )) || {};
        const labelMaterial = findMaterial('LABELS');
        const shrinkMaterial = findMaterial('SHRINK', 'SHRINKS', 'STRETCH_FILM');
        setMaterialPieceWeights({
            LABELS: firstValue(labelMaterial, ['label_weight_per_piece_g', 'weight_per_piece_g']),
            SHRINK: firstValue(shrinkMaterial, ['shrink_weight_per_piece_g', 'weight_per_piece_g']),
        });
    }, [materials]);
    const allDetails = Array.isArray(report?.production_details) ? report.production_details
        : (Array.isArray(report?.batches) ? report.batches : []);
    const productionDetails = selectedProductData ? allDetails.filter((item) => {
        const hasProductAssociation = firstValue(item, ['product_id', 'product', 'product_name', 'name']) !== '';
        return !hasProductAssociation || belongsToProduct(item, selectedProductData);
    }) : allDetails;
    const productionDates = selectedProductData
        ? (Array.isArray(selectedProductData.production_dates) ? selectedProductData.production_dates : [])
        : (Array.isArray(report?.production_dates) ? report.production_dates : (Array.isArray(run.production_dates) ? run.production_dates : []));
    const productMeters = selectedProductData && Array.isArray(report?.meters?.products)
        ? report.meters.products.find((entry) => belongsToProduct(entry, selectedProductData)) : null;
    const meters = selectedProductData ? (selectedProductData.meters || productMeters || report?.meters || {}) : (report?.meters || {});
    const co2 = meters.co2 || {};
    const productionMeters = meters.production || {};
    const downtimeSources = selectedProductData
        ? [selectedProductData.downtime, selectedProductData.downtime_breakdown, report?.downtime, report?.downtime_breakdown, selectedProductData, run]
        : [report?.downtime, report?.downtime_breakdown, run];
    const downtimeMetric = (keys, fallback = '') => {
        for (const source of downtimeSources) {
            const value = firstValue(source, keys);
            if (value !== '') return value;
        }
        return fallback;
    };
    const apiDowntimeCategories = downtimeSources.find((source) => Array.isArray(source?.categories))?.categories || [];
    const apiDowntimeRows = apiDowntimeCategories
        .filter((category) => !/^total$/i.test(String(firstValue(category, ['category_name', 'name'])).trim()))
        .map((category, index) => ({
            key: firstValue(category, ['category_id', 'id'], `downtime-${index}`),
            label: firstValue(category, ['category_name', 'downtime_category_name', 'name'], 'Unclassified Downtime'),
            minutes: firstValue(category, ['total_duration_mins', 'duration_minutes', 'total_minutes', 'minutes']),
        }));
    const flatDowntimeRows = [
        { key: 'planned', label: 'Total Planned Downtime', minutes: downtimeMetric(['total_planned_downtime_mins', 'planned_downtime_mins', 'planned_minutes']) },
        { key: 'mechanical', label: 'Total Mechanical Downtime', minutes: downtimeMetric(['total_mechanical_downtime_mins', 'mechanical_downtime_mins', 'mechanical_minutes']) },
        { key: 'unclassified', label: 'Unclassified Downtime', minutes: downtimeMetric(['total_unclassified_downtime_mins', 'unclassified_downtime_mins', 'unclassified_minutes']) },
    ];
    const hasFlatDowntime = flatDowntimeRows.some(({ minutes }) => minutes !== '');
    const downtimeRows = hasFlatDowntime ? flatDowntimeRows : apiDowntimeRows;
    const totalDowntimeMinutes = downtimeMetric(['total_downtime_minutes', 'total_minutes']);
    const workers = selectedProductData?.workers || report?.workers || {};
    const sourceReportId = reportIdFor(selectedProductData, run);
    const metric = (keys, fallback = '') => firstValue(scope, keys, firstValue(calculations, keys, fallback));
    const totalPacksValue = metric(['total_packs']);
    const totalPacks = Number(totalPacksValue);
    const materialFor = (...types) => materials.find((item) => types.includes(String(firstValue(item, ['material_type', 'type', 'code'])).toUpperCase())) || {};
    const preformsExpectedUsageValue = firstValue(materialFor('PREFORMS'), ['expected_to_be_used', 'expected_usage']);
    const preformsExpectedUsage = Number(preformsExpectedUsageValue);
    const selectedPetName = pets.find((pet) => String(pet.id) === String(selectedPet))?.pet_name || firstValue(run, ['pet_name', 'line_name']);
    const selectedShiftName = selectedShift
        ? (shifts.find((shift) => String(shift.id) === String(selectedShift))?.name
            || shifts.find((shift) => String(shift.id) === String(selectedShift))?.shift_name
            || 'All Shifts')
        : 'All Shifts';
    const productionStartTime = firstValue(run, ['production_start_time']);
    const productionEndTime = firstValue(run, ['production_end_time']);
    const totalBatches = new Set(
        productionDetails
            .map((detail) => String(firstValue(detail, ['batch_number', 'batch_no'])).trim())
            .filter(Boolean)
    ).size;
    const batchDetailGroups = new Map();
    productionDetails.forEach((detail) => {
        const date = firstValue(detail, ['date', 'production_date']);
        const batchNumber = String(firstValue(detail, ['batch_number', 'batch_no']));
        const key = `${date}||${batchNumber}`;
        if (!batchDetailGroups.has(key)) {
            batchDetailGroups.set(key, {
                date,
                batchNumber,
                products: new Set(),
                entries: [],
                tanks: new Set(),
                lines: new Set(),
                totalSyrupLiters: 0,
                totalBeverageLiters: 0,
                hasSyrupLiters: false,
                hasBeverageLiters: false,
            });
        }
        const group = batchDetailGroups.get(key);
        const product = firstValue(detail, ['product_name', 'name']);
        const tank = firstValue(detail, ['tank_number', 'tank_no']);
        const line = firstValue(detail, ['pet_name', 'line_name']);
        const syrupLiters = firstValue(detail, ['syrup_liters', 'syrup_used_l']);
        const beverageLiters = firstValue(detail, ['beverage_liters', 'total_beverage_liters']);
        const numericSyrupLiters = Number(syrupLiters);
        const numericBeverageLiters = Number(beverageLiters);
        if (product) group.products.add(product);
        if (tank) group.tanks.add(tank);
        if (line) group.lines.add(line);
        group.entries.push({ liters: syrupLiters, time: firstValue(detail, ['start_time', 'production_start_time']) });
        if (syrupLiters !== '' && Number.isFinite(numericSyrupLiters)) {
            group.totalSyrupLiters += numericSyrupLiters;
            group.hasSyrupLiters = true;
        }
        if (beverageLiters !== '' && Number.isFinite(numericBeverageLiters)) {
            group.totalBeverageLiters += numericBeverageLiters;
            group.hasBeverageLiters = true;
        }
    });
    const batchDetailRows = [...batchDetailGroups.values()]
        .map((group) => ({
            ...group,
            productionDetails: [...group.entries]
                .sort((left, right) => String(left.time).localeCompare(String(right.time)))
                .map((entry) => `${formatValue(entry.liters)}${entry.time ? ` (${formatProductionTime(entry.time)})` : ''}`)
                .join(', '),
        }))
        .sort((left, right) => compareBatchNumbers(left.batchNumber, right.batchNumber)
            || String(left.date).localeCompare(String(right.date)));
    const visibleBatchSyrupTotal = batchDetailRows.reduce((total, detail) => (
        detail.hasSyrupLiters ? total + detail.totalSyrupLiters : total
    ), 0);
    const visibleBatchBeverageTotal = batchDetailRows.reduce((total, detail) => (
        detail.hasBeverageLiters ? total + detail.totalBeverageLiters : total
    ), 0);

    const print = () => {
        const previousTitle = document.title;
        document.title = `Product Sign-Off - ${productName(selectedProductData) || 'All Products'} - ${startDate} to ${endDate}`;
        window.print();
        document.title = previousTitle;
    };

    const materialCell = (material, keys) => formatValue(firstValue(material, keys));
    const materialRows = [
        ['PREFORMS', 'Preforms Consumption', 'Pcs'],
        ['CLOSURES', 'Closure Consumption', 'Pcs'],
        ['LABELS', 'Label Consumption', 'kg'],
        ['SHRINK', 'Shrink Consumption', 'kg'],
    ];

    return <div className="page-wrapper"><div className="content">
        <div className="d-flex justify-content-between align-items-center mb-3 no-print">
            <div><h4 className="fw-bold mb-1">Product Report</h4><p className="text-muted mb-0">FP-DR-008-Rev.A | API-calculated product sign-off report</p></div>
            <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                <Calendar size={18} className="text-muted" />
                <input type="date" className="form-control form-control-sm" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={{ width: 145 }} />
                <span>to</span>
                <input type="date" className="form-control form-control-sm" value={endDate} onChange={(event) => setEndDate(event.target.value)} style={{ width: 145 }} />
                <select className="form-select form-select-sm" value={selectedPet} onChange={(event) => setSelectedPet(event.target.value)} style={{ width: 145 }}>
                    <option value="">All Lines</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.pet_name}</option>)}
                </select>
                <select className="form-select form-select-sm" value={selectedShift} onChange={(event) => setSelectedShift(event.target.value)} style={{ width: 145 }}>
                    <option value="">All Shifts</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name || shift.shift_name}</option>)}
                </select>
                <select className="form-select form-select-sm" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} style={{ width: 190 }}>
                    <option value="">All Products</option>{products.map((product) => <option key={productIdentity(product)} value={productFilterValue(product)}>{productName(product)}</option>)}
                </select>
                <button className="btn btn-primary d-flex align-items-center gap-2" onClick={print} disabled={loading || !report}><Printer size={18} /> Print Form</button>
            </div>
        </div>

        {loading && <div className="d-flex justify-content-center py-5"><Loader2 className="spinning text-primary" /><span className="ms-2">Loading report…</span></div>}
        {error && !loading && <div className="alert alert-danger">{error}</div>}

        {!loading && report && <div className="print-form-container product-sign-off-container"><div className="production-report-form product-sign-off-report">
            <div className="form-header">
                <div className="header-left"><img src="/logo.jpeg" alt="Twellium" className="print-logo" /><h5 className="company-name">TWELLIUM INDUSTRIAL COMPANY LTD.</h5><span style={{ fontSize: 11 }}>Title: Product Sign Off Report</span></div>
                <div className="header-center"><h4 className="report-title">{selectedPetName || 'ALL LINES'}</h4></div>
                <div className="header-right"><div className="header-info"><span className="doc-ref">FP-DR-008-Rev.A</span><span>Page 1 of 1</span></div></div>
            </div>
            <div className="active-filters-strip">
                <span><strong>Date:</strong> {formatDate(startDate)} TO {formatDate(endDate)}</span>
                <span><strong>Line:</strong> {selectedPetName || 'All Lines'}</span>
                <span><strong>Shift:</strong> {selectedShiftName}</span>
            </div>

            <table className="form-table report-summary-table"><tbody>
                <tr><td className="label-cell"><strong>Date</strong></td><td className="input-cell"><ReadOnlyField align="left" value={`${formatDate(startDate)} TO ${formatDate(endDate)}`} /></td><td className="label-cell"><strong>Line Speed</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(metric(['line_speed_bottles_per_hour', 'line_speed']))} /></td><td className="label-cell"><strong>Total Units</strong></td><td className="input-cell"><ManualEntryField label="Total Units" /></td></tr>
                <tr><td className="label-cell"><strong>Prod. Date(s)</strong></td><td className="input-cell" colSpan={5}><ReadOnlyField align="left" value={productionDates.map(formatDate).join(', ')} /></td></tr>
                <tr><td className="label-cell"><strong>Shift</strong></td><td className="input-cell"><ReadOnlyField align="left" value={selectedShiftName} /></td><td className="label-cell"><strong>Total Batches</strong></td><td className="input-cell numeric" colSpan={3}><ReadOnlyField value={totalBatches} /></td></tr>
            </tbody></table>

            <table className="form-table section-table product-details-table"><thead><tr className="section-header-row"><th colSpan={5}>Product Details</th></tr><tr className="sub-header-row"><th>Product</th><th>Bottle Size</th><th>Line Speed (BPH)</th><th>Bottles/Pack</th><th>Packs/Pallet</th></tr></thead><tbody>
                {(selectedProductData ? [selectedProductData] : products).map((product) => <tr key={productIdentity(product)}>
                    <td className="input-cell text-center">{productName(product)}</td>
                    <td className="input-cell numeric">{formatValue(firstValue(product, ['bottle_size', 'bottle_size_ml']))}</td>
                    <td className="input-cell numeric">{formatValue(firstValue(product, ['line_speed_bottles_per_hour', 'line_speed']))}</td>
                    <td className="input-cell numeric">{formatValue(firstValue(product, ['bottles_per_pack']))}</td>
                    <td className="input-cell numeric">{formatValue(firstValue(product, ['packs_per_pallet']))}</td>
                </tr>)}
            </tbody></table>

            <table className="form-table paired-metrics-table"><tbody><tr>
                <td className="label-cell"><strong>Total Btls/Hr</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(metric(['bottles_per_hour', 'total_bottles_per_hour', 'total_bottles_per_hr']))} /></td>
                <td className="label-cell"><strong>Efficiency</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(metric(['efficiency_percentage', 'efficiency', 'avg_efficiency']), metric(['efficiency_percentage', 'efficiency', 'avg_efficiency']) !== '' ? '%' : '')} /></td>
            </tr></tbody></table>

            <table className="form-table section-table production-metrics-table"><thead><tr className="section-header-row"><th colSpan={4}>Production</th></tr></thead><tbody><tr>
                <td className="label-cell"><strong>Yield</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(metric(['yield_percentage', 'yield', 'syrup_yield', 'avg_syrup_yield']), metric(['yield_percentage', 'yield', 'syrup_yield', 'avg_syrup_yield']) !== '' ? '%' : '')} /></td>
                <td className="label-cell"><strong>Total Pack</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(metric(['total_packs']))} /></td>
            </tr></tbody></table>

            <table className="form-table section-table batch-details-table"><thead><tr className="section-header-row"><th colSpan={7}>Batch Details</th></tr><tr className="sub-header-row"><th>Date</th><th>Batch No.</th><th>Product</th><th>Production Details</th><th>Syrup Liters</th><th>Tank / Line</th><th>Beverage (L)</th></tr></thead><tbody>
                {batchDetailRows.length ? batchDetailRows.map((detail) => <tr key={`${detail.date}-${detail.batchNumber}`}>
                    <td className="input-cell text-center">{formatDate(detail.date)}</td>
                    <td className="input-cell text-center">{detail.batchNumber}</td>
                    <td className="input-cell text-center">{[...detail.products].join(', ')}</td>
                    <td className="input-cell" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{detail.productionDetails}</td>
                    <td className="input-cell text-center">{detail.hasSyrupLiters ? formatValue(detail.totalSyrupLiters) : ''}</td>
                    <td className="input-cell text-center">{[...detail.tanks].join(', ')}{detail.tanks.size && detail.lines.size ? ' / ' : ''}{[...detail.lines].join(', ')}</td>
                    <td className="input-cell text-center">{detail.hasBeverageLiters ? formatValue(detail.totalBeverageLiters) : ''}</td>
                </tr>) : <tr><td colSpan={7} className="text-center py-2">No production details for this scope</td></tr>}
                {batchDetailRows.length > 0 && <tr className="batch-total-row">
                    <td className="label-cell"><strong>TOTAL</strong></td>
                    <td className="input-cell text-center"><strong>{formatValue(totalBatches)} batches</strong></td>
                    <td></td><td></td>
                    <td className="input-cell text-center"><strong>{formatValue(visibleBatchSyrupTotal)}</strong></td>
                    <td></td>
                    <td className="input-cell text-center"><strong>{formatValue(visibleBatchBeverageTotal)}</strong></td>
                </tr>}
            </tbody></table>

            <table className="form-table production-window-table"><tbody>
                <tr>
                    <td className="label-cell"><strong>Start Up Production</strong></td><td className="input-cell"><PersistedField type="time" value={productionStartTime} field="production_start_time" reportId={sourceReportId} onSaved={reloadReport} /></td>
                    <td className="label-cell"><strong>Shut Down Production</strong></td><td className="input-cell"><PersistedField type="time" value={productionEndTime} field="production_end_time" reportId={sourceReportId} onSaved={reloadReport} /></td>
                </tr>
                <tr>
                    <td className="label-cell"><strong>Total Production Hrs</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(metric(['total_production_hours', 'production_hours']))} /></td>
                    <td className="label-cell"><strong>Cumulative Stoppage Time/min</strong></td><td className="input-cell numeric"><ReadOnlyField value={formatValue(totalDowntimeMinutes)} /></td>
                </tr>
                <tr><td className="label-cell"><strong>Workers Count</strong></td><td className="input-cell numeric" colSpan={3}><ReadOnlyField value={firstValue(workers, ['worker_count', 'count'])} /></td></tr>
            </tbody></table>

            <table className="form-table section-table materials-table"><thead><tr className="section-header-row"><th colSpan={9}>Materials</th></tr><tr className="sub-header-row"><th>Material</th><th>Piece Weight</th><th>Unit</th><th>Expected to be use</th><th>Received</th><th>Used</th><th>Returned</th><th>Losses</th><th>Loss%</th></tr></thead><tbody>
                {materialRows.map(([type, label, defaultUnit]) => {
                    const material = materialFor(...(type === 'SHRINK' ? ['SHRINK', 'SHRINKS', 'STRETCH_FILM'] : [type]));
                    const isLabel = type === 'LABELS';
                    const isShrink = type === 'SHRINK';
                    const pieceWeight = materialPieceWeights[type];
                    const numericPieceWeight = Number(pieceWeight);
                    const usageBaseValue = isShrink ? totalPacksValue : preformsExpectedUsageValue;
                    const usageBase = isShrink ? totalPacks : preformsExpectedUsage;
                    const calculatedExpectedUsage = (isLabel || isShrink)
                        && pieceWeight !== ''
                        && usageBaseValue !== ''
                        && Number.isFinite(numericPieceWeight)
                        && Number.isFinite(usageBase)
                        ? (usageBase * numericPieceWeight) / 1000
                        : null;
                    const expectedUsage = (isLabel || isShrink)
                        ? (calculatedExpectedUsage === null ? '' : formatValue(calculatedExpectedUsage))
                        : materialCell(material, ['expected_to_be_used', 'expected_usage']);
                    const returnedValue = firstValue(material, ['returned', 'total_returned']);
                    const lossesValue = firstValue(material, ['losses', 'total_losses']);
                    const numericReturned = Number(returnedValue || 0);
                    const numericLosses = Number(lossesValue || 0);
                    const canReconcile = calculatedExpectedUsage !== null
                        && Number.isFinite(numericReturned)
                        && Number.isFinite(numericLosses);
                    const calculatedReceived = canReconcile ? calculatedExpectedUsage + numericLosses : null;
                    const calculatedUsed = canReconcile ? calculatedReceived - numericReturned : null;
                    const calculatedLossPercent = calculatedUsed > 0 ? (numericLosses / calculatedUsed) * 100 : null;
                    const receivedValue = (isLabel || isShrink) && canReconcile
                        ? formatValue(calculatedReceived)
                        : materialCell(material, ['received', 'total_received']);
                    const usedValue = (isLabel || isShrink) && canReconcile
                        ? formatValue(calculatedUsed)
                        : materialCell(material, ['used', 'total_used']);
                    const lossPercentValue = (isLabel || isShrink) && canReconcile
                        ? (calculatedLossPercent === null ? '' : formatValue(calculatedLossPercent, '%'))
                        : formatValue(firstValue(material, ['loss_percentage', 'loss_percent']), firstValue(material, ['loss_percentage', 'loss_percent']) !== '' ? '%' : '');
                    return <tr key={type}><td className="label-cell"><strong>{firstValue(material, ['material_name', 'material_type_display'], label)}</strong></td><td className="input-cell">
                        {(isLabel || isShrink) && <PersistedField value={pieceWeight} field={isLabel ? 'label_weight_per_piece_g' : 'shrink_weight_per_piece_g'} reportId={reportIdFor(material, scope) || sourceReportId} unit="g/piece" onSaved={reloadReport} onValueChange={(value) => setMaterialPieceWeights((current) => ({ ...current, [type]: value }))} />}
                    </td><td className="unit-cell text-center">{firstValue(material, ['unit'], defaultUnit)}</td><td className="input-cell numeric">{expectedUsage}</td><td className="input-cell numeric">{receivedValue}</td><td className="input-cell numeric">{usedValue}</td><td className="input-cell numeric">{materialCell(material, ['returned', 'total_returned'])}</td><td className="input-cell numeric">{materialCell(material, ['losses', 'total_losses'])}</td><td className="input-cell numeric">{lossPercentValue}</td></tr>;
                })}
            </tbody></table>

            <section className="meters-reading-section">
                <div className="meter-section-title">Meters Reading</div>
                <div className="meters-reading-grid">
                    <table className="form-table meter-reading-panel"><thead><tr className="sub-header-row"><th colSpan={2}>CO₂ Reading</th></tr></thead><tbody>
                        <tr><td className="label-cell"><strong>Start Up Reading</strong><span className="meter-unit">kg</span></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(co2, ['start_reading_kg', 'starting_co2_reading_kg']))} /></td></tr>
                        <tr><td className="label-cell"><strong>End Up Reading</strong><span className="meter-unit">kg</span></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(co2, ['end_reading_kg', 'ending_co2_reading_kg']))} /></td></tr>
                        <tr className="meter-total-row"><td className="label-cell"><strong>Total CO₂ Consumed</strong><span className="meter-unit">kg</span></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(co2, ['total_co2_consumed_kg']))} /></td></tr>
                        <tr><td className="label-cell"><strong>Standard CO₂ Consumption</strong><span className="meter-unit">kg</span></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(co2, ['standard_co2_consumption_kg', 'standard_co2_consumption']))} /></td></tr>
                        <tr><td className="label-cell"><strong>CO₂ Yield</strong><span className="meter-unit">%</span></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(co2, ['co2_yield_percentage', 'co2_yield_percent']), firstValue(co2, ['co2_yield_percentage', 'co2_yield_percent']) !== '' ? '%' : '')} /></td></tr>
                    </tbody></table>
                    <table className="form-table meter-reading-panel"><thead><tr className="sub-header-row"><th colSpan={2}>Production Reading</th></tr></thead><tbody>
                        <tr><td className="label-cell"><strong>Filler Reading</strong></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(productionMeters, ['filler_reading_total', 'total_filler_reading', 'filler_reading']))} /></td></tr>
                        <tr><td className="label-cell"><strong>Shrink Reading</strong></td><td className="input-cell"><ReadOnlyField align="center" value={formatValue(firstValue(productionMeters, ['shrink_reading_total', 'total_shrink_reading', 'shrink_reading']))} /></td></tr>
                    </tbody></table>
                </div>
            </section>

            <table className="form-table section-table downtime-table"><thead><tr className="section-header-row"><th colSpan={2}>Downtime</th></tr><tr className="sub-header-row"><th>Category</th><th>Duration (min)</th></tr></thead><tbody>
                {downtimeRows.map(({ key, label, minutes }) => <tr key={key}><td className="label-cell" style={{ width: '50%' }}><strong>{label}</strong></td><td className="input-cell numeric" style={{ width: '50%' }}><ReadOnlyField value={formatValue(minutes, minutes !== '' ? 'min' : '')} /></td></tr>)}
                <tr className="batch-total-row"><td className="label-cell" style={{ width: '50%' }}><strong>TOTAL</strong></td><td className="input-cell numeric" style={{ width: '50%' }}><ReadOnlyField value={formatValue(totalDowntimeMinutes, totalDowntimeMinutes !== '' ? 'min' : '')} /></td></tr>
            </tbody></table>

            <div className="sign-off-section"><div className="sign-off-row"><div className="sign-off-field"><label>Name:</label><div className="sign-line" /></div><div className="sign-off-field"><label>Issue Date:</label><div className="sign-line" /></div></div><div className="sign-off-row"><div className="sign-off-field"><label>Signature:</label><div className="sign-line" /></div></div></div>
        </div></div>}
    </div></div>;
};

export default ProductionRunByPetV2;
