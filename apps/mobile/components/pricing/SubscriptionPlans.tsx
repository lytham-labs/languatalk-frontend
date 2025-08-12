import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import cx from 'classnames';
import { PurchasesPackage, PURCHASES_ERROR_CODE, PurchasesError, IntroEligibility, INTRO_ELIGIBILITY_STATUS, PRORATION_MODE } from 'react-native-purchases';
import { getCurrentSubscription, purchasePackage, getOfferings, transformOfferings, TransformedOfferings, TransformedOffering, packageDescriptions, formatPriceWithDaily, getTrialOrIntroductoryPriceEligibility, upgradePackage, getCurrentEntitlement, getSubscriptionChangeType, getCurrentActiveProductSku } from '@/lib/revenuecat';
import FeatureListUI from '@/components/pricing/FeatureListUI';
import { unlimitedPlanFeatures, communicatePlanFeatures } from '@/constants/Features';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { SubscriptionTitles, SubscriptionType } from '@/constants/Subscriptions';
import useDevice from '@/hooks/useDevice';
import * as Sentry from '@sentry/react-native';

interface SubscriptionPlansProps {
  onCompletePurchase: () => void; // or (result: any) => void if it takes a result
  onPurchaseError: (errorMessage: string) => void;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ onCompletePurchase, onPurchaseError }) => {
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState<TransformedOfferings | null>(null);
  const [trialOrIntroductoryPriceEligibility, setTrialOrIntroductoryPriceEligibility] = useState<{ [productId: string]: IntroEligibility } | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<string[]>([]);
  const [activeProductSku, setActiveProductSku] = useState<string | null>(null);
  const { isTablet, isPhone } = useDevice();

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      const [currentOfferings, currentSubscription, currentEntitlement, activeProductSku] = await Promise.all([
        getOfferings(),
        getCurrentSubscription(),
        getCurrentEntitlement(),
        getCurrentActiveProductSku()
      ]);
      const trialOrIntroductoryPriceEligibility = await getTrialOrIntroductoryPriceEligibility(currentOfferings);
      setTrialOrIntroductoryPriceEligibility(trialOrIntroductoryPriceEligibility);
      setOfferings(transformOfferings(currentOfferings));
      setActiveSubscription(currentSubscription);
      setActiveProductSku(activeProductSku);
      
      // Log current subscription state
      Sentry.captureMessage('Subscription data loaded', {
        level: 'info',
        extra: {
          activeSubscription: currentSubscription,
          activeProductSku: activeProductSku,
          entitlementDetails: currentEntitlement ? {
            identifier: currentEntitlement.identifier,
            productIdentifier: currentEntitlement.productIdentifier,
            isActive: currentEntitlement.isActive
          } : null
        },
        tags: {
          subscription_action: 'data_loaded'
        }
      });
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId: string) => {
    try {
      setLoading(true);
      onPurchaseError('');

      if (Platform.OS === 'android' && activeProductSku) {
        // Determine the type of subscription change
        const changeType = await getSubscriptionChangeType(activeProductSku, packageId);
        
        // Log the subscription change details
        Sentry.captureMessage('Subscription change type determined', {
          level: 'info',
          extra: {
            currentPackageId: activeProductSku,
            newPackageId: packageId,
            changeType,
            activeSubscription,
            activeProductSku
          },
          tags: {
            subscription_action: 'change_type_detected',
            change_type: changeType
          }
        });
        
        // Map change type to proration mode
        let prorationMode;
        switch (changeType) {
          case 'upgrade':
            prorationMode = PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE;
            break;
          case 'downgrade':
            prorationMode = PRORATION_MODE.IMMEDIATE_WITHOUT_PRORATION;
            break;
          case 'lateral':
            prorationMode = PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION;
            break;
          default:
            prorationMode = PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION;
        }

        await upgradePackage(
          packageId,
          activeProductSku,
          () => {
            onCompletePurchase();
            loadSubscriptionData();
          },
          onPurchaseError,
          {
            prorationMode
          }
        );
      } else {
        await purchasePackage(packageId);
        onCompletePurchase();
        await loadSubscriptionData();
      }
    } catch (error) {
      const purchaseError = error as PurchasesError;
      
      // Handle specific RevenueCat errors
      switch (purchaseError.code) {
        case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
          onPurchaseError('Purchase was cancelled');
          break;
        case PURCHASES_ERROR_CODE.NETWORK_ERROR:
          onPurchaseError('Network error. Please check your internet connection');
          break;
        case PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR:
          onPurchaseError('The purchase receipt was invalid. Please try again');
          break;
        case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
          onPurchaseError('You already own this product');
          break;
        case PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR:
          onPurchaseError('This purchase is already associated with a different account');
          break;
        case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
          onPurchaseError('Payment is pending. Please check your payment method');
          break;
        case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
          onPurchaseError('This product is not currently available for purchase');
          break;
        case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
          onPurchaseError('Purchases are not allowed on this device');
          break;
        case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
          onPurchaseError('You appear to be offline. Please check your internet connection');
          break;
        case PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR:
          onPurchaseError('There was a problem with the store credentials. Please contact support');
          break;
        case PURCHASES_ERROR_CODE.UNKNOWN_ERROR:
          onPurchaseError('An unknown error occurred. Please try again later');
          break;
        default:
          // Use the error message from RevenueCat if available
          onPurchaseError(purchaseError.message || 'An unexpected error occurred');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className={cx('flex-1', {
      'flex-row gap-8': isTablet,
      'flex-col gap-4': isPhone,
    })}>
      {activeSubscription.length > 0 && (
        <>
          {activeSubscription.map((sub) => (
            <>
              <View className="mt-4 p-4 bg-green-100 rounded-lg">
                <Text className="font-bold">Active Subscription</Text>
                <Text className="font-bold">{SubscriptionTitles[sub as keyof typeof SubscriptionTitles]}</Text>
              </View>
              <PackgroundContainer subscriptionKey={sub as SubscriptionType} pkgKey='unlimited' pkg={offerings?.unlimited || null} onSelectPackage={handlePurchase} trialOrIntroductoryPriceEligibility={trialOrIntroductoryPriceEligibility} />
              <PackgroundContainer subscriptionKey={sub as SubscriptionType} pkgKey='communicate' pkg={offerings?.communicate || null} onSelectPackage={handlePurchase} trialOrIntroductoryPriceEligibility={trialOrIntroductoryPriceEligibility} />
            </>
          ))}
        </>
      )}
      {/* lookup by pkg.identifier and have description by first key in split from key_rate pattern  */}
      {activeSubscription.length === 0 && (
        <>
          <PackgroundContainer pkgKey='unlimited' pkg={offerings?.unlimited || null} onSelectPackage={handlePurchase} trialOrIntroductoryPriceEligibility={trialOrIntroductoryPriceEligibility} />
          <PackgroundContainer pkgKey='communicate' pkg={offerings?.communicate || null} onSelectPackage={handlePurchase} trialOrIntroductoryPriceEligibility={trialOrIntroductoryPriceEligibility} />
        </>
      )}
      {/* group */}
    </View>
  );
}
function PackgroundContainer({ subscriptionKey, pkgKey, pkg, onSelectPackage, trialOrIntroductoryPriceEligibility }: { subscriptionKey?: string | undefined, pkgKey: string, pkg: TransformedOffering | null, onSelectPackage: (id: string) => Promise<void>, trialOrIntroductoryPriceEligibility: { [productId: string]: IntroEligibility } | null }) {
  const [showUnlimitedFeatures, setShowUnlimitedFeatures] = useState(false);
  const [showCommunicateFeatures, setShowCommunicateFeatures] = useState(false);
  const { isTablet, isPhone } = useDevice();

  const isPkgDisabled = useCallback((subscriptionKey: string | undefined, pkg: TransformedOffering | null) => {
    if (subscriptionKey && pkg) {
      return {
        isAnnualDisabled: pkg?.annual?.product.identifier === subscriptionKey,
        isMonthlyDisabled: pkg?.monthly?.product.identifier === subscriptionKey || pkg?.annual?.product.identifier === subscriptionKey,
      }
    }
    return {
      isAnnualDisabled: false,
      isMonthlyDisabled: false,
    }
  }, []);
  const { isAnnualDisabled, isMonthlyDisabled } = isPkgDisabled(subscriptionKey, pkg);

  const annualButtonText = pkg?.annual && trialOrIntroductoryPriceEligibility?.[pkg.annual.product.identifier]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
    ? 'Choose Annual (1-week free trial)' 
    : 'Choose Annual (Best Value)';
  const monthlyButtonText = pkg?.monthly && trialOrIntroductoryPriceEligibility?.[pkg.monthly.product.identifier]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
    ? 'Choose Monthly (3-day free trial)' 
    : 'Choose Monthly';
  
  return (
    <View className={cx('flex flex-col flex-1 bg-white dark:bg-gray-700 rounded-lg pt-6 mb-4 shadow', {
      'p-6': isTablet,
      'p-4': isPhone,
    })}>
      <Text style={GlobalFontStyleSheet.textXl} className="text-blue-500 dark:text-white text-center font-bold mb-4 capitalize">{pkgKey}</Text>
      <Text style={GlobalFontStyleSheet.textMd}  className="text-blue-500 dark:text-white text-center flex-auto mb-2">
        {packageDescriptions[pkgKey as keyof typeof packageDescriptions]}
      </Text>

      {pkgKey === 'unlimited' && (
        <View className="py-2">
          <TouchableOpacity onPress={() => setShowUnlimitedFeatures(!showUnlimitedFeatures)}>
            <Text style={GlobalFontStyleSheet.textMd} className="text-center font-bold text-blue-500 dark:text-white underline mb-2">
              {showUnlimitedFeatures ? 'Hide feature list' : 'Click to discover key features'}
            </Text>
          </TouchableOpacity>
          {showUnlimitedFeatures && (
            <FeatureListUI features={unlimitedPlanFeatures} />
          )}
        </View>
      )}
      {pkgKey === 'communicate' && (
        <View className="py-2">
          <TouchableOpacity onPress={() => setShowCommunicateFeatures(!showCommunicateFeatures)}>
          <Text style={GlobalFontStyleSheet.textMd} className="text-center font-bold text-blue-500 dark:text-white underline mb-2">
              {showCommunicateFeatures ? 'Hide feature list' : 'Click to discover key features'}
            </Text>
          </TouchableOpacity>
          {showCommunicateFeatures && (
            <FeatureListUI features={communicatePlanFeatures} />
          )}
        </View>
      )}

      {/* the two keys for monthly and annual */}
      {pkg?.annual && (
        <View>
          <Text style={GlobalFontStyleSheet.text14} className='text-blue-500 dark:text-white font-bold py-4 text-center'>
            {formatPriceWithDaily(pkg.annual, 'year')}
          </Text>
          <PackageButton keyTitle={annualButtonText} pkg={pkg?.annual} type={isAnnualDisabled ? 'disabled' : 'primary'} onPress={onSelectPackage} />
        </View>
      )}
      {pkg?.monthly && (
        <View className='pt-4'>
          <Text style={GlobalFontStyleSheet.text14} className='text-blue-500 dark:text-white font-bold py-4 text-center'>
            {formatPriceWithDaily(pkg.monthly, 'month')}
          </Text>
          <PackageButton keyTitle={monthlyButtonText} pkg={pkg?.monthly!} type={isMonthlyDisabled ? 'disabled' : 'secondary'} onPress={onSelectPackage} />
        </View>
      )}
    </View>
  );
}
export function PackageButton({ pkg, type = "primary", keyTitle, onPress }: { pkg: PurchasesPackage, type?: 'primary' | 'secondary' | 'disabled', keyTitle: string, onPress: (id: string) => Promise<void> }) {
  return (
    <TouchableOpacity
      key={pkg?.identifier}
      className={cx('p-4 rounded-lg border-2 ', {
        'dark:border-peach-500 border-blue-500 bg-blue-500 dark:bg-peach-500': type === 'primary',
        'dark:border-peach-100 border-blue-50 bg-blue-50 dark:bg-peach-100': type === 'secondary',
        'bg-gray-200 border-gray-500': type === 'disabled',
      })}
      disabled={type === 'disabled'}
      onPress={() => {
        if (pkg) {
          onPress(pkg.identifier)
        }
      }}
    >
      <Text className={cx('text-lg sm:text-xxl text-center font-bold', {
        'text-white': type === 'primary',
        'text-blue-500 dark:text-peach-500': type === 'secondary',
        'text-gray-300': type === 'disabled',
      })}>
        {keyTitle}
      </Text>
    </TouchableOpacity>
  );
}




export default SubscriptionPlans;
