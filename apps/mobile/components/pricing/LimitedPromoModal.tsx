import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTag, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import SlidingModal from '@/components/shared/SlidingModal';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { TransformedOffering, getOfferings, transformOfferings } from '@/lib/revenuecat';
import { PackageButton } from '@/components/pricing/SubscriptionPlans';
import { Colors } from '@/constants/Colors';
import { usePostHog } from 'posthog-react-native';
interface LimitedPromoModalProps {
    isVisible: boolean;
    onClose?: () => void;
    onPackageSelected: (pkgIdentifier: string) => void;
}

const LimitedPromoModal: React.FC<LimitedPromoModalProps> = ({ isVisible, onClose, onPackageSelected }) => {
    const [loading, setLoading] = useState(true);
    const [unlimitedOffering, setUnlimitedOffering] = useState<TransformedOffering | null>(null);
    const [communicateOffering, setCommunicateOffering] = useState<TransformedOffering | null>(null);
    const [showPromoModal, setShowPromoModal] = useState(false);
    const posthog = usePostHog();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    //load the subscription data
    // with transformOfferings - get the unlimited offerings and show the month and yearly price
    // with getCurrentSubscription - get the current subscription and show the remaining days

    const loadSubscriptionData = async () => {
        try {
            setLoading(true);
            const [currentOfferings] = await Promise.all([
                getOfferings(),
            ]);
            const transformedOfferings = transformOfferings(currentOfferings);
            const unlimitedOffering = transformedOfferings?.unlimited as TransformedOffering;
            setUnlimitedOffering(unlimitedOffering);
            setCommunicateOffering(transformedOfferings?.communicate as TransformedOffering);
        } catch (error) {
            // if error, show a button to go to the subscription page
            console.error('Error loading subscription data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowPromoModal(false);
        if (onClose) {
            onClose();
        }
    }

    const handlePackageSelected = async (pkgIdentifier: string) => {
        try {
            await onPackageSelected(pkgIdentifier);
        } catch (error) {
            console.error('Error selecting package:', error);
        }
    };

    const renderContent = () => (
        <>
            <ScrollView className="p-2">
                <View className="flex flex-column justify-between border-1 border-white">
                    <View className='flex-1'>
                        <Text style={GlobalFontStyleSheet.textXl} className="py-5 font-bold text-center dark:text-white">
                            Limited Time Offer
                        </Text>
                        { unlimitedOffering?.annual && (
                            <View>
                                <Text className="text-center text-gray-500 dark:text-white text-lg mb-5">
                                    Get unlimited 24/7 access to the most advanced AI for language learning at a reduced annual rate. Enjoy substantial savings compared to monthly plans.
                                </Text>
                                <PackageButton keyTitle="Claim discount & 7-day free trial" pkg={unlimitedOffering.annual} type={'secondary'} onPress={() => handlePackageSelected('annual')} />
                            </View>
                        )}
                        { communicateOffering?.annual && (
                            <View className='py-5'>
                                <Text className="text-center text-gray-500 dark:text-white">
                                    Don't need unlimited practice? 
                                </Text>
                                <Pressable onPress={() => handlePackageSelected('communicate')}>
                                    <Text className="text-center text-blue-500 dark:text-white font-bold">
                                        Check the Communicate Plan discount.
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </>
    );

    useEffect(() => {
        loadSubscriptionData();
    }, []);

    const handleShowPromoModal = () => {
        // posthog event for clicking promo banner
        posthog.capture('clicked_annual_promo_banner');
        setShowPromoModal(true);
    }

    return (
        <>
            { isVisible && (
                <View className='flex-1 w-full border-1 border-black'>
                    {/* Annual savings banner */}
                    <Pressable className="bg-amber-50 dark:bg-amber-500 border border-amber-300 dark:border-amber-500 rounded-lg p-3 mb-4 w-full flex flex-row items-center justify-between cursor-pointer shadow-sm mx-auto"
                        onPress={() => handleShowPromoModal()}>
                            <FontAwesomeIcon icon={faTag} className="text-amber-600 dark:text-white" />
                            <View className='flex-auto px-2 flex-column items-center justify-center'>
                                <Text className="flex-auto text-blue-500 dark:text-white font-xs px-2 font-bold">Annual savings available today</Text>
                                <Text className="flex-auto text-blue-500 dark:text-white font-xs px-2 font-bold">click to learn more</Text>
                            </View>
                            <FontAwesomeIcon icon={faArrowRight} className="text-amber-600 dark:text-white" />
                        
                    </Pressable>
                </View>
            )}
            <SlidingModal visible={showPromoModal} onClose={handleCloseModal}>
                {loading && (
                    <View className="p-4 flex-1" style={[{ backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
                        <ActivityIndicator className="py-8 flex-1 items-center justify-center" size="large" color={Colors[colorScheme]?.tint} />
                    </View>
                )}
                {!loading && (
                    <View className="pb-6">
                        {renderContent()}
                    </View>
                )}
            </SlidingModal>
        </>
    );
};

export default LimitedPromoModal;
