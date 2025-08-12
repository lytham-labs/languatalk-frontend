import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import { NativeModules } from 'react-native';

// Import InCallManager for audio routing
let InCallManager: any = null;
try {
    InCallManager = require('react-native-incall-manager');
    console.log('InCallManager imported successfully:', typeof InCallManager);
} catch (error) {
    console.warn('InCallManager not available:', error);
}

type AudioRoute = 'BLUETOOTH' | 'WIRED_HEADSET' | 'SPEAKER' | 'EARPIECE';

interface UseAudioRoutingReturn {
    availableRoutes: AudioRoute[];
    isActive: boolean;
    startAudioRouting: () => Promise<void>;
    stopAudioRouting: () => Promise<void>;
    routeToBest: () => Promise<void>;
}

const { AudioRouting } = NativeModules;

export function useAudioRouting(): UseAudioRoutingReturn {
    const [availableRoutes, setAvailableRoutes] = useState<AudioRoute[]>([]);
    const [isActive, setIsActive] = useState(false);
    const isActiveRef = useRef(false);
    const currentRouteRef = useRef<AudioRoute | null>(null);
    const persistenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Update ref when isActive changes
    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    const getAvailableRoutes = useCallback(async (): Promise<AudioRoute[]> => {
        if (Platform.OS !== 'android' || !AudioRouting) {
            // Fallback for iOS or when module is not available
            return ['SPEAKER', 'EARPIECE'];
        }

        try {
            const routes = await AudioRouting.getAvailableRoutes();
            return routes || [];
        } catch (error) {
            console.error('Failed to get available routes:', error);
            return ['SPEAKER', 'EARPIECE'];
        }
    }, []);

    const refreshAvailableRoutes = useCallback(async () => {
        if (!isActiveRef.current) return;

        console.log('🎧 [AudioRouting] Refreshing available routes...');
        const routes = await getAvailableRoutes();
        setAvailableRoutes(routes);

        // Re-route to best available after device change
        console.log('🎧 [AudioRouting] Device change detected, re-routing...');
        await routeToBest();
    }, [getAvailableRoutes, routeToBest]);

    const routeToBest = useCallback(async (): Promise<void> => {
        if (!InCallManager || !InCallManager.chooseAudioRoute) {
            console.warn('InCallManager.chooseAudioRoute not available');
            return;
        }

        try {
            const routes = await getAvailableRoutes();

            // Priority order: BLUETOOTH > WIRED_HEADSET > EARPIECE > SPEAKER
            let bestRoute: AudioRoute = 'SPEAKER'; // fallback

            if (routes.includes('BLUETOOTH')) {
                bestRoute = 'BLUETOOTH';
            } else if (routes.includes('WIRED_HEADSET')) {
                bestRoute = 'WIRED_HEADSET';
            } else if (routes.includes('EARPIECE')) {
                bestRoute = 'EARPIECE';
            }

            console.log('🎧 [AudioRouting] Available routes:', routes);
            console.log('🎧 [AudioRouting] Routing to best available:', bestRoute);

            await InCallManager.chooseAudioRoute(bestRoute);
            currentRouteRef.current = bestRoute;

            console.log('🎧 [AudioRouting] Successfully routed to:', bestRoute);
        } catch (error) {
            console.error('🎧 [AudioRouting] Failed to route to best audio:', error);
        }
    }, [getAvailableRoutes]);

    const startAudioRouting = useCallback(async (): Promise<void> => {
        if (isActiveRef.current) {
            console.log('🎧 [AudioRouting] Already active, skipping start');
            return;
        }

        try {
            console.log('🎧 [AudioRouting] Starting audio routing system...');

            // Start InCallManager with audio routing configuration
            if (InCallManager && InCallManager.start) {
                console.log('🎧 [AudioRouting] Starting InCallManager...');
                await InCallManager.start({
                    media: 'audio',
                    auto: true,
                    ringback: false,
                    busytone: false,
                    ringtone: false
                });
                console.log('🎧 [AudioRouting] InCallManager started');
            }

            // Enable SCO for Bluetooth
            if (AudioRouting && AudioRouting.enableSco) {
                console.log('🎧 [AudioRouting] Enabling Bluetooth SCO...');
                await AudioRouting.enableSco();
                console.log('🎧 [AudioRouting] Bluetooth SCO enabled');
            }

            setIsActive(true);

            // Get initial routes and route to best
            const routes = await getAvailableRoutes();
            setAvailableRoutes(routes);

            console.log('🎧 [AudioRouting] Initial routing to best device...');
            await routeToBest();

            // Re-configure audio mode to prevent conflicts with BackgroundAudioService
            await configureAudioModeForRouting();

            // Start persistence check to maintain routing every 2 seconds
            startRoutingPersistence();

            console.log('🎧 [AudioRouting] Audio routing system started successfully');
        } catch (error) {
            console.error('🎧 [AudioRouting] Failed to start audio routing:', error);
            setIsActive(false);
        }
    }, [getAvailableRoutes, routeToBest, startRoutingPersistence, configureAudioModeForRouting]);

    const stopAudioRouting = useCallback(async (): Promise<void> => {
        if (!isActiveRef.current) {
            console.log('Audio routing already stopped');
            return;
        }

        try {
            console.log('Stopping audio routing...');

            // Stop InCallManager
            if (InCallManager && InCallManager.stop) {
                await InCallManager.stop();
            }

            // Disable SCO
            if (AudioRouting && AudioRouting.disableSco) {
                await AudioRouting.disableSco();
            }

            setIsActive(false);
            setAvailableRoutes([]);
            currentRouteRef.current = null;

            // Stop persistence check
            stopRoutingPersistence();

            console.log('🎧 [AudioRouting] Audio routing stopped successfully');
        } catch (error) {
            console.error('Failed to stop audio routing:', error);
        }
    }, []);

    // Set up event listeners for device changes and SCO state
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const audioDevicesChangedListener = DeviceEventEmitter.addListener(
            'audioDevicesChanged',
            () => {
                console.log('Audio devices changed, refreshing routes...');
                refreshAvailableRoutes();
            }
        );

        const scoStateChangedListener = DeviceEventEmitter.addListener(
            'onScoStateChanged',
            async (event) => {
                console.log('🎧 [AudioRouting] SCO state changed:', event.state);
                // 0 = DISCONNECTED, 1 = CONNECTING, 2 = CONNECTED
                if (event.state === 2 && isActiveRef.current) {
                    // SCO Connected - re-route to ensure we're using Bluetooth
                    console.log('🎧 [AudioRouting] SCO connected, re-routing to Bluetooth...');
                    await routeToBest();
                }
            }
        );

        return () => {
            audioDevicesChangedListener.remove();
            scoStateChangedListener.remove();
        };
    }, [refreshAvailableRoutes, routeToBest]);

    // Add persistence functions
    const startRoutingPersistence = useCallback(() => {
        if (persistenceIntervalRef.current) return;

        console.log('🎧 [AudioRouting] Starting route persistence monitoring...');
        persistenceIntervalRef.current = setInterval(async () => {
            if (!isActiveRef.current || !currentRouteRef.current) return;

            try {
                console.log('🎧 [AudioRouting] Persistence check - maintaining route:', currentRouteRef.current);
                await InCallManager.chooseAudioRoute(currentRouteRef.current);

                // Re-configure audio mode to prevent conflicts
                await configureAudioModeForRouting();
            } catch (error) {
                console.error('🎧 [AudioRouting] Persistence error:', error);
            }
        }, 2000); // Check every 2 seconds
    }, [configureAudioModeForRouting]);

    const stopRoutingPersistence = useCallback(() => {
        if (persistenceIntervalRef.current) {
            console.log('🎧 [AudioRouting] Stopping route persistence monitoring...');
            clearInterval(persistenceIntervalRef.current);
            persistenceIntervalRef.current = null;
        }
    }, []);

    // Configure audio mode to prevent conflicts with other services
    const configureAudioModeForRouting = useCallback(async () => {
        if (Platform.OS !== 'android') return;

        try {
            console.log('🎧 [AudioRouting] Configuring audio mode for routing...');
            // Dynamically import Audio to avoid circular dependencies
            const { Audio } = await import('expo-av');

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: true, // Allow routing to earpiece/bluetooth
                staysActiveInBackground: true,
            });

            console.log('🎧 [AudioRouting] Audio mode configured for routing');
        } catch (error) {
            console.error('🎧 [AudioRouting] Failed to configure audio mode:', error);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRoutingPersistence();
            if (isActiveRef.current) {
                stopAudioRouting();
            }
        };
    }, [stopAudioRouting, stopRoutingPersistence]);

    return {
        availableRoutes,
        isActive,
        startAudioRouting,
        stopAudioRouting,
        routeToBest,
    };
} 
