import api from './axios';
import { withEndpointFallbacks } from './fallbacks';

export const login = async (credentials) => {
    const response = await api.post('/auth/token/', credentials);
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
};

export const forgotPassword = async (email) => {
    const response = await withEndpointFallbacks(
        () => api.post('/core/auth/forgot-password/', { email }),
        [
            () => api.post('/auth/forgot-password/', { email }),
        ]
    );
    return response.data;
};

export const resetPassword = async (data) => {
    const response = await withEndpointFallbacks(
        () => api.post('/core/auth/reset-password/', data),
        [
            () => api.post('/auth/reset-password/', data),
        ]
    );
    return response.data;
};
