import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { logoutAPI, checkAuthAPI } from '../services/api';
import { removeOfflineCredentials } from '../services/offlineAuth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

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
            const netState = await NetInfo.fetch();
            if (!netState.isConnected || netState.isInternetReachable === false) {
                // Offline start
                console.log('App started offline. Entering offline mode using cached user.');
                const cachedUser = await AsyncStorage.getItem('user');
                if (cachedUser) {
                    setUser(JSON.parse(cachedUser));
                    setIsOfflineMode(true);
                } else {
                    // No cached user to use offline
                    await SecureStore.deleteItemAsync('authToken');
                }
                setIsLoading(false);
                return;
            }

            const serverUser = await checkAuthAPI();
            if (serverUser && serverUser.authenticated !== false) {
                // Merge server data with locally cached user data
                const cachedUser = await AsyncStorage.getItem('user');
                const localUser = cachedUser ? JSON.parse(cachedUser) : {};
                const mergedUser = { ...localUser, ...serverUser, success: true };
                setUser(mergedUser);
                setIsOfflineMode(false);
                await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
            } else {
                throw new Error('Server returned unauthenticated');
            }
        } catch (err) {
            console.warn('Session restore failed — clearing credentials:', err.message);
            // Check if it was a network error instead of 401
            if (err.message === 'Network Error' || !err.response) {
                const cachedUser = await AsyncStorage.getItem('user');
                if (cachedUser) {
                    console.log('Falling back to offline mode due to network error.');
                    setUser(JSON.parse(cachedUser));
                    setIsOfflineMode(true);
                    setIsLoading(false);
                    return;
                }
            }

            // Token is stale or server unreachable — clear and show login
            await SecureStore.deleteItemAsync('authToken');
            await AsyncStorage.removeItem('user');
            setUser(null);
            setIsOfflineMode(false);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (userData, offline = false) => {
        setUser(userData);
        setIsOfflineMode(offline);
        if (!offline) {
            await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
        // Token is already stored in SecureStore by loginAPI in api.js
    };

    const logout = async () => {
        try {
            await logoutAPI();
        } catch (err) {
            console.warn('Logout API failed:', err.message);
        } finally {
            setUser(null);
            setIsOfflineMode(false);
            await SecureStore.deleteItemAsync('authToken');
            await AsyncStorage.removeItem('user');
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, isOfflineMode, login, logout }}>
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
