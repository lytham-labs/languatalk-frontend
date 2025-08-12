import React, { useState, useEffect, useCallback } from 'react';
import UpgradeProModal from '@/components/pricing/UpgradeProModal';
import UpgradeUnlimitedModal from '@/components/pricing/UpgradeUnlimitedModal';
import UpgradeWebModal from '@/components/pricing/UpgradeWebModal';
import useUserSubscription from '@/services/api/useUserSubscription';
import useUserSettings from '@/services/api/useUserSettings';
import { identifyUser } from '@/lib/revenuecat';

interface RevenueCatUser {
    activeSubscriptions: string[];
    allExpirationDates: Record<string, string>;
    allPurchaseDates: Record<string, string>;
    entitlements: {
        active: Record<string, any>;
    };
    managementURL: string | null;
}

interface LimitReachedModalProps {
    hasHitLimit: boolean;
    onClose: () => void;
}

const LimitReachedModal: React.FC<LimitReachedModalProps> = ({ hasHitLimit, onClose }) => {
    const { subscriptionInfo } = useUserSubscription();
    const { userSettings } = useUserSettings();
    const [isRevenuecatUser, setIsRevenuecatUser] = useState(false);
    const [revenueCatData, setRevenueCatData] = useState<RevenueCatUser | null>(null);

    useEffect(() => {
        
        const checkUser = async () => {
            console.log('checkUser start');
            const revenueCatUser = await identifyUser({
                uuid: userSettings?.user.uuid || '',
                email: userSettings?.user.email || ''
            });

            setRevenueCatData(revenueCatUser as RevenueCatUser);
            setIsRevenuecatUser(revenueCatUser?.activeSubscriptions.length ? true : false);
        };

        if (userSettings?.user) {
            checkUser();
        }
    }, [userSettings?.user]);


    const handleClose = useCallback(() => {
        onClose();
    }, []);


    if (!revenueCatData) {
        console.log('no revenue cat data');
        return null;
    }

    return (
        <>
            {/* <Text className='text-gray-950 dark:text-white mb-2 text-center'>Limit Reached</Text> */}
            {subscriptionInfo?.plan?.id === 'free' ? (
                <UpgradeProModal isVisible={hasHitLimit} onClose={handleClose} />
            ) : subscriptionInfo?.plan?.id && isRevenuecatUser ? (
                <UpgradeUnlimitedModal isVisible={hasHitLimit} onClose={handleClose} />
            ) : (
                <UpgradeWebModal isVisible={hasHitLimit} onClose={handleClose} />
            )}
        </>
    );
};

export default LimitReachedModal;
