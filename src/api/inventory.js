import api from './axios';

export const inventoryApi = {
    getProducts: (params) => api.get('/inventory/products/', { params }),
    getProduct: (id) => api.get(`/inventory/products/${id}/`),
    createProduct: (data) => api.post('/inventory/products/', data),
    updateProduct: (id, data) => api.patch(`/inventory/products/${id}/`, data),
    deleteProduct: (id) => api.delete(`/inventory/products/${id}/`),

    // Handling Units (Post Production)
    createHandlingUnit: (data) => api.post('/inventory/handling-units/', data),
    scanHandlingUnit: (data) => api.post('/inventory/handling-units/scan/', data),
    linkRfid: (data) => api.post('/inventory/handling-units/link-rfid/', data),
    getBarcodesByStage: (params) => api.get(`/inventory/handling-units/barcodes-by-stage/`, { params }),
    getTodayOverview: () => api.get('/inventory/handling-units/today-overview/'),
    getStageCounts: () => api.get('/inventory/handling-units/stage-counts/'),
    getStageDetails: (params) => api.get('/inventory/handling-units/stage-details/', { params }),

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
};
