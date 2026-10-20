import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, Loader2, Calendar, Search, CheckCircle2, UserCheck, ArrowLeft, FileText, Warehouse, RefreshCw, Package, Layers, X, Hash } from 'lucide-react';
import { inventoryApi, loadAllHandlingUnits, loadUnitsByDocumentCode, SAVE_TRANSFER_DOCUMENT, DOCUMENT_SAVING_OFF_MESSAGE, STAGING_WAREHOUSE_STAGE } from '../../api/inventory';
import { executeTransfer, SCAN_CHUNK_SIZE } from '../../utils/transferExecutor';
import { fetchSupervisors, supervisorLabel } from '../../utils/supervisors';
import { getUnitsSignature } from '../../utils/unitsSnapshot';
import { productionApi } from '../../api/production';
import { formatAndSortPets } from '../../utils/petUtils';
import { applyTransferToCache, clearUnitsCache, getUnitsCache, mergeUnitsIntoCache, setUnitsCacheSignature } from '../../utils/unitsCache';
import { Pagination } from '../../components/ui/Pagination';
import {
    DIRECTION_LABELS,
    buildDocumentCode,
    compareBySequence,
    findTransfersById,
    getDateKeyFromTransferId,
    toDateKey,
    getDocumentCode,
    getDocumentCodes,
    getSupervisorNames,
    getSupervisors,
    getSequence,
    getStampTypes,
    groupUnitsIntoTransfers,
    getStage,
    getTransferRoute,
    getUnitDirection,
    normalizeTransferId,
} from '../../utils/transferUtils';

// A shared pallet snapshot younger than this is trusted when looking up a Transfer ID.
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

// Stable identity of a pallet: its id survives a stage change, a barcode may not.
const unitId = (u) => String(u.id ?? u.internal_id ?? u.current_barcode ?? u.barcode ?? u.rfid_number ?? '');
const scanValueOf = (u) => u.current_barcode || u.barcode || u.rfid_number || '';

