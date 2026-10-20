import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Search, RotateCcw, Package, Layers, ArrowRight, Hash, SlidersHorizontal, Boxes, Building2, Warehouse, RefreshCw, Clock3, X, CheckCircle2, Eye } from 'lucide-react';
import { loadAllHandlingUnits, loadUnitsByDocumentCode, MAIN_WAREHOUSE_STAGE, STAGE_DETAILS_URL, STAGING_WAREHOUSE_STAGE } from '../../api/inventory';
import { getUnitsCache, hydrateUnitsCache, setUnitsCache } from '../../utils/unitsCache';
import { getUnitsSignature } from '../../utils/unitsSnapshot';
import { buildTransferId, getUpdatedAt, toDateKey, findTransfersById, getDocumentCode, getDocumentCodes, getSupervisorNames, groupUnitsIntoTransfers, normalizeTransferId } from '../../utils/transferUtils';
import TransferDetailModal from '../../components/post-production/TransferDetailModal';
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
const getSequence = (u) => {
    const seq = u.pet_sequence ?? u.sequence ?? u.sequence_number;
    return seq !== undefined && seq !== null && seq !== '' ? seq : '—';
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

// Cards are rendered in batches; a warehouse can hold hundreds of groups.
const CARD_BATCH_SIZE = 24;

// Today as a YYYY-MM-DD key (same UTC basis the cards use for their dates).
const todayKey = () => new Date().toISOString().split('T')[0];

const formatDate = (dateKey) =>
    dateKey && dateKey !== 'unknown'
        ? new Date(dateKey).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '—';

const TransferCard = React.memo(({ transfer: t, tone, activeTab, tabLabel, canSelect, detailsEnabled, targetLabel, selected, onOpen, onToggle, onDetails }) => {
    const pdCodes = activeTab !== 'transfer' ? getDocumentCodes(t.units) : [];
    const supervisors = activeTab !== 'transfer' ? getSupervisorNames(t.units) : { source: [], target: [] };
    return (
    <div className="col-xl-3 col-lg-4 col-md-6">
        <div
            className={`card h-100 transfer-group-card is-${tone} ${selected ? 'is-selected' : ''}`}
            role={canSelect ? 'button' : undefined}
            tabIndex={canSelect ? 0 : undefined}
            onClick={() => onOpen(t)}
            onKeyDown={(event) => {
                if (canSelect && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onOpen(t);
                }
            }}
        >
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center gap-2 min-w-0">
                        {canSelect && (
                            <input
                                type="checkbox"
                                className="form-check-input transfer-group-checkbox mt-0"
                                checked={selected}
                                onChange={() => onToggle(t)}
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
                        {activeTab === 'transfer' ? 'Production → Staging' : tabLabel}
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
                    {activeTab !== 'transfer' && (
                        <div className="d-flex justify-content-between">
                            <span className="text-muted fs-13">PD code</span>
                            <span className="fw-semibold fs-13" title={pdCodes.join(', ')}>
                                {pdCodes.length > 0 ? <code>{pdCodes[0]}</code> : '—'}
                            </span>
                        </div>
                    )}
                    {(supervisors.source.length > 0 || supervisors.target.length > 0) && (
                        <div className="fs-13 text-muted" title={`From ${supervisors.source.join(', ') || '—'} to ${supervisors.target.join(', ') || '—'}`}>
                            <span className="text-truncate d-block">
                                {supervisors.source.join(', ') || '—'} → {supervisors.target.join(', ') || '—'}
                            </span>
                        </div>
                    )}
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                        <span className="text-muted fs-13 d-flex align-items-center gap-1">
                            <Layers size={14} /> Total Pallets
                        </span>
                        <span className="badge bg-primary fs-13">{t.totalPallets}</span>
                    </div>
                </div>
                {activeTab !== 'transfer' && (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-primary w-100 mt-3 d-flex align-items-center justify-content-center gap-2"
                        disabled={!detailsEnabled}
                        onClick={(event) => { event.stopPropagation(); onDetails(t); }}
                        onKeyDown={(event) => event.stopPropagation()}
                    >
                        <Eye size={14} /> View details
                    </button>
                )}
                <div className="transfer-card-footer">
                    <span>{canSelect ? `Select pallets for ${targetLabel}` : 'Inventory group'}</span>
                    {canSelect && <ArrowRight size={15} />}
                </div>
            </div>
        </div>
    </div>
    );
});

const TransferCardSkeleton = ({ tone, showCheckbox }) => (
    <div className="col-xl-3 col-lg-4 col-md-6" aria-hidden="true">
        <div className={`card h-100 transfer-group-card transfer-skeleton-card is-${tone}`}>
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                        {showCheckbox && <span className="transfer-skeleton transfer-skeleton--check" />}
                        <span className="transfer-skeleton transfer-skeleton--badge" />
                    </div>
                    <span className="transfer-skeleton transfer-skeleton--status" />
                </div>
                <span className="transfer-skeleton transfer-skeleton--title" />
                <div className="d-flex flex-column gap-3 mt-4">
                    <span className="transfer-skeleton transfer-skeleton--row" />
                    <span className="transfer-skeleton transfer-skeleton--row" />
                    <span className="transfer-skeleton transfer-skeleton--row" />
                </div>
                <div className="transfer-card-footer">
                    <span className="transfer-skeleton transfer-skeleton--footer" />
                </div>
            </div>
        </div>
    </div>
);

const TransferExecution = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // Set by the transfer form after a completed transfer; shown once, then cleared from history.
    const [transferNotice, setTransferNotice] = useState(location.state?.transferNotice || null);
    useEffect(() => {
        if (location.state?.transferNotice) navigate(location.pathname, { replace: true, state: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Start from the shared session cache (if any) so the cards paint immediately.
    const initialCache = useRef(getUnitsCache()).current;
    const [loading, setLoading] = useState(!initialCache);
    const [units, setUnits] = useState(() => initialCache?.units || []);
    const [activeTab, setActiveTab] = useState('transfer');
    const [lastUpdated, setLastUpdated] = useState(() => initialCache?.fetchedAt || null);
    const [visibleCount, setVisibleCount] = useState(CARD_BATCH_SIZE);
    // `isComplete` = `units` holds every pallet. Grouping, selection and details
    // need the full set, so they stay disabled until it is true.
    const [isComplete, setIsComplete] = useState(() => !!initialCache);
    const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: null });
    const [loadIssue, setLoadIssue] = useState('');
    const completeRef = useRef(!!initialCache);
    const loadSeqRef = useRef(0);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Look up any transfer (including completed ones) by Transfer ID
    const [lookupInput, setLookupInput] = useState('');
    const [lookupError, setLookupError] = useState('');
    const [lookupMatches, setLookupMatches] = useState([]);
    const [lookupDetail, setLookupDetail] = useState(null);
    const [lookupBusy, setLookupBusy] = useState(false);
    const [selectionGroup, setSelectionGroup] = useState(null);
    const [selectedUnitKeys, setSelectedUnitKeys] = useState(() => new Set());
    const [selectedGroupKeys, setSelectedGroupKeys] = useState(() => new Set());

    // The page starts on today's pallets; widen or clear the dates to see older ones.
    const [filters, setFilters] = useState({
        startDate: todayKey(),
        endDate: todayKey(),
        petName: '',
        transferId: '',
        productName: '',
    });
    // 'range' = start/end dates; 'single' = one date
    const [dateMode, setDateMode] = useState('range');

    const markComplete = (value) => {
        completeRef.current = value;
        setIsComplete(value);
    };

    // Loads pallets page by page (100 per request). The first page paints the cards
    // straight away and the rest stream in. When a complete snapshot is already on
    // screen (cache or earlier load) it stays untouched until the fresh load finishes.
    const fetchTransfers = async () => {
        const seq = ++loadSeqRef.current;
        const isCurrent = () => mountedRef.current && seq === loadSeqRef.current;
        const progressive = !completeRef.current;
        const collected = new Map();
        const addUnits = (items) => items.forEach((unit) => {
            const id = unit.id ?? unit.internal_id ?? getUnitKey(unit);
            collected.set(id || `row-${collected.size}`, unit);
        });

        setLoading(true);
        setLoadIssue('');
        setLoadProgress({ loaded: 0, total: null });
        try {
            // Fingerprint taken before loading: if the data changes meanwhile, the next visit
            // sees a different fingerprint and reloads.
            const signature = await getUnitsSignature();
            if (!isCurrent()) return;
            const result = await loadAllHandlingUnits({}, {
                isCancelled: () => !isCurrent(),
                onPage: (items, { total }) => {
                    if (!isCurrent()) return;
                    addUnits(items);
                    setLoadProgress({ loaded: collected.size, total });
                    if (progressive) setUnits(Array.from(collected.values()));
                },
            });
            if (result.cancelled || !isCurrent()) return;

            const list = Array.from(collected.values());
            const fetchedAt = new Date();
            const missing = result.total !== null && list.length < result.total;
            setUnits(list);
            setLastUpdated(fetchedAt);
            if (result.failedPages > 0 || missing) {
                markComplete(false);
                setLoadIssue(
                    result.total !== null
                        ? `Loaded ${list.length.toLocaleString()} of ${result.total.toLocaleString()} pallets. Some could not be loaded.`
                        : 'Some pallets could not be loaded.'
                );
            } else {
                setUnitsCache(list, fetchedAt, signature);
                markComplete(true);
            }
        } catch (error) {
            console.error('Failed to fetch transfers:', error);
            if (!isCurrent()) return;
            // Keep showing the previous snapshot if a refresh fails.
            if (!completeRef.current) setUnits([]);
            setLoadIssue('Could not load transfers. Check your connection and try again.');
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    // The handling-unit list endpoint does not support date/product/PET query
    // parameters, so the whole list is loaded once and all selection filters apply client-side.
    // It is kept in the session cache (and survives a page reload); on a later visit it is
    // only downloaded again when the per-stage counts show that the data changed. The
    // Refresh button always reloads.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const cached = getUnitsCache() || await hydrateUnitsCache();
            if (cancelled) return;
            if (!cached) {
                fetchTransfers();
                return;
            }
            if (!completeRef.current) {
                setUnits(cached.units);
                setLastUpdated(cached.fetchedAt);
                markComplete(true);
                setLoading(false);
            }
            const signature = await getUnitsSignature();
            if (cancelled) return;
            if (!signature || signature !== cached.signature) fetchTransfers();
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ----- Staging / Main Warehouse tabs -----
    // These stages can hold a very large number of pallets, so they are not taken from the
    // full list. Each tab loads only its own stage from the stage-details endpoint, scoped to
    // the selected dates ("date the pallet entered the stage") or to a Transfer ID / PD search.
    const [stageData, setStageData] = useState({ staging: null, main: null });
    const stageSeq = useRef({ staging: 0, main: 0 });
    const stageFetched = useRef({ staging: null, main: null });
    const [stageSearch, setStageSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setStageSearch(filters.transferId.trim()), 400);
        return () => clearTimeout(timer);
    }, [filters.transferId]);

    const stageQuery = () => {
        const { startDate, endDate } = filters;
        let days = [null];
        if (!stageSearch && startDate && endDate && startDate <= endDate) {
            const span = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
            if (span <= 31) {
                days = Array.from({ length: span }, (_, i) => {
                    const d = new Date(startDate);
                    d.setUTCDate(d.getUTCDate() + i);
                    return d.toISOString().split('T')[0];
                });
            }
        }
        return {
            days,
            serverDated: days[0] !== null,
            key: `${stageSearch}|${stageSearch ? '' : `${startDate}|${endDate}`}`,
        };
    };

    const fetchStage = async (tab) => {
        const query = stageQuery();
        const stageName = tab === 'main' ? MAIN_WAREHOUSE_STAGE : STAGING_WAREHOUSE_STAGE;
        const seq = ++stageSeq.current[tab];
        const isCurrent = () => mountedRef.current && seq === stageSeq.current[tab];
        const collected = new Map();
        const keep = stageFetched.current[tab] === query.key;
        let failedPages = 0;
        let total = 0;

        stageFetched.current[tab] = query.key;
        setStageData((prev) => ({
            ...prev,
            [tab]: {
                units: keep ? prev[tab]?.units || [] : [],
                total: keep ? prev[tab]?.total ?? null : null,
                serverDated: query.serverDated,
                loading: true,
                complete: false,
                error: '',
                progress: { loaded: 0, total: null },
            },
        }));

        try {
            const runDay = async (day) => {
                const result = await loadAllHandlingUnits(
                    { stage: stageName, ...(day ? { date: day } : {}), ...(stageSearch ? { search: stageSearch } : {}) },
                    {
                        url: STAGE_DETAILS_URL,
                        ordering: null,
                        isCancelled: () => !isCurrent(),
                        onPage: (items) => {
                            if (!isCurrent()) return;
                            items.forEach((unit) => collected.set(unit.id ?? unit.internal_id ?? getUnitKey(unit) ?? `row-${collected.size}`, unit));
                            setStageData((prev) => ({
                                ...prev,
                                [tab]: { ...prev[tab], units: Array.from(collected.values()), progress: { loaded: collected.size, total: null } },
                            }));
                        },
                    }
                );
                failedPages += result.failedPages;
                total += result.total ?? 0;
            };
            for (let i = 0; i < query.days.length; i += 4) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(query.days.slice(i, i + 4).map(runDay));
                if (!isCurrent()) return;
            }
            if (!isCurrent()) return;
            const list = Array.from(collected.values());
            setStageData((prev) => ({
                ...prev,
                [tab]: {
                    ...prev[tab],
                    units: list,
                    total: Math.max(total, list.length),
                    loading: false,
                    complete: failedPages === 0,
                    error: failedPages > 0 ? 'Some pallets could not be loaded.' : '',
                    progress: null,
                },
            }));
        } catch (error) {
            console.error(`Failed to load ${tab} warehouse:`, error);
            if (!isCurrent()) return;
            stageFetched.current[tab] = null;
            setStageData((prev) => ({
                ...prev,
                [tab]: { ...(prev[tab] || { units: [], total: null }), loading: false, complete: false, error: 'Could not load this warehouse. Check your connection and try again.', progress: null },
            }));
        }
    };

    // Load a warehouse tab when it is opened, or when its dates / search change.
    useEffect(() => {
        if (activeTab === 'transfer') return;
        const fetched = stageFetched.current[activeTab];
        if (fetched === stageQuery().key && !stageData[activeTab]?.error) return;
        fetchStage(activeTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, filters.startDate, filters.endDate, stageSearch]);

    const refreshActive = () => {
        if (activeTab === 'transfer') fetchTransfers();
        else {
            stageFetched.current[activeTab] = null;
            fetchStage(activeTab);
        }
    };

    const productionUnits = useMemo(() => units.filter((unit) => {
        const stage = getStage(unit);
        return stage !== STAGING_WAREHOUSE_STAGE && stage !== MAIN_WAREHOUSE_STAGE;
    }), [units]);

    const tabCounts = {
        transfer: productionUnits.length,
        staging: stageData.staging?.total ?? null,
        main: stageData.main?.total ?? null,
    };

    const tabUnits = useMemo(() => {
        if (activeTab === 'transfer') return productionUnits;
        const stage = stageData[activeTab];
        const list = stage?.units || [];
        // Without a server-side date, narrow by the date the pallet entered the stage.
        if (!stage || stage.serverDated || stageSearch) return list;
        return list.filter((unit) => {
            const moved = toDateKey(getUpdatedAt(unit));
            if (filters.startDate && (moved === 'unknown' || moved < filters.startDate)) return false;
            if (filters.endDate && (moved === 'unknown' || moved > filters.endDate)) return false;
            return true;
        });
    }, [activeTab, productionUnits, stageData, stageSearch, filters.startDate, filters.endDate]);

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

    // Aggregate the active tab's handling units by date + product + pet. Each transfer
    // document (PD code) is its own card, so two transfers of the same
    // product and PET line are never merged.
    const transfers = useMemo(() => {
        const map = {};
        tabUnits.forEach((u) => {
            const createdAt = getCreatedAt(u);
            const dateKey = createdAt ? new Date(createdAt).toISOString().split('T')[0] : 'unknown';
            const productName = getProductName(u);
            const petName = getPetName(u);
            const documentCode = getDocumentCode(u);
            const key = `${dateKey}||${productName}||${petName}||${documentCode}`;

            if (!map[key]) {
                map[key] = {
                    key,
                    dateKey,
                    productName,
                    petName,
                    transferId: buildTransferId(dateKey, productName, petName),
                    documentCode,
                    totalPallets: 0,
                    totalPacks: 0,
                    units: [],
                };
            }
            map[key].totalPallets += 1;
            map[key].totalPacks += getPacks(u);
            map[key].units.push(u);
        });
        return Object.values(map).sort((a, b) => (
            a.dateKey !== b.dateKey
                ? (a.dateKey < b.dateKey ? 1 : -1)
                : String(b.documentCode).localeCompare(String(a.documentCode))
        ));
    }, [tabUnits]);

    // Client-side filters that operate on aggregated transfers.
    const filteredTransfers = useMemo(() => {
        const norm = (v) => String(v || '').toLowerCase().trim();
        return transfers.filter((t) => {
            // Searching by Transfer ID / PD code looks across all dates.
            if (!filters.transferId && activeTab === 'transfer') {
                if (filters.startDate && (t.dateKey === 'unknown' || t.dateKey < filters.startDate)) return false;
                if (filters.endDate && (t.dateKey === 'unknown' || t.dateKey > filters.endDate)) return false;
            }
            if (filters.petName && norm(t.petName) !== norm(filters.petName)) return false;
            if (filters.productName && norm(t.productName) !== norm(filters.productName)) return false;
            if (filters.transferId && !norm(t.transferId).includes(norm(filters.transferId)) && !norm(t.documentCode).includes(norm(filters.transferId))) return false;
            return true;
        });
    }, [transfers, activeTab, filters.startDate, filters.endDate, filters.petName, filters.productName, filters.transferId]);

    // Start from the first batch whenever the tab or filters change.
    useEffect(() => {
        setVisibleCount(CARD_BATCH_SIZE);
    }, [activeTab, filters.startDate, filters.endDate, filters.petName, filters.productName, filters.transferId]);

    const visibleTransfers = useMemo(
        () => filteredTransfers.slice(0, visibleCount),
        [filteredTransfers, visibleCount]
    );

    const handleReset = () => {
        setFilters({
            startDate: todayKey(),
            endDate: todayKey(),
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

    // Details list exactly the pallets counted on the card (the ones in this warehouse tab),
    // so the numbers on the card and in the details always agree.
    const openTransferDetails = useCallback((card) => {
        setLookupDetail({ ...card, productionDate: card.dateKey });
    }, []);

    // A PD document number is looked up on the server: only the pallets moved under it come back.
    const lookupByDocumentCode = async (code) => {
        setLookupBusy(true);
        try {
            const collected = await loadUnitsByDocumentCode(code);
            if (collected.length === 0) {
                setLookupError(`No transfer found with document number "${code}".`);
                return;
            }
            const matches = groupUnitsIntoTransfers(collected).map((g) => ({ ...g, productionDate: g.dateKey }));
            if (matches.length === 1) setLookupDetail(matches[0]);
            else setLookupMatches(matches);
        } catch (error) {
            console.error('Document number lookup failed:', error);
            setLookupError('Could not search for the document number. Please try again.');
        } finally {
            setLookupBusy(false);
        }
    };

    const handleLookup = (e) => {
        if (e) e.preventDefault();
        setLookupError('');
        setLookupMatches([]);
        const wanted = normalizeTransferId(lookupInput);
        if (!wanted) {
            setLookupError('Enter a Transfer ID (TR…) or document number (PD…), for example TR260908-RUSH-P02.');
            return;
        }
        if (/^PD\d{6,}$/.test(wanted)) {
            lookupByDocumentCode(wanted);
            return;
        }
        if (loading && units.length === 0) {
            setLookupError('Transfers are still loading. Try again in a moment.');
            return;
        }
        const matches = findTransfersById(units, wanted).map((g) => ({ ...g, productionDate: g.dateKey }));
        if (matches.length === 0) {
            setLookupError(
                isComplete
                    ? `No transfer found with ID "${lookupInput.trim()}".`
                    : `No match yet for "${lookupInput.trim()}", but not all pallets are loaded. ${loading ? 'Try again once loading finishes.' : 'Use Refresh to reload them.'}`
            );
        } else if (matches.length === 1) {
            setLookupDetail(matches[0]);
        } else {
            setLookupMatches(matches);
        }
    };

    const totalPalletsAll = filteredTransfers.reduce((s, t) => s + t.totalPallets, 0);
    const selectedGroups = filteredTransfers.filter((transfer) => selectedGroupKeys.has(transfer.key));
    const selectedGroupPallets = selectedGroups.reduce((sum, transfer) => sum + transfer.totalPallets, 0);

    const activeFilterCount =
        (filters.startDate || filters.endDate ? 1 : 0) +
        (filters.petName ? 1 : 0) +
        (filters.productName ? 1 : 0) +
        (filters.transferId ? 1 : 0);

    const activeStage = activeTab === 'transfer' ? null : stageData[activeTab];
    const activeLoading = activeTab === 'transfer' ? loading : (!activeStage || activeStage.loading);
    const activeCount = activeTab === 'transfer' ? units.length : (activeStage?.units.length || 0);
    const activeComplete = activeTab === 'transfer' ? isComplete : !!activeStage?.complete;
    const activeIssue = activeTab === 'transfer' ? loadIssue : (activeStage?.error || '');
    const canSelectForTransfer = (activeTab === 'transfer' || activeTab === 'staging') && activeComplete;
    const isInitialLoading = activeLoading && activeCount === 0;
    const isStreaming = activeLoading && !activeComplete && activeCount > 0;
    const countSuffix = isStreaming ? '+' : '';
    const activeProgress = activeTab === 'transfer' ? loadProgress : (activeStage?.progress || { loaded: activeCount, total: null });
    const progressPct = activeProgress.total
        ? Math.min(100, Math.round((activeProgress.loaded / activeProgress.total) * 100))
        : null;
    const selectionTarget = activeTab === 'staging'
        ? { stage: MAIN_WAREHOUSE_STAGE, label: 'Main Warehouse', source: 'Staging Warehouse' }
        : { stage: STAGING_WAREHOUSE_STAGE, label: 'Staging Warehouse', source: 'Production' };

    const openSelection = useCallback((transfer) => {
        if (!canSelectForTransfer) return;
        setSelectionGroup(transfer);
        setSelectedUnitKeys(new Set());
    }, [canSelectForTransfer]);

    const toggleGroup = useCallback((transfer) => {
        if (!canSelectForTransfer) return;
        setSelectedGroupKeys((current) => {
            const next = new Set(current);
            if (next.has(transfer.key)) next.delete(transfer.key);
            else next.add(transfer.key);
            return next;
        });
    }, [canSelectForTransfer]);

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

    // Modal rows: ascending by sequence (grouped by PET line when several groups are combined).
    const selectionUnits = useMemo(() => {
        const units = selectionGroup?.units || [];
        const seqValue = (unit) => {
            const n = parseInt(unit.pet_sequence ?? unit.sequence ?? unit.sequence_number, 10);
            return Number.isNaN(n) ? Infinity : n;
        };
        return [...units].sort((a, b) => {
            const pet = String(getPetName(a)).localeCompare(String(getPetName(b)), undefined, { numeric: true, sensitivity: 'base' });
            if (pet !== 0) return pet;
            const sa = seqValue(a);
            const sb = seqValue(b);
            if (sa === sb) return 0;
            return sa < sb ? -1 : 1;
        });
    }, [selectionGroup]);

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

    // The selected pallets open directly on the transfer form, where the supervisors are
    // chosen, the form is printed and the transfer is completed.
    const continueWithSelection = () => {
        if (!selectionGroup || selectedUnitKeys.size === 0) return;
        const selectedUnits = selectionGroup.units.filter((unit) => selectedUnitKeys.has(getUnitKey(unit)));
        const dates = selectedUnits.map((u) => toDateKey(getCreatedAt(u))).filter((d) => d !== 'unknown').sort();
        navigate('/post-production/batch-print-transfer', {
            state: {
                fromTransferList: true,
                canExecute: true,
                date: selectionGroup.dateKey,
                startDate: selectionGroup.startDate || dates[0] || selectionGroup.dateKey,
                endDate: selectionGroup.endDate || dates[dates.length - 1] || selectionGroup.dateKey,
                productName: selectionGroup.productName === 'Multiple products' ? '' : selectionGroup.productName,
                petName: selectionGroup.petName === 'Multiple PET lines' ? '' : selectionGroup.petName,
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
                    <button className="btn btn-light transfer-refresh-btn" type="button" onClick={refreshActive} disabled={activeLoading}>
                        <RefreshCw size={15} className={activeLoading ? 'spinning' : ''} /> Refresh
                    </button>
                </div>
            </section>

            {/* Transfer lookup: searches every stage, including completed transfers */}
            <div className="card mb-3">
                <div className="card-body py-3">
                    <form className="d-flex flex-wrap align-items-center gap-2" onSubmit={handleLookup}>
                        <span className="fw-semibold d-flex align-items-center gap-2 me-2">
                            <Hash size={16} className="text-primary" /> Find a transfer
                        </span>
                        <div className="input-group input-group-sm" style={{ maxWidth: 440 }}>
                            <span className="input-group-text bg-light"><Search size={14} className="text-muted" /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Transfer ID or document no., e.g. TR260908-RUSH-P02"
                                aria-label="Transfer ID or document number"
                                value={lookupInput}
                                onChange={(e) => setLookupInput(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm d-flex align-items-center gap-2" disabled={lookupBusy}>
                            {lookupBusy ? <Loader2 size={14} className="spinning" /> : <Search size={14} />} View details
                        </button>
                        {(lookupInput || lookupError || lookupMatches.length > 0) && (
                            <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => { setLookupInput(''); setLookupError(''); setLookupMatches([]); }}
                            >
                                <X size={14} /> Clear
                            </button>
                        )}
                        <small className="text-muted">Searches pending and completed transfers in every warehouse.</small>
                    </form>
                    {lookupError && <div className="alert alert-warning py-2 px-3 mt-3 mb-0 fs-13">{lookupError}</div>}
                    {lookupMatches.length > 1 && (
                        <div className="mt-3">
                            <p className="fs-13 text-muted mb-2">{lookupMatches.length} transfers match. Choose one:</p>
                            <div className="list-group">
                                {lookupMatches.map((m) => (
                                    <button
                                        type="button"
                                        key={m.key}
                                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                        onClick={() => { setLookupDetail(m); setLookupMatches([]); }}
                                    >
                                        <span>{m.productName} · {m.petName} · {m.dateKey}</span>
                                        <span className="badge bg-soft-primary text-primary">{m.totalPallets} pallets</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {lookupDetail && (
                <TransferDetailModal
                    transfer={lookupDetail}
                    onClose={() => setLookupDetail(null)}
                    onOpenForm={() => navigate(`/post-production/batch-print-transfer?transfer_id=${encodeURIComponent(lookupDetail.transferId)}`)}
                />
            )}

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
                                {tabCounts[tab.id] === null
                                    ? <strong>—</strong>
                                    : (tab.id === 'transfer' && loading && units.length === 0)
                                        ? <span className="transfer-skeleton transfer-skeleton--count" aria-hidden="true" />
                                        : <strong>{tabCounts[tab.id].toLocaleString()}{tab.id === 'transfer' && loading && !isComplete ? '+' : ''}</strong>}
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
                                    <Layers size={13} /> {totalPalletsAll.toLocaleString()}{countSuffix} pallets
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
                                    {activeTab !== 'transfer' && <span className="text-lowercase fw-normal" title="Pallets are filtered by the date they entered this warehouse"> · moved in</span>}
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

            {isStreaming && (
                <div className="alert alert-info py-2 px-3 mb-3 fs-13" role="status">
                    <div className="d-flex align-items-center gap-2">
                        <RefreshCw size={14} className="spinning flex-shrink-0" />
                        <span>
                            Loading pallets
                            {activeProgress.total
                                ? ` — ${activeProgress.loaded.toLocaleString()} of ${activeProgress.total.toLocaleString()}`
                                : ` — ${activeProgress.loaded.toLocaleString()} so far…`}
                            Selecting and details unlock once everything is loaded.
                        </span>
                    </div>
                    {progressPct !== null && (
                        <div className="progress mt-2" style={{ height: 4 }}>
                            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
                        </div>
                    )}
                </div>
            )}

            {transferNotice && (() => {
                const n = transferNotice;
                const problems = (n.failedCount || 0) > 0 || !!n.documentIssue;
                const tone = !problems ? 'success' : (n.moved > 0 ? 'warning' : 'danger');
                return (
                    <div className={`alert alert-${tone} py-2 px-3 mb-3 fs-13 d-flex align-items-start justify-content-between gap-2`} role="status">
                        <div>
                            <div>
                                {problems ? <X size={15} className="me-1" /> : <CheckCircle2 size={15} className="me-1" />}
                                Transfer{n.transferId ? <> <strong>{n.transferId}</strong></> : ''}{' '}
                                {!problems ? 'completed' : (n.moved > 0 ? 'partly completed' : 'not completed')} — {n.moved}
                                {n.total ? ` of ${n.total}` : ''} pallet(s) moved to the {n.targetLabel}.
                                {n.documentCode && <> Document number <code>{n.documentCode}</code> saved.</>}
                                {!problems && (n.transferIds || []).slice(0, 3).map((id) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className="btn btn-outline-success btn-sm ms-2 py-0"
                                        onClick={() => navigate(`/post-production/batch-print-transfer?transfer_id=${encodeURIComponent(id)}`)}
                                    >
                                        Print form{n.transferIds.length > 1 ? ` ${id}` : ''}
                                    </button>
                                ))}
                            </div>
                            {n.documentIssue && (
                                <div className="mt-1"><strong>Document number not saved.</strong> {n.documentIssue}</div>
                            )}
                            {(n.failedCount || 0) > 0 && (
                                <ul className="mb-0 mt-1 ps-3">
                                    {n.failed.map((f, i) => (
                                        <li key={i}><code>{f.scan_value || '—'}</code> — {f.error || 'Unknown error'}</li>
                                    ))}
                                    {n.failedCount > n.failed.length && <li>…and {n.failedCount - n.failed.length} more</li>}
                                </ul>
                            )}
                            {n.withoutBarcode > 0 && <div className="mt-1">{n.withoutBarcode} pallet(s) had no barcode/RFID and were skipped.</div>}
                            {problems && <div className="mt-1">The list below shows where the pallets are now. Select the remaining ones to try again.</div>}
                        </div>
                        <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setTransferNotice(null)} />
                    </div>
                );
            })()}

            {!activeLoading && activeIssue && (
                <div className="alert alert-warning py-2 px-3 mb-3 fs-13 d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
                    <span>
                        {activeIssue}
                        {!activeComplete && ' Selecting and details stay disabled until all pallets are loaded.'}
                    </span>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={refreshActive}>Retry</button>
                </div>
            )}

            {/* Loading skeleton (first load with nothing cached) */}
            {isInitialLoading && (
                <div className="row g-3" role="status" aria-label={`Loading ${activeTabConfig.label.toLowerCase()}`}>
                    {Array.from({ length: 8 }).map((_, index) => (
                        <TransferCardSkeleton key={index} tone={activeTabConfig.tone} showCheckbox={canSelectForTransfer} />
                    ))}
                </div>
            )}

            {/* Transfer Summary Cards */}
            {filteredTransfers.length > 0 && (
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
                    {visibleTransfers.map((t) => (
                        <TransferCard
                            key={t.key}
                            transfer={t}
                            tone={activeTabConfig.tone}
                            activeTab={activeTab}
                            tabLabel={activeTabConfig.label}
                            canSelect={canSelectForTransfer}
                            detailsEnabled={activeComplete}
                            targetLabel={selectionTarget.label}
                            selected={selectedGroupKeys.has(t.key)}
                            onOpen={openSelection}
                            onToggle={toggleGroup}
                            onDetails={openTransferDetails}
                        />
                    ))}
                </div>
                {visibleTransfers.length < filteredTransfers.length && (
                    <div className="d-flex justify-content-center mt-3">
                        <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => setVisibleCount((count) => count + CARD_BATCH_SIZE)}
                        >
                            Show more ({filteredTransfers.length - visibleTransfers.length} remaining)
                        </button>
                    </div>
                )}
                </>
            )}

            {/* Empty state */}
            {!isInitialLoading && filteredTransfers.length === 0 && (
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
                            <span className="transfer-selection-count">{selectedUnitKeys.size} selected out of {selectionGroup.units.length}</span>
                        </div>

                        <div className="table-responsive transfer-selection-table-wrap">
                            <table className="table align-middle mb-0 transfer-selection-table">
                                <thead>
                                    <tr>
                                        <th aria-label="Select" />
                                        <th>Barcode / RFID</th>
                                        <th className="text-center">Sequence</th>
                                        <th>Product</th>
                                        <th>PET Line</th>
                                        <th className="text-end">Packs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectionUnits.map((unit) => {
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
                                                <td className="text-center fw-semibold">{getSequence(unit)}</td>
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
                                <span>out of {selectionGroup.units.length} pallet{selectionGroup.units.length === 1 ? '' : 's'} selected</span>
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
