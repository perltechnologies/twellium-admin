import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, Loader2, Calendar, Search, CheckCircle2, UserCheck, ArrowLeft, FileText, Warehouse, RefreshCw, Package, Layers, X, Hash } from 'lucide-react';
import { inventoryApi, loadAllHandlingUnits, SAVE_TRANSFER_DOCUMENT, STAGING_WAREHOUSE_STAGE } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { usersApi } from '../../api/users';
import { formatAndSortPets } from '../../utils/petUtils';
import { clearUnitsCache, mergeUnitsIntoCache } from '../../utils/unitsCache';
import {
    DIRECTION_LABELS,
    compareBySequence,
    findTransfersById,
    getDocumentCode,
    getSequence,
    getStampTypes,
    groupUnitsIntoTransfers,
    getStage,
    getTransferRoute,
    getUnitDirection,
    normalizeTransferId,
} from '../../utils/transferUtils';

// Pallets are sent to the scan endpoint in chunks so one huge request cannot time out.
const SCAN_CHUNK_SIZE = 100;

// Stable identity of a pallet: its id survives a stage change, a barcode may not.
const unitId = (u) => String(u.id ?? u.internal_id ?? u.current_barcode ?? u.barcode ?? u.rfid_number ?? '');
// Document number printed on the form and sent with the transfer: PD + yyMMddHHmmss.
// `withSuffix` adds two random digits, used when the server reports the code is taken.
const buildDocumentCode = (withSuffix = false) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `PD${stamp}${withSuffix ? pad(Math.floor(Math.random() * 100)) : ''}`;
};
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
    const [documentCode, setDocumentCode] = useState('');
    const [singlePacks, setSinglePacks] = useState('');

    // Transfer completion
    const [users, setUsers] = useState([]);
    const [productionSupervisor, setProductionSupervisor] = useState('');
    const [warehouseSupervisor, setWarehouseSupervisor] = useState('');
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [completeError, setCompleteError] = useState('');
    const completedRef = useRef(false);
    useEffect(() => { completedRef.current = completed; }, [completed]);
    const [transferSummary, setTransferSummary] = useState({ moved: 0, alreadyThere: 0, documentNotSaved: false });
    const [transferProgress, setTransferProgress] = useState(null); // { done, total, verifying }

    // ----- Tabs -----
    const [activeTab, setActiveTab] = useState('form'); // 'form' | 'warehouse'

    // ----- Main Warehouse stock tab -----
    const [whUnits, setWhUnits] = useState([]);
    const [whLoading, setWhLoading] = useState(false);
    const [whError, setWhError] = useState('');
    const [whSearch, setWhSearch] = useState('');
    const [whLoaded, setWhLoaded] = useState(false);
    const [whUpdatedAt, setWhUpdatedAt] = useState(null);

    useEffect(() => {
        fetchDropdownData();
        generateDocumentCode();
    }, []);

    // Leaving a completed transfer starts a new one, which needs its own document number.
    const resetCompletion = () => {
        if (completedRef.current) {
            completedRef.current = false;
            generateDocumentCode();
        }
        setCompleted(false);
        setCompleteError('');
    };

    const generateDocumentCode = (withSuffix = false) => {
        const code = buildDocumentCode(withSuffix);
        setDocumentCode(code);
        return code;
    };

    const fetchDropdownData = async () => {
        try {
            const [petsRes, productsRes, usersRes] = await Promise.all([
                productionApi.getPets(),
                inventoryApi.getProducts({ page_size: 100 }),
                usersApi.getUsers({ page_size: 200, role: 'SUPERVISOR' }).catch(() => null),
            ]);

            const allPets = formatAndSortPets(petsRes);
            setPets(allPets);

            const prodList = productsRes.data?.data?.data || productsRes.data?.data || productsRes.data?.results || [];
            setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);

            // Parse users the same way UserList does, then keep supervisors only.
            const usersData = usersRes?.data;
            let userList = [];
            if (Array.isArray(usersData)) {
                userList = usersData;
            } else if (usersData?.results) {
                userList = usersData.results;
            } else if (usersData?.data) {
                userList = usersData.data.results || usersData.data;
            }
            const supervisors = (Array.isArray(userList) ? userList : []).filter(
                (u) => String(u.role || '').toUpperCase() === 'SUPERVISOR'
            );
            setUsers(supervisors);
        } catch (error) {
            console.error('Failed to fetch dropdown data:', error);
        }
    };

    // Loads handling units page by page. With a locked selection it stops as soon as
    // every locked pallet has been found, so it rarely needs the whole list.
    const fetchUnitList = async (lockedList = [], isStale = () => false) => {
        const wanted = new Set(lockedList.map(String));
        const matched = new Set();
        const collected = new Map();
        await loadAllHandlingUnits({}, {
            isCancelled: () => isStale() || (wanted.size > 0 && matched.size >= wanted.size),
            onPage: (items) => items.forEach((unit) => {
                collected.set(unitId(unit) || `row-${collected.size}`, unit);
                if (wanted.size === 0) return;
                const scan = String(scanValueOf(unit));
                const id = String(unit.id ?? '');
                if (wanted.has(scan)) matched.add(scan);
                if (wanted.has(id)) matched.add(id);
            }),
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
            if (!preserveCompletion) resetCompletion();
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
        resetCompletion();
        setLoading(false);
        setActiveTab('form');
    };

    const handleFindTransfer = async (value = finderInput) => {
        const wanted = normalizeTransferId(value);
        if (!wanted) {
            setFinderError('Enter a Transfer ID, for example TR260908-RUSH-P02.');
            return;
        }
        setFinding(true);
        setFinderError('');
        setFinderMatches([]);
        try {
            const matches = findTransfersById(await fetchUnitList(), wanted);
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
        resetCompletion();
    };

    // Open directly from a link such as ?transfer_id=TR260908-RUSH-P02
    useEffect(() => {
        const idFromUrl = searchParams.get('transfer_id');
        if (idFromUrl) handleFindTransfer(idFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-load data when filters change
    useEffect(() => {
        if (pets.length === 0 || products.length === 0) return;
        const timer = setTimeout(() => {
            handleSearch();
        }, 400);
        return () => clearTimeout(timer);
    }, [filters.startDate, filters.endDate, filters.productType, filters.petName, filters.shift, pets.length, products.length]);

    const handlePrint = () => {
        const prevTitle = document.title;
        const productLabel = filters.productType || 'All Products';
        document.title = `Transfer Form - ${productLabel} - ${filters.startDate}`;
        window.print();
        document.title = prevTitle;
    };

    const userLabel = (u) => {
        if (!u) return '';
        return (
            u.full_name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
            u.name ||
            u.username ||
            u.email ||
            `User #${u.id}`
        );
    };

    // All loaded users are supervisors, so the dropdown shows the plain name.
    const userOptionLabel = (u) => userLabel(u);

    const findUser = (id) => users.find((u) => String(u.id) === String(id));

    const handleCompleteTransfer = async () => {
        setCompleteError('');
        if (!productionSupervisor || !warehouseSupervisor) {
            setCompleteError(`Select both a ${sourceSupervisorLabel} and a ${targetSupervisorLabel} before completing the transfer.`);
            return;
        }
        if (barcodes.length === 0) {
            setCompleteError('There are no pallets loaded to transfer.');
            return;
        }

        const TARGET_STAGE = targetStage;
        // Pallets already in the target stage are a no-op on the backend, so only
        // send the ones that still have to move.
        const movable = barcodes.filter((b) => getStage(b) !== TARGET_STAGE);
        const alreadyThere = barcodes.length - movable.length;
        if (movable.length === 0) {
            setCompleteError(
                `All ${barcodes.length} loaded pallet(s) are already in the ${targetLabel} — nothing to transfer.`
            );
            return;
        }

        // scan_values are barcodes / RFID numbers, not the internal UUIDs.
        const scanValues = [...new Set(movable.map(scanValueOf).filter(Boolean))];
        const withoutBarcode = movable.filter((b) => !scanValueOf(b)).length;
        if (scanValues.length === 0) {
            setCompleteError('Could not resolve barcodes for the loaded pallets; cannot complete the transfer.');
            return;
        }

        setCompleting(true);
        let requestSent = false;
        let freshLoaded = false;
        try {
            let rejected = 0;
            let firstError = '';
            let activeDocumentCode = documentCode;
            let documentSaving = SAVE_TRANSFER_DOCUMENT;
            let documentSkipped = false;
            for (let i = 0; i < scanValues.length; i += SCAN_CHUNK_SIZE) {
                const chunk = scanValues.slice(i, i + SCAN_CHUNK_SIZE);
                setTransferProgress({ done: i, total: scanValues.length, verifying: false });
                requestSent = true;
                try {
                    const send = (code, withDocument = SAVE_TRANSFER_DOCUMENT) => inventoryApi.completeTransfer({
                        scan_values: chunk,
                        target_stage: TARGET_STAGE,
                        extra: withDocument ? {
                            document_code: code,
                            transfer_id: formTransferId || undefined,
                            source_supervisor: productionSupervisor,
                            target_supervisor: warehouseSupervisor,
                        } : {},
                    });
                    let res;
                    try {
                        res = await send(activeDocumentCode, documentSaving);
                    } catch (sendError) {
                        const status = sendError?.response?.status;
                        if (documentSaving && status === 409 && i === 0) {
                            // The server says this code belongs to another transfer. Take a
                            // fresh code once; later chunks reuse it.
                            activeDocumentCode = generateDocumentCode(true);
                            res = await send(activeDocumentCode, true);
                        } else if (documentSaving && status === 400) {
                            // The backend may not accept the document fields yet. Never let that
                            // block the transfer: resend without them and flag it.
                            documentSaving = false;
                            documentSkipped = true;
                            res = await send(activeDocumentCode, false);
                        } else {
                            throw sendError;
                        }
                    }
                    // The scan endpoint response envelope varies. Normalise it.
                    const result = res?.data?.data ?? res?.data ?? {};
                    const results = Array.isArray(result.results)
                        ? result.results
                        : Array.isArray(result) ? result : [];
                    // A per-unit failure is flagged by success === false OR an error field.
                    const failed = results.filter((r) => r && (r.success === false || r.error));
                    if (result.success === false && failed.length === 0) {
                        rejected += chunk.length;
                        if (!firstError) firstError = result.message || 'The transfer was rejected.';
                    } else {
                        rejected += failed.length;
                        if (!firstError) firstError = failed.find((f) => f.error)?.error || '';
                    }
                } catch (chunkError) {
                    rejected += chunk.length;
                    if (!firstError) {
                        firstError = chunkError?.response?.data?.message || chunkError?.message || 'Request failed';
                    }
                }
            }

            // The reloaded list is the source of truth: count what really changed stage
            // instead of trusting the scan response.
            setTransferProgress({ done: scanValues.length, total: scanValues.length, verifying: true });
            const fresh = await handleSearch({ preserveCompletion: true });
            freshLoaded = fresh !== null;

            const movableIds = new Set(movable.map(unitId));
            const moved = fresh
                ? fresh.filter((u) => movableIds.has(unitId(u)) && getStage(u) === TARGET_STAGE).length
                : Math.max(0, scanValues.length - rejected);
            const notMoved = movable.length - moved;

            setTransferSummary({ moved, alreadyThere, documentNotSaved: documentSkipped });

            if (notMoved === 0) {
                setCompleted(true);
                return;
            }

            const reason = firstError ? ` Reason: ${firstError}` : '';
            const skipped = withoutBarcode > 0 ? ` ${withoutBarcode} had no barcode/RFID and were skipped.` : '';
            if (moved === 0) {
                setCompleteError(
                    `No pallets changed stage. They may not be eligible for transfer to the ${targetLabel} from their current stage.${reason}${skipped}`
                );
            } else {
                setCompleteError(
                    `${moved} of ${movable.length} pallet(s) moved to the ${targetLabel}; ${notMoved} did not.${reason}${skipped}` +
                    ' The list above is up to date. Click Complete Transfer again to retry the remaining pallets.'
                );
            }
        } catch (error) {
            console.error('Failed to complete transfer:', error);
            setCompleteError(
                error?.response?.data?.message ||
                error?.message ||
                'Could not complete the transfer. Please try again or contact an administrator.'
            );
        } finally {
            // If the list could not be refreshed after moving pallets, the shared cache is
            // out of date; drop it so the transfer list reloads from the server.
            if (requestSent && !freshLoaded) clearUnitsCache();
            setTransferProgress(null);
            setCompleting(false);
        }
    };

    // ----- Main Warehouse stock (WAREHOUSE / Main Unit stage) -----
    const fetchWarehouseStock = async (searchTerm = whSearch) => {
        setWhLoading(true);
        setWhError('');
        try {
            const params = { stage: 'WAREHOUSE', page_size: 1000 };
            if (searchTerm) params.search = searchTerm;
            const response = await inventoryApi.getStageDetails(params);
            const data = response.data?.data ?? response.data ?? [];
            const list = Array.isArray(data) ? data : data.details || data.results || [];
            setWhUnits(Array.isArray(list) ? list : []);
            setWhUpdatedAt(new Date());
            setWhLoaded(true);
        } catch (err) {
            console.error('Failed to fetch main warehouse stock:', err);
            setWhError('Could not load the main warehouse stock. Please try again.');
            setWhUnits([]);
        } finally {
            setWhLoading(false);
        }
    };

    // Lazy-load warehouse stock the first time the tab is opened.
    useEffect(() => {
        if (activeTab === 'warehouse' && !whLoaded && !whLoading) {
            fetchWarehouseStock();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Debounced server-side search within the warehouse tab.
    useEffect(() => {
        if (activeTab !== 'warehouse' || !whLoaded) return;
        const timer = setTimeout(() => fetchWarehouseStock(whSearch), 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [whSearch]);

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
    const whTotalPacks = whUnits.reduce((s, u) => s + whGetQty(u), 0);

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
                                <span className="badge bg-soft-primary text-primary ms-1">{whUnits.length}</span>
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
                            <Hash size={16} className="text-primary" /> Find Transfer by ID
                        </label>
                        <form
                            className="d-flex flex-wrap gap-2"
                            onSubmit={(e) => { e.preventDefault(); handleFindTransfer(); }}
                        >
                            <div className="input-group" style={{ maxWidth: 420 }}>
                                <span className="input-group-text bg-light"><Search size={15} className="text-muted" /></span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Transfer ID, e.g. TR260908-RUSH-P02"
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
                {barcodes.length > 0 && (
                    <div className="card mt-3 border-0 shadow-sm">
                        <div className="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-2">
                            <span className="d-inline-flex align-items-center justify-content-center bg-soft-success text-success rounded" style={{ width: 32, height: 32 }}>
                                <UserCheck size={16} />
                            </span>
                            <span className="fw-semibold">Complete Transfer</span>
                            {completed && (
                                <span className="badge bg-success d-inline-flex align-items-center gap-1 ms-2">
                                    <CheckCircle2 size={13} /> Completed
                                </span>
                            )}
                        </div>
                        <div className="card-body">
                            <p className="text-muted fs-13 mb-3">
                                Assign the supervisors signing off this {sourceLabel}&nbsp;→&nbsp;{targetLabel} transfer, then complete it.
                            </p>
                            <div className="row g-3 align-items-end">
                                <div className="col-md-4">
                                    <label className="form-label">{sourceSupervisorLabel}</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={productionSupervisor}
                                        onChange={(e) => setProductionSupervisor(e.target.value)}
                                        disabled={completed || users.length === 0}
                                    >
                                        <option value="">
                                            {users.length === 0 ? 'No supervisors available' : 'Select supervisor…'}
                                        </option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>{userOptionLabel(u)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">{targetSupervisorLabel}</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={warehouseSupervisor}
                                        onChange={(e) => setWarehouseSupervisor(e.target.value)}
                                        disabled={completed || users.length === 0}
                                    >
                                        <option value="">
                                            {users.length === 0 ? 'No supervisors available' : 'Select supervisor…'}
                                        </option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>{userOptionLabel(u)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <button
                                        className="btn btn-success d-flex align-items-center justify-content-center gap-2 w-100"
                                        onClick={handleCompleteTransfer}
                                        disabled={completing || completed}
                                    >
                                        {completing ? (
                                            <>
                                                <Loader2 size={16} className="spinning" />
                                                {transferProgress?.verifying
                                                    ? ' Verifying…'
                                                    : transferProgress && transferProgress.total > SCAN_CHUNK_SIZE
                                                        ? ` Transferring ${Math.min(transferProgress.done + SCAN_CHUNK_SIZE, transferProgress.total)} / ${transferProgress.total}…`
                                                        : ' Completing…'}
                                            </>
                                        ) : completed ? (
                                            <><CheckCircle2 size={16} /> Transfer Completed</>
                                        ) : (
                                            <><CheckCircle2 size={16} /> Complete Transfer</>
                                        )}
                                    </button>
                                </div>
                            </div>
                            {completeError && (
                                <div className="alert alert-danger py-2 px-3 mt-3 mb-0 fs-13">{completeError}</div>
                            )}
                            {completed && (
                                <div className="alert alert-success py-2 px-3 mt-3 mb-0 fs-13">
                                    Transfer <strong>{formTransferId || documentCode}</strong> completed — {transferSummary.moved} pallet(s) moved from {sourceLabel} to {targetLabel}. Search this Transfer ID on the Production Transfer page to view its details later.
                                    {transferSummary.alreadyThere > 0 && (
                                        <> ({transferSummary.alreadyThere} pallet(s) were already in the {targetLabel} and were skipped.)</>
                                    )}
                                    {transferSummary.documentNotSaved && (
                                        <div className="mt-1 text-warning-emphasis">
                                            Note: the server did not accept the document number {documentCode}, so it was not saved. The transfer itself completed.
                                        </div>
                                    )}
                                </div>
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
                                        onClick={() => fetchWarehouseStock()}
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
                                            <strong className="fs-4">{whUnits.length.toLocaleString()}</strong>
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
                                            <span className="text-muted fs-13 d-block">Total packs</span>
                                            <strong className="fs-4">{whTotalPacks.toLocaleString()}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        {whError && !whLoading && (
                            <div className="alert alert-danger d-flex align-items-center justify-content-between">
                                <span>{whError}</span>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => fetchWarehouseStock()}>Try again</button>
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
                        {!whLoading && whUnits.length > 0 && (
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-3">
                                    <span className="fw-semibold d-flex align-items-center gap-2">
                                        <Warehouse size={16} className="text-muted" /> Stock in Main Warehouse
                                    </span>
                                    <span className="badge bg-soft-primary text-primary">{whUnits.length} pallets</span>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0 align-middle">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Barcode</th>
                                                    <th>RFID</th>
                                                    <th>Product</th>
                                                    <th>PET Line</th>
                                                    <th>PD Code</th>
                                                    <th className="text-end">Packs</th>
                                                    <th>Added / Updated</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {whUnits.map((u, idx) => {
                                                    const barcode = whGetBarcode(u);
                                                    return (
                                                        <tr
                                                            key={u.id || barcode || idx}
                                                            onClick={() => barcode !== '—' && navigate(`/post-production/pallets/details/${barcode}`)}
                                                            style={{ cursor: barcode !== '—' ? 'pointer' : 'default' }}
                                                        >
                                                            <td className="text-muted">{idx + 1}</td>
                                                            <td><code className="text-primary">{barcode}</code></td>
                                                            <td>{u.rfid_number || '—'}</td>
                                                            <td>{whGetProduct(u)}</td>
                                                            <td>{whGetPet(u)}</td>
                                                            <td>{getDocumentCode(u) ? <code>{getDocumentCode(u)}</code> : '—'}</td>
                                                            <td className="text-end">{whGetQty(u).toLocaleString()}</td>
                                                            <td>{whGetTime(u) ? new Date(whGetTime(u)).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="fw-bold border-top">
                                                    <td colSpan={6}>TOTAL</td>
                                                    <td className="text-end">{whTotalPacks.toLocaleString()}</td>
                                                    <td>{whUnits.length.toLocaleString()} pallets</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Empty */}
                        {!whLoading && whUnits.length === 0 && !whError && (
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
                                <span className="doc-ref" style={{ fontSize: '13px', fontWeight: 'bold' }}>{documentCode}</span>
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
                                    <div className="sign-line">{productionSupervisor ? userLabel(findUser(productionSupervisor)) : ''}</div>
                                </div>
                                <div className="sign-off-field">
                                    <label>Name:</label>
                                    <div className="sign-line">{warehouseSupervisor ? userLabel(findUser(warehouseSupervisor)) : ''}</div>
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
