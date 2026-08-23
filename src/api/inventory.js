import api from './axios';

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
            params: { page_size: 1000, ...params },
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
