import api from './axios';

// Stage names follow the backend contract (including its STAGGING spelling).
export const STAGING_WAREHOUSE_STAGE = 'STAGGING';
export const MAIN_WAREHOUSE_STAGE = 'WAREHOUSE';
export const STAGE_DETAILS_URL = '/inventory/handling-units/stage-details/';

// Sending the transfer document (PD code, supervisors) with a transfer is off until
// the backend supports it (TRANSFER_DOCUMENT_API_SPEC.md). Set
// REACT_APP_SAVE_TRANSFER_DOCUMENT=true in .env to turn it on.
export const SAVE_TRANSFER_DOCUMENT = process.env.REACT_APP_SAVE_TRANSFER_DOCUMENT === 'true';

// The API wraps DRF pagination in varying envelopes
// ({results}, {data: []}, {data: {results}}, ...). Normalise to items + paging meta.
const extractPage = (res) => {
    const body = res?.data;
    const layers = [body, body?.data, body?.data?.data].filter((layer) => layer && typeof layer === 'object');
    let items = [];
    for (const layer of layers) {
        if (Array.isArray(layer)) { items = layer; break; }
        if (Array.isArray(layer.results)) { items = layer.results; break; }
        if (Array.isArray(layer.data)) { items = layer.data; break; }
    }
    const countLayer = layers.find((layer) => Number.isFinite(Number(layer.count)) && layer.count !== null);
    const nextLayer = layers.find((layer) => 'next' in layer);
    return {
        items,
        count: countLayer ? Number(countLayer.count) : null,
        hasNext: nextLayer ? Boolean(nextLayer.next) : null,
    };
};

// Loads every page of /inventory/handling-units/ (or another paginated `url`, e.g. stage-details). The first page resolves fast so
// the UI can paint straight away; remaining pages are fetched in parallel (when the
// API reports a total count) or followed one by one (when it only reports `next`).
// `onPage(items, { total })` fires per page. Failed pages are retried once and then
// counted in `failedPages` instead of aborting the whole load.
export const loadAllHandlingUnits = async (
    params = {},
    { pageSize = 100, concurrency = 4, onPage, isCancelled = () => false, url = '/inventory/handling-units/', ordering = '-created_at' } = {}
) => {
    const fetchPage = async (page) => {
        const request = () => api.get(url, {
            params: { ...(ordering ? { ordering } : {}), ...params, page_size: pageSize, page },
        });
        try {
            return extractPage(await request());
        } catch (error) {
            return extractPage(await request());
        }
    };

    const first = await fetchPage(1);
    const total = first.count;
    if (isCancelled()) return { total, failedPages: 0, cancelled: true };
    onPage?.(first.items, { page: 1, total });

    let failedPages = 0;
    if (total !== null) {
        const totalPages = Math.ceil(total / pageSize);
        let nextPage = 2;
        const worker = async () => {
            while (!isCancelled()) {
                const page = nextPage++;
                if (page > totalPages) return;
                try {
                    const result = await fetchPage(page);
                    if (!isCancelled()) onPage?.(result.items, { page, total });
                } catch (error) {
                    failedPages += 1;
                }
            }
        };
        await Promise.all(Array.from({ length: Math.max(0, Math.min(concurrency, totalPages - 1)) }, worker));
    } else if (first.hasNext) {
        let page = 2;
        let hasNext = true;
        while (hasNext && !isCancelled()) {
            try {
                const result = await fetchPage(page);
                if (!isCancelled()) onPage?.(result.items, { page, total });
                hasNext = result.hasNext !== false && result.items.length > 0;
            } catch (error) {
                failedPages += 1;
                break;
            }
            page += 1;
        }
    }

    return { total, failedPages, cancelled: isCancelled() };
};

// The document code the scan endpoint echoes back once the pallets are linked to a transfer
// document (top level, or on a successful result). Empty when the server did not link it.
export const getScanDocumentEcho = (res) => {
    const body = res?.data?.data ?? res?.data ?? {};
    const results = Array.isArray(body.results) ? body.results : [];
    const linked = results.find((r) => r && r.success !== false && !r.error && r.document_code);
    return String(body.document_code ?? linked?.document_code ?? '').trim().toUpperCase();
};

// True when a scan response moved at least one pallet (so a document should be linked).
export const scanMovedAnyPallet = (res) => {
    const body = res?.data?.data ?? res?.data ?? {};
    const results = Array.isArray(body.results) ? body.results : [];
    return results.length === 0 || results.some((r) => r && r.success !== false && !r.error);
};

