import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import SlidingModal from '@/components/shared/SlidingModal';
import { ThemedText } from '@/components/shared/ThemedText';
import { useRouter } from 'expo-router';
import { GlobalFontStyleSheet } from '@/constants/Font';
import BottomUpWindow from '@/components/BottomUpWindow';
import { getCurrentSubscription, TransformedOffering, getOfferings, getCurrentEntitlement, transformOfferings, fetchSubscriptionTerms, TransformedOfferings, formatPriceWithDaily, upgradePackage, getCurrentActiveProductSku } from '@/lib/revenuecat';
import { PRORATION_MODE } from 'react-native-purchases';
import { PackageButton } from '@/components/pricing/SubscriptionPlans';
import { Colors } from '@/constants/Colors';
import useDevice from '@/hooks/useDevice';

interface UpgradeUnlimitedModalProps {
    isVisible: boolean;
    onClose: () => void;
}

const UpgradeUnlimitedModal: React.FC<UpgradeUnlimitedModalProps> = ({
    isVisible,
    onClose,
}) => {
    const [purchaseError, setPurchaseError] = useState<string | null>(null);
    const [offerings, setOfferings] = useState<TransformedOfferings | null>(null);
    const [activeProductSku, setActiveProductSku] = useState<string | null>(null);
    const [activeSubscriptionTerms, setActiveSubscriptionTerms] = useState<'monthly' | 'yearly' | null>(null);
    const [loading, setLoading] = useState(true);
    const [shouldShowSubscriptionPageButton, setShouldShowSubscriptionPageButton] = useState(false);
    const [unlimitedOffering, setUnlimitedOffering] = useState<TransformedOffering | null>(null);
    const { isTablet } = useDevice()

    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    //load the subscription data
    // with transformOfferings - get the unlimited offerings and show the month and yearly price
    // with getCurrentSubscription - get the current subscription and show the remaining days

    const loadSubscriptionData = async () => {
        try {
            setLoading(true);
            const [currentOfferings, currentEntitlement, currentSubscription, activeProductSku] = await Promise.all([
                getOfferings(),
                getCurrentEntitlement(),
                getCurrentSubscription(),
                getCurrentActiveProductSku()
            ]);
            //   need active subscription package for term - monthly or yearly
            const activeSubscriptionPeriod = fetchSubscriptionTerms(currentSubscription, currentOfferings);
            //   need unlimited offering - monthly and yearly
            const transformedOfferings = transformOfferings(currentOfferings);
            const unlimitedOffering = transformedOfferings?.unlimited as TransformedOffering;
            setUnlimitedOffering(unlimitedOffering);
            setActiveProductSku(activeProductSku);
            setActiveSubscriptionTerms(activeSubscriptionPeriod as 'monthly' | 'yearly' | null);
        } catch (error) {
            // if error, show a button to go to the subscription page
            setShouldShowSubscriptionPageButton(true);
            console.error('Error loading subscription data:', error);
        } finally {
            setLoading(false);
        }
    };

    const router = useRouter();
    const isAndroid = Platform.OS === 'android';

    const handlePurchaseFromSubscriptionPage = () => {
        onClose();
        router.navigate('/subscription');
    }

    const handleCloseModal = () => {
        setPurchaseError(null);
        onClose();
    }

    const handleUnlimitedPurchaseUpgrade = async (packageId: string) => {
        setLoading(true);
        setPurchaseError(null);

        try {
            if (Platform.OS === 'android' && activeProductSku) {
                await upgradePackage(
                    packageId,
                    activeProductSku,
                    () => {
                        setLoading(false);
                        onClose();
                    },
                    (error: string) => {
                        console.error('Error purchasing package:', error);
                        setPurchaseError(error);
                        setLoading(false);
                    },
                    {
                        prorationMode: PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE
                    }
                );
            } else {
                // Use regular upgrade for iOS or when feature flag is disabled
                await upgradePackage(
                    packageId,
                    activeProductSku,
                    () => {
                        setLoading(false);
                        onClose();
                    },
                    (error: string) => {
                        console.error('Error purchasing package:', error);
                        setPurchaseError(error);
                        setLoading(false);
                    }
                );
            }
        } catch (error) {
            setLoading(false);
            // Error handling is already done in upgradePackage
        }
    };

    const renderContent = () => (
        <>
            <ScrollView className="px-2 py-2">
                <View className="flex flex-column justify-between border-1 border-white">

                    <View className='flex-1'>
                        <Text style={GlobalFontStyleSheet.textXl} className="py-10 font-bold mb-4 text-center text-blue-500 dark:text-white">
                            Upgrade to Unlimited
                        </Text>
                        <ThemedText style={[GlobalFontStyleSheet.textMd, { lineHeight: isTablet ? 38 : 24 }]} className="text-base text-center mb-4">
                            This will give you unlimited speaking practice in our AI conversation tool.
                        </ThemedText>
                        { activeSubscriptionTerms && (
                        <ThemedText style={GlobalFontStyleSheet.textMd} className="text-base mb-4">
                            {/* do we have have the subscription term in the app */}
                            Today's payment will be reduced based on the remaining days you have on your subscription this {activeSubscriptionTerms}.
                        </ThemedText>
                        )}
                    </View>
                    {(shouldShowSubscriptionPageButton || isAndroid) && (
                        <TouchableOpacity
                            onPress={handlePurchaseFromSubscriptionPage}
                            className={'p-4 rounded-lg border-2 dark:border-peach-500 border-blue-500 bg-blue-500 dark:bg-peach-500'}
                            style={{
                                backgroundImage: 'linear-gradient(to bottom right, #FC5D5D, #3B75E3)'
                            }}
                        >
                            <Text className={'text-base sm:text-xl text-center font-bold text-white'}>
                                Pay & Switch to Unlimited
                            </Text>
                        </TouchableOpacity>
                    )}
                    {!shouldShowSubscriptionPageButton && !isAndroid && (
                        <View>
                            {unlimitedOffering?.annual && (
                                <View>
                                    <Text style={GlobalFontStyleSheet.textSm} className='text-blue-500 dark:text-white font-bold py-4 text-center'>
                                        {formatPriceWithDaily(unlimitedOffering.annual, 'year')}
                                    </Text>
                                    <PackageButton keyTitle="Choose Annual (Best Value)" pkg={unlimitedOffering?.annual} type={'primary'} onPress={(pkgKey) => handleUnlimitedPurchaseUpgrade(pkgKey)} />
                                </View>
                            )}
                            {unlimitedOffering?.monthly && (
                                <View className='pt-4'>
                                    <Text style={GlobalFontStyleSheet.textSm} className='text-blue-500 dark:text-white font-bold py-4 text-center'>
                                        {formatPriceWithDaily(unlimitedOffering.monthly, 'month')}
                                    </Text>
                                    <PackageButton keyTitle="Choose Monthly" pkg={unlimitedOffering?.monthly} type={'secondary'} onPress={(pkgKey) => handleUnlimitedPurchaseUpgrade(pkgKey)} />
                                </View>
                            )}
                        </View>
                    )}

                </View>
            </ScrollView>
        </>
    );

    if (isAndroid) {
        return (
            <BottomUpWindow
                isVisible={isVisible}
                onClose={onClose}
                content={renderContent()}
            />
        );
    }

    useEffect(() => {
        loadSubscriptionData();
    }, []);
    return (
        <SlidingModal visible={isVisible} onClose={handleCloseModal}>
            {loading && (
                <View style={[styles.container, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
                    <ActivityIndicator className="py-8 flex-1 items-center justify-center" size="large" color={Colors[colorScheme]?.tint} />
                </View>
            )}
            {purchaseError && (
                <View className='mb-4 rounded bg-yellow-500 p-6'>
                    <Text style={GlobalFontStyleSheet.textBase} className="text-white text-bold">{purchaseError}</Text>
                </View>
            )}
            {!loading && (
                <View className="pb-4">
                    {renderContent()}
                </View>
            )}
        </SlidingModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    chatItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    chatInfo: {
        flex: 1,
    },
    chatTopic: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#00448f',
        textDecorationLine: 'underline',
    },
    editIcon: {
        marginLeft: 8,
    },
    chatDate: {
        fontSize: 14,
        color: '#484848',
        marginTop: 4,
    },
    chatActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    feedbackButton: {
        padding: 8,
        borderRadius: 5,
        marginRight: 10,
    },
    feedbackButtonText: {
        color: 'white',
        fontSize: 14,
    },
    deleteIcon: {
        padding: 5,
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    emptyStateSubtext: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
        marginBottom: 20,
    },
    startChatButton: {
        backgroundColor: '#00448f',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
    },
    startChatButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    titleInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        paddingVertical: 4,
        marginRight: 8,
        flex: 1,
    },
    editButton: {
        padding: 8,
        marginLeft: 8,
    }
});

export default UpgradeUnlimitedModal;
