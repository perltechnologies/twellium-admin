import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Search, RotateCcw, Package, Layers, ArrowRight, Hash, SlidersHorizontal, Boxes } from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { formatAndSortPets } from '../../utils/petUtils';

/**
 * Transfer Execution Page
 * ------------------------
 * Browse all Staging Unit -> Main Unit transfers as summary cards.
 * A "transfer" is the group of pallets (handling units) dispatched together,
 * grouped by transfer date + product + PET line (matching the single-document
 * BatchPrintTransfer form). Each card shows: Transfer ID, Product Name, Date,
 * PET Name, Total Pallets.
 */

// --- field accessors (handling unit records use varied shapes across the API) ---
const getProductName = (u) => u.product_name || u.product?.name || u.product || 'N/A';
const getPetName = (u) => u.pet_name || u.pet?.pet_name || u.pet?.name || u.pet || 'N/A';
const getCreatedAt = (u) => u.created_at || u.created || null;
const getPacks = (u) =>
    parseInt(u.quantity, 10) ||
    parseInt(u.packs_per_pallet, 10) ||
    parseInt(u.total_packs, 10) ||
    parseInt(u.packs, 10) ||
    0;

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
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        petName: '',
        transferId: '',
        productName: '',
    });
    // 'range' = start/end dates; 'single' = one date
    const [dateMode, setDateMode] = useState('range');

    useEffect(() => {
        fetchDropdownData();
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts({ page_size: 100 }),
            ]);
            setPets(formatAndSortPets(petsRes));
            const prodList =
                productsRes.data?.data?.data ||
                productsRes.data?.data ||
                productsRes.data?.results ||
                [];
            setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            const response = await inventoryApi.getBulkBarcodes(params);
            const data =
                response.data?.data?.data ||
                response.data?.data ||
                response.data?.results ||
                [];
            const list = Array.isArray(data) ? data : data.results || [];
            setUnits(list);
        } catch (error) {
            console.error('Failed to fetch transfers:', error);
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    // Debounced auto-load when server-side (date) filters change.
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTransfers();
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.startDate, filters.endDate]);

    // Aggregate handling units into transfers (date + product + pet).
    const transfers = useMemo(() => {
        const map = {};
        units.forEach((u) => {
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
                };
            }
            map[key].totalPallets += 1;
            map[key].totalPacks += getPacks(u);
        });
        return Object.values(map).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
    }, [units]);

    // Client-side filters that operate on aggregated transfers.
    const filteredTransfers = useMemo(() => {
        const norm = (v) => String(v || '').toLowerCase().trim();
        return transfers.filter((t) => {
            if (filters.petName && norm(t.petName) !== norm(filters.petName)) return false;
            if (filters.productName && norm(t.productName) !== norm(filters.productName)) return false;
            if (filters.transferId && !norm(t.transferId).includes(norm(filters.transferId))) return false;
            return true;
        });
    }, [transfers, filters.petName, filters.productName, filters.transferId]);

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

    const activeFilterCount =
        (filters.startDate || filters.endDate ? 1 : 0) +
        (filters.petName ? 1 : 0) +
        (filters.productName ? 1 : 0) +
        (filters.transferId ? 1 : 0);

    return (
        <div>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h4 className="fw-bold mb-1">Production Transfer</h4>
                    <p className="text-muted mb-0 d-flex align-items-center gap-2">
                        <span className="badge bg-soft-primary text-primary d-inline-flex align-items-center gap-1">
                            Staging Unit <ArrowRight size={12} /> Main Unit
                        </span>
                        Browse and search all production-to-main transfers
                    </p>
                </div>
                {loading && <Loader2 size={20} className="spinning text-primary" />}
            </div>

            {/* Filter Bar */}
            <div className="card mb-3 border-0 shadow-sm">
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
                                    <Boxes size={13} /> {filteredTransfers.length} transfers
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
                                    {pets.map((p) => (
                                        <option key={p.id} value={p.pet_name}>{p.label}</option>
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
                                    {products.map((p) => (
                                        <option key={p.id} value={p.name || p.product_name}>{p.name || p.product_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Transfer ID */}
                        <div className="col-xl-3 col-lg-6 col-md-4">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>Transfer ID</label>
                            <div className="input-group input-group-sm">
                                <span className="input-group-text bg-light border-end-0">
                                    <Search size={15} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Search by ID…"
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
                    <span className="ms-2 text-muted">Loading transfers…</span>
                </div>
            )}

            {/* Transfer Summary Cards */}
            {!loading && filteredTransfers.length > 0 && (
                <div className="row g-3">
                    {filteredTransfers.map((t) => (
                        <div className="col-xl-3 col-lg-4 col-md-6" key={t.key}>
                            <div
                                className="card h-100 shadow-sm transfer-card"
                                role="button"
                                onClick={() =>
                                    navigate('/post-production/batch-print-transfer', {
                                        state: {
                                            fromTransferList: true,
                                            date: t.dateKey,
                                            productName: t.productName,
                                            petName: t.petName,
                                        },
                                    })
                                }
                                style={{ cursor: 'pointer', transition: 'transform .12s ease, box-shadow .12s ease' }}
                            >
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <span className="badge bg-soft-primary text-primary d-inline-flex align-items-center gap-1">
                                            <Hash size={12} /> {t.transferId}
                                        </span>
                                        <span className="badge bg-soft-success text-success">Staging → Main</span>
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
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!loading && filteredTransfers.length === 0 && (
                <div className="text-center py-5">
                    <div className="text-muted mb-2">
                        <Search size={48} strokeWidth={1} />
                    </div>
                    <p className="text-muted mb-0">
                        No transfers match the selected filters. Adjust the date range or filters above.
                    </p>
                </div>
            )}
        </div>
    );
};

export default TransferExecution;
