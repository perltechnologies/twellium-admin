import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Search, RotateCcw, Package, Layers, ArrowRight, Hash, SlidersHorizontal, Boxes, Building2, Warehouse, RefreshCw, Clock3, X, CheckCircle2 } from 'lucide-react';
import { inventoryApi, MAIN_WAREHOUSE_STAGE, STAGING_WAREHOUSE_STAGE } from '../../api/inventory';
import './TransferExecution.css';

/**
 * Transfer Execution Page
 * ------------------------
 * Browse pending transfers and stock held across the staging and main
 * warehouses. Units are grouped by date + product + PET line.
 */

// --- field accessors (handling unit records use varied shapes across the API) ---
const getProductName = (u) => u.product_name || u.product?.name || u.product || 'N/A';
const getPetName = (u) => u.pet_name || u.pet?.pet_name || u.pet?.name || u.pet || 'N/A';
const getCreatedAt = (u) => u.created_at || u.created || null;
const getUnitKey = (u) => String(u.current_barcode || u.barcode || u.rfid_number || u.id || u.internal_id || '');
const getBarcode = (u) => u.current_barcode || u.barcode || u.rfid_number || '—';
const getStage = (u) => {
    const stage = u.current_status || u.current_stage || u.stage || '';
    return String(stage?.code || stage?.name || stage).trim().toUpperCase();
};
const getPacks = (u) =>
    parseInt(u.quantity, 10) ||
    parseInt(u.packs_per_pallet, 10) ||
    parseInt(u.total_packs, 10) ||
    parseInt(u.packs, 10) ||
    0;

const WAREHOUSE_TABS = [
    {
        id: 'transfer',
        label: 'Transfer Queue',
        description: 'Products waiting to be transferred from production',
        icon: ArrowRight,
        tone: 'amber',
    },
    {
        id: 'staging',
        label: 'Staging Warehouse',
        description: 'Products currently held in the staging warehouse',
        icon: Building2,
        tone: 'blue',
    },
    {
        id: 'main',
        label: 'Main Warehouse',
        description: 'Products already transferred to the main warehouse',
        icon: Warehouse,
        tone: 'green',
    },
];

