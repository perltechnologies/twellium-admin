import api from './axios';

export const productionApi = {
    // Lines & Shifts
    getLines: () => api.get('/production/lines/'),
    getShifts: () => api.get('/production/shifts/'),

    // Reports
    getReports: (params) => api.get('/production/reports/', { params }),
    getReport: (id) => api.get(`/production/reports/${id}/`),
    createReport: (data) => api.post('/production/reports/', data),
    updateReport: (id, data) => api.patch(`/production/reports/${id}/`, data),
    deleteReport: (id) => api.delete(`/production/reports/${id}/`),

    // Report Actions
    updateStatus: (id, status) => api.post(`/production/reports/${id}/update_status/`, { status }),
    addBatch: (id, data) => api.post(`/production/reports/${id}/add_batch/`, data),
    addMaterial: (id, data) => api.post(`/production/reports/${id}/add_material/`, data),
    addStoppages: (id, data) => api.post(`/production/reports/${id}/add_stoppage_logs/`, data),

    // Runs
    getRuns: (params) => api.get('/production/runs/', { params }),
    startRun: (data) => api.post('/production/runs/', data),
    stopRun: (id) => api.post(`/production/runs/${id}/stop/`),


    // Stoppages
    getStoppages: (params) => api.get('/production/stoppages/', { params }),
    getStoppage: (id) => api.get(`/production/stoppages/${id}/`),
    createStoppage: (data) => api.post('/production/stoppages/', data),
    updateStoppage: (id, data) => api.patch(`/production/stoppages/${id}/`, data),
    deleteStoppage: (id) => api.delete(`/production/stoppages/${id}/`),
    addIncident: (id, data) => api.post(`/production/stoppages/${id}/add_incident/`, data),

    // Materials
    getMaterials: (params) => api.get('/production/materials/', { params }),
    createMaterial: (data) => api.post('/production/materials/', data),
    updateMaterial: (id, data) => api.patch(`/production/materials/${id}/`, data),
    deleteMaterial: (id) => api.delete(`/production/materials/${id}/`),

    // Meters
    getMeters: (params) => api.get('/production/meters/', { params }),
    createMeter: (data) => api.post('/production/meters/', data),
    updateMeter: (id, data) => api.patch(`/production/meters/${id}/`, data),
    deleteMeter: (id) => api.delete(`/production/meters/${id}/`),

    // Pets (Core)
    getPets: (params) => api.get('/core/pets/', { params }),
    createPet: (data) => api.post('/core/pets/', data),
    updatePet: (id, data) => api.patch(`/core/pets/${id}/`, data),
    deletePet: (id) => api.delete(`/core/pets/${id}/`),

    // Shifts
    createShift: (data) => api.post('/production/shifts/', data),
    updateShift: (id, data) => api.patch(`/production/shifts/${id}/`, data),
    deleteShift: (id) => api.delete(`/production/shifts/${id}/`),

    // Batches
    getBatches: (params) => api.get('/production/batches/', { params }),
    createBatch: (data) => api.post('/production/batches/', data),
    updateBatch: (id, data) => api.patch(`/production/batches/${id}/`, data),
    deleteBatch: (id) => api.delete(`/production/batches/${id}/`),
};
