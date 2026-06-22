import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const RootStack = createNativeStackNavigator();

function AppContent() {
    const { user, isLoading, login } = useAuth();
    const { isDark } = useTheme();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}>
                <ActivityIndicator size="large" color="#0ea5e9" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <SystemBars style={isDark ? 'light' : 'dark'} />
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    <RootStack.Screen name="MainApp" component={AppNavigator} />
                ) : (
                    <RootStack.Screen name="Login">
                        {(props) => <LoginScreen {...props} onLogin={login} />}
                    </RootStack.Screen>
                )}
            </RootStack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    React.useEffect(() => {
        const { initializeAppDb } = require('./src/services/offlineStorage');
        initializeAppDb();
    }, []);

    return (
        <AuthProvider>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </AuthProvider>
    );
}