export const DOCUMENT_SAVING_OFF_MESSAGE =
    'Saving transfer documents is switched off in this build (REACT_APP_SAVE_TRANSFER_DOCUMENT is not "true"). Set it in .env and restart or rebuild the app.';

// A user reference on a transfer document: { id, name } (or a bare id / name string).
const personName = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return '';
    return value.name || value.full_name
        || [value.first_name, value.last_name].filter(Boolean).join(' ').trim()
        || value.username || value.email || '';
};

const normalizeTransferDocument = (doc) => ({
    id: doc.id,
    documentCode: doc.document_code || '',
    transferId: doc.transfer_id || '',
    sequenceNumber: doc.sequence_number ?? null,
    sourceStage: doc.source_stage || '',
    targetStage: doc.target_stage || '',
    sourceSupervisor: personName(doc.source_supervisor),
    targetSupervisor: personName(doc.target_supervisor),
    createdBy: personName(doc.created_by),
    createdAt: doc.created_at || null,
    totalPallets: doc.total_pallets ?? null,
    totalPacks: doc.total_packs ?? null,
});

// Saved transfer documents for a set of pallets: looked up by their PD codes when they
// carry one, otherwise by Transfer ID. Never throws; returns [] if nothing is found.
export const loadTransferDocuments = async ({ codes = [], transferId = '' } = {}) => {
    const unwrap = (res) => res?.data?.data ?? res?.data ?? {};
    try {
        if (codes.length > 0) {
            const docs = await Promise.all(codes.slice(0, 10).map((code) => (
                inventoryApi.getTransferDocument(code).then((res) => unwrap(res)).catch(() => null)
            )));
            return docs.filter((doc) => doc && doc.document_code).map(normalizeTransferDocument);
        }
        if (!transferId) return [];
        const res = await inventoryApi.getTransferDocuments({ transfer_id: transferId, page_size: 50 });
        const body = unwrap(res);
        const list = Array.isArray(body) ? body : body.results || [];
        const wanted = String(transferId).toUpperCase();
        return list
            .filter((doc) => String(doc.transfer_id || '').toUpperCase().includes(wanted))
            .map(normalizeTransferDocument);
    } catch (error) {
        console.error('Failed to load transfer documents:', error);
        return [];
    }
};

// Pallets moved under one transfer document (PD code). If the server ignores the
// `document_code` filter it returns unrelated pallets; those are detected via the
// pallet's own document code and the load stops with an empty result.
export const loadUnitsByDocumentCode = async (code) => {
    const wanted = String(code || '').trim().toUpperCase();
    const collected = [];
    let ignored = false;
    await loadAllHandlingUnits({ document_code: wanted }, {
        isCancelled: () => ignored,
        onPage: (items) => items.forEach((unit) => {
            const unitCode = String(unit.document_code ?? unit.transfer_document_code ?? unit.transfer_document?.document_code ?? '').trim().toUpperCase();
            if (unitCode === wanted) collected.push(unit);
            else ignored = true;
        }),
    });
    return ignored ? [] : collected;
};

