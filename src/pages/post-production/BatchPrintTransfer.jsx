import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Printer, Loader2, Calendar, Search, CheckCircle2, UserCheck, ArrowLeft, FileText, Warehouse, RefreshCw, Package, Layers, X } from 'lucide-react';
import { inventoryApi } from '../../api/inventory';
import { productionApi } from '../../api/production';
import { usersApi } from '../../api/users';
import { formatAndSortPets } from '../../utils/petUtils';

const BatchPrintTransfer = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // This page is only reachable via the Production Transfer (Transfer Execution)
    // page, which passes navigation state. Direct URL access has no state and is
    // redirected back to the transfer list.
    const cameFromTransferList = Boolean(location.state && location.state.fromTransferList);

    const printRef = useRef();
    const today = new Date().toISOString().split('T')[0];
    const [loading, setLoading] = useState(false);
    const [barcodes, setBarcodes] = useState([]);
    const [pets, setPets] = useState([]);
    const [products, setProducts] = useState([]);
    const [shifts] = useState([
        { id: 'DAY', name: 'DAY' },
        { id: 'NIGHT', name: 'NIGHT' },
    ]);

    const [filters, setFilters] = useState({
        startDate: today,
        endDate: today,
        productType: '',
        petName: '',
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
    const [transferSummary, setTransferSummary] = useState({ moved: 0, alreadyThere: 0 });

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

    const generateDocumentCode = () => {
        const now = new Date();
        const code = `PD${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        setDocumentCode(code);
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

    const handleSearch = async ({ preserveCompletion = false } = {}) => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.start_date = filters.startDate;
            if (filters.endDate) params.end_date = filters.endDate;
            if (filters.productType) params.product_type = filters.productType;
            if (filters.petName) params.pet_name = filters.petName;

            const response = await inventoryApi.getBulkBarcodes(params);
            const data = response.data?.data?.data || response.data?.data || response.data?.results || [];
            const list = Array.isArray(data) ? data : data.results || [];

            // Filter by shift if selected
            const filtered = filters.shift
                ? list.filter(b => (b.shift || '').toUpperCase() === filters.shift.toUpperCase())
                : list;

            setBarcodes(filtered);
            if (!preserveCompletion) {
                setCompleted(false);
                setCompleteError('');
            }
        } catch (error) {
            console.error('Failed to fetch barcodes:', error);
            setBarcodes([]);
        } finally {
            setLoading(false);
        }
    };

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
            setCompleteError('Select both a Production Supervisor and a Warehouse Supervisor before completing the transfer.');
            return;
        }
        if (barcodes.length === 0) {
            setCompleteError('There are no pallets loaded to transfer.');
            return;
        }

        setCompleting(true);
        try {
            const TARGET_STAGE = 'WAREHOUSE';
            const unitStage = (b) =>
                String(b.stage || b.current_status || b.current_stage || '').toUpperCase();

            // Only move pallets that are not already in the target stage. Sending
            // units that are already in WAREHOUSE is a no-op on the backend, which
            // is why "completing" appeared to do nothing.
            const movable = barcodes.filter((b) => unitStage(b) !== TARGET_STAGE);
            const alreadyThere = barcodes.length - movable.length;

            if (movable.length === 0) {
                setCompleteError(
                    `All ${barcodes.length} loaded pallet(s) are already in the ${TARGET_STAGE} (Main Unit) stage — nothing to transfer.`
                );
                return;
            }

            // scan_values are barcodes / RFID numbers, not the internal UUIDs.
            const scanValues = movable
                .map((b) => b.current_barcode || b.barcode || b.rfid_number)
                .filter(Boolean);

            if (scanValues.length === 0) {
                setCompleteError('Could not resolve barcodes for the loaded pallets; cannot complete the transfer.');
                return;
            }

            const res = await inventoryApi.completeTransfer({
                scan_values: scanValues,
                target_stage: TARGET_STAGE,
            });

            // The scan endpoint response envelope varies. Normalise it.
            const result = res?.data?.data ?? res?.data ?? {};
            const results = Array.isArray(result.results)
                ? result.results
                : Array.isArray(result)
                    ? result
                    : [];

            // A per-unit failure is flagged by success === false OR an error field.
            const failed = results.filter((r) => r && (r.success === false || r.error));

            if (result.success === false && failed.length === 0) {
                setCompleteError(result.message || 'The transfer could not be completed. Please try again.');
                return;
            }

            if (failed.length > 0) {
                const firstError = failed.find((f) => f.error)?.error;
                const movedCount = scanValues.length - failed.length;
                setCompleteError(
                    `${failed.length} of ${scanValues.length} pallet(s) could not be transferred${firstError ? `: ${firstError}` : ''}.` +
                    (movedCount > 0 ? ` ${movedCount} moved successfully.` : '') +
                    ' Please review and retry.'
                );
                // Still refresh so any successful moves drop out of the list.
                await handleSearch({ preserveCompletion: true });
                return;
            }

            // Verify the move actually took effect by reloading and checking that the
            // transferred barcodes are no longer outside the target stage.
            let verifiedMoved = scanValues.length;
            try {
                const verifyParams = {};
                if (filters.startDate) verifyParams.start_date = filters.startDate;
                if (filters.endDate) verifyParams.end_date = filters.endDate;
                if (filters.productType) verifyParams.product_type = filters.productType;
                if (filters.petName) verifyParams.pet_name = filters.petName;
                const verifyRes = await inventoryApi.getBulkBarcodes(verifyParams);
                const vData = verifyRes.data?.data?.data || verifyRes.data?.data || verifyRes.data?.results || [];
                const vList = Array.isArray(vData) ? vData : vData.results || [];
                const movedSet = new Set(scanValues);
                const stillOutside = vList.filter(
                    (b) =>
                        movedSet.has(b.current_barcode || b.barcode || b.rfid_number) &&
                        unitStage(b) !== TARGET_STAGE
                );
                verifiedMoved = scanValues.length - stillOutside.length;
                if (verifiedMoved === 0) {
                    setCompleteError(
                        'The server accepted the request but no pallets changed stage. ' +
                        'They may not be eligible for transfer to the Main Unit from their current stage. ' +
                        'Please check the pallet stages or contact an administrator.'
                    );
                    return;
                }
            } catch (verifyErr) {
                // Verification is best-effort; if it fails we still trust the scan result.
                console.warn('Transfer verification skipped:', verifyErr);
            }

            setTransferSummary({ moved: verifiedMoved, alreadyThere });
            setCompleted(true);
            await handleSearch({ preserveCompletion: true });
        } catch (error) {
            console.error('Failed to complete transfer:', error);
            setCompleteError(
                error?.response?.data?.message ||
                error?.message ||
                'Could not complete the transfer. Please try again or contact an administrator.'
            );
        } finally {
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

    // Block direct URL access — must come from the Production Transfer page.
    if (!cameFromTransferList) {
        return <Navigate to="/post-production/transfer-execution" replace />;
    }

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
                            <p className="text-muted mb-0">Production to Warehouse transfer documentation</p>
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
                                    onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                />
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Product</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={filters.productType}
                                    onChange={(e) => setFilters(f => ({ ...f, productType: e.target.value }))}
                                >
                                    <option value="">All Products</option>
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
                                    onChange={(e) => setFilters(f => ({ ...f, petName: e.target.value }))}
                                >
                                    <option value="">All Lines</option>
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
                                Assign the supervisors signing off this Staging&nbsp;→&nbsp;Main transfer, then complete it.
                            </p>
                            <div className="row g-3 align-items-end">
                                <div className="col-md-4">
                                    <label className="form-label">Production Supervisor</label>
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
                                    <label className="form-label">Warehouse Supervisor</label>
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
                                            <><Loader2 size={16} className="spinning" /> Completing…</>
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
                                    Transfer <strong>{documentCode}</strong> completed — {transferSummary.moved} pallet(s) moved from Staging Unit to Main Unit.
                                    {transferSummary.alreadyThere > 0 && (
                                        <> ({transferSummary.alreadyThere} pallet(s) were already in the Main Unit and were skipped.)</>
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
                                                            <td className="text-end">{whGetQty(u).toLocaleString()}</td>
                                                            <td>{whGetTime(u) ? new Date(whGetTime(u)).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="fw-bold border-top">
                                                    <td colSpan={5}>TOTAL</td>
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
                                <h4 className="report-title" style={{ fontSize: '14px' }}>Transfer Form from Production to Warehouse</h4>
                                <span className="doc-ref" style={{ fontSize: '13px', fontWeight: 'bold' }}>{documentCode}</span>
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
                                {barcodes.map((barcode, idx) => (
                                    <tr key={barcode.id || barcode.barcode || idx}>
                                        <td className="label-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {barcode.current_barcode || barcode.barcode || ''}
                                        </td>
                                        <td className="input-cell" style={{ fontSize: '0.8rem' }}>
                                            {barcode.batch_number || barcode.batch || barcode.traceability || ''}
                                        </td>
                                        <td className="input-cell numeric">{idx + 1}</td>
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
                                    <label>Production Supervisor</label>
                                </div>
                                <div className="sign-off-field">
                                    <label>Warehouse Supervisor</label>
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
                    <p className="text-muted">Adjust filters above to load pallets for the transfer form.</p>
                </div>
            )}
        </div>
    );
};

export default BatchPrintTransfer;