const BatchPrintTransfer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // The page can be opened from the Production Transfer list (navigation
    // state), or directly: use the Transfer ID finder to load a transfer.
    const transferState = location.state || {};
    const initialLocked = Array.isArray(transferState.selectedUnits) && transferState.selectedUnits.length > 0
        ? transferState.selectedUnits.map(unitId).filter(Boolean)
        : (Array.isArray(transferState.selectedScanValues) ? transferState.selectedScanValues : []);
    const defaultRoute = {
        targetStage: transferState.targetStage || STAGING_WAREHOUSE_STAGE,
        targetLabel: transferState.targetLabel || 'Staging Warehouse',
        sourceLabel: transferState.sourceLabel || 'Production',
    };
    const [route, setRoute] = useState(defaultRoute);
    const { targetStage, targetLabel, sourceLabel } = route;
    // Pallets locked to the loaded transfer (barcodes/RFIDs from the list, or unit ids from the finder)
    const [lockedValues, setLockedValues] = useState(initialLocked);
    const hasLockedSelection = lockedValues.length > 0;
    const sourceSupervisorLabel = `${sourceLabel} Supervisor`;
    const targetSupervisorLabel = `${targetLabel} Supervisor`;

    // Transfer ID finder
    const [finderInput, setFinderInput] = useState(searchParams.get('transfer_id') || '');
    const [finding, setFinding] = useState(false);
    const [finderError, setFinderError] = useState('');
    const [foundTransfer, setFoundTransfer] = useState(null); // { transferId, dateKey, productName, petName }
    const [finderMatches, setFinderMatches] = useState([]);
    const searchSeq = useRef(0);

    const printRef = useRef();
    const today = new Date().toISOString().split('T')[0];
    const [loading, setLoading] = useState(false);
    const [barcodes, setBarcodes] = useState(() => (
        Array.isArray(transferState.selectedUnits) ? transferState.selectedUnits : []
    ));
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);
    const [shifts] = useState([
        { id: 'DAY', name: 'DAY' },
        { id: 'NIGHT', name: 'NIGHT' },
    ]);

    const [filters, setFilters] = useState({
        startDate: transferState.startDate && transferState.startDate !== 'unknown'
            ? transferState.startDate
            : (transferState.date && transferState.date !== 'unknown' ? transferState.date : today),
        endDate: transferState.endDate && transferState.endDate !== 'unknown'
            ? transferState.endDate
            : (transferState.date && transferState.date !== 'unknown' ? transferState.date : today),
        productType: transferState.productName || '',
        petName: transferState.petName || '',
        shift: '',
    });

    // Transfer form editable fields
    const [singlePacks, setSinglePacks] = useState('');

    // Completing the transfer is only offered when the pallets were selected on the
    // Transfer Execution page (not when a saved transfer is opened to view or print).
    const [documentCode, setDocumentCode] = useState('');
    const [users, setUsers] = useState([]);
    const [productionSupervisor, setProductionSupervisor] = useState('');
    const [warehouseSupervisor, setWarehouseSupervisor] = useState('');
    const [completing, setCompleting] = useState(false);
    const [completeError, setCompleteError] = useState('');
    const [transferProgress, setTransferProgress] = useState(null);

    // ----- Tabs -----
    const [activeTab, setActiveTab] = useState('form'); // 'form' | 'warehouse'

    // ----- Main Warehouse stock tab -----
    const [whUnits, setWhUnits] = useState([]);
    const [whLoading, setWhLoading] = useState(false);
    const [whError, setWhError] = useState('');
    const [whSearch, setWhSearch] = useState('');
    const [whLoaded, setWhLoaded] = useState(false);
    const [whUpdatedAt, setWhUpdatedAt] = useState(null);
    const [whQuery, setWhQuery] = useState('');
    const [whPage, setWhPage] = useState(1);
    const [whPageSize, setWhPageSize] = useState(50);
    const [whTotal, setWhTotal] = useState(0);
    const [whServerPacks, setWhServerPacks] = useState(null);
    const [whClientPaging, setWhClientPaging] = useState(false);
    const whRequestId = useRef(0);
    const whFetched = useRef(null);

    useEffect(() => {
        fetchDropdownData();
        if (transferState.canExecute) {
            setDocumentCode(buildDocumentCode());
            fetchSupervisors().then(setUsers).catch((error) => console.error('Failed to load supervisors:', error));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts({ page_size: 100 }),
            ]);

            const allPets = formatAndSortPets(petsRes);
            setPets(allPets);

            const prodList = productsRes.data?.data?.data || productsRes.data?.data || productsRes.data?.results || [];
            setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    // Loads handling units page by page. With a locked selection it stops as soon as
    // every locked pallet has been found, so it rarely needs the whole list.
    // `stopBeforeDate` (YYYY-MM-DD) is for Transfer ID lookups: the list is newest first,
    // so once every page up to one containing older pallets has arrived, the rest cannot
    // hold the transfer. The shortcut switches itself off if the order is not respected.
    const fetchUnitList = async (lockedList = [], isStale = () => false, { stopBeforeDate = null } = {}) => {
        const wanted = new Set(lockedList.map(String));
        const matched = new Set();
        const collected = new Map();
        const pageRanges = new Map(); // page -> { min, max } of created dates
        let contiguous = 0;
        let prevMin = null;
        let orderBroken = false;
        let reachedDate = false;

        await loadAllHandlingUnits({}, {
            isCancelled: () => isStale() || reachedDate || (wanted.size > 0 && matched.size >= wanted.size),
            onPage: (items, { page }) => {
                items.forEach((unit) => {
                    collected.set(unitId(unit) || `row-${collected.size}`, unit);
                    if (wanted.size === 0) return;
                    const scan = String(scanValueOf(unit));
                    const id = String(unit.id ?? '');
                    if (wanted.has(scan)) matched.add(scan);
                    if (wanted.has(id)) matched.add(id);
                });
                if (!stopBeforeDate) return;
                const dates = items.map((u) => toDateKey(u.created_at || u.created)).filter((d) => d !== 'unknown');
                pageRanges.set(page, dates.length ? { min: dates.reduce((a, b) => (a < b ? a : b)), max: dates.reduce((a, b) => (a > b ? a : b)) } : null);
                while (pageRanges.has(contiguous + 1)) {
                    contiguous += 1;
                    const range = pageRanges.get(contiguous);
                    if (!range) continue;
                    if (prevMin !== null && range.max > prevMin) orderBroken = true;
                    prevMin = range.min;
                    if (!orderBroken && range.min < stopBeforeDate) reachedDate = true;
                }
            },
        });
        return Array.from(collected.values());
    };

    // Returns the filtered pallet list that is now on the form (or null if superseded / failed).
    const handleSearch = async ({ preserveCompletion = false } = {}) => {
        const seq = ++searchSeq.current;
        setLoading(true);
        try {
            const list = await fetchUnitList(lockedValues, () => seq !== searchSeq.current);
            mergeUnitsIntoCache(list);

            const norm = (value) => String(value || '').trim().toLowerCase();
            const scanValue = (unit) => String(unit.current_barcode || unit.barcode || unit.rfid_number || unit.id || unit.internal_id || '');
            const selectedSet = new Set(lockedValues.map(String));
            const filtered = list.filter((unit) => {
                if (selectedSet.size > 0) return selectedSet.has(scanValue(unit)) || selectedSet.has(String(unit.id ?? ''));

                const created = unit.created_at || unit.created;
                const dateKey = created ? new Date(created).toISOString().split('T')[0] : 'unknown';
                const product = unit.product_name || unit.product?.name || unit.product || '';
                const pet = unit.pet_name || unit.pet?.pet_name || unit.pet?.name || unit.pet || '';
                if (filters.startDate && (dateKey === 'unknown' || dateKey < filters.startDate)) return false;
                if (filters.endDate && (dateKey === 'unknown' || dateKey > filters.endDate)) return false;
                if (filters.productType && norm(product) !== norm(filters.productType)) return false;
                if (filters.petName && norm(pet) !== norm(filters.petName)) return false;
                if (filters.shift && norm(unit.shift) !== norm(filters.shift)) return false;
                return true;
            });

            if (seq !== searchSeq.current) return null; // a newer search/finder result superseded this one
            setBarcodes(filtered);
            return filtered;
        } catch (error) {
            console.error('Failed to fetch barcodes:', error);
            // After a transfer, keep the form as it is rather than blanking it.
            if (seq === searchSeq.current && !preserveCompletion) setBarcodes([]);
            return null;
        } finally {
            if (seq === searchSeq.current) setLoading(false);
        }
    };

    // ----- Transfer ID finder -----
    const applyTransfer = (group) => {
        searchSeq.current += 1; // drop any in-flight search
        const lock = group.units
            .map((u) => String(u.id ?? u.internal_id ?? u.current_barcode ?? u.barcode ?? u.rfid_number ?? ''))
            .filter(Boolean);
        setLockedValues(lock);
        setRoute(getTransferRoute(group.units));
        setFoundTransfer({
            transferId: group.transferId,
            dateKey: group.dateKey,
            productName: group.productName,
            petName: group.petName,
        });
        setFilters((f) => ({
            ...f,
            startDate: group.dateKey !== 'unknown' ? group.dateKey : f.startDate,
            endDate: group.dateKey !== 'unknown' ? group.dateKey : f.endDate,
            productType: group.productName,
            petName: group.petName,
            shift: '',
        }));
        setBarcodes(group.units);
        setFinderMatches([]);
        setFinderError('');
        setLoading(false);
        setActiveTab('form');
    };

    const handleFindTransfer = async (value = finderInput) => {
        const wanted = normalizeTransferId(value);
        if (!wanted) {
            setFinderError('Enter a Transfer ID (TR…) or document number (PD…), for example TR260908-RUSH-P02.');
            return;
        }
        setFinding(true);
        setFinderError('');
        setFinderMatches([]);
        try {
            let matches = [];
            if (/^PD\d{6,}$/.test(wanted)) {
                // A document number finds the pallets moved under it.
                matches = groupUnitsIntoTransfers(await loadUnitsByDocumentCode(wanted));
                if (matches.length === 0) {
                    setFinderError(`No transfer found with document number "${String(value).trim()}". Check the number and try again.`);
                } else if (matches.length === 1) {
                    applyTransfer(matches[0]);
                } else {
                    setFinderMatches(matches);
                }
                return;
            }
            // 1. A recent shared snapshot (e.g. from the Transfer Analytics list) is instant.
            const cached = getUnitsCache();
            if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MAX_AGE_MS) {
                matches = findTransfersById(cached.units, wanted);
            }
            // 2. Otherwise load newest-first only back to the date inside the Transfer ID.
            const stopBeforeDate = getDateKeyFromTransferId(wanted);
            if (matches.length === 0 && stopBeforeDate) {
                matches = findTransfersById(await fetchUnitList([], () => false, { stopBeforeDate }), wanted);
            }
            // 3. Fall back to the full list.
            if (matches.length === 0) {
                matches = findTransfersById(await fetchUnitList(), wanted);
            }
            if (matches.length === 0) {
                setFinderError(`No transfer found with ID "${String(value).trim()}". Check the ID and try again.`);
            } else if (matches.length === 1) {
                applyTransfer(matches[0]);
            } else {
                setFinderMatches(matches);
            }
        } catch (error) {
            console.error('Failed to find transfer:', error);
            setFinderError('Could not search for the transfer. Please try again.');
        } finally {
            setFinding(false);
        }
    };

    const handleClearTransfer = () => {
        searchSeq.current += 1;
        setFoundTransfer(null);
        setFinderMatches([]);
        setFinderError('');
        setFinderInput('');
        setLockedValues([]);
        setRoute(defaultRoute);
        setBarcodes([]);
    };

    // Open directly from a link such as ?transfer_id=TR260908-RUSH-P02
    useEffect(() => {
        const idFromUrl = searchParams.get('transfer_id');
        if (idFromUrl) handleFindTransfer(idFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-load data when filters change
    // Skipped while a Transfer ID is being looked up or is loaded: its pallets are
    // already on the form, so reloading the whole list would only repeat the work.
    useEffect(() => {
        if (pets.length === 0 || products.length === 0) return;
        if (finding || foundTransfer) return;
        const timer = setTimeout(() => {
            handleSearch();
        }, 400);
        return () => clearTimeout(timer);
    }, [filters.startDate, filters.endDate, filters.productType, filters.petName, filters.shift, pets.length, products.length, finding]);

    const handleCompleteTransfer = async () => {
        setCompleteError('');
        if (!SAVE_TRANSFER_DOCUMENT) {
            setCompleteError(`Transfer not started. ${DOCUMENT_SAVING_OFF_MESSAGE}`);
            return;
        }
        if (!productionSupervisor || !warehouseSupervisor) {
            setCompleteError(`Select both a ${sourceSupervisorLabel} and a ${targetSupervisorLabel} before completing the transfer.`);
            return;
        }
        // Pallets already in the target stage need no move.
        const movable = barcodes.filter((b) => getStage(b) !== targetStage);
        if (movable.length === 0) {
            setCompleteError(`All ${barcodes.length} loaded pallet(s) are already in the ${targetLabel} — nothing to transfer.`);
            return;
        }
        const scanValues = [...new Set(movable.map(scanValueOf).filter(Boolean))];
        const withoutBarcode = movable.filter((b) => !scanValueOf(b)).length;
        if (scanValues.length === 0) {
            setCompleteError('None of the loaded pallets has a barcode or RFID to transfer.');
            return;
        }

        setCompleting(true);
        setTransferProgress({ done: 0, total: scanValues.length });
        let outcome;
        try {
            // Was the shared list up to date before this transfer? Then it can be patched
            // afterwards instead of being downloaded again.
            const cachedBefore = getUnitsCache();
            const signatureBefore = cachedBefore ? await getUnitsSignature() : null;
            const cacheWasFresh = !!signatureBefore && cachedBefore.signature === signatureBefore;

            outcome = await executeTransfer({
                scanValues,
                targetStage,
                documentCode,
                transferId: formTransferId,
                sourceSupervisor: productionSupervisor,
                targetSupervisor: warehouseSupervisor,
                onProgress: setTransferProgress,
            });
            setDocumentCode(outcome.documentCode);
            // Keep the shared list instead of reloading it: apply the moved pallets to it and
            // record the new fingerprint. If that is not possible, drop it.
            if (cacheWasFresh && outcome.succeeded && !outcome.documentIssue && outcome.failed.length === 0) {
                applyTransferToCache(outcome.succeeded, {
                    targetStage,
                    documentCode: outcome.documentCode,
                    sourceName: formSourceSupervisor,
                    targetName: formTargetSupervisor,
                    sourceId: Number(productionSupervisor),
                    targetId: Number(warehouseSupervisor),
                });
                const signatureAfter = await getUnitsSignature();
                if (signatureAfter) setUnitsCacheSignature(signatureAfter);
                else clearUnitsCache();
            } else {
                clearUnitsCache();
            }

            // Whatever the outcome, go back to the transfer list, which reports it and shows
            // the pallets as they now are.
            navigate('/post-production/transfer-execution', {
                state: {
                    transferNotice: {
                        moved: outcome.moved,
                        total: scanValues.length,
                        failed: outcome.failed.slice(0, 5),
                        failedCount: outcome.failed.length,
                        withoutBarcode,
                        documentIssue: outcome.documentIssue,
                        targetLabel,
                        transferId: formTransferId,
                        transferIds: formTransferId ? formTransferId.split(', ') : [],
                        documentCode: outcome.documentIssue ? '' : outcome.documentCode,
                    },
                },
            });
        } catch (error) {
            console.error('Failed to complete transfer:', error);
            setCompleteError(error?.response?.data?.message || error?.message || 'Could not complete the transfer. Please try again.');
        } finally {
            setTransferProgress(null);
            setCompleting(false);
        }
    };

    const handlePrint = () => {
        const prevTitle = document.title;
        const productLabel = filters.productType || 'All Products';
        document.title = `Transfer Form - ${productLabel} - ${filters.startDate}`;
        window.print();
        document.title = prevTitle;
    };

    // ----- Main Warehouse stock (WAREHOUSE / Main Unit stage) -----
    // Loads one page at a time from the server. If the API ignores paging and returns
    // everything in one go, the full list is kept and sliced in the browser instead.
    const fetchWarehouseStock = async ({ search = whQuery, page = whPage, size = whPageSize } = {}) => {
        const requestId = ++whRequestId.current;
        setWhLoading(true);
        setWhError('');
        try {
            const params = { stage: 'WAREHOUSE', page, page_size: size };
            if (search) params.search = search;
            const response = await inventoryApi.getStageDetails(params);
            if (requestId !== whRequestId.current) return;

            const body = response.data;
            const data = body?.data ?? body ?? [];
            const list = Array.isArray(data) ? data : data.details || data.results || [];
            const items = Array.isArray(list) ? list : [];
            const layers = [body, body?.data].filter((l) => l && typeof l === 'object' && !Array.isArray(l));
            const pick = (...keys) => {
                for (const layer of layers) {
                    for (const key of keys) {
                        const n = Number(layer[key]);
                        if (layer[key] !== null && layer[key] !== undefined && Number.isFinite(n)) return n;
                    }
                }
                return null;
            };
            const count = pick('count', 'total_count', 'total');
            const clientPaging = count === null && items.length > size;

            whFetched.current = { search, page, size, clientPaging };
            setWhClientPaging(clientPaging);
            setWhUnits(items);
            setWhTotal(count ?? items.length);
            setWhServerPacks(pick('total_packs', 'packs_total'));
            setWhUpdatedAt(new Date());
            setWhLoaded(true);
            setWhLoading(false);
        } catch (err) {
            if (requestId !== whRequestId.current) return;
            console.error('Failed to fetch main warehouse stock:', err);
            setWhError('Could not load the main warehouse stock. Please try again.');
            setWhUnits([]);
            setWhTotal(0);
            setWhLoading(false);
        }
    };

    // Debounced server-side search; a new search always starts from page 1.
    useEffect(() => {
        const timer = setTimeout(() => {
            setWhQuery(whSearch);
            setWhPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [whSearch]);

    // Fetch when the tab opens or the search / page / page size changes. Reopening the
    // tab or paging through an already loaded full list does not hit the server again.
    useEffect(() => {
        if (activeTab !== 'warehouse') return;
        const last = whFetched.current;
        if (last) {
            const sameQuery = last.search === whQuery;
            if (sameQuery && (last.clientPaging || (last.page === whPage && last.size === whPageSize))) return;
        }
        fetchWarehouseStock({ search: whQuery, page: whPage, size: whPageSize });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, whQuery, whPage, whPageSize]);

    const refreshWarehouseStock = () => {
        whFetched.current = null;
        fetchWarehouseStock({ search: whQuery, page: whPage, size: whPageSize });
    };

    const whGetBarcode = (u) => u.current_barcode || u.barcode || '—';
    const whGetProduct = (u) => u.product_name || u.product?.name || u.product || 'N/A';
    const whGetPet = (u) => u.pet_name || u.pet?.pet_name || u.pet?.name || u.pet || 'N/A';
    const whGetQty = (u) =>
        parseInt(u.quantity, 10) ||
        parseInt(u.packs_per_pallet, 10) ||
        parseInt(u.total_packs, 10) ||
        parseInt(u.packs, 10) ||
        0;
    const whGetTime = (u) => u.updated_at || u.created_at || null;
    const whPagedUnits = useMemo(() => {
        if (!whClientPaging) return whUnits;
        const start = (whPage - 1) * whPageSize;
        return whUnits.slice(start, start + whPageSize);
    }, [whUnits, whClientPaging, whPage, whPageSize]);
    const whPagePacks = whPagedUnits.reduce((s, u) => s + whGetQty(u), 0);
    // Total across all pages only when the server (or a fully loaded list) provides it.
    const whTotalPacks = whClientPaging ? whUnits.reduce((s, u) => s + whGetQty(u), 0) : whServerPacks;

    // Computed values
    const totalPallets = barcodes.length;
    const totalPacks = barcodes.reduce((sum, b) => sum + (parseInt(b.quantity) || parseInt(b.packs_per_pallet) || parseInt(b.total_packs) || 0), 0);
    const productName = filters.productType || barcodes[0]?.product_name || barcodes[0]?.product_type || '';
    const displayDate = filters.startDate === filters.endDate
        ? new Date(filters.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : `${new Date(filters.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${new Date(filters.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    // Stamp type(s) on the form; blank until the API returns it.
    const stampTypeLabel = useMemo(() => getStampTypes(barcodes).join(', '), [barcodes]);

    // Same order as the selection modal: ascending by sequence.
    const sortedBarcodes = useMemo(() => [...barcodes].sort(compareBySequence), [barcodes]);

    // Transfer ID(s) of the pallets on the form, printed so the transfer can be looked up later.
    const formTransferId = useMemo(() => {
        const ids = groupUnitsIntoTransfers(barcodes).map((g) => g.transferId);
        return [...new Set(ids)].join(', ');
    }, [barcodes]);

    // A transfer that has already happened (every pallet is in the target stage) carries the
    // PD code and supervisors that were saved with it: print those, not a fresh code.
    const savedDocument = useMemo(() => {
        if (barcodes.length === 0 || !barcodes.every((b) => getStage(b) === targetStage)) return null;
        const codes = getDocumentCodes(barcodes);
        if (codes.length !== 1) return null;
        const names = getSupervisorNames(barcodes);
        return { code: codes[0], source: names.source.join(', '), target: names.target.join(', ') };
    }, [barcodes, targetStage]);
    // Selected on the Transfer Execution page: the transfer can be completed from this form.
    const canExecute = !!transferState.canExecute && !foundTransfer;
    const findUser = (id) => users.find((u) => String(u.id) === String(id));
    const formDocumentCode = savedDocument?.code || (canExecute ? documentCode : '');
    const formSourceSupervisor = savedDocument?.source || (productionSupervisor && findUser(productionSupervisor) ? supervisorLabel(findUser(productionSupervisor)) : '');
    const formTargetSupervisor = savedDocument?.target || (warehouseSupervisor && findUser(warehouseSupervisor) ? supervisorLabel(findUser(warehouseSupervisor)) : '');

    // Details of the loaded transfer (live: updates after the transfer completes)
    const stageBreakdown = useMemo(() => {
        const counts = {};
        barcodes.forEach((b) => {
            const stage = getStage(b) || 'UNKNOWN';
            counts[stage] = (counts[stage] || 0) + 1;
        });
        return counts;
    }, [barcodes]);
    const directionBreakdown = useMemo(() => {
        const counts = {};
        barcodes.forEach((b) => {
            const d = getUnitDirection(b);
            counts[d] = (counts[d] || 0) + 1;
        });
        return counts;
    }, [barcodes]);

    return (
        <div>
            {/* Filter Controls - hidden on print */}
            <div className="no-print mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-3">
                        <button
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                            onClick={() => navigate('/post-production/transfer-execution')}
                            title="Back to Production Transfer"
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div>
                            <h4 className="fw-bold mb-1">Batch Print — Transfer Form</h4>
                            <p className="text-muted mb-0">{sourceLabel} to {targetLabel} transfer documentation</p>
                        </div>
                    </div>
                    <button
                        className="btn btn-primary d-flex align-items-center gap-2"
                        onClick={handlePrint}
                        disabled={loading || barcodes.length === 0}
                        style={{ visibility: activeTab === 'form' ? 'visible' : 'hidden' }}
                    >
                        <Printer size={18} />
                        Print Form
                    </button>
                </div>

                {/* Tabs */}
                <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                        <button
                            type="button"
                            className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'form' ? 'active' : ''}`}
                            onClick={() => setActiveTab('form')}
                        >
                            <FileText size={16} /> Transfer Form
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            type="button"
                            className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'warehouse' ? 'active' : ''}`}
                            onClick={() => setActiveTab('warehouse')}
                        >
                            <Warehouse size={16} /> Main Warehouse Stock
                            {whLoaded && (
                                <span className="badge bg-soft-primary text-primary ms-1">{whTotal.toLocaleString()}</span>
                            )}
                        </button>
                    </li>
                </ul>

                {activeTab === 'form' && (
                <>
                {/* Transfer ID finder */}
                <div className="card mb-3 border-0 shadow-sm">
                    <div className="card-body">
                        <label className="form-label fw-semibold d-flex align-items-center gap-2 mb-2">
                            <Hash size={16} className="text-primary" /> Find Transfer by ID or Document Number
                        </label>
                        <form
                            className="d-flex flex-wrap gap-2"
                            onSubmit={(e) => { e.preventDefault(); handleFindTransfer(); }}
                        >
                            <div className="input-group" style={{ maxWidth: 480 }}>
                                <span className="input-group-text bg-light"><Search size={15} className="text-muted" /></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Transfer ID or document no., e.g. TR260908-RUSH-P02"
                                    value={finderInput}
                                    onChange={(e) => setFinderInput(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={finding}>
                                {finding ? <Loader2 size={16} className="spinning" /> : <Search size={16} />} Find Transfer
                            </button>
                            {(foundTransfer || finderInput) && (
                                <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={handleClearTransfer}>
                                    <X size={16} /> Clear
                                </button>
                            )}
                        </form>
                        {finderError && <div className="alert alert-warning py-2 px-3 mt-3 mb-0 fs-13">{finderError}</div>}
                        {finderMatches.length > 1 && (
                            <div className="mt-3">
                                <p className="fs-13 text-muted mb-2">
                                    {finderMatches.length} transfers share this ID. Choose the one you want to load:
                                </p>
                                <div className="list-group">
                                    {finderMatches.map((m) => (
                                        <button
                                            type="button"
                                            key={m.key}
                                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                            onClick={() => applyTransfer(m)}
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

                {/* Loaded transfer details */}
                {foundTransfer && (
                    <div className="card mb-3 border-0 shadow-sm">
                        <div className="card-header bg-transparent d-flex align-items-center justify-content-between py-2">
                            <span className="fw-semibold d-flex align-items-center gap-2">
                                <Hash size={16} className="text-primary" /> Transfer {foundTransfer.transferId}
                            </span>
                            <span className="badge bg-soft-primary text-primary">{sourceLabel} → {targetLabel}</span>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-md-3"><small className="text-muted d-block">Product</small><strong>{foundTransfer.productName}</strong></div>
                                <div className="col-md-2"><small className="text-muted d-block">PET Line</small><strong>{foundTransfer.petName}</strong></div>
                                <div className="col-md-2">
                                    <small className="text-muted d-block">Production Date</small>
                                    <strong>{foundTransfer.dateKey !== 'unknown' ? new Date(foundTransfer.dateKey).toLocaleDateString('en-GB') : '—'}</strong>
                                </div>
                                <div className="col-md-2"><small className="text-muted d-block">Total Pallets</small><strong>{totalPallets.toLocaleString()}</strong></div>
                                <div className="col-md-3"><small className="text-muted d-block">Total Packs</small><strong>{totalPacks.toLocaleString()}</strong></div>
                                <div className="col-12">
                                    <small className="text-muted d-block mb-1">Current status of pallets</small>
                                    <div className="d-flex flex-wrap gap-2">
                                        {Object.entries(directionBreakdown).map(([dir, n]) => (
                                            <span key={dir} className="badge bg-light text-dark border">{DIRECTION_LABELS[dir]}: {n}</span>
                                        ))}
                                        {Object.entries(stageBreakdown).map(([stage, n]) => (
                                            <span key={stage} className="badge bg-soft-primary text-primary">{stage}: {n}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {hasLockedSelection && !foundTransfer && (
                    <div className="alert alert-primary d-flex align-items-center gap-2 py-2 px-3 mb-3">
                        <CheckCircle2 size={17} />
                        <span><strong>{lockedValues.length} selected pallet{lockedValues.length === 1 ? '' : 's'}</strong> loaded from the transfer card.</span>
                    </div>
                )}
                <div className="card">
                    <div className="card-body">
                        <div className="row g-3 align-items-end">
                            <div className="col-md-2">
                                <label className="form-label">Start Date</label>
                                <div className="d-flex align-items-center gap-1">
                                    <Calendar size={16} className="text-muted" />
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        value={filters.startDate}
                                        disabled={hasLockedSelection}
                                        onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">End Date</label>
                                <input
                                    type="date"
                                    className="form-control form-control-sm"
                                    value={filters.endDate}
                                    disabled={hasLockedSelection}
                                    onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Product</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.productType}
                                    disabled={hasLockedSelection}
                                    onChange={(e) => setFilters(f => ({ ...f, productType: e.target.value }))}
                                >
                                    <option value="">All Products</option>
                                    {hasLockedSelection && filters.productType && !products.some((p) => p.name === filters.productType) && (
                                        <option value={filters.productType}>{filters.productType}</option>
                                    )}
                                    {products.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Line</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.petName}
                                    disabled={hasLockedSelection}
                                    onChange={(e) => setFilters(f => ({ ...f, petName: e.target.value }))}
                                >
                                    <option value="">All Lines</option>
                                    {hasLockedSelection && filters.petName && !pets.some((p) => p.pet_name === filters.petName) && (
                                        <option value={filters.petName}>{filters.petName}</option>
                                    )}
                                    {pets.map(p => (
                                        <option key={p.id} value={p.pet_name}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Shift</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.shift}
                                    disabled={hasLockedSelection}
                                    onChange={(e) => setFilters(f => ({ ...f, shift: e.target.value }))}
                                >
                                    <option value="">All Shifts</option>
                                    {shifts.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2 d-flex align-items-center gap-2">
                                <button
                                    className="btn btn-success btn-sm d-flex align-items-center gap-2"
                                    onClick={handlePrint}
                                    disabled={loading || barcodes.length === 0}
                                >
                                    <Printer size={16} />
                                    Print
                                </button>
                                {loading && <Loader2 size={16} className="spinning text-muted" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results count */}
                {barcodes.length > 0 && (
                    <div className="d-flex align-items-center gap-3 mt-2">
                        <span className="badge bg-primary fs-13">{barcodes.length} pallets found</span>
                        <span className="text-muted fs-13">Total Packs: {totalPacks.toLocaleString()}</span>
                    </div>
                )}

                {/* Complete Transfer panel */}
                {canExecute && barcodes.length > 0 && (
                    <div className="card mt-3 border-0 shadow-sm">
                        <div className="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-2">
                            <span className="d-inline-flex align-items-center justify-content-center bg-soft-success text-success rounded" style={{ width: 32, height: 32 }}>
                                <UserCheck size={16} />
                            </span>
                            <span className="fw-semibold">Complete Transfer</span>
                        </div>
                        <div className="card-body">
                            <p className="text-muted fs-13 mb-3">
                                Select both supervisors, print this form and have it signed, then complete the transfer. The document number
                                {' '}<code>{documentCode}</code> and the supervisors are saved with it.
                            </p>
                            <div className="row g-3 align-items-end">
                                <div className="col-md-4">
                                    <label className="form-label">{sourceSupervisorLabel}</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={productionSupervisor}
                                        onChange={(e) => setProductionSupervisor(e.target.value)}
                                        disabled={completing || users.length === 0}
                                    >
                                        <option value="">{users.length === 0 ? 'No supervisors available' : 'Select supervisor…'}</option>
                                        {users.filter((u) => String(u.id) !== String(warehouseSupervisor)).map((u) => (
                                            <option key={u.id} value={u.id}>{supervisorLabel(u)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">{targetSupervisorLabel}</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={warehouseSupervisor}
                                        onChange={(e) => setWarehouseSupervisor(e.target.value)}
                                        disabled={completing || users.length === 0}
                                    >
                                        <option value="">{users.length === 0 ? 'No supervisors available' : 'Select supervisor…'}</option>
                                        {users.filter((u) => String(u.id) !== String(productionSupervisor)).map((u) => (
                                            <option key={u.id} value={u.id}>{supervisorLabel(u)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <button
                                        className="btn btn-success d-flex align-items-center justify-content-center gap-2 w-100"
                                        onClick={handleCompleteTransfer}
                                        disabled={completing}
                                    >
                                        {completing ? (
                                            <>
                                                <Loader2 size={16} className="spinning" />
                                                {transferProgress && transferProgress.total > SCAN_CHUNK_SIZE
                                                    ? ` Transferring ${Math.min(transferProgress.done + SCAN_CHUNK_SIZE, transferProgress.total)} / ${transferProgress.total}…`
                                                    : ' Transferring…'}
                                            </>
                                        ) : (
                                            <><CheckCircle2 size={16} /> Complete Transfer</>
                                        )}
                                    </button>
                                </div>
                            </div>
                            {completeError && (
                                <div className="alert alert-danger py-2 px-3 mt-3 mb-0 fs-13">{completeError}</div>
                            )}
                        </div>
                    </div>
                )}

                </>
                )}

                {/* Main Warehouse Stock tab */}
                {activeTab === 'warehouse' && (
                    <div className="warehouse-stock-tab">
                        {/* Toolbar */}
                        <div className="card mb-3">
                            <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
                                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: 420 }}>
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text bg-light border-end-0">
                                            <Search size={15} className="text-muted" />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0"
                                            placeholder="Search barcode, RFID, or product…"
                                            value={whSearch}
                                            onChange={(e) => setWhSearch(e.target.value)}
                                        />
                                        {whSearch && (
                                            <button className="btn btn-light border" type="button" aria-label="Clear search" onClick={() => setWhSearch('')}>
                                                <X size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    {whUpdatedAt && (
                                        <span className="text-muted fs-13">
                                            Updated {whUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                    <button
                                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                                        onClick={refreshWarehouseStock}
                                        disabled={whLoading}
                                    >
                                        {whLoading ? <Loader2 size={15} className="spinning" /> : <RefreshCw size={15} />} Refresh
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body d-flex align-items-center gap-3">
                                        <span className="d-inline-flex align-items-center justify-content-center bg-soft-primary text-primary rounded" style={{ width: 42, height: 42 }}>
                                            <Layers size={20} />
                                        </span>
                                        <div>
                                            <span className="text-muted fs-13 d-block">Total pallets in Main Warehouse</span>
                                            <strong className="fs-4">{whTotal.toLocaleString()}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-body d-flex align-items-center gap-3">
                                        <span className="d-inline-flex align-items-center justify-content-center bg-soft-success text-success rounded" style={{ width: 42, height: 42 }}>
                                            <Package size={20} />
                                        </span>
                                        <div>
                                            <span className="text-muted fs-13 d-block">
                                                {whTotalPacks === null ? 'Packs on this page' : 'Total packs'}
                                            </span>
                                            <strong className="fs-4">{(whTotalPacks ?? whPagePacks).toLocaleString()}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        {whError && !whLoading && (
                            <div className="alert alert-danger d-flex align-items-center justify-content-between">
                                <span>{whError}</span>
                                <button className="btn btn-sm btn-outline-danger" onClick={refreshWarehouseStock}>Try again</button>
                            </div>
                        )}

                        {/* Loading */}
                        {whLoading && whUnits.length === 0 && (
                            <div className="d-flex justify-content-center align-items-center py-5">
                                <Loader2 size={28} className="text-primary spinning" />
                                <span className="ms-2 text-muted">Loading main warehouse stock…</span>
                            </div>
                        )}

                        {/* Table */}
                        {whUnits.length > 0 && (
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-3">
                                    <span className="fw-semibold d-flex align-items-center gap-2">
                                        <Warehouse size={16} className="text-muted" /> Stock in Main Warehouse
                                    </span>
                                    <span className="d-flex align-items-center gap-2">
                                        {whLoading && <Loader2 size={15} className="text-primary spinning" />}
                                        <span className="badge bg-soft-primary text-primary">{whTotal.toLocaleString()} pallets</span>
                                    </span>
                                </div>
                                <div className="card-body p-0">
                                    <div
                                        className="table-responsive"
                                        style={whLoading ? { opacity: 0.5, pointerEvents: 'none', transition: 'opacity 0.15s' } : undefined}
                                    >
                                        <table className="table table-hover mb-0 align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Barcode</th>
                                                    <th>RFID</th>
                                                    <th>Product</th>
                                                    <th>PET Line</th>
                                                    <th>PD Code</th>
                                                    <th>Handed over by</th>
                                                    <th>Received by</th>
                                                    <th className="text-end">Packs</th>
                                                    <th>Added / Updated</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {whPagedUnits.map((u, idx) => {
                                                    const barcode = whGetBarcode(u);
                                                    return (
                                                        <tr
                                                            key={u.id || barcode || idx}
                                                            onClick={() => barcode !== '—' && navigate(`/post-production/pallets/details/${barcode}`)}
                                                            style={{ cursor: barcode !== '—' ? 'pointer' : 'default' }}
                                                        >
                                                            <td className="text-muted">{(whPage - 1) * whPageSize + idx + 1}</td>
                                                            <td><code className="text-primary">{barcode}</code></td>
                                                            <td>{u.rfid_number || '—'}</td>
                                                            <td>{whGetProduct(u)}</td>
                                                            <td>{whGetPet(u)}</td>
                                                            <td>{getDocumentCode(u) ? <code>{getDocumentCode(u)}</code> : '—'}</td>
                                                            <td>{getSupervisors(u).source || '—'}</td>
                                                            <td>{getSupervisors(u).target || '—'}</td>
                                                            <td className="text-end">{whGetQty(u).toLocaleString()}</td>
                                                            <td>{whGetTime(u) ? new Date(whGetTime(u)).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="fw-bold border-top">
                                                    <td colSpan={8}>{whTotalPacks === null ? 'PAGE TOTAL' : 'TOTAL (all pages)'}</td>
                                                    <td className="text-end">{(whTotalPacks ?? whPagePacks).toLocaleString()}</td>
                                                    <td>{(whTotalPacks === null ? whPagedUnits.length : whTotal).toLocaleString()} pallets</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    <Pagination
                                        page={whPage}
                                        pageSize={whPageSize}
                                        totalCount={whTotal}
                                        onPageChange={setWhPage}
                                        onPageSizeChange={setWhPageSize}
                                        pageSizeOptions={[10, 20, 50, 100]}
                                        itemLabel="pallets"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Empty */}
                        {whLoaded && !whLoading && whUnits.length === 0 && !whError && (
                            <div className="text-center py-5">
                                <div className="text-muted mb-2"><Warehouse size={48} strokeWidth={1} /></div>
                                <p className="text-muted mb-0">
                                    {whSearch ? 'No stock matches your search.' : 'No stock currently in the Main Warehouse.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Loading */}
            {activeTab === 'form' && loading && (
                <div className="d-flex justify-content-center align-items-center py-5 no-print">
                    <Loader2 size={32} className="text-primary spinning" />
                    <span className="ms-2 text-muted">Searching pallets...</span>
                </div>
            )}

            {/* Printable Transfer Form */}
            {activeTab === 'form' && !loading && barcodes.length > 0 && (
                <div className="print-form-container" ref={printRef}>
                    <div className="production-report-form">

                        {/* Header */}
                        <div className="form-header">
                            <div className="header-left">
                                <img src="/logo.jpeg" alt="Twellium" className="print-logo" />
                                <h5 className="company-name">TWELLIUM INDUSTRIAL COMPANY LTD.</h5>
                            </div>
                            <div className="header-center">
                                <h4 className="report-title" style={{ fontSize: '14px' }}>Transfer Form from {sourceLabel} to {targetLabel}</h4>
                                <span className="doc-ref" style={{ fontSize: '13px', fontWeight: 'bold' }}>{formDocumentCode}</span>
                                {formTransferId && (
                                    <span className="doc-ref d-block" style={{ fontSize: '11px' }}>Transfer ID: {formTransferId}</span>
                                )}
                            </div>
                            <div className="header-right">
                                <div className="header-info">
                                    <span className="doc-ref">PRODUCTION DEPARTMENT</span>
                                    <span>Page 1 of 1</span>
                                </div>
                            </div>
                        </div>

                        {/* Product & Summary Section */}
                        <table className="form-table">
                            <tbody>
                                <tr>
                                    <td className="label-cell" style={{ width: '12%' }}>Product Name</td>
                                    <td className="input-cell" style={{ width: '38%' }}>{productName}</td>
                                    <td className="label-cell" style={{ width: '12%' }}>Total Pallet</td>
                                    <td className="input-cell numeric" style={{ width: '38%' }}>{totalPallets}</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Date</td>
                                    <td className="input-cell">{displayDate}</td>
                                    <td className="label-cell">Single Packs</td>
                                    <td className="input-cell numeric">
                                        <input
                                            type="number"
                                            className="form-control form-control-sm border-0 rounded-0 shadow-none no-print-input"
                                            style={{ minWidth: '60px', height: '1.6rem', padding: '0.1rem 0.25rem', textAlign: 'right', backgroundColor: 'transparent', borderBottom: '1px dashed rgba(33,37,41,0.35)', fontSize: '0.85rem' }}
                                            value={singlePacks}
                                            onChange={(e) => setSinglePacks(e.target.value)}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Shift</td>
                                    <td className="input-cell">{filters.shift || 'All Shifts'}</td>
                                    <td className="label-cell">Total Packs</td>
                                    <td className="input-cell numeric">{(totalPacks + (parseInt(singlePacks) || 0)).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="label-cell">Stamp Type</td>
                                    <td className="input-cell" colSpan={3}>{stampTypeLabel}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Pallet Details Table */}
                        <table className="form-table section-table">
                            <thead>
                                <tr className="section-header-row">
                                    <th colSpan={5}>Pallet Details</th>
                                </tr>
                                <tr className="sub-header-row">
                                    <th style={{ width: '28%' }}>Barcode</th>
                                    <th style={{ width: '20%' }}>Batch number</th>
                                    <th style={{ width: '12%' }}>Sequence Number</th>
                                    <th style={{ width: '15%' }}>Packs per Pallet</th>
                                    <th style={{ width: '25%' }}>Date time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedBarcodes.map((barcode, idx) => (
                                    <tr key={barcode.id || barcode.barcode || idx}>
                                        <td className="label-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {barcode.current_barcode || barcode.barcode || ''}
                                        </td>
                                        <td className="input-cell" style={{ fontSize: '0.8rem' }}>
                                            {barcode.batch_number || barcode.batch || barcode.traceability || ''}
                                        </td>
                                        <td className="input-cell numeric">{getSequence(barcode) || idx + 1}</td>
                                        <td className="input-cell numeric">
                                            {barcode.quantity ?? barcode.packs_per_pallet ?? barcode.total_packs ?? barcode.packs ?? ''}
                                        </td>
                                        <td className="input-cell" style={{ fontSize: '0.8rem' }}>
                                            {barcode.created_at ? new Date(barcode.created_at).toLocaleString() : ''}
                                        </td>
                                    </tr>
                                ))}
                                {/* Totals row */}
                                <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                    <td className="label-cell">TOTAL</td>
                                    <td className="input-cell"></td>
                                    <td className="input-cell numeric">{barcodes.length}</td>
                                    <td className="input-cell numeric">{totalPacks.toLocaleString()}</td>
                                    <td className="input-cell"></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Sign Off Section */}
                        <div className="sign-off-section">
                            <div className="sign-off-row">
                                <div className="sign-off-field">
                                    <label>{sourceSupervisorLabel}</label>
                                </div>
                                <div className="sign-off-field">
                                    <label>{targetSupervisorLabel}</label>
                                </div>
                            </div>
                            <div className="sign-off-row">
                                <div className="sign-off-field">
                                    <label>Name:</label>
                                    <div className="sign-line">{formSourceSupervisor}</div>
                                </div>
                                <div className="sign-off-field">
                                    <label>Name:</label>
                                    <div className="sign-line">{formTargetSupervisor}</div>
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
                    </div>
                </div>
            )}

            {/* Empty state */}
            {activeTab === 'form' && !loading && barcodes.length === 0 && (
                <div className="text-center py-5 no-print">
                    <div className="text-muted mb-2">
                        <Search size={48} strokeWidth={1} />
                    </div>
                    <p className="text-muted">Find a transfer by its ID, or adjust the filters above, to load pallets for the transfer form.</p>
                </div>
            )}
        </div>
    );
};

export default BatchPrintTransfer;
