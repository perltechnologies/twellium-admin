import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2,
    Calendar,
    Search,
    RotateCcw,
    Package,
    Layers,
    Boxes,
    Building2,
    RefreshCw,
    ArrowLeft,
    ArrowRight,
    Hash,
    Clock3,
    X,
    AlertCircle,
} from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { formatAndSortPets } from '../../utils/petUtils';
import { Pagination } from '../../components/ui/Pagination';
import './StagingWarehouse.css';

/**
 * Staging Warehouse
 * -----------------
 * Everything held in the WAREHOUSE ("Main Unit") stage — i.e. all pallets
 * added to the staging warehouse via completed Production Transfers.
 *
 * The units are grouped into cards (by date + product + PET line). Clicking a
 * card drills into the individual pallet records that make up that group.
 *
 * Data source: GET /inventory/handling-units/stage-details/?stage=WAREHOUSE
 */

const WAREHOUSE_STAGE = 'WAREHOUSE';

// Handling-unit records use varied field shapes across the API.
const getBarcode = (u) => u.current_barcode || u.barcode || '—';
const getProductName = (u) => u.product_name || u.product?.name || u.product || 'N/A';
const getPetName = (u) => u.pet_name || u.pet?.pet_name || u.pet?.name || u.pet || 'N/A';
const getQuantity = (u) =>
    parseInt(u.quantity, 10) ||
    parseInt(u.packs_per_pallet, 10) ||
    parseInt(u.total_packs, 10) ||
    parseInt(u.packs, 10) ||
    0;
const getTimestamp = (u) => u.updated_at || u.created_at || null;
const getDateKey = (u) => {
    const t = getTimestamp(u);
    return t ? new Date(t).toISOString().split('T')[0] : 'unknown';
};