// Build a stable, human-readable Transfer ID from date + product + pet.
// Mirrors the PDyymmddHHMM document-code style used on the transfer form.
const buildTransferId = (dateKey, productName, petName) => {
    const d = dateKey && dateKey !== 'unknown' ? new Date(dateKey) : null;
    const datePart = d
        ? `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
        : '000000';
    const petPart = (String(petName).match(/\d+/)?.[0] || '0').padStart(2, '0');
    const prodPart = String(productName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PROD';
    return `TR${datePart}-${prodPart}-P${petPart}`;
};

const TransferExecution = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [units, setUnits] = useState([]);
    const [activeTab, setActiveTab] = useState('transfer');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [selectionGroup, setSelectionGroup] = useState(null);
    const [selectedUnitKeys, setSelectedUnitKeys] = useState(() => new Set());
    const [selectedGroupKeys, setSelectedGroupKeys] = useState(() => new Set());

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        petName: '',
        transferId: '',
        productName: '',
    });
    // 'range' = start/end dates; 'single' = one date
    const [dateMode, setDateMode] = useState('range');

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const response = await inventoryApi.getBulkBarcodes();
            const data =
                response.data?.data?.data ||
                response.data?.data ||
                response.data?.results ||
                [];
            const list = Array.isArray(data) ? data : data.results || [];
            setUnits(list);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch transfers:', error);
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    // The handling-unit list endpoint does not support date/product/PET query
    // parameters, so load once and apply all selection filters client-side.
    useEffect(() => {
        fetchTransfers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tabCounts = useMemo(() => units.reduce((counts, unit) => {
        const stage = getStage(unit);
        if (stage === STAGING_WAREHOUSE_STAGE) counts.staging += 1;
        else if (stage === MAIN_WAREHOUSE_STAGE) counts.main += 1;
        else counts.transfer += 1;
        return counts;
    }, { transfer: 0, staging: 0, main: 0 }), [units]);

    const tabUnits = useMemo(() => units.filter((unit) => {
        const stage = getStage(unit);
        if (activeTab === 'staging') return stage === STAGING_WAREHOUSE_STAGE;
        if (activeTab === 'main') return stage === MAIN_WAREHOUSE_STAGE;
        return stage !== STAGING_WAREHOUSE_STAGE && stage !== MAIN_WAREHOUSE_STAGE;
    }), [units, activeTab]);

    const availablePets = useMemo(() => (
        [...new Set(tabUnits.map(getPetName).filter((name) => name && name !== 'N/A'))]
            .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }))
    ), [tabUnits]);

    const availableProducts = useMemo(() => (
        [...new Set(tabUnits.map(getProductName).filter((name) => name && name !== 'N/A'))]
            .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
    ), [tabUnits]);

    // A selection from one warehouse may not exist in another warehouse.
    useEffect(() => {
        setFilters((current) => ({ ...current, petName: '', productName: '' }));
        setSelectedGroupKeys(new Set());
    }, [activeTab]);

    const activeTabConfig = WAREHOUSE_TABS.find((tab) => tab.id === activeTab) || WAREHOUSE_TABS[0];
    const ActiveTabIcon = activeTabConfig.icon;

    // Aggregate the active tab's handling units by date + product + pet.
    const transfers = useMemo(() => {
        const map = {};
        tabUnits.forEach((u) => {
            const createdAt = getCreatedAt(u);
            const dateKey = createdAt ? new Date(createdAt).toISOString().split('T')[0] : 'unknown';
            const productName = getProductName(u);
            const petName = getPetName(u);
            const key = `${dateKey}||${productName}||${petName}`;

            if (!map[key]) {
                map[key] = {
                    key,
                    dateKey,
                    productName,
                    petName,
                    transferId: buildTransferId(dateKey, productName, petName),
                    totalPallets: 0,
                    totalPacks: 0,
                    units: [],
                };
            }
            map[key].totalPallets += 1;
            map[key].totalPacks += getPacks(u);
            map[key].units.push(u);
        });
        return Object.values(map).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
    }, [tabUnits]);

    // Client-side filters that operate on aggregated transfers.
    const filteredTransfers = useMemo(() => {
        const norm = (v) => String(v || '').toLowerCase().trim();
        return transfers.filter((t) => {
            if (filters.startDate && (t.dateKey === 'unknown' || t.dateKey < filters.startDate)) return false;
            if (filters.endDate && (t.dateKey === 'unknown' || t.dateKey > filters.endDate)) return false;
            if (filters.petName && norm(t.petName) !== norm(filters.petName)) return false;
            if (filters.productName && norm(t.productName) !== norm(filters.productName)) return false;
            if (filters.transferId && !norm(t.transferId).includes(norm(filters.transferId))) return false;
            return true;
        });
    }, [transfers, filters.startDate, filters.endDate, filters.petName, filters.productName, filters.transferId]);

    const handleReset = () => {
        setFilters({
            startDate: '',
            endDate: '',
            petName: '',
            transferId: '',
            productName: '',
        });
        setDateMode('range');
    };

    const handleDateModeChange = (mode) => {
        setDateMode(mode);
        // Clear date values when switching modes to avoid stale filters.
        setFilters((f) => ({ ...f, startDate: '', endDate: '' }));
    };

    const formatDate = (dateKey) =>
        dateKey && dateKey !== 'unknown'
            ? new Date(dateKey).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';

    const totalPalletsAll = filteredTransfers.reduce((s, t) => s + t.totalPallets, 0);
    const selectedGroups = filteredTransfers.filter((transfer) => selectedGroupKeys.has(transfer.key));
    const selectedGroupPallets = selectedGroups.reduce((sum, transfer) => sum + transfer.totalPallets, 0);

    const activeFilterCount =
        (filters.startDate || filters.endDate ? 1 : 0) +
        (filters.petName ? 1 : 0) +
        (filters.productName ? 1 : 0) +
        (filters.transferId ? 1 : 0);

    const canSelectForTransfer = activeTab === 'transfer' || activeTab === 'staging';
    const selectionTarget = activeTab === 'staging'
        ? { stage: MAIN_WAREHOUSE_STAGE, label: 'Main Warehouse', source: 'Staging Warehouse' }
        : { stage: STAGING_WAREHOUSE_STAGE, label: 'Staging Warehouse', source: 'Production' };

    const openSelection = (transfer) => {
        if (!canSelectForTransfer) return;
        setSelectionGroup(transfer);
        setSelectedUnitKeys(new Set());
    };

    const toggleGroup = (transfer) => {
        if (!canSelectForTransfer) return;
        setSelectedGroupKeys((current) => {
            const next = new Set(current);
            if (next.has(transfer.key)) next.delete(transfer.key);
            else next.add(transfer.key);
            return next;
        });
    };

    const toggleAllGroups = () => {
        const visibleKeys = filteredTransfers.map((transfer) => transfer.key);
        const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedGroupKeys.has(key));
        setSelectedGroupKeys(allVisibleSelected ? new Set() : new Set(visibleKeys));
    };

    const openBulkSelection = () => {
        const selectedGroups = filteredTransfers.filter((transfer) => selectedGroupKeys.has(transfer.key));
        const selectedUnits = selectedGroups.flatMap((transfer) => transfer.units);
        const dates = selectedGroups.map((transfer) => transfer.dateKey).filter((date) => date && date !== 'unknown').sort();
        if (selectedUnits.length === 0) return;

        setSelectionGroup({
            key: 'multi-group-selection',
            productName: selectedGroups.length === 1 ? selectedGroups[0].productName : 'Multiple products',
            petName: selectedGroups.length === 1 ? selectedGroups[0].petName : 'Multiple PET lines',
            dateKey: selectedGroups.length === 1 ? selectedGroups[0].dateKey : 'unknown',
            startDate: dates[0] || '',
            endDate: dates[dates.length - 1] || '',
            units: selectedUnits,
            selectedGroupCount: selectedGroups.length,
        });
        setSelectedUnitKeys(new Set(selectedUnits.map(getUnitKey).filter(Boolean)));
    };

    const closeSelection = () => {
        setSelectionGroup(null);
        setSelectedUnitKeys(new Set());
    };

    const toggleUnit = (unit) => {
        const key = getUnitKey(unit);
        if (!key) return;
        setSelectedUnitKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllUnits = () => {
        const selectableKeys = selectionGroup?.units.map(getUnitKey).filter(Boolean) || [];
        setSelectedUnitKeys((current) => (
            current.size === selectableKeys.length ? new Set() : new Set(selectableKeys)
        ));
    };

    const continueWithSelection = () => {
        if (!selectionGroup || selectedUnitKeys.size === 0) return;
        const selectedUnits = selectionGroup.units.filter((unit) => selectedUnitKeys.has(getUnitKey(unit)));
        navigate('/post-production/batch-print-transfer', {
            state: {
                fromTransferList: true,
                date: selectionGroup.dateKey,
                startDate: selectionGroup.startDate || selectionGroup.dateKey,
                endDate: selectionGroup.endDate || selectionGroup.dateKey,
                productName: selectionGroup.productName,
                petName: selectionGroup.petName,
                selectedUnits,
                selectedScanValues: selectedUnits.map(getUnitKey),
                targetStage: selectionTarget.stage,
                targetLabel: selectionTarget.label,
                sourceLabel: selectionTarget.source,
            },
        });
    };

    return (
        <div className="transfer-execution-page">
            <section className="transfer-hero mb-3">
                <div className="transfer-hero__content">
                    <span className="transfer-hero__icon"><ArrowRight size={24} /></span>
                    <div>
                        <span className="transfer-eyebrow">Post-production logistics</span>
                        <h3 className="fw-bold mb-1">Transfer &amp; Warehouse Control</h3>
                        <p className="mb-0">
                            <span className={`transfer-current-view is-${activeTabConfig.tone}`}>
                                <ActiveTabIcon size={13} /> {activeTabConfig.label}
                            </span>
                            {activeTabConfig.description}
                        </p>
                    </div>
                </div>
                <div className="transfer-hero__actions">
                    {lastUpdated && (
                        <span className="transfer-updated">
                            <Clock3 size={14} /> Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button className="btn btn-light transfer-refresh-btn" type="button" onClick={fetchTransfers} disabled={loading}>
                        <RefreshCw size={15} className={loading ? 'spinning' : ''} /> Refresh
                    </button>
                </div>
            </section>

            <div className="warehouse-tabs mb-3" role="tablist" aria-label="Warehouse views">
                {WAREHOUSE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`warehouse-tab is-${tab.tone} ${isActive ? 'is-active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="warehouse-tab__icon"><Icon size={18} /></span>
                            <span className="warehouse-tab__copy">
                                <strong>{tab.label}</strong>
                                <small>{tab.description}</small>
                            </span>
                            <span className="warehouse-tab__count">
                                <strong>{tabCounts[tab.id].toLocaleString()}</strong>
                                <small>pallets</small>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filter Bar */}
            <div className="card mb-3 transfer-filter-card">
                {/* Filter header: title + active count on the left, actions/summary on the right */}
                <div className="card-header bg-transparent border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="d-inline-flex align-items-center justify-content-center bg-soft-primary text-primary rounded" style={{ width: 32, height: 32 }}>
                            <SlidersHorizontal size={16} />
                        </span>
                        <span className="fw-semibold">Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="badge bg-primary rounded-pill">{activeFilterCount} active</span>
                        )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        {filteredTransfers.length > 0 && (
                            <>
                                <span className="badge bg-soft-primary text-primary d-inline-flex align-items-center gap-1 fs-13">
                                    <Boxes size={13} /> {filteredTransfers.length} {activeTab === 'transfer' ? 'transfers' : 'groups'}
                                </span>
                                <span className="badge bg-soft-success text-success d-inline-flex align-items-center gap-1 fs-13">
                                    <Layers size={13} /> {totalPalletsAll.toLocaleString()} pallets
                                </span>
                            </>
                        )}
                        <button
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                            onClick={handleReset}
                            disabled={activeFilterCount === 0}
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    </div>
                </div>

                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        {/* Date filter with Range / Single toggle */}
                        <div className="col-xl-4 col-lg-5 col-md-12">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <label className="form-label mb-0 text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>
                                    {dateMode === 'range' ? 'Date Range' : 'Single Date'}
                                </label>
                                <div className="btn-group btn-group-sm" role="group" aria-label="Date filter mode">
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${dateMode === 'range' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => handleDateModeChange('range')}
                                    >
                                        Range
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${dateMode === 'single' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => handleDateModeChange('single')}
                                    >
                                        Single
                                    </button>
                                </div>
                            </div>
                            {dateMode === 'range' ? (
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light border-end-0">
                                        <Calendar size={15} className="text-muted" />
                                    </span>
                                    <input
                                        type="date"
                                        className="form-control border-start-0"
                                        aria-label="Start date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                                    />
                                    <span className="input-group-text bg-light">–</span>
                                    <input
                                        type="date"
                                        className="form-control"
                                        aria-label="End date"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                                    />
                                </div>
                            ) : (
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light border-end-0">
                                        <Calendar size={15} className="text-muted" />
                                    </span>
                                    <input
                                        type="date"
                                        className="form-control border-start-0"
                                        aria-label="Single date"
                                        value={filters.startDate}
                                        onChange={(e) =>
                                            setFilters((f) => ({ ...f, startDate: e.target.value, endDate: e.target.value }))
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        {/* PET Line */}
                        <div className="col-xl-2 col-lg-3 col-md-4">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>PET Line</label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-end-0">
                                    <Layers size={15} className="text-muted" />
                                </span>
                                <select
                                    className="form-select border-start-0"
                                    value={filters.petName}
                                    onChange={(e) => setFilters((f) => ({ ...f, petName: e.target.value }))}
                                >
                                    <option value="">All PET Lines</option>
                                    {availablePets.map((petName) => (
                                        <option key={petName} value={petName}>{petName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Product */}
                        <div className="col-xl-3 col-lg-4 col-md-4">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>Product</label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-end-0">
                                    <Package size={15} className="text-muted" />
                                </span>
                                <select
                                    className="form-select border-start-0"
                                    value={filters.productName}
                                    onChange={(e) => setFilters((f) => ({ ...f, productName: e.target.value }))}
                                >
                                    <option value="">All Products</option>
                                    {availableProducts.map((productName) => (
                                        <option key={productName} value={productName}>{productName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Transfer ID */}
                        <div className="col-xl-3 col-lg-6 col-md-4">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>
                                {activeTab === 'transfer' ? 'Transfer ID' : 'Group ID'}
                            </label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-end-0">
                                    <Search size={15} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder={`Search ${activeTab === 'transfer' ? 'transfer' : 'group'} ID…`}
                                    value={filters.transferId}
                                    onChange={(e) => setFilters((f) => ({ ...f, transferId: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="d-flex justify-content-center align-items-center py-5">
                    <Loader2 size={32} className="text-primary spinning" />
                    <span className="ms-2 text-muted">Loading {activeTabConfig.label.toLowerCase()}…</span>
                </div>
            )}

            {/* Transfer Summary Cards */}
            {!loading && filteredTransfers.length > 0 && (
                <>
                {canSelectForTransfer && (
                    <div className={`transfer-bulk-bar mb-3 ${selectedGroups.length === 0 ? 'is-idle' : ''}`}>
                        <div className="transfer-bulk-bar__summary">
                            <label className="transfer-select-all mb-0" title="Select all visible transfer cards">
                                <input
                                    type="checkbox"
                                    className="form-check-input mt-0"
                                    checked={filteredTransfers.length > 0 && selectedGroups.length === filteredTransfers.length}
                                    onChange={toggleAllGroups}
                                />
                            </label>
                            <div>
                                <strong>
                                    {selectedGroups.length > 0
                                        ? `${selectedGroups.length} transfer card${selectedGroups.length === 1 ? '' : 's'} selected`
                                        : 'Select transfer cards'}
                                </strong>
                                <small>
                                    {selectedGroups.length > 0
                                        ? `${selectedGroupPallets} pallet${selectedGroupPallets === 1 ? '' : 's'} ready for review`
                                        : 'Choose one or more TR IDs, or select all visible cards'}
                                </small>
                            </div>
                        </div>
                        {selectedGroups.length > 0 && (
                            <div className="d-flex align-items-center gap-2">
                                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedGroupKeys(new Set())}>Clear</button>
                                <button type="button" className="btn btn-primary btn-sm d-flex align-items-center gap-2" onClick={openBulkSelection}>
                                    Transfer selected cards <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div className="row g-3">
                    {filteredTransfers.map((t) => (
                        <div className="col-xl-3 col-lg-4 col-md-6" key={t.key}>
                            <div
                                className={`card h-100 transfer-group-card is-${activeTabConfig.tone} ${selectedGroupKeys.has(t.key) ? 'is-selected' : ''}`}
                                role={canSelectForTransfer ? 'button' : undefined}
                                tabIndex={canSelectForTransfer ? 0 : undefined}
                                onClick={() => openSelection(t)}
                                onKeyDown={(event) => {
                                    if (canSelectForTransfer && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault();
                                        openSelection(t);
                                    }
                                }}
                            >
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="d-flex align-items-center gap-2 min-w-0">
                                            {canSelectForTransfer && (
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input transfer-group-checkbox mt-0"
                                                    checked={selectedGroupKeys.has(t.key)}
                                                    onChange={() => toggleGroup(t)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    title={`Select ${t.transferId}`}
                                                    aria-label={`Select transfer group ${t.transferId}`}
                                                />
                                            )}
                                            <span className="badge bg-soft-primary text-primary d-inline-flex align-items-center gap-1">
                                                <Hash size={12} /> {t.transferId}
                                            </span>
                                        </div>
                                        <span className="badge bg-soft-success text-success">
                                            {activeTab === 'transfer' ? 'Production → Staging' : activeTabConfig.label}
                                        </span>
                                    </div>

                                    <h6 className="fw-bold mb-1 d-flex align-items-center gap-2" title={t.productName}>
                                        <Package size={16} className="text-muted" />
                                        <span className="text-truncate">{t.productName}</span>
                                    </h6>

                                    <div className="d-flex flex-column gap-2 mt-3">
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted fs-13">PET Line</span>
                                            <span className="fw-semibold fs-13">{t.petName}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted fs-13">Date</span>
                                            <span className="fw-semibold fs-13">{formatDate(t.dateKey)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                                            <span className="text-muted fs-13 d-flex align-items-center gap-1">
                                                <Layers size={14} /> Total Pallets
                                            </span>
                                            <span className="badge bg-primary fs-13">{t.totalPallets}</span>
                                        </div>
                                    </div>
                                    <div className="transfer-card-footer">
                                        <span>{canSelectForTransfer ? `Select pallets for ${selectionTarget.label}` : 'Inventory group'}</span>
                                        {canSelectForTransfer && <ArrowRight size={15} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}

            {/* Empty state */}
            {!loading && filteredTransfers.length === 0 && (
                <div className="transfer-empty-state">
                    <span className={`transfer-empty-state__icon is-${activeTabConfig.tone}`}>
                        <ActiveTabIcon size={27} />
                    </span>
                    <h5>No products found</h5>
                    <p>No products in {activeTabConfig.label.toLowerCase()} match the selected filters.</p>
                    {activeFilterCount > 0 && (
                        <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleReset}>
                            <RotateCcw size={14} /> Clear filters
                        </button>
                    )}
                </div>
            )}

            {selectionGroup && (
                <div className="transfer-selection-backdrop" role="dialog" aria-modal="true" aria-labelledby="transfer-selection-title" onClick={closeSelection}>
                    <div className="transfer-selection-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="transfer-selection-header">
                            <span className="transfer-selection-header__icon"><Layers size={20} /></span>
                            <div className="flex-grow-1 min-w-0">
                                <span className="transfer-eyebrow text-primary">
                                    {selectionGroup.selectedGroupCount
                                        ? `${selectionGroup.selectedGroupCount} groups combined`
                                        : 'Choose pallets'}
                                </span>
                                <h5 id="transfer-selection-title" className="mb-1">Transfer to {selectionTarget.label}</h5>
                                <p className="mb-0">{selectionGroup.productName} · {selectionGroup.petName} · {formatDate(selectionGroup.dateKey)}</p>
                            </div>
                            <button type="button" className="transfer-selection-close" onClick={closeSelection} aria-label="Close selection">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="transfer-selection-toolbar">
                            <label className="form-check d-flex align-items-center gap-2 mb-0">
                                <input
                                    className="form-check-input mt-0"
                                    type="checkbox"
                                    checked={selectedUnitKeys.size > 0 && selectedUnitKeys.size === selectionGroup.units.length}
                                    onChange={toggleAllUnits}
                                />
                                <span className="fw-semibold">Select all {selectionGroup.units.length} pallets</span>
                            </label>
                            <span className="transfer-selection-count">{selectedUnitKeys.size} selected</span>
                        </div>

                        <div className="table-responsive transfer-selection-table-wrap">
                            <table className="table align-middle mb-0 transfer-selection-table">
                                <thead>
                                    <tr>
                                        <th aria-label="Select" />
                                        <th>Barcode / RFID</th>
                                        <th>Product</th>
                                        <th>PET Line</th>
                                        <th className="text-end">Packs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectionGroup.units.map((unit) => {
                                        const key = getUnitKey(unit);
                                        const isSelected = selectedUnitKeys.has(key);
                                        return (
                                            <tr key={key} className={isSelected ? 'is-selected' : ''} onClick={() => toggleUnit(unit)}>
                                                <td>
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleUnit(unit)}
                                                        onClick={(event) => event.stopPropagation()}
                                                        aria-label={`Select ${getBarcode(unit)}`}
                                                    />
                                                </td>
                                                <td><code>{getBarcode(unit)}</code></td>
                                                <td>{getProductName(unit)}</td>
                                                <td>{getPetName(unit)}</td>
                                                <td className="text-end fw-semibold">{getPacks(unit).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="transfer-selection-footer">
                            <div>
                                <strong>{selectedUnitKeys.size}</strong>
                                <span>pallet{selectedUnitKeys.size === 1 ? '' : 's'} selected</span>
                            </div>
                            <div className="d-flex gap-2">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeSelection}>Cancel</button>
                                <button type="button" className="btn btn-primary d-flex align-items-center gap-2" disabled={selectedUnitKeys.size === 0} onClick={continueWithSelection}>
                                    <CheckCircle2 size={16} /> Continue to transfer form
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransferExecution;
