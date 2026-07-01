import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logoutAPI, checkAuthAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        restoreSession();
    }, []);

    /**
     * On app start, try to restore a previous session.
     * Reads auth token from SecureStore, then validates it against /api/me/.
     * If valid → user remains logged in (no need to re-enter credentials).
     * If invalid/expired → silently clear and show login screen.
     */
    const restoreSession = async () => {
        try {
            const authToken = await SecureStore.getItemAsync('authToken');

            if (!authToken) {
                // No token stored — show login screen
                setIsLoading(false);
                return;
            }

            // Token exists — validate with server
            const serverUser = await checkAuthAPI();
            if (serverUser && serverUser.authenticated !== false) {
                // Merge server data with locally cached user data
                const cachedUser = await AsyncStorage.getItem('user');
                const localUser = cachedUser ? JSON.parse(cachedUser) : {};
                const mergedUser = { ...localUser, ...serverUser, success: true };
                setUser(mergedUser);
                await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
            } else {
                throw new Error('Server returned unauthenticated');
            }
        } catch (err) {
            console.warn('Session restore failed — clearing credentials:', err.message);
            // Token is stale or server unreachable — clear and show login
            await SecureStore.deleteItemAsync('authToken');
            await AsyncStorage.removeItem('user');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (userData) => {
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        // Token is already stored in SecureStore by loginAPI in api.js
    };

    const logout = async () => {
        try {
            await logoutAPI();
        } catch (err) {
            console.warn('Logout API failed:', err.message);
        } finally {
            setUser(null);
            await SecureStore.deleteItemAsync('authToken');
            await AsyncStorage.removeItem('user');
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
