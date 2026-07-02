import api from './axios';

export const workersApi = {
    // Core workers
    getWorkers: (params) => api.get('/core/workers/', { params }),
    getWorker: (id) => api.get(`/core/workers/${id}/`),
    createWorker: (data) => api.post('/core/workers/', data),
    updateWorker: (id, data) => api.patch(`/core/workers/${id}/`, data),
    deleteWorker: (id) => api.delete(`/core/workers/${id}/`),

    // Worker groups
    getWorkerGroups: (params) => api.get('/core/worker-groups/', { params }),
    getWorkerGroup: (id) => api.get(`/core/worker-groups/${id}/`),
    createWorkerGroup: (data) => api.post('/core/worker-groups/', data),
    updateWorkerGroup: (id, data) => api.patch(`/core/worker-groups/${id}/`, data),
    deleteWorkerGroup: (id) => api.delete(`/core/worker-groups/${id}/`),
};
