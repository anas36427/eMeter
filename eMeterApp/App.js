import React from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import LoginScreen from './src/screens/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

function AppContent() {
    const { user, isLoading, login } = useAuth();
    const { isDark } = useTheme();

    if (isLoading) {
        return null;
    }

    return (
        <>
            <SystemBars style={isDark ? 'light' : 'dark'} />
            {user ? (
                <AppNavigator />
            ) : (
                <LoginScreen onLogin={login} />
            )}
        </>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </AuthProvider>
    );
}

