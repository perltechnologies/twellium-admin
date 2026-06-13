import api from './axios';

export const logisticsApi = {
    getVehicles: (params) => api.get('/logistics/vehicles/', { params }),
    createVehicle: (data) => api.post('/logistics/vehicles/', data),
    updateVehicle: (id, data) => api.patch(`/logistics/vehicles/${id}/`, data),
    deleteVehicle: (id) => api.delete(`/logistics/vehicles/${id}/`),
    getDrivers: (params) => api.get('/logistics/drivers/', { params }),
    createDriver: (data) => api.post('/logistics/drivers/', data),
    updateDriver: (id, data) => api.patch(`/logistics/drivers/${id}/`, data),
    deleteDriver: (id) => api.delete(`/logistics/drivers/${id}/`),
    getCustomers: (params) => api.get('/logistics/customers/', { params }),

    getShipments: (params) => api.get('/logistics/shipments/', { params }),
    getShipment: (id) => api.get(`/logistics/shipments/${id}/`),
    createShipment: (data) => api.post('/logistics/shipments/', data),

    markDispatched: (id) => api.post(`/logistics/shipments/${id}/mark-dispatched/`),
};
