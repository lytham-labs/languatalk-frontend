import React from 'react';
import { ScrollView } from 'react-native';
import SubscriptionView from '@/components/pricing/SubscriptionView';
import { router } from 'expo-router';

export default function ManagerSubscriptionScreen() {

  return (
    <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
        >
        <SubscriptionView onComplete={ () => {
            router.back();
        }}/>
    </ScrollView>
  );
}
