import api from './axios';
import { withEndpointFallbacks } from './fallbacks';

export const usersApi = {
    getUsers: (params) => api.get('/core/users/', { params }),
    getUser: (id) => api.get(`/core/users/${id}/`),
    createUser: (data) => api.post('/core/users/', data),

    updateUser: (id, data) => api.patch(`/core/users/${id}/`, data),
    deleteUser: (id) => api.delete(`/core/users/${id}/`),
    getBaseRoles: () => api.get('/core/users/base-roles/'),
    getRoles: (params) => api.get('/core/roles/', { params }),
    getRole: (id) => api.get(`/core/roles/${id}/`),
    createRole: (data) => api.post('/core/roles/', data),
    updateRole: (id, data) => api.patch(`/core/roles/${id}/`, data),
    deleteRole: (id) => api.delete(`/core/roles/${id}/`),
    getPermissions: (params) => api.get('/core/permissions/', { params }),
    getPermission: (id) => api.get(`/core/permissions/${id}/`),
    createPermission: (data) => api.post('/core/permissions/', data),
    updatePermission: (id, data) => api.patch(`/core/permissions/${id}/`, data),
    deletePermission: (id) => api.delete(`/core/permissions/${id}/`),
    seedPermissions: (data = {}) => api.post('/core/permissions/seed/', data),
    getCompanies: () => withEndpointFallbacks(
        () => api.get('/core/companies/'),
        [
            () => api.get('/companies/'),
        ]
    ),
};