// Build a stable, human-readable group ID from date + product + pet.
const buildGroupId = (dateKey, productName, petName) => {
    const d = dateKey && dateKey !== 'unknown' ? new Date(dateKey) : null;
    const datePart = d
        ? `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
        : '000000';
    const petPart = (String(petName).match(/\d+/)?.[0] || '0').padStart(2, '0');
    const prodPart = String(productName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PROD';
    return `WH${datePart}-${prodPart}-P${petPart}`;
};

const WarehouseCardSkeleton = () => (
    <div className="col-xl-3 col-lg-4 col-md-6" aria-hidden="true">
        <div className="card h-100 warehouse-group-card warehouse-skeleton-card">
            <div className="card-body">
                <div className="d-flex justify-content-between mb-4">
                    <span className="warehouse-skeleton warehouse-skeleton--badge" />
                    <span className="warehouse-skeleton warehouse-skeleton--status" />
                </div>
                <span className="warehouse-skeleton warehouse-skeleton--title" />
                <div className="warehouse-skeleton-rows mt-4">
                    <span /><span /><span /><span />
                </div>
            </div>
        </div>
    </div>
);

const StagingWarehouse = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [units, setUnits] = useState([]);
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [filters, setFilters] = useState({
        date: '',
        search: '',
        petName: '',
        productName: '',
    });

    // Currently drilled-into group (null = card grid view).
    const [selectedGroupKey, setSelectedGroupKey] = useState(null);

    // Pagination for the drill-down records view.
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

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
        } catch (err) {
            console.error('Failed to fetch dropdown data:', err);
        }
    };

    const fetchUnits = async () => {
        setLoading(true);
        setError('');
        try {
            const params = { stage: WAREHOUSE_STAGE, page_size: 1000 };
            if (filters.date) params.date = filters.date;
            if (filters.search) params.search = filters.search;

            const response = await inventoryApi.getStageDetails(params);
            const data = response.data?.data ?? response.data ?? [];
            const list = Array.isArray(data) ? data : data.details || data.results || [];
            setUnits(Array.isArray(list) ? list : []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch warehouse units:', err);
            setError('Could not load the staging warehouse. Please try again.');
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    // Debounced reload when server-side filters (date/search) change.
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUnits();
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.date, filters.search]);

    // Client-side filters for product / PET line.
    const filteredUnits = useMemo(() => {
        const norm = (v) => String(v || '').toLowerCase().trim();
        return units.filter((u) => {
            if (filters.petName && norm(getPetName(u)) !== norm(filters.petName)) return false;
            if (filters.productName && norm(getProductName(u)) !== norm(filters.productName)) return false;
            return true;
        });
    }, [units, filters.petName, filters.productName]);

    // Group units into cards by date + product + pet line.
    const groups = useMemo(() => {
        const map = {};
        filteredUnits.forEach((u) => {
            const dateKey = getDateKey(u);
            const productName = getProductName(u);
            const petName = getPetName(u);
            const key = `${dateKey}||${productName}||${petName}`;
            if (!map[key]) {
                map[key] = {
                    key,
                    dateKey,
                    productName,
                    petName,
                    groupId: buildGroupId(dateKey, productName, petName),
                    totalPallets: 0,
                    totalPacks: 0,
                    units: [],
                };
            }
            map[key].totalPallets += 1;
            map[key].totalPacks += getQuantity(u);
            map[key].units.push(u);
        });
        return Object.values(map).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
    }, [filteredUnits]);

    const selectedGroup = useMemo(
        () => groups.find((g) => g.key === selectedGroupKey) || null,
        [groups, selectedGroupKey]
    );

    // If the selected group disappears after a filter/refresh, return to the grid.
    useEffect(() => {
        if (selectedGroupKey && !selectedGroup) {
            setSelectedGroupKey(null);
        }
    }, [selectedGroupKey, selectedGroup]);

    const grandTotals = useMemo(() => {
        const totalPacks = filteredUnits.reduce((s, u) => s + getQuantity(u), 0);
        return { totalPallets: filteredUnits.length, totalPacks, totalGroups: groups.length };
    }, [filteredUnits, groups.length]);

    const paginatedRecords = useMemo(() => {
        if (!selectedGroup) return [];
        const start = (page - 1) * pageSize;
        return selectedGroup.units.slice(start, start + pageSize);
    }, [selectedGroup, page, pageSize]);

    const handleReset = () => {
        setFilters({ date: '', search: '', petName: '', productName: '' });
    };

    const openGroup = (key) => {
        setSelectedGroupKey(key);
        setPage(1);
    };

    const activeFilterCount =
        (filters.date ? 1 : 0) +
        (filters.search ? 1 : 0) +
        (filters.petName ? 1 : 0) +
        (filters.productName ? 1 : 0);
    const isInitialLoading = loading && !lastUpdated;

    const formatDate = (dateKey) =>
        dateKey && dateKey !== 'unknown'
            ? new Date(dateKey).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';

    const formatDateTime = (val) =>
        val ? new Date(val).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const handleRowClick = (barcode) => {
        if (barcode && barcode !== '—') {
            navigate(`/post-production/pallets/details/${barcode}`);
        }
    };

    // ----- Drill-down: individual records for the selected group -----
    if (selectedGroup) {
        return (
            <div className="staging-warehouse-page">
                <div className="warehouse-detail-header mb-4">
                    <div className="d-flex align-items-center gap-3 min-w-0">
                        <button
                            className="warehouse-back-btn"
                            onClick={() => setSelectedGroupKey(null)}
                            aria-label="Back to warehouse groups"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0">
                            <span className="warehouse-eyebrow">Warehouse group</span>
                            <h4 className="fw-bold mb-1 d-flex align-items-center gap-2 text-truncate">
                                {selectedGroup.groupId}
                            </h4>
                            <p className="text-muted mb-0 text-truncate">
                                {selectedGroup.productName} · {selectedGroup.petName} · {formatDate(selectedGroup.dateKey)}
                            </p>
                        </div>
                    </div>
                    <div className="warehouse-detail-totals">
                        <span className="warehouse-stat-pill warehouse-stat-pill--blue">
                            <Layers size={13} /> {selectedGroup.totalPallets.toLocaleString()} pallets
                        </span>
                        <span className="warehouse-stat-pill warehouse-stat-pill--green">
                            <Boxes size={13} /> {selectedGroup.totalPacks.toLocaleString()} packs
                        </span>
                    </div>
                </div>

                <div className="card border-0 warehouse-panel overflow-hidden">
                    <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-3 px-4">
                        <span className="fw-semibold d-flex align-items-center gap-2">
                            <Boxes size={16} className="text-muted" /> Individual Pallet Records
                        </span>
                        <span className="badge bg-soft-primary text-primary">{selectedGroup.units.length} items</span>
                    </div>
                    <div className="card-body p-0">
                        <div className="table-responsive">
                            <table className="table warehouse-table table-hover mb-0 align-middle">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Barcode</th>
                                        <th>RFID</th>
                                        <th className="text-end">Packs</th>
                                        <th>Added / Updated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRecords.map((u, idx) => {
                                        const barcode = getBarcode(u);
                                        return (
                                            <tr
                                                key={u.id || barcode || idx}
                                                onClick={() => handleRowClick(barcode)}
                                                style={{ cursor: barcode !== '—' ? 'pointer' : 'default' }}
                                            >
                                                <td className="text-muted">{(page - 1) * pageSize + idx + 1}</td>
                                                <td><code className="warehouse-barcode">{barcode}</code></td>
                                                <td>{u.rfid_number || '—'}</td>
                                                <td className="text-end">{getQuantity(u).toLocaleString()}</td>
                                                <td>{formatDateTime(getTimestamp(u))}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="fw-bold border-top">
                                        <td colSpan={3}>TOTAL</td>
                                        <td className="text-end">{selectedGroup.totalPacks.toLocaleString()}</td>
                                        <td>{selectedGroup.totalPallets.toLocaleString()} pallets</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {selectedGroup.units.length > 0 && (
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            totalCount={selectedGroup.units.length}
                            onPageChange={setPage}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setPage(1);
                            }}
                            pageSizeOptions={[10, 20, 50, 100]}
                            itemLabel="pallets"
                        />
                    )}
                </div>
            </div>
        );
    }

    // ----- Card grid view -----
    return (
        <div className="staging-warehouse-page">
            {/* Header */}
            <div className="warehouse-hero mb-4">
                <div className="warehouse-hero__content">
                    <div className="warehouse-hero__icon"><Building2 size={25} /></div>
                    <div>
                    <span className="warehouse-eyebrow">Post-production inventory</span>
                    <h3 className="fw-bold mb-1">Staging Warehouse</h3>
                    <p className="text-muted mb-0">
                        Track pallets in the Main Unit stage, grouped by production date, product and PET line.
                    </p>
                    </div>
                </div>
                <div className="warehouse-hero__actions">
                    {lastUpdated && (
                        <span className="warehouse-updated"><Clock3 size={14} /> Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    <button className="btn btn-primary d-flex align-items-center gap-2" onClick={fetchUnits} disabled={loading}>
                        {loading ? <Loader2 size={16} className="spinning" /> : <RefreshCw size={16} />} Refresh
                    </button>
                </div>
            </div>

            <div className="row g-3 mb-4">
                {[
                    { label: 'Warehouse groups', value: grandTotals.totalGroups, icon: Boxes, tone: 'blue' },
                    { label: 'Total pallets', value: grandTotals.totalPallets, icon: Layers, tone: 'violet' },
                    { label: 'Total packs', value: grandTotals.totalPacks, icon: Package, tone: 'green' },
                ].map(({ label, value, icon: Icon, tone }) => (
                    <div className="col-md-4" key={label}>
                        <div className="warehouse-summary-card" aria-busy={isInitialLoading}>
                            <span className={`warehouse-summary-card__icon warehouse-summary-card__icon--${tone}`}><Icon size={20} /></span>
                            <div><span>{label}</span>{isInitialLoading ? <i className="warehouse-skeleton warehouse-skeleton--metric" /> : <strong>{value.toLocaleString()}</strong>}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="card mb-4 border-0 warehouse-panel">
                <div className="card-header bg-transparent border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
                    <div className="d-flex align-items-center gap-2">
                        <span className="d-inline-flex align-items-center justify-content-center bg-soft-primary text-primary rounded" style={{ width: 32, height: 32 }}>
                            <Search size={16} />
                        </span>
                        <span className="fw-semibold">Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="badge bg-primary rounded-pill">{activeFilterCount} active</span>
                        )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
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
                        {/* Date */}
                        <div className="col-xl-3 col-lg-4 col-md-6">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>Date</label>
                            <div className="input-group warehouse-input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <Calendar size={15} className="text-muted" />
                                </span>
                                <input
                                    type="date"
                                    className="form-control border-start-0"
                                    aria-label="Filter by date"
                                    value={filters.date}
                                    onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* PET Line */}
                        <div className="col-xl-2 col-lg-3 col-md-6">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>PET Line</label>
                            <div className="input-group warehouse-input-group">
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
                        <div className="col-xl-3 col-lg-5 col-md-6">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>Product</label>
                            <div className="input-group warehouse-input-group">
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

                        {/* Search */}
                        <div className="col-xl-4 col-lg-6 col-md-6">
                            <label className="form-label text-muted fs-13 fw-semibold text-uppercase" style={{ letterSpacing: '.03em' }}>Search</label>
                            <div className="input-group warehouse-input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <Search size={15} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0"
                                    placeholder="Barcode, RFID, or product…"
                                    value={filters.search}
                                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                />
                                {filters.search && (
                                    <button className="btn btn-light border border-start-0" type="button" aria-label="Clear search" onClick={() => setFilters((f) => ({ ...f, search: '' }))}>
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && !loading && (
                <div className="warehouse-state warehouse-state--error">
                    <AlertCircle size={28} /><div><strong>Unable to load warehouse</strong><span>{error}</span></div>
                    <button className="btn btn-sm btn-outline-danger" onClick={fetchUnits}>Try again</button>
                </div>
            )}

            {/* Loading */}
            {isInitialLoading && (
                <div role="status" aria-live="polite" aria-label="Loading staging warehouse">
                    <div className="warehouse-loading-heading">
                        <div>
                            <span className="warehouse-skeleton warehouse-skeleton--heading" />
                            <span className="warehouse-skeleton warehouse-skeleton--subheading" />
                        </div>
                        <span className="warehouse-loading-label"><Loader2 size={16} className="spinning" /> Loading inventory…</span>
                    </div>
                    <div className="row g-3">
                        {Array.from({ length: 8 }).map((_, index) => <WarehouseCardSkeleton key={index} />)}
                    </div>
                </div>
            )}

            {loading && !isInitialLoading && (
                <div className="warehouse-refreshing" role="status" aria-live="polite">
                    <span className="warehouse-refreshing__track"><span /></span>
                    <span><RefreshCw size={14} className="spinning" /> Refreshing warehouse data…</span>
                </div>
            )}

            {/* Card Grid */}
            {!isInitialLoading && groups.length > 0 && (
                <div className="row g-3">
                    {groups.map((g) => (
                        <div className="col-xl-3 col-lg-4 col-md-6" key={g.key}>
                            <div
                                className="card h-100 warehouse-group-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => openGroup(g.key)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openGroup(g.key);
                                    }
                                }}
                                aria-label={`View ${g.groupId}, ${g.productName}`}
                            >
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <span className="warehouse-group-id">
                                            <Hash size={12} /> {g.groupId}
                                        </span>
                                        <span className="warehouse-status"><span /> Warehouse</span>
                                    </div>

                                    <h6 className="fw-bold mb-1 d-flex align-items-center gap-2" title={g.productName}>
                                        <Package size={16} className="text-muted" />
                                        <span className="text-truncate">{g.productName}</span>
                                    </h6>

                                    <div className="d-flex flex-column gap-2 mt-3">
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted fs-13">PET Line</span>
                                            <span className="fw-semibold fs-13">{g.petName}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted fs-13">Date</span>
                                            <span className="fw-semibold fs-13">{formatDate(g.dateKey)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <span className="text-muted fs-13">Total Packs</span>
                                            <span className="fw-semibold fs-13">{g.totalPacks.toLocaleString()}</span>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center pt-3 mt-1 border-top">
                                            <span className="text-muted fs-13 d-flex align-items-center gap-1">
                                                <Layers size={14} /> Total Pallets
                                            </span>
                                            <span className="warehouse-pallet-count">{g.totalPallets}</span>
                                        </div>
                                    </div>
                                    <div className="warehouse-card-link mt-3">View pallet records <ArrowRight size={15} /></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!loading && groups.length === 0 && !error && (
                <div className="warehouse-empty-state">
                    <span className="warehouse-empty-state__icon"><Search size={28} /></span>
                    <h5>No warehouse pallets found</h5>
                    <p>Try changing or clearing the selected filters.</p>
                    {activeFilterCount > 0 && <button className="btn btn-outline-primary btn-sm" onClick={handleReset}>Clear all filters</button>}
                </div>
            )}
        </div>
    );
};

export default StagingWarehouse;
