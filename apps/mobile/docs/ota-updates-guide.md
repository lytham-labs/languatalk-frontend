# OTA Updates Guide for Langua iOS App

## Overview
This guide explains how to send Over-The-Air (OTA) updates to specific versions and builds of the Langua iOS app using EAS Update, with emphasis on using runtime versions and fingerprinting to ensure update compatibility.

## Current Configuration
- **Project ID**: 0e63b797-2f31-4ca1-be89-4cae65b653cd
- **Runtime Version**: 1.0.0
- **Production Channel**: production
- **Update URL**: https://u.expo.dev/0e63b797-2f31-4ca1-be89-4cae65b653cd
- **Update Check**: ON_LOAD (checks when app loads)

## Critical: Understanding Runtime Versions vs Fingerprinting

### Runtime Version Policy (Currently Used)
Your app uses `"runtimeVersion": "1.0.0"` which means:
- Updates are **ONLY** compatible with builds that have the same runtime version
- You must **manually** increment this when native code changes
- **Risk**: Forgetting to update can cause app crashes

### Fingerprint Policy (Recommended for Safety)
Fingerprinting automatically detects native changes and prevents incompatible updates:

```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

**Benefits:**
- Automatically generates a unique runtime version based on native code
- Prevents JavaScript updates from being sent to incompatible native builds
- No manual version management needed
- **Safest option** to prevent breaking production apps

## How to Switch to Fingerprint Policy (Recommended)

1. Update `app.json`:
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

2. Remove the static `"runtimeVersion": "1.0.0"` line

3. Build new versions:
```bash
eas build --platform ios --profile production
```

4. Future updates will automatically be compatible only with matching native code

## Checking Update Compatibility

### Before Sending an Update
Check what will change in your update:
```bash
# See what files will be included in the update
npx expo export --platform ios --output-dir ./dist

