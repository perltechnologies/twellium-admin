import api from './axios';

// Stage names follow the backend contract (including its STAGGING spelling).
export const STAGING_WAREHOUSE_STAGE = 'STAGGING';
export const MAIN_WAREHOUSE_STAGE = 'WAREHOUSE';

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

// Loads every page of /inventory/handling-units/. The first page resolves fast so
// the UI can paint straight away; remaining pages are fetched in parallel (when the
// API reports a total count) or followed one by one (when it only reports `next`).
// `onPage(items, { total })` fires per page. Failed pages are retried once and then
// counted in `failedPages` instead of aborting the whole load.
export const loadAllHandlingUnits = async (
    params = {},
    { pageSize = 100, concurrency = 4, onPage, isCancelled = () => false } = {}
) => {
    const fetchPage = async (page) => {
        const request = () => api.get('/inventory/handling-units/', {
            params: { ordering: '-created_at', ...params, page_size: pageSize, page },
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
    transferToMainWarehouse: ({ scan_values, target_stage = MAIN_WAREHOUSE_STAGE, location = null } = {}) =>
        api.post('/inventory/handling-units/scan/', {
            scan_values,
            target_stage,
            ...(location ? { location } : {}),
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
