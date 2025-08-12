package com.strukturedkaos.languatalkapp;

import android.content.Intent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class AudioForegroundServiceModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "AudioForegroundService";

    public AudioForegroundServiceModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startService() {
        Intent serviceIntent = new Intent(getReactApplicationContext(), AudioForegroundService.class);
        serviceIntent.setAction("START_AUDIO_SERVICE");
        getReactApplicationContext().startForegroundService(serviceIntent);
    }

    @ReactMethod
    public void stopService() {
        Intent serviceIntent = new Intent(getReactApplicationContext(), AudioForegroundService.class);
        serviceIntent.setAction("STOP_AUDIO_SERVICE");
        getReactApplicationContext().startService(serviceIntent);
    }
} 
