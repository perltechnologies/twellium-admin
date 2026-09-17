import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout } from '../api/auth';
import { usersApi } from '../api/users';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { canAccessPrivilege, isAdministrator } from '../config/pagePrivileges';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const persistUser = (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const unwrapUser = (response) => response?.data?.data ?? response?.data ?? response;

    const refreshUser = async (fallbackUser = user) => {
        if (!fallbackUser?.id) return fallbackUser;
        try {
            const response = await usersApi.getUser(fallbackUser.id);
            const latestUser = unwrapUser(response);
            if (latestUser?.id) {
                persistUser(latestUser);
                return latestUser;
            }
        } catch (error) {
            // A stale cached user is preferable to logging someone out during a
            // temporary API failure. Authorization still uses the cached claims.
            console.warn('Unable to refresh the current user profile', error);
        }
        return fallbackUser;
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');

        if (storedUser && token) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                refreshUser(parsedUser).finally(() => setLoading(false));
                return;
            } catch (error) {
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
        // refreshUser deliberately reads only the supplied cached user here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (username, password) => {
        try {
            const response = await apiLogin({ username, password });

            const { access, refresh, user: userData } = response.data;

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            persistUser(userData);
            return { success: true };
        } catch (error) {
            console.error("Login failed", error);
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const logout = () => {
        apiLogout();
        setUser(null);
    };

    if (loading) {
        return <LoadingSpinner fullScreen size="lg" />;
    }

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            loading,
            refreshUser: () => refreshUser(user),
            isAdmin: isAdministrator(user),
            canAccess: (privilegeKey) => canAccessPrivilege(user, privilegeKey),
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

export { AuthContext };
