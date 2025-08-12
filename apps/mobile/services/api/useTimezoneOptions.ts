import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';

interface TimezoneOption {
  value: string;
  label: string;
}

interface TimezoneOptionsResponse {
  timezone_options: TimezoneOption[];
}

export const useTimezoneOptions = () => {
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchTimezoneOptions = async () => {
    if (!token) {
      setError("No authentication token available");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Check if timezoneOptions are cached
      const cachedData = await AsyncStorage.getItem('timezoneOptions');
      if (cachedData) {
        setTimezoneOptions(JSON.parse(cachedData));
        setLoading(false);
        return;
      }

      const url = `${API_URL}/api/v1/langua_settings/timezone_options`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch timezone options');
      }

      const data: TimezoneOptionsResponse = await response.json();
    
      setTimezoneOptions(data.timezone_options);
      
      await AsyncStorage.setItem('timezoneOptions', JSON.stringify(data.timezone_options));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimezoneOptions();
  }, [token]);

  return {
    timezoneOptions,
    loading,
    error,
    refetch: fetchTimezoneOptions,
  };
}; 
