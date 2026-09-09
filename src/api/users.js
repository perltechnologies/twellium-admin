import api from './axios';
import { withEndpointFallbacks } from './fallbacks';

export const usersApi = {
    getUsers: (params) => api.get('/core/users/', { params }),
    createUser: (data) => api.post('/core/users/', data),

    updateUser: (id, data) => api.patch(`/core/users/${id}/`, data),
    deleteUser: (id) => api.delete(`/core/users/${id}/`),
    getCompanies: () => withEndpointFallbacks(
        () => api.get('/core/companies/'),
        [
            () => api.get('/companies/'),
        ]
    ),
};
