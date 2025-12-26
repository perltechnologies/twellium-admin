import api from './axios';

export const usersApi = {
    getUsers: () => api.get('/core/users/'),
    createUser: (data) => api.post('/core/users/', data),
    // According to request, update is PATCH /core/users/{id}/
    updateUser: (id, data) => api.patch(`/core/users/${id}/`, data),
    deleteUser: (id) => api.delete(`/core/users/${id}/`),
    getCompanies: () => api.get('/core/companies/'),
};
