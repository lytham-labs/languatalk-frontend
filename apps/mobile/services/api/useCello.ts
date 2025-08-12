import { useState, useEffect } from 'react';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';
import Cello from '@getcello/cello-react-native';

interface CelloTokenResponse {
  token: string;
  productId: string;
  productUserDetails: any;
}

interface CelloError {
  error: string;
}

const useCello = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const initializeCello = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/v1/cello/create_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}`,
        },
      });

      if (!response.ok) {
        const errorData: CelloError = await response.json();
        throw new Error(errorData.error || 'Failed to initialize Cello');
      }

      const data: CelloTokenResponse = await response.json();
      
      // Initialize Cello with the received token
      await Cello.initialize(data.productId, data.token);

      setIsInitialized(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Cello';
      setError(errorMessage);
      console.error('Cello initialization error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const openWidget = async () => {
    if (!isInitialized) {
      const success = await initializeCello();
      if (!success) {
        return;
      }
    }
    
    try {
      await Cello.openWidget();
    } catch (err) {
      console.error('Error opening Cello widget:', err);
      setError('Failed to open referral widget');
    }
  };

  // Auto-initialize when component mounts if user is authenticated
  useEffect(() => {
    if (token && !isInitialized && !loading) {
      initializeCello();
    }
  }, [token]);

  return {
    isInitialized,
    loading,
    error,
    initializeCello,
    openWidget,
  };
};

export default useCello;