export const inventoryApi = {
    getProducts: (params) => api.get('/inventory/products/', { params }),
    getProduct: (id) => api.get(`/inventory/products/${id}/`),
    createProduct: (data) => api.post('/inventory/products/', data),
    updateProduct: (id, data) => api.patch(`/inventory/products/${id}/`, data),
    deleteProduct: (id) => api.delete(`/inventory/products/${id}/`),

    // Handling Units (Post Production)
    getHandlingUnits: (params) => api.get('/inventory/handling-units/', { params }),
    getHandlingUnit: (id) => api.get(`/inventory/handling-units/${id}/`),
    createHandlingUnit: (data) => api.post('/inventory/handling-units/', data),
    scanHandlingUnit: (data) => api.post('/inventory/handling-units/scan/', data),
    linkRfid: (data) => api.post('/inventory/handling-units/link-rfid/', data),
    getBarcodesByStage: (params) => api.get('/inventory/handling-units/barcodes-by-stage/', { params }),
    getTodayOverview: () => api.get('/inventory/handling-units/today-overview/'),
    getStageCounts: () => api.get('/inventory/handling-units/stage-counts/'),
    getStageDetails: (params) => api.get('/inventory/handling-units/stage-details/', { params }),
    // Transfer documents (PD code, route, supervisors) saved when pallets are transferred
    getTransferDocuments: (params) => api.get('/inventory/transfer-documents/', { params }),
    getTransferDocument: (code) => api.get(`/inventory/transfer-documents/${encodeURIComponent(code)}/`),
    lookupUnit: (params) => api.get('/inventory/handling-units/lookup/', { params }),
    printBatch: (data) => api.post('/inventory/handling-units/print_batch/', data),

    // Production -> staging warehouse transfer completion.
    // Backend has no dedicated "complete-transfer" route; the canonical way to
    // move handling units to a new stage in batch is the scan endpoint
    // (POST /inventory/handling-units/scan/ — "move multiple handling units to a
    // new stage in batch"). scan_values are barcodes/RFIDs.
    // `extra` carries the transfer-form metadata (document_code, transfer_id,
    // supervisor ids); see TRANSFER_DOCUMENT_API_SPEC.md.
    completeTransfer: ({ scan_values, target_stage = STAGING_WAREHOUSE_STAGE, location = null, extra = {} } = {}) =>
        api.post('/inventory/handling-units/scan/', {
            scan_values,
            target_stage,
            ...(location ? { location } : {}),
            ...extra,
        }),

    // Staging Warehouse -> Main Warehouse transfer. scan_values are barcodes /
    // RFID numbers (not internal UUIDs).
    // `extra` carries the transfer-form metadata (document_code, transfer_id, supervisors).
    transferToMainWarehouse: ({ scan_values, target_stage = MAIN_WAREHOUSE_STAGE, location = null, extra = {} } = {}) =>
        api.post('/inventory/handling-units/scan/', {
            scan_values,
            target_stage,
            ...(location ? { location } : {}),
            ...extra,
        }),

    // Diagnostic & Management Tools (Redesigned)
    getUnitStatus: (value) => api.get('/inventory/handling-units/get-status/', { params: { value } }),
    getBarcodeByRfid: (rfid_number) => api.get('/inventory/handling-units/get-barcode/', { params: { rfid_number } }),
    getRfidByBarcode: (barcode) => api.get('/inventory/handling-units/get-rfid/', { params: { barcode } }),

    // Stage Management (CRUD)
    getStages: () => api.get('/inventory/post-production-stages/'),
    createStage: (data) => api.post('/inventory/post-production-stages/', data),
    updateStage: (id, data) => api.patch(`/inventory/post-production-stages/${id}/`, data),
    deleteStage: (id) => api.delete(`/inventory/post-production-stages/${id}/`),

    // Activity Logs
    getActivityLogs: (params) => api.get('/inventory/activity-logs/', { params }),
    getActivityLog: (id) => api.get(`/inventory/activity-logs/${id}/`),

    // Post Production Analytics (computed client-side from available endpoints)
    getBulkBarcodes: async (params) => {
        const res = await api.get('/inventory/handling-units/', {
            params: { page_size: 100, ...params },
        });
        return res;
    },
    getBatchTraceability: async (params) => {
        const res = await api.get('/inventory/handling-units/', {
            params: { page_size: 1000, ...params },
        });
        return res;
    },
    getProductAnalysis: async (params) => {
        const res = await api.get('/inventory/handling-units/', {
            params: { page_size: 1000, ...params },
        });
        return res;
    },
    getPetPerformance: async (params) => {
        const res = await api.get('/inventory/handling-units/', {
            params: { page_size: 1000, ...params },
        });
        return res;
    },
    getLiveMetrics: async (params) => {
        const [overviewRes, stageCountsRes] = await Promise.all([
            api.get('/inventory/handling-units/today-overview/'),
            api.get('/inventory/handling-units/stage-counts/'),
        ]);
        return { data: { data: { overview: overviewRes.data?.data, stageCounts: stageCountsRes.data?.data } } };
    },
    getPacksTrend: async (params) => {
        const res = await api.get('/inventory/handling-units/', {
            params: { page_size: 1000, ...params },
        });
        return res;
    },
    getPalletsTrend: async (params) => {
        const res = await api.get('/inventory/handling-units/', {
            params: { page_size: 1000, ...params },
        });
        return res;
    },
    getWarehouseStageTrend: async (params) => {
        const res = await api.get('/inventory/handling-units/stage-details/', { params });
        return res;
    },
    getCustomerDispatchTrend: async (params) => {
        const res = await api.get('/logistics/shipments/', { params: { page_size: 1000, ...params } });
        return res;
    },
    getVehicleDispatchDetails: async (params) => {
        const res = await api.get('/logistics/shipments/', { params: { page_size: 1000, ...params } });
        return res;
    },
};
