import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OfflineBanner() {
    return (
        <View style={styles.container}>
            <Ionicons name="flash-off" size={16} color="#B45309" />
            <Text style={styles.text}>Offline Mode — Using cached data</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FEF3C7',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
        gap: 8,
    },
    text: {
        color: '#B45309',
        fontSize: 12,
        fontWeight: '600',
    },
});
