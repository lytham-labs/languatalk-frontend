import { useState, useEffect } from 'react';
import { API_URL } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STATS_URL = `${API_URL}/api/v1/user_stats`; // Update with your API URL

export interface UserStats {
    language: string | null; // Assuming language can be null
    daily_streak: number;
    weekly_streak: number;
    user_position: number;
    users_above: Array<UserLeaderboard>;
    users_below: Array<UserLeaderboard>;
    user_leaderboard: UserLeaderboard | null;
}

export interface UserLeaderboard {
    user_id: number; // Adjust based on your actual user ID type
    all_time_points: number; // Adjust based on your actual points type
    // Add other relevant fields if necessary
}


const useUserStats = (token: string | null) => {
    const [userStats, setUserStats] = useState<UserStats>({
        language: null,
        daily_streak: 0,
        weekly_streak: 0, 
        user_position: 0,
        users_above: [],
        users_below: [],
        user_leaderboard: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserStats = async () => {
            try {
                // Check if data is cached
                const cachedData = await AsyncStorage.getItem('userStats');
                if (cachedData) {
                    setUserStats(JSON.parse(cachedData));
                }

                // Fetch new data
                const response = await fetch(USER_STATS_URL, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                setUserStats(data);

                // Cache the new data
                await AsyncStorage.setItem('userStats', JSON.stringify(data));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchUserStats();
    }, [token]);

    return { userStats, loading, error };
};

export default useUserStats;