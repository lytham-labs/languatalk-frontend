# Background Microphone Implementation

## Overview
This document outlines the comprehensive implementation for ensuring the user's microphone remains active and functional when the screen is off during voice assistant calls.

## Key Components

### 1. Enhanced BackgroundAudioService (`services/BackgroundAudioService.ts`)

#### New Features Added:
- **Microphone Persistence Monitoring**: Dedicated interval monitoring microphone permissions and status every 5 seconds
- **Background Microphone Enforcement**: Specific logic to reinforce microphone access when app goes to background
- **Call State Tracking**: Tracks whether a call is in progress to optimize monitoring
- **Force Microphone Refresh**: Method to reset and reapply audio configuration
- **Enhanced Audio Configuration**: Optimized audio session settings for background operation

#### Key Methods:
- `startMicrophonePersistenceMonitoring()`: Monitors microphone status during calls
- `ensureMicrophoneAccessInBackground()`: Reinforces microphone configuration in background
- `forceMicrophoneRefresh()`: Forces a complete microphone session refresh
- `isCallInProgress()`: Returns whether a call is currently active

### 2. Enhanced Call Screen (`app/(tabs)/speak/call.tsx`)

#### Improvements Made:
- **LiveKit Room Configuration**: Enhanced with audio options for better background handling:
  ```typescript
  audioConfiguration: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    audioPreset: {
      maxBitrate: 64000,
      priority: 'high'
    }
  }
  ```

- **Microphone State Management**: Added effect to ensure microphone remains active during state changes
- **App State Handling**: Enhanced background/foreground transition handling with microphone refresh
- **Automated Monitoring**: Periodic microphone health checks every 10 seconds
- **Cleanup Management**: Proper cleanup of monitoring intervals

#### Key Features:
- Automatic microphone re-enablement when AI finishes speaking
- Force microphone refresh when transitioning to background
- Periodic audio session maintenance
- Proper cleanup when call ends

### 3. Android Permissions (`app.json`)

#### Added Permissions:
- `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- `android.permission.USE_FULL_SCREEN_INTENT`

These permissions ensure the app can maintain audio services in the background.

## How It Works

### 1. Call Initiation
When a call starts:
1. `BackgroundAudioService.startBackgroundAudio()` is called
2. Audio session is configured for background operation
3. Microphone persistence monitoring begins
4. Call state is set to active

### 2. Background Transition
When the app goes to background:
1. App state change is detected
2. Audio session is reinforced for background operation
3. Microphone access is specifically reinforced
4. Force microphone refresh is triggered after 1 second

### 3. Foreground Return
When the app returns to foreground:
1. Audio session is refreshed
2. Microphone state is verified
3. Normal monitoring resumes

### 4. Continuous Monitoring
During the call:
- Background service checks microphone every 5 seconds
- Call screen monitors audio session every 10 seconds
- LiveKit room maintains audio configuration every 15 seconds
- Automatic re-enablement if microphone track is lost

### 5. AI Speaking Transitions
When AI finishes speaking:
1. Audio session is refreshed with 500ms delay
2. Microphone track is verified and re-enabled if needed
3. Background microphone access is reinforced if in background

## Configuration Requirements

### iOS (`app.json`)
The existing `UIBackgroundModes: ["audio"]` permission is sufficient for background audio.

### Android (`app.json`)
Required permissions:
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_MICROPHONE`
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`

## Monitoring and Debugging

### Console Logs
The implementation includes comprehensive logging:
- "Background audio service started"
- "App going to background - reinforcing audio session and microphone"
- "Microphone access reinforced for background operation"
- "Forcing microphone refresh..."
- "Error monitoring microphone persistence"

### Error Handling
Robust error handling for:
- Audio session configuration failures
- Microphone permission losses
- Background transition errors
- LiveKit track management issues

## Performance Considerations

### Intervals
- Microphone monitoring: 5 seconds
- Call screen monitoring: 10 seconds
- LiveKit room monitoring: 15 seconds
- Background session maintenance: 15 seconds

These intervals are optimized to balance:
- Responsive microphone recovery
- Battery efficiency
- System resource usage

## Testing Scenarios

To verify the implementation works:

1. **Basic Background Test**:
   - Start a call
   - Turn off screen
   - Speak - verify AI responds
   - Return to app - verify microphone still works

2. **Extended Background Test**:
   - Start a call
   - Keep screen off for several minutes
   - Periodically speak to verify microphone remains active

3. **App State Transition Test**:
   - Start a call
   - Switch to another app
   - Return to call app
   - Verify microphone functionality

4. **AI Transition Test**:
   - Start a call with screen off
   - Let AI speak for extended periods
   - Verify user can respond immediately after AI finishes

## Troubleshooting

If microphone stops working in background:

1. Check console logs for error messages
2. Verify permissions are granted
3. Ensure background audio service is active
4. Check if other apps are using microphone
5. Try manual audio refresh using the refresh button

The implementation provides multiple layers of redundancy to ensure microphone persistence, making it highly reliable for background voice assistant operation. 
