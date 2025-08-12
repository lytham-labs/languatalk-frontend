import React, { useCallback } from 'react';
import UpgradeProModal from '@/components/pricing/UpgradeProModal';
import UpgradeCommunicateCallLimitModal from '@/components/pricing/UpgradeCommunicateCallLimitModal';
import useUserSubscription from '@/services/api/useUserSubscription';

interface CallModeLimitReachedModalProps {
    isVisible: boolean;
    onClose: () => void;
    simulatedPlanIdOverride?: string | null;
}

const CallModeLimitReachedModal: React.FC<CallModeLimitReachedModalProps> = ({ isVisible, onClose, simulatedPlanIdOverride }) => {
    const { subscriptionInfo, loading, error } = useUserSubscription();

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    if (loading) {
        // Optionally, render a loading indicator or null
        return null;
    }

    if (error) {
        // Optionally, render an error message or null
        console.error("Error fetching subscription info for CallModeLimitReachedModal:", error);
        return null;
    }

    // Determine which modal to show based on the plan ID
    const planToEvaluate = simulatedPlanIdOverride !== undefined ? simulatedPlanIdOverride : subscriptionInfo?.plan?.id;

    if (planToEvaluate?.toLowerCase() === 'free') {
        return <UpgradeProModal isVisible={isVisible} onClose={handleClose} usageContext="call" />;
    }

    if (planToEvaluate && /communicate/i.test(planToEvaluate)) {
        return <UpgradeCommunicateCallLimitModal isVisible={isVisible} onClose={handleClose} />;
    }
    
    // Fallback or if plan is not 'free' or 'communicate' (e.g. already unlimited, or other cases)
    // In the context of a call limit being hit, this path might indicate an unexpected state
    // or a user on a plan that shouldn't have this specific modal triggered (e.g. Unlimited).
    // For now, returning null, but might need a specific web/fallback modal if requirements change.
    console.warn(`CallModeLimitReachedModal shown for unexpected plan: ${planToEvaluate}`);
    return null; 
};

export default CallModeLimitReachedModal; 
