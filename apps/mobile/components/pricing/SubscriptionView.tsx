import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Platform, AppState, Linking } from 'react-native';
import LimitedPromoModal from '@/components/pricing/LimitedPromoModal';
import cx from 'classnames';
import { getCurrentSubscription } from '@/lib/revenuecat';
import useDevice from '@/hooks/useDevice';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SenjaEmbed } from '@/components/shared/SenjaEmbed';
import SubscriptionPlans from '@/components/pricing/SubscriptionPlans';
import FAQs from '@/components/FAQs';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import useUserSettings from '@/services/api/useUserSettings';
import { usePostHog } from 'posthog-react-native';
import { usePromoBanner } from '@/hooks/usePromoBanner';
import Purchases from 'react-native-purchases';

type OnCompleteType = (() => void) | null;

// Usage in your component props
interface SubscriptionViewProps {
    onComplete: OnCompleteType;
}

export default function SubscriptionScreen({ onComplete } : SubscriptionViewProps ) {
    const { isTablet } = useDevice();
    const colorScheme = useColorScheme() || 'light';
    const { token } = useAuth();
    const { userSettings } = useUserSettings();
    const senjaId = colorScheme === 'dark' ? "795539b8-dfb0-4c0d-8c54-7372e9730dbe" : "58203e68-967d-4051-bdbd-cc18e8f51e83";
    const [errorMessage, setErrorMessage] = useState<string | null>(null); // State for error messages
    const [hasPurchased, setHasPurchased] = useState<boolean>(false); // State for error messages
    const [revCatSubscription, setRevCatSubscription] = useState<string | null>(null);
    const [isLoadingUserInfo, setIsLoadingUserInfo] = useState<boolean>(false); // State for websocket 
    const [showPlans, setShowPlans] = useState(true);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const router = useRouter();
    const posthog = usePostHog();
    const [showPromoCodeModal, setShowPromoCodeModal] = usePromoBanner(!userSettings?.user?.langua_pro_enabled);

    const appState = useRef(AppState.currentState);
    const [leftAppForPromoClick, setLeftAppForPromoClick] = useState(false);

    const unlimitedPromoCode = '20ANNUAL';
    const communicatePromoCode = '20ANNUALCOMMUNICATE';

    const { 
        connectWebSocket, 
        closeWebSocket, 
        onMessage, 
        removeMessageListener,
    } = useWebSocket();

    const handleRedirectToSpeak = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        closeWebSocket(-1, 'UserSubscriptionChannel');
        if ( onComplete !== null ) {
            onComplete();
        } else {
            router.replace('/(tabs)/speak');
        }
    };


    useEffect(() => {
        if (token && userSettings?.user?.id) {
            
            connectWebSocket(-1, {
                name: 'UserSubscriptionChannel',
                params: {
                    user_id: userSettings.user.id
                }
            });

            const handleWebSocketMessage = (event: MessageEvent) => {
                let data = event.data?.data || event.data;

                if (data.type === 'subscription_update' && data.event === 'subscription_updated') {
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                    }
                    setIsLoadingUserInfo(false);
                    setHasPurchased(false);
                    handleRedirectToSpeak();
                }
            };

            onMessage(-1, handleWebSocketMessage);

            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                removeMessageListener(-1, handleWebSocketMessage);
                closeWebSocket(-1, 'UserSubscriptionChannel');
            };
        }
    }, [token, userSettings?.user?.id]);

    const handlePurchaseComplete = () => {
        setHasPurchased(true);
        setIsLoadingUserInfo(true);
        setShowPlans(false);

        // Set timeout to route to speak after 10 seconds if no websocket message
        timeoutRef.current = setTimeout(() => {
            setIsLoadingUserInfo(false);
            setHasPurchased(false);
            handleRedirectToSpeak();
        }, 10000);
    };

    useEffect(() => {
        const subscription = AppState.addEventListener('change', async(nextAppState) => {
          if (
            appState.current.match(/inactive|background/) &&
            nextAppState === 'active' &&
            leftAppForPromoClick
          ) {
            setLeftAppForPromoClick(false);
            subscription.remove();
            // refresh the purchase
            try {
                const customerUserInfo = await Purchases.syncPurchases();
                console.log('customerUserInfo', customerUserInfo);
                getCurrentSubscription().then(subscription => {
                    console.log('Sync Subscriptions after returning from background');
                    if (subscription?.length && revCatSubscription !== subscription[0]) {
                        // sub changed - if they are a subscriber, show the speak screen
                        setShowPromoCodeModal(false);
                        posthog.capture('purchased_annual_promo_banner');
                        handleRedirectToSpeak();
                    }
                });

            } catch (error) {
                console.error('Error syncing purchases and getting current subscription', error);
            }
          }
    
          appState.current = nextAppState;
          console.log('AppState', appState.current);
        });
    
        return () => {
          subscription.remove();
        };
      }, [leftAppForPromoClick, revCatSubscription, handleRedirectToSpeak]);


    const handlePromoCodeClick = async (pkgIdentifier: string) => {
        setLeftAppForPromoClick(true);
        if (pkgIdentifier === 'annual') {
            Linking.openURL(`https://apps.apple.com/redeem/?ctx=offercodes&id=6737520234&code=${unlimitedPromoCode}`);
        } else if (pkgIdentifier === 'communicate') {
            Linking.openURL(`https://apps.apple.com/redeem/?ctx=offercodes&id=6737520234&code=${communicatePromoCode}`);
        }
    };


    useEffect(() => {
        getCurrentSubscription().then(subscription => {
            console.log('Subscription', subscription);
            setRevCatSubscription(subscription[0]);
        });
    }, []);

    return (

            <View className="flex-1 justify-center items-center px-6 py-10">
                <View className={cx("w-full", { "max-w-sm": !isTablet, "max-w-4xl": isTablet })}>
                    <LimitedPromoModal
                        isVisible={(showPromoCodeModal && !revCatSubscription) as boolean}
                        onClose={() => {
                            // posthog.capture('dismissed_annual_promo_banner'); - should we add events for dismissing the banner?
                        }}
                        onPackageSelected={handlePromoCodeClick}
                    />
                    
                    {errorMessage && (
                        <View className='mb-4 rounded bg-yellow-500 p-6'>
                            <Text style={GlobalFontStyleSheet.textBase} className="text-white text-bold">{errorMessage}</Text>
                        </View>
                    )}
                    {isLoadingUserInfo && hasPurchased ? (
                        <View className="text-center py-10">
                            <Text style={GlobalFontStyleSheet.textXl} className="text-gray-500 dark:text-white mb-4">
                                Thank you for your purchase!
                            </Text>
                            <Text style={GlobalFontStyleSheet.textBase} className="text-gray-500 dark:text-white mb-4">
                                We're finalizing your subscription. You'll be redirected to start practicing in just a moment...
                            </Text>
                            <ActivityIndicator size="large" color={Colors[colorScheme].text} />
                        </View>
                    ) : showPlans ? (
                        <>
                            <SubscriptionPlans 
                                onCompletePurchase={handlePurchaseComplete} 
                                onPurchaseError={setErrorMessage} 
                            />
                            {Platform.OS === 'android' && (
                              <View className="mb-4">
                                <Text style={GlobalFontStyleSheet.textBase} className="text-center text-gray-500 dark:text-white mb-4">
                                  All Pro plans come with a 30-day moneyback guarantee: try for 30 days, and if you don't love it, simply message our support team and we'll refund you in full.
                                </Text>
                              </View>
                            )}
                            <SenjaEmbed id={senjaId} />
                            <FAQs />
                        </>
                    ) : null}
                </View>
            </View>
    );
} 
