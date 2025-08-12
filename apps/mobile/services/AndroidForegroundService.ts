import { NativeModules, Platform } from 'react-native';

interface AudioForegroundServiceInterface {
    startService(): void;
    stopService(): void;
}

const { AudioForegroundService } = NativeModules;

class AndroidForegroundService {
    private static instance: AndroidForegroundService;
    private isServiceRunning: boolean = false;

    private constructor() { }

    public static getInstance(): AndroidForegroundService {
        if (!AndroidForegroundService.instance) {
            AndroidForegroundService.instance = new AndroidForegroundService();
        }
        return AndroidForegroundService.instance;
    }

    public async startForegroundService(): Promise<void> {
        if (Platform.OS !== 'android') {
            console.log('Foreground service is only available on Android');
            return;
        }

        if (this.isServiceRunning) {
            console.log('Foreground service is already running');
            return;
        }

        try {
            if (AudioForegroundService) {
                AudioForegroundService.startService();
                this.isServiceRunning = true;
                console.log('Android foreground service started');
            } else {
                console.error('AudioForegroundService module not found');
            }
        } catch (error) {
            console.error('Failed to start Android foreground service:', error);
        }
    }

    public async stopForegroundService(): Promise<void> {
        if (Platform.OS !== 'android') {
            return;
        }

        if (!this.isServiceRunning) {
            console.log('Foreground service is not running');
            return;
        }

        try {
            if (AudioForegroundService) {
                AudioForegroundService.stopService();
                this.isServiceRunning = false;
                console.log('Android foreground service stopped');
            } else {
                console.error('AudioForegroundService module not found');
            }
        } catch (error) {
            console.error('Failed to stop Android foreground service:', error);
        }
    }

    public isRunning(): boolean {
        return this.isServiceRunning;
    }
}

export default AndroidForegroundService; 
