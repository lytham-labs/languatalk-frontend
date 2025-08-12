import Purchases, { 
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  PURCHASES_ERROR_CODE,
  LOG_LEVEL,
  PurchasesError,
  PRORATION_MODE,
  PurchasesEntitlementInfo,
  IntroEligibility,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import * as Sentry from '@sentry/react-native';


interface UserIdentity {
  uuid: string;
  email: string;
}

// Define the type for the transformed offerings
export interface TransformedOffering {
  monthly?: PurchasesPackage | null;
  annual?: PurchasesPackage | null;
}
export interface TransformedOfferings {
  'unlimited': TransformedOffering,
  'communicate': TransformedOffering,
}

export const packageDescriptions = {
  'unlimited': 'Unlimited conversation practice. 24/7 access to the most advanced AI for language learning.',
  'communicate': 'Access everything in Unlimited, except conversations are capped at 75 messages per day (takes 45 mins on average).'
};

let isInitialized = false;

export const identifyUser = async (user: UserIdentity): Promise<CustomerInfo | undefined> => {
  try {
    if (!isInitialized) {
      // First time initialization
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      await Purchases.configure({
        apiKey: Platform.select({
          ios: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
          android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
        }) || '',
        appUserID: user.uuid,
        useAmazon: false
      });
      Purchases.enableAdServicesAttributionTokenCollection();

      isInitialized = true;
    } else {
      // Switch user
      await Purchases.logIn(user.uuid);
    }

    // Set user attributes
    if (user.email) {
      await Purchases.setEmail(user.email);
    }

    const customerInfo = await Purchases.getCustomerInfo();
    // console.log('RevenueCat User Identified:', {
    //   customerInfo,
    //   userId: user.uuid,
    //   isInitialized
    // });

    return customerInfo;
  } catch (error) {
    console.error('Failed to identify RevenueCat user:', error);
    throw error;
  }
};

export const syncPurchases = async () => {
  try {
    if (!isInitialized) {
      throw new Error('RevenueCat not initialized');
    }
    await Purchases.syncPurchases();
  } catch (error) {
    console.error('Error syncing purchases:', error);
    throw error;
  }
}

export const fetchSubscriptionTerms = (activeSubscriptionIds: string[], offerings: PurchasesOffering | null) => {
  if (!offerings) {
    return null;
  }
  // Find the subscription terms for active subscriptions
  const activeSubscriptionTerms = offerings?.availablePackages.filter(pkg =>
      activeSubscriptionIds.includes(pkg.identifier)
  ).map(pkg => {
    const isMonth = pkg.identifier.includes('monthly');
    return isMonth ? 'month' : 'year';
  });
  // this is assuming there is only one active subscription
  return activeSubscriptionTerms?.[0] ?? null;
};

export const getCurrentSubscription = async (): Promise<string[]> => {
  try {
    if (!isInitialized) {
      console.warn('RevenueCat not initialized when fetching subscription');
      return [];
    }

    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.activeSubscriptions;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return [];
  }
};

export const purchasePackage = async (packageId: string): Promise<CustomerInfo | undefined> => {
  try {
    if (!isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    const offerings = await Purchases.getOfferings();
    const purchasePackage = offerings.current?.availablePackages.find(
      pkg => pkg.identifier === packageId
    );
    
    if (purchasePackage) {
      const { customerInfo } = await Purchases.purchasePackage(purchasePackage);
      return customerInfo;
    }
  } catch (error) {
    console.error('Error making purchase:', error);
    throw error;
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    if (!isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
};

export const getTrialOrIntroductoryPriceEligibility = async (offerings: PurchasesOffering | null): Promise<{ [productId: string]: IntroEligibility } | null> => {
  if (!offerings) {
    return null;
  }
  try {
    const productIds = offerings.availablePackages.map(pkg => pkg.product.identifier);
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
    return eligibility;
  } catch (error) {
    console.error('Error fetching trial or introductory price eligibility:', error);
    return null;
  }
};

export const transformOfferings = (offerings: PurchasesOffering | null) => {
  const transformedOfferings: TransformedOfferings = {
    'unlimited': {
      'monthly': null,
      'annual': null,
    },
    'communicate': {
      'monthly': null,
      'annual': null,
    },
  };
  if (Array.isArray(offerings?.availablePackages)) {
    offerings.availablePackages.forEach((purchasePackage: PurchasesPackage) => {
      const key = purchasePackage.identifier.includes('unlimited') ? 'unlimited' : 'communicate';
      const isMonth = purchasePackage.identifier.includes('monthly');
      const isAnnual = purchasePackage.identifier.includes('annual');
      if (isMonth) {
        transformedOfferings[key]['monthly'] = purchasePackage;
      }
      if (isAnnual) {
        transformedOfferings[key]['annual'] = purchasePackage;
      }
    });
  }
  return transformedOfferings;
}

export const formatPriceWithDaily = (pkg: PurchasesPackage, period: 'month' | 'year') => {
  const price = pkg.product.price;
  const dailyPrice = calculateDailyPrice(price, period);
  const currencyCode = pkg.product.currencyCode;

  // Format the daily price using the Intl.NumberFormat
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${pkg.product.priceString} / ${period} (${formatter.format(dailyPrice)} / day)`;
};

const calculateDailyPrice = (price: number, period: 'month' | 'year') => {
  const daysInPeriod = period === 'year' ? 365 : 30.42;
  return Number((price / daysInPeriod).toFixed(2));
};

export const handlePurchase = async (packageId: string, onCompletePurchase: () => void, onPurchaseError: (error: string) => void) => {
    try {
      await purchasePackage(packageId);
      onCompletePurchase();// Refresh subscription status
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
    }
  };

interface UpgradePackageOptions {
  prorationMode?: PRORATION_MODE;
}

export const upgradePackage = async (
  packageId: string, 
  oldProductIdentifier: string,
  onCompletePurchase: () => void,
  onPurchaseError: (error: string) => void,
  options?: UpgradePackageOptions
): Promise<CustomerInfo | undefined> => {
  try {
    if (!isInitialized) {
      throw new Error('RevenueCat not initialized');
    }

    // Get customer info before upgrade to log current state
    const customerInfoBefore = await Purchases.getCustomerInfo();
    
    // Log pre-upgrade state
    Sentry.captureMessage('Subscription upgrade initiated', {
      level: 'info',
      extra: {
        packageId,
        oldProductIdentifier,
        platform: Platform.OS,
        prorationMode: options?.prorationMode,
        activeSubscriptions: customerInfoBefore.activeSubscriptions,
        entitlements: Object.keys(customerInfoBefore.entitlements.active).map(key => ({
          key,
          productIdentifier: customerInfoBefore.entitlements.active[key].productIdentifier,
          identifier: customerInfoBefore.entitlements.active[key].identifier
        })),
        allPurchasedProductIdentifiers: customerInfoBefore.allPurchasedProductIdentifiers
      },
      tags: {
        subscription_action: 'upgrade_start',
        platform: Platform.OS
      }
    });

    const offerings = await Purchases.getOfferings();
    const purchasePackage = offerings.current?.availablePackages.find(
      pkg => pkg.identifier === packageId
    );

    if (purchasePackage) {
      if (Platform.OS === 'android') {
        // Default to TIME_PRORATION for backwards compatibility
        let prorationMode = PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION;
        
        // Use new proration modes only if feature flag is enabled
        if (options?.prorationMode) {
          prorationMode = options.prorationMode;
        }

        // Log Android-specific upgrade parameters
        Sentry.captureMessage('Android subscription upgrade parameters', {
          level: 'info',
          extra: {
            newPackageId: packageId,
            newProductId: purchasePackage.product.identifier,
            oldSKU: oldProductIdentifier,
            prorationMode,
            packageDetails: {
              identifier: purchasePackage.identifier,
              productIdentifier: purchasePackage.product.identifier,
              priceString: purchasePackage.product.priceString,
              price: purchasePackage.product.price
            }
          },
          tags: {
            subscription_action: 'android_upgrade_params',
            proration_mode: prorationMode
          }
        });

        const { customerInfo } = await Purchases.purchasePackage(purchasePackage, {
          oldSKU: oldProductIdentifier,
          prorationMode
        });
        
        // Log successful upgrade
        Sentry.captureMessage('Subscription upgrade completed', {
          level: 'info',
          extra: {
            newActiveSubscriptions: customerInfo.activeSubscriptions,
            newEntitlements: Object.keys(customerInfo.entitlements.active).map(key => ({
              key,
              productIdentifier: customerInfo.entitlements.active[key].productIdentifier
            }))
          },
          tags: {
            subscription_action: 'upgrade_success',
            platform: Platform.OS
          }
        });
        
        onCompletePurchase();
        return customerInfo;
      } else {
        // iOS behavior remains unchanged
        const { customerInfo } = await Purchases.purchasePackage(purchasePackage);
        onCompletePurchase();
        return customerInfo;
      }
    }
  } catch (error) {
    const purchaseError = error as PurchasesError;
    
    // Log upgrade error
    Sentry.captureException(error, {
      tags: {
        subscription_action: 'upgrade_error',
        platform: Platform.OS,
        error_code: purchaseError.code
      },
      extra: {
        packageId,
        oldProductIdentifier,
        errorMessage: purchaseError.message,
        underlyingErrorMessage: purchaseError.underlyingErrorMessage
      }
    });
    
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
        onPurchaseError(purchaseError.message || 'An unexpected error occurred');
        break;
    }
    throw error;
  }
};

// Helper function to determine if new package is an upgrade, downgrade, or lateral move
export const getSubscriptionChangeType = async (
  currentPackageId: string,
  newPackageId: string
): Promise<'upgrade' | 'downgrade' | 'lateral' | 'unknown'> => {
  try {
    const offerings = await Purchases.getOfferings();
    const currentPackage = offerings.current?.availablePackages.find(
      pkg => pkg.identifier === currentPackageId
    );
    const newPackage = offerings.current?.availablePackages.find(
      pkg => pkg.identifier === newPackageId
    );

    if (!currentPackage || !newPackage) {
      return 'unknown';
    }

    const currentPrice = currentPackage.product.price;
    const newPrice = newPackage.product.price;

    if (newPrice > currentPrice) {
      return 'upgrade';
    } else if (newPrice < currentPrice) {
      return 'downgrade';
    } else {
      return 'lateral';
    }
  } catch (error) {
    console.error('Error determining subscription change type:', error);
    return 'unknown';
  }
};

export const getCurrentEntitlement = async (): Promise<PurchasesEntitlementInfo | undefined> => {
  try {
    if (!isInitialized) {
      throw new Error('RevenueCat not initialized');
    }
    const customerInfo = await Purchases.getCustomerInfo();
    const allEntitlements = Object.values(customerInfo.entitlements.all);
    const activeEntitlements = Object.values(customerInfo.entitlements.active);
    
    // Log entitlement details
    Sentry.captureMessage('Fetching current entitlement', {
      level: 'info',
      extra: {
        activeSubscriptions: customerInfo.activeSubscriptions,
        allEntitlements: allEntitlements.map(ent => ({
          identifier: ent.identifier,
          productIdentifier: ent.productIdentifier,
          isActive: ent.isActive
        })),
        activeEntitlements: activeEntitlements.map(ent => ({
          identifier: ent.identifier,
          productIdentifier: ent.productIdentifier
        })),
        firstEntitlement: allEntitlements[0] ? {
          identifier: allEntitlements[0].identifier,
          productIdentifier: allEntitlements[0].productIdentifier
        } : null
      },
      tags: {
        subscription_action: 'get_entitlement'
      }
    });
    
    return customerInfo.entitlements.all[0];
  } catch (error) {
    console.error('Error fetching entitlement:', error);
    return undefined;
  }
};

// Get the current active product SKU for Android upgrades
export const getCurrentActiveProductSku = async (): Promise<string | null> => {
  try {
    if (!isInitialized) {
      throw new Error('RevenueCat not initialized');
    }
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Log all subscription-related data to understand what we have
    console.log('DEBUG: Customer subscription data:', {
      activeSubscriptions: customerInfo.activeSubscriptions,
      allPurchasedProductIdentifiers: customerInfo.allPurchasedProductIdentifiers,
      entitlements: Object.keys(customerInfo.entitlements.active).map(key => ({
        key,
        productIdentifier: customerInfo.entitlements.active[key].productIdentifier,
        identifier: customerInfo.entitlements.active[key].identifier
      }))
    });
    
    // For Android upgrades, we need the actual product ID from activeSubscriptions
    // not the entitlement's productIdentifier
    return customerInfo.activeSubscriptions[0] || null;
  } catch (error) {
    console.error('Error fetching active product SKU:', error);
    return null;
  }
};
// Add a helper to check initialization status
export const isRevenueCatInitialized = () => isInitialized;

// Add helper to check if a RevenueCat error is due to user cancellation
export const isUserCancelledError = (error: any): boolean => {
  return error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
};

/**
 * Presents the RevenueCat Customer Center UI
 * This allows users to manage their subscriptions, view purchase history,
 * and request refunds directly within the app
 *
 * @returns {Promise<void>} A promise that resolves when the Customer Center is closed
 * @throws {Error} If RevenueCat is not initialized or the UI cannot be presented
 */
export const presentCustomerCenter = async (): Promise<void> => {
  try {
    if (!isInitialized) {
      console.warn('RevenueCat not initialized when presenting Customer Center');
    }

    if (!RevenueCatUI || typeof RevenueCatUI.presentCustomerCenter !== 'function') {
      throw new Error('RevenueCat Customer Center UI is not available');
    }

    return await RevenueCatUI.presentCustomerCenter();
  } catch (error) {
    console.error('Error presenting RevenueCat Customer Center:', error);
    throw error;
  }
};
