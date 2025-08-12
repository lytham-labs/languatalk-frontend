# iOS Device Registration Guide for Internal Testing

## Overview
To test PR preview builds on your iPhone, you need to register your device first. This is a one-time setup that takes about 2 minutes.

## Quick Registration Steps

### Step 1: Generate Registration URL
The team lead should run this command once:
```bash
eas device:create
```

This will output a QR code and URL like:
```
✔ Generating a registration URL...
Registration URL: https://expo.dev/accounts/strukturedkaos/devices/register
```

### Step 2: Share with Team
Share the registration URL with your team via Slack/email:
```
Subject: Register Your iPhone for Langua Testing

Hi team,

Please register your iPhone for testing Langua PR builds:
https://expo.dev/accounts/strukturedkaos/devices/register

Instructions:
1. Open this link ON YOUR IPHONE (not computer)
2. Tap "Download Profile" 
3. Open Settings → Profile Downloaded → Install
4. Enter your passcode when prompted
5. Done! You can now install PR builds

This is a one-time setup. Let me know if you have any issues.
```

## Detailed Registration Process

### For Team Members:

#### 1. Open Registration Link on iPhone
- **Important**: Must open on the iPhone you want to register
- Use Safari or Chrome
- You'll see an Expo page

#### 2. Download Configuration Profile
- Tap "Download Profile" button
- iOS will show: "This website is trying to download a configuration profile. Do you want to allow this?"
- Tap "Allow"

#### 3. Install Profile
- You'll see a notification: "Profile Downloaded - Review the profile in Settings"
- Open Settings app
- You'll see "Profile Downloaded" at the top
- Tap it
- Tap "Install" in top right
- Enter your iPhone passcode
- Tap "Install" again
- Tap "Done"

#### 4. Verify Registration
The team lead can verify with:
```bash
eas device:list

# Output:
Device ID                               Name                    Model
00008030-001234567890ABCD              John's iPhone          iPhone 14 Pro
00008030-009876543210WXYZ              Sarah's iPhone         iPhone 13
```

## Installing PR Builds

Once registered, you can install PR builds:

### From PR Comments
1. Find the PR on GitHub
2. Look for the automated comment with build links
3. Click "Install on iPhone" link ON YOUR IPHONE
4. Tap "Install" on the Expo page
5. App installs directly

### Manual Installation
```bash
# Get build URL
eas build:list --platform ios --limit 5

# Share install link with team
https://expo.dev/accounts/strukturedkaos/builds/[build-id]
```

## Troubleshooting

### "Device Not Registered" Error
- Ensure you completed the profile installation
- Check device is listed: `eas device:list`
- Try re-registering if needed

### Profile Won't Install
- Check iOS version is 13+ 
- Ensure you have space on device
- Try restarting phone

### Can't Open Install Links
- Must open link on the registered iPhone
- Won't work on computer or different device
- Check you're signed into same Apple ID

### Build Says "Expired"
- Internal builds expire after 30 days
- Need to create new build
- Old builds can't be re-signed

## Device Limits

### Apple's Restrictions:
- **100 devices maximum** per year
- Includes all iPhones, iPads registered
- Can't remove devices until yearly reset
- Renewal date based on Apple Developer account

### Managing Devices:
```bash
# View all registered devices
eas device:list

# Count remaining slots
eas device:list | wc -l  # Subtract from 100

# No way to remove devices until renewal
```

## Best Practices

### For Team Lead:
1. Track device count (max 100)
2. Only register active team members
3. Document who has registered
4. Plan for contractor/new hire devices

### For Developers:
1. Register your primary test device
2. Don't register personal devices unless needed
3. Let team lead know if you get new device
4. Test PR builds promptly

## PR Build Testing Flow

```
Developer creates PR
        ↓
GitHub Actions builds app
        ↓
Install link posted in PR
        ↓
Open link on registered iPhone
        ↓
Tap Install
        ↓
Test the PR changes
        ↓
Comment feedback on PR
```

## Quick Commands Reference

```bash
# Generate registration URL (team lead)
eas device:create

# List registered devices
eas device:list

# View recent iOS builds
eas build:list --platform ios --limit 10

# Get install link for specific build
eas build:view [build-id]
```

## FAQ

**Q: Do I need to re-register for each build?**
A: No, registration is one-time only.

**Q: Can I register iPad too?**
A: Yes, but it counts toward the 100 device limit.

**Q: What if I get a new iPhone?**
A: You'll need to register the new device.

**Q: Can external testers register?**
A: Yes, but consider using TestFlight for external testers instead.

**Q: How long do builds last?**
A: Internal distribution builds expire after 30 days.

**Q: Can I install on non-registered device?**
A: No, iOS requires device registration for internal distribution.

## Support

If you have issues:
1. Check this guide first
2. Ask in #mobile-dev Slack channel
3. Contact the mobile team lead

Remember: Registration is one-time, but required for all iOS testing!