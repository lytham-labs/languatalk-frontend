# PR Preview & Deployment Workflow

## Overview
This workflow automatically handles PR previews and gradual rollout from preview → production.

## How It Works

### 1. When You Create a PR

The system automatically detects if your PR has native changes or just JavaScript:

#### A. JavaScript-Only Changes → OTA to Preview
```
PR Created → No native changes → Deploy OTA to preview channel → Team tests on preview builds
```
- **Automatic**: OTA deploys to preview channel immediately
- **Testing**: Team members with preview builds get the update
- **Safe**: Production users unaffected

#### B. Native Changes → Build Preview Apps
```
PR Created → Native changes detected → Build APK & iOS app → Links posted in PR
```
- **Automatic**: Builds start immediately
- **APK**: Direct download for Android testing
- **iOS**: Simulator build for iOS testing
- **Links**: Posted as PR comment when ready

### 2. Preview → Production Flow

```
Preview (all PRs) → Testing (1-2 days) → Approval → Production
```

#### Manual Promotion (Recommended)
```bash
# When preview is tested and ready
gh workflow run preview-to-production.yml
```

#### Scheduled Review (Optional)
- Weekly review every Wednesday
- Team reviews preview updates
- Approves promotion to production

## Setup Instructions

### 1. Configure Channels in eas.json
Already configured:
- `preview` channel - For PR testing
- `production` channel - For live users

### 2. Build Preview Apps for Team
```bash
# One-time: Build preview apps for your team
eas build --platform all --profile preview

# Share these builds with team members
# They'll receive all preview OTA updates
```

### 3. Add GitHub Secrets
Required secrets:
```
EXPO_TOKEN                           # Your Expo access token
EXPO_PUBLIC_LANGUA_API_URL          # Production API
PREVIEW_LANGUA_API_URL              # Preview/staging API (optional)
# ... (all other env variables)
```

### 4. Create GitHub Environments
In GitHub Settings → Environments:
1. `preview` - No restrictions
2. `production-approval` - Add required reviewers
3. `production` - Protect main branch

### 5. Install Fingerprint
```bash
npx expo install @expo/fingerprint
```

### 6. Update app.json (Optional but Recommended)
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

## Example PR Flow

### Scenario 1: Fix a Bug (JavaScript Only)
```bash
git checkout -b strukturedkaos/fix-chat-bug
# Fix the bug in components/Chat.tsx
git commit -m "fix: Resolve chat scrolling issue"
git push origin strukturedkaos/fix-chat-bug
# Create PR
```

**What happens:**
1. ✅ PR created
2. ✅ Fingerprint checked - no native changes
3. ✅ OTA deployed to preview channel
4. ✅ Comment posted: "Preview OTA deployed!"
5. ✅ Team tests on preview builds
6. ✅ Merge PR
7. ⏳ Later: Promote to production

### Scenario 2: Add Camera Feature (Native)
```bash
git checkout -b strukturedkaos/add-camera
npm install react-native-vision-camera
# Add camera feature
git commit -m "feat: Add camera support"
git push origin strukturedkaos/add-camera
# Create PR
```

**What happens:**
1. ✅ PR created
2. ✅ Fingerprint checked - native changes detected!
3. ✅ Preview builds started (APK + iOS)
4. ✅ Comment posted with download links
5. ✅ Team downloads and tests builds
6. ✅ Merge PR
7. ⚠️ Need to create production builds before OTA works again

## Team Testing Guide

### For Developers
1. Install the preview build on your device
2. All PRs automatically deploy to preview
3. Test features before approving PRs

### For QA Team
1. Use preview builds for testing
2. Preview updates arrive automatically
3. Report issues in PR comments

### For Product Team
1. Review features in preview
2. Approve promotion to production
3. Monitor rollout metrics

## Commands Reference

### Check PR Status
```bash
# View all PR checks
gh pr checks

# View workflow runs
gh run list
```

### Manually Trigger Workflows
```bash
# Promote preview to production
gh workflow run preview-to-production.yml

# Trigger with specific update
gh workflow run preview-to-production.yml -f update-group=abc123

# Skip approval (hotfix)
gh workflow run preview-to-production.yml -f skip-approval=true
```

### Monitor Deployments
```bash
# View recent updates
eas update:list --branch preview
eas update:list --branch production

# Check specific update
eas update:view <update-group-id>
```

## Safety Features

### Automatic Protections
- ✅ Fingerprint prevents native changes via OTA
- ✅ Preview channel isolation from production
- ✅ Required approval for production
- ✅ Automatic rollback on high error rates

### Manual Controls
- Approve/reject production deployments
- Manually trigger rollbacks
- Skip approval for emergency hotfixes

## Troubleshooting

### PR Not Building
- Check GitHub Actions tab for errors
- Verify EXPO_TOKEN is set correctly
- Check EAS build quotas

### OTA Not Deploying
- Ensure fingerprint matches (no native changes)
- Verify preview channel configuration
- Check environment variables

### Team Can't Test
- Ensure they have preview builds installed
- Check update deployment with `eas update:list`
- Verify channel configuration

## Best Practices

1. **Always test in preview first** - Never skip preview
2. **Wait 24-48 hours** - Let preview bake before production
3. **Monitor after promotion** - Watch error rates
4. **Document native changes** - Clear PR descriptions
5. **Coordinate releases** - Communicate with team

## Quick Start Checklist

- [ ] Install @expo/fingerprint
- [ ] Add GitHub secrets
- [ ] Create GitHub environments
- [ ] Copy workflow files to `.github/workflows/`
- [ ] Build and distribute preview apps to team
- [ ] Test with a simple PR
- [ ] Document team process

## Support

For issues:
1. Check GitHub Actions logs
2. Run `eas build:list` for build status
3. Run `eas update:list` for update status
4. Check fingerprint with `npx @expo/fingerprint`