import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(true);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            // isInternetReachable can be null initially while checking
            setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
            setIsChecking(false);
        });

        // Initial check
        NetInfo.fetch().then(state => {
            setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
            setIsChecking(false);
        });

        return () => unsubscribe();
    }, []);

    return { isOnline, isChecking };
};
