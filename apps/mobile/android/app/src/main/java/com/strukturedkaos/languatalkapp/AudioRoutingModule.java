package com.strukturedkaos.languatalkapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

public class AudioRoutingModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "AudioRouting";
    private AudioManager audioManager;
    private AudioDeviceCallback deviceChangeListener;
    private BroadcastReceiver scoStateReceiver;
    private boolean scoEnabled = false;

    public AudioRoutingModule(ReactApplicationContext reactContext) {
        super(reactContext);
        try {
            this.audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
            // Don't register listeners in constructor to avoid initialization conflicts
        } catch (Exception e) {
            android.util.Log.e("AudioRoutingModule", "Error initializing AudioRoutingModule", e);
        }
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @RequiresApi(api = Build.VERSION_CODES.M)
    private void setupDeviceChangeListener() {
        try {
            deviceChangeListener = new AudioDeviceCallback() {
                @Override
                public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                    try {
                        emitAudioDevicesChanged();
                    } catch (Exception e) {
                        android.util.Log.e("AudioRoutingModule", "Error emitting audio devices changed", e);
                    }
                }

                @Override
                public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                    try {
                        emitAudioDevicesChanged();
                    } catch (Exception e) {
                        android.util.Log.e("AudioRoutingModule", "Error emitting audio devices changed", e);
                    }
                }
            };
            
            audioManager.registerAudioDeviceCallback(deviceChangeListener, null);
        } catch (Exception e) {
            android.util.Log.e("AudioRoutingModule", "Error setting up device change listener", e);
        }
    }

    private void setupScoStateReceiver() {
        try {
            // Only set up if React context is properly initialized
            if (!getReactApplicationContext().hasActiveReactInstance()) {
                return;
            }
            
            scoStateReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    try {
                        if (AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED.equals(intent.getAction())) {
                            int state = intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -1);
                            emitScoStateChanged(state);
                        }
                    } catch (Exception e) {
                        android.util.Log.e("AudioRoutingModule", "Error in SCO state receiver", e);
                    }
                }
            };
            
            IntentFilter filter = new IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED);
            getReactApplicationContext().registerReceiver(scoStateReceiver, filter);
        } catch (Exception e) {
            android.util.Log.e("AudioRoutingModule", "Error setting up SCO state receiver", e);
        }
    }

    private void emitAudioDevicesChanged() {
        try {
            if (getReactApplicationContext().hasActiveReactInstance()) {
                getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("audioDevicesChanged", null);
            }
        } catch (Exception e) {
            android.util.Log.e("AudioRoutingModule", "Error emitting audioDevicesChanged", e);
        }
    }

    private void emitScoStateChanged(int state) {
        try {
            if (getReactApplicationContext().hasActiveReactInstance()) {
                WritableMap params = Arguments.createMap();
                params.putInt("state", state);
                
                getReactApplicationContext()
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onScoStateChanged", params);
            }
        } catch (Exception e) {
            android.util.Log.e("AudioRoutingModule", "Error emitting onScoStateChanged", e);
        }
    }

    @ReactMethod
    public void getAvailableRoutes(Promise promise) {
        try {
            // Initialize listeners on first use if not already done
            ensureListenersInitialized();
            
            WritableArray routes = Arguments.createArray();
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                
                for (AudioDeviceInfo device : devices) {
                    String routeType = mapDeviceTypeToRoute(device.getType());
                    if (routeType != null && !routeExists(routes, routeType)) {
                        routes.pushString(routeType);
                    }
                }
            } else {
                // Fallback for older API levels
                routes.pushString("SPEAKER");
                if (audioManager.isBluetoothScoAvailableOffCall()) {
                    routes.pushString("BLUETOOTH");
                }
                if (audioManager.isWiredHeadsetOn()) {
                    routes.pushString("WIRED_HEADSET");
                }
                routes.pushString("EARPIECE");
            }
            
            promise.resolve(routes);
        } catch (Exception e) {
            promise.reject("GET_ROUTES_ERROR", "Failed to get available routes", e);
        }
    }

    private void ensureListenersInitialized() {
        if (deviceChangeListener == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioManager != null) {
            setupDeviceChangeListener();
        }
        if (scoStateReceiver == null && audioManager != null) {
            setupScoStateReceiver();
        }
    }

    @ReactMethod
    public void enableSco(Promise promise) {
        try {
            if (!scoEnabled) {
                audioManager.setBluetoothScoOn(true);
                audioManager.startBluetoothSco();
                scoEnabled = true;
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("SCO_ENABLE_ERROR", "Failed to enable SCO", e);
        }
    }

    @ReactMethod
    public void disableSco(Promise promise) {
        try {
            if (scoEnabled) {
                audioManager.stopBluetoothSco();
                audioManager.setBluetoothScoOn(false);
                scoEnabled = false;
            }
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("SCO_DISABLE_ERROR", "Failed to disable SCO", e);
        }
    }

    private String mapDeviceTypeToRoute(int deviceType) {
        switch (deviceType) {
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
                return "BLUETOOTH";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
                return "WIRED_HEADSET";
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                return "SPEAKER";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
                return "EARPIECE";
            default:
                return null;
        }
    }

    private boolean routeExists(WritableArray routes, String route) {
        for (int i = 0; i < routes.size(); i++) {
            if (route.equals(routes.getString(i))) {
                return true;
            }
        }
        return false;
    }


} 
