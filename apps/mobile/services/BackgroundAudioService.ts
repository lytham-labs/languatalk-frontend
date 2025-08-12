import { Audio } from 'expo-av';
import * as KeepAwake from 'expo-keep-awake';
import { Platform } from 'react-native';
import AndroidForegroundService from './AndroidForegroundService';

class BackgroundAudioService {
    private static instance: BackgroundAudioService;
    private isActive: boolean = false;
    private androidForegroundService: AndroidForegroundService;

    private constructor() {
        this.androidForegroundService = AndroidForegroundService.getInstance();
    }

    public static getInstance(): BackgroundAudioService {
        if (!BackgroundAudioService.instance) {
            BackgroundAudioService.instance = new BackgroundAudioService();
        }
        return BackgroundAudioService.instance;
    }

    public async startBackgroundAudio(): Promise<void> {
        if (this.isActive) {
            return;
        }

        try {
            // Configure audio session for background use
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: true,
            });

            // Keep the app awake during the call
            await KeepAwake.activateKeepAwakeAsync();

            // Start Android foreground service for background recording
            if (Platform.OS === 'android') {
                await this.androidForegroundService.startForegroundService();
            }

            this.isActive = true;
            console.log('Background audio service started');
        } catch (error) {
            console.error('Failed to start background audio service:', error);
        }
    }

    public async stopBackgroundAudio(): Promise<void> {
        if (!this.isActive) {
            return;
        }

        try {
            // Stop Android foreground service
            if (Platform.OS === 'android') {
                await this.androidForegroundService.stopForegroundService();
            }

            // Reset audio session to normal state
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: false,
            });

            // Deactivate keep awake
            await KeepAwake.deactivateKeepAwake();

            this.isActive = false;
            console.log('Background audio service stopped');
        } catch (error) {
            console.error('Failed to stop background audio service:', error);
        }
    }

    public isServiceActive(): boolean {
        return this.isActive;
    }

    public async handleAppStateChange(nextAppState: string): Promise<void> {
        if (nextAppState === 'background' && this.isActive) {
            console.log('App going to background - maintaining audio session');

            // Ensure Android foreground service is running
            if (Platform.OS === 'android' && !this.androidForegroundService.isRunning()) {
                await this.androidForegroundService.startForegroundService();
            }

            // Reinforce audio configuration for background
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                    staysActiveInBackground: true,
                });
                console.log('Audio session reinforced for background operation');
            } catch (error) {
                console.error('Failed to reinforce audio session:', error);
            }
        } else if (nextAppState === 'active' && this.isActive) {
            console.log('App becoming active - audio session maintained');
        }
    }
}

export default BackgroundAudioService; 
