import React from 'react';
import { ScrollView } from 'react-native';
import SubscriptionView from '@/components/pricing/SubscriptionView';
import { useRouter } from 'expo-router';

export default function SubscriptionScreen() {
    const router = useRouter();
    return (
        <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
        >
            <SubscriptionView onComplete={ () => { router.replace('/(tabs)/speak'); }}/>
        </ScrollView>
    );
} 
