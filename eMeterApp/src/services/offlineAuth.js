import * as SecureStore from 'expo-secure-store';
import SHA256 from 'crypto-js/sha256';

const MAX_USERS = 5;
const INDEX_KEY = 'offline_users_index';

export const hashPassword = (password) => {
    return SHA256(password).toString();
};

export const saveOfflineCredentials = async (username, password, role) => {
    // Only meter readers are allowed to use offline mode
    if (role !== 'meter_reader') return;
    
    try {
        const hash = hashPassword(password);
        
        let users = [];
        const indexStr = await SecureStore.getItemAsync(INDEX_KEY);
        if (indexStr) {
            users = JSON.parse(indexStr);
        }
        
        // Remove if already exists so we can push to the end (most recent)
        users = users.filter(u => u !== username);
        
        users.push(username);
        
        // Enforce max users
        while (users.length > MAX_USERS) {
            const oldestUser = users.shift();
            await SecureStore.deleteItemAsync(`offline_hash_${oldestUser}`);
            await SecureStore.deleteItemAsync(`offline_role_${oldestUser}`);
        }
        
        await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(users));
        await SecureStore.setItemAsync(`offline_hash_${username}`, hash);
        await SecureStore.setItemAsync(`offline_role_${username}`, role);
        
        console.log(`✅ Offline credentials saved for ${username}`);
    } catch (err) {
        console.error('Error saving offline credentials:', err);
    }
};

export const verifyOfflineCredentials = async (username, password) => {
    try {
        const hash = hashPassword(password);
        const storedHash = await SecureStore.getItemAsync(`offline_hash_${username}`);
        
        if (storedHash === hash) {
            const role = await SecureStore.getItemAsync(`offline_role_${username}`);
            // Extra safety check
            if (role !== 'meter_reader') return null;
            
            return { success: true, role, username };
        }
        
        return null;
    } catch (err) {
        console.error('Error verifying offline credentials:', err);
        return null;
    }
};

export const getOfflineUsers = async () => {
    try {
        const indexStr = await SecureStore.getItemAsync(INDEX_KEY);
        return indexStr ? JSON.parse(indexStr) : [];
    } catch (err) {
        return [];
    }
};

export const removeOfflineCredentials = async (username) => {
    try {
        let users = await getOfflineUsers();
        users = users.filter(u => u !== username);
        
        await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(users));
        await SecureStore.deleteItemAsync(`offline_hash_${username}`);
        await SecureStore.deleteItemAsync(`offline_role_${username}`);
    } catch (err) {
        console.error('Error removing offline credentials:', err);
    }
};