# Check the update manifest
cat ./dist/_expo/static/js/ios/*.hbc.map
```

### Verify Native Dependencies Haven't Changed
```bash
# Check if package.json native dependencies changed
git diff HEAD~1 package.json

# Check if any iOS/Android folders changed
git diff HEAD~1 --name-only | grep -E "(ios/|android/)"

# Check if app.json plugins changed
git diff HEAD~1 app.json
```

### What Can Be Updated via OTA
✅ **Safe to Update:**
- JavaScript/TypeScript code changes
- Asset updates (images, fonts, JSON files)
- Style changes
- Business logic updates
- API endpoint changes (via env vars)

❌ **Cannot Update (Requires New Build):**
- New native dependencies (`npm install some-native-package`)
- Changes to app.json plugins
- iOS Info.plist changes
- Android permissions
- Native code modifications
- Expo SDK upgrades

## Prerequisites
- EAS CLI installed (`npm install -g eas-cli`)
- Logged into EAS (`eas login`)
- `.env.production` file with production environment variables

## Sending OTA Updates Safely

### Pre-Update Checklist
```bash
# 1. Verify you're only changing JavaScript
git status
git diff --name-only

# 2. Ensure no native dependencies were added
git diff package.json

# 3. Confirm app.json hasn't changed native config
git diff app.json

# 4. Run local tests
npm test

# 5. Test the update locally
npx expo start --no-dev
```

### 1. Basic Production Update (All iOS Builds)
```bash
# Load production environment variables and send update
source .env.production && eas update --branch production --platform ios --message "Your update description"
```

### 2. Update Both iOS and Android
```bash
# Omit --platform to update both platforms
source .env.production && eas update --branch production --message "Cross-platform update"
```

### 3. Target Specific Runtime Version
```bash
# Only devices with runtime version 1.0.0 will receive this update
source .env.production && eas update --branch production --runtime-version "1.0.0" --message "Update for v1.0.0"
```

## Targeting Specific Builds

### Understanding Limitations
- **Runtime version** is the primary targeting mechanism
- Build numbers (e.g., iOS build 27) cannot be directly targeted via CLI
- All builds with the same runtime version on the same channel will receive updates

### Strategies for Specific Build Targeting

#### Option 1: Create Build-Specific Branches
```bash
# Create a new branch for specific builds
eas update --branch production-hotfix-build27 --message "Hotfix for build 27"

# Future builds can be configured to use different channels
```

#### Option 2: Use Different Runtime Versions
For future builds, increment the runtime version in `app.json`:
```json
{
  "expo": {
    "runtimeVersion": "1.0.1"
  }
}
```

#### Option 3: Implement In-App Filtering
Add logic in your app to selectively apply updates based on build number:
```javascript
// In App.js or update handler
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

const checkForUpdates = async () => {
  const buildNumber = Constants.expoConfig?.ios?.buildNumber;
  
  // Only apply updates for specific builds
  if (buildNumber === "27") {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  }
};
```

## Environment Variables

### Production Environment File
The `.env.production` file contains all production environment variables:
- API URLs
- WebSocket URLs  
- Google OAuth client IDs
- Sentry configuration
- RevenueCat API keys
- PostHog analytics keys

### Important Notes
- **Always use `.env.production`** when sending production updates
- Environment variables are embedded in the JavaScript bundle at update time
- Changes to env vars require sending a new OTA update

## Monitoring and Management

### View Update History
```bash
# List all updates on production branch
eas update:list --branch production

# View specific update details
eas update:view <update-group-id>
```

### Check Channel Configuration
```bash
# List all channels
eas channel:list

# View production channel details
eas channel:view production
```

### Rollback Updates
```bash
# Republish a previous update
eas update:republish --group <update-group-id> --branch production
```

### Delete Updates (Use with Caution)
```bash
# Delete a specific update
eas update:delete <update-group-id>
```

## Best Practices

1. **Test First**: Always test updates on development/preview builds before production
2. **Clear Messages**: Use descriptive commit messages for tracking
3. **Monitor Adoption**: Check analytics to ensure updates are being received
4. **Gradual Rollout**: Consider using preview branches for testing with smaller user groups
5. **Version Planning**: Plan runtime versions carefully for future targeting needs

## Workflow Example

### Complete Production Update Process
```bash
# 1. Ensure you're on the correct branch
git status

# 2. Verify this is a JavaScript-only change
git diff --name-only | grep -E "(\.tsx?|\.jsx?|\.json)$"

# 3. Check no native changes
git diff package.json app.json

# 4. Run tests
npm test

# 5. Build the JavaScript bundle locally to verify
npx expo export --platform ios

# 6. Send the OTA update with production environment
source .env.production && eas update --branch production --platform ios --message "Fix: Resolved keyboard issue on chat screen"

# 7. Monitor the update
eas update:list --branch production
```

## Runtime Version Management Strategies

### Option 1: Manual Runtime Version (Current Setup)
```json
{
  "expo": {
    "runtimeVersion": "1.0.0"
  }
}
```
**When to increment:**
- Adding/removing native dependencies
- Changing app.json plugins
- Modifying iOS/Android native code
- Upgrading Expo SDK

### Option 2: Fingerprint Policy (Recommended)
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```
**Advantages:**
- Automatic compatibility checking
- No manual version management
- Prevents accidental breaking updates

### Option 3: App Version Policy
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```
**Uses:** The version field from app.json (e.g., "1.0.0")

## Troubleshooting

### Update Not Appearing
- Check runtime version compatibility
- Verify channel configuration in eas.json
- Ensure app has internet connection
- App must be restarted (or foregrounded) to check for updates

### Wrong Environment Variables
- Verify `.env.production` is sourced before running update
- Check that all EXPO_PUBLIC_ variables are set correctly
- Use `--clear-cache` flag if updates seem cached

### Targeting Issues
- Remember: cannot target specific build numbers directly
- Use runtime versions for version-based targeting
- Consider implementing in-app update logic for fine-grained control

### Update Causing Crashes
**This usually means native code incompatibility!**
1. Immediately rollback:
```bash
eas update:republish --group <previous-update-id> --branch production
```
2. Check what changed:
```bash
# See if any native dependencies changed
git diff HEAD~1 package.json

# Check for plugin changes
git diff HEAD~1 app.json
```
3. If native changes exist, you need a new build:
```bash
eas build --platform ios --profile production
```

### Verifying Update Compatibility
Use the Expo CLI to check compatibility:
```bash
# Check if current code is compatible with a specific runtime version
npx expo doctor

# Preview what will be in the update bundle
npx expo export --platform ios --output-dir ./dist
ls -la ./dist/_expo/static/js/ios/
```

## Quick Reference

```bash
# Production iOS update
source .env.production && eas update --branch production --platform ios --message "Update message"

# View recent updates
eas update:list --branch production

# Check channel status
eas channel:view production

# Emergency rollback
eas update:republish --group <previous-update-id> --branch production
```

## Support
For issues or questions about OTA updates, consult:
- [Expo EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [EAS Update Troubleshooting](https://docs.expo.dev/eas-update/debug/)