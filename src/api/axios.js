import axios from 'axios';

const BASE_URL = process.env.REACT_APP_BASE_URL;


const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        console.log(process.env.REACT_APP_DEBUG)
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);


api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle 500 errors
        if (error.response?.status === 500) {
            console.error('Server Error (500):', {
                url: originalRequest?.url,
                method: originalRequest?.method,
                data: originalRequest?.data,
                error: error.response?.data
            });
            
            // Return a more user-friendly error
            return Promise.reject({
                ...error,
                message: error.response?.data?.message || 'Server error occurred. Please try again later.',
                isServerError: true
            });
        }

        // Handle 401 errors
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
                        refresh: refreshToken,
                    });

                    localStorage.setItem('access_token', data.data.access);
                    api.defaults.headers.common['Authorization'] = `Bearer ${data.data.access}`;

                    return api(originalRequest);
                } catch (refreshError) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
        }
        
        return Promise.reject(error);
    }
);

export default api;
