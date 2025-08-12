import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useUserSubscription from '@/services/api/useUserSubscription';
import useUserSettings from '@/services/api/useUserSettings';

const STORE_REVIEW_KEY = 'store_review_last_shown';
const MIN_DAYS_BETWEEN_REVIEWS = 10; // Minimum days between showing the review prompt

export const useStoreReview = () => {
  const { subscriptionInfo } = useUserSubscription();
  const { userSettings } = useUserSettings();

  const requestReview = async () => {
    try {
      // Check if user is a Pro subscriber
      if (!subscriptionInfo?.is_premium) {
        return;
      }

      // Create user-specific key
      const userSpecificKey = `${STORE_REVIEW_KEY}_${userSettings?.user.id}`;

      // Check if user was already prompted to submit a review in the last 10 days
      const lastShown = await AsyncStorage.getItem(userSpecificKey);
      const now = new Date().getTime();
      if (lastShown) {
        const daysSinceLastReview = (now - parseInt(lastShown)) / (1000 * 60 * 60 * 24);

        if (daysSinceLastReview < MIN_DAYS_BETWEEN_REVIEWS) {
          return;
        }
      }

      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
        await AsyncStorage.setItem(userSpecificKey, now.toString());
      }
    } catch (error) {
      console.error('Error requesting store review:', error);
    }
  };

  return { requestReview };
}; 
