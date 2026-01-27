import api from './axios';

export const inventoryApi = {
    getProducts: (params) => api.get('/inventory/products/', { params }),
    getProduct: (id) => api.get(`/inventory/products/${id}/`),
    createProduct: (data) => api.post('/inventory/products/', data),
    updateProduct: (id, data) => api.patch(`/inventory/products/${id}/`, data),
    deleteProduct: (id) => api.delete(`/inventory/products/${id}/`),
};
