import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/constants/api';

interface SubscriptionPlan {
  name: string;
  id: string;
  product_id: string;
  price_id: string;
}

interface SubscriptionStatus {
  state: string;
  canceled_at: string | null;
  scheduled_change: any | null;
}

interface SubscriptionBilling {
  next_billing_date: string;
  currency: string;
  amount: number;
  customer_id: string;
}

interface SubscriptionInfo {
  is_premium: boolean;
  provider: string;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  billing: SubscriptionBilling;
}

export const fetchSubscriptionData = async (token: string) => {
  const response = await fetch(`${API_URL}/api/v1/user_subscription`, {
    headers: {
      'Authorization': `${token}`,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.status?.message || 'Failed to fetch subscription');
  }
  
  return data.subscription;
};

export default function useUserSubscription() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const { token } = useAuth();

  const fetchSubscription = async () => {
    if (!token) {
      setLoading(false);
      // setError("Authentication token not available."); // Optionally set an error
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const subscription = await fetchSubscriptionData(token);
      setSubscriptionInfo(subscription);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [token]);

  return { subscriptionInfo, loading, error, fetchSubscription };
}
