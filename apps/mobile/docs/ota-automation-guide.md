# OTA Update Automation Guide

## Overview
This guide explains how to automate OTA updates using GitHub Actions and EAS workflows, using Expo Fingerprint to detect native changes and ensure only JavaScript changes are deployed via OTA.

## Setup Expo Fingerprint

### Install Fingerprint Package
```bash
npx expo install @expo/fingerprint
```

### Create Fingerprint Configuration
Create `fingerprint.config.js`:

```javascript
module.exports = {
  // Exclude files from fingerprint calculation
  ignorePaths: [
    'docs/**/*',
    '**/*.md',
    '.github/**/*',
    'scripts/**/*',
    '**/*.test.ts',
    '**/*.test.tsx'
  ],
  // Platform-specific configurations
  platforms: ['ios', 'android'],
  // Include environment variables that affect native build
  includeEnvVars: [
    'EXPO_PUBLIC_*'
  ]
};
```

### Create .fingerprintignore
```
# Ignore non-native files
*.md
docs/
.github/
scripts/
__tests__/
*.test.ts
*.test.tsx
.env*
```

## GitHub Actions Workflow with Fingerprint

### Fingerprint-Based OTA Workflow

Create `.github/workflows/ota-update-fingerprint.yml`:

```yaml
name: OTA Update with Fingerprint Check

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize]

jobs:
  fingerprint-check:
    runs-on: ubuntu-latest
    outputs:
      native-changed: ${{ steps.fingerprint.outputs.native-changed }}
      fingerprint: ${{ steps.fingerprint.outputs.fingerprint }}
      changes: ${{ steps.fingerprint.outputs.changes }}
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install Dependencies
        run: |
          npm ci
          npx expo install @expo/fingerprint
      
      - name: Generate and Compare Fingerprints
        id: fingerprint
        run: |
          # Generate current fingerprint
          CURRENT_FINGERPRINT=$(npx @expo/fingerprint . --platform ios --json | jq -r '.hash')
          echo "Current fingerprint: $CURRENT_FINGERPRINT"
          echo "fingerprint=$CURRENT_FINGERPRINT" >> $GITHUB_OUTPUT
          
          # Get the last deployed fingerprint from either:
          # 1. A stored artifact from last successful deployment
          # 2. The main branch if this is a PR
          # 3. The previous commit if this is a push to main
          
          if [[ "${{ github.event_name }}" == "pull_request" ]]; then
            # Compare with main branch for PRs
            git checkout origin/main
            BASELINE_FINGERPRINT=$(npx @expo/fingerprint . --platform ios --json | jq -r '.hash')
            git checkout -
          else
            # Compare with previous commit for pushes
            git checkout HEAD~1
            BASELINE_FINGERPRINT=$(npx @expo/fingerprint . --platform ios --json | jq -r '.hash')
            git checkout -
          fi
          
          echo "Baseline fingerprint: $BASELINE_FINGERPRINT"
          
          # Compare fingerprints
          if [[ "$CURRENT_FINGERPRINT" != "$BASELINE_FINGERPRINT" ]]; then
            echo "❌ Native changes detected - fingerprints differ"
            echo "native-changed=true" >> $GITHUB_OUTPUT
            
            # Get detailed diff
            npx @expo/fingerprint diff \
              --baseline HEAD~1 \
              --current HEAD \
              --platform ios \
              --json > fingerprint-diff.json
            
            CHANGES=$(cat fingerprint-diff.json | jq -r '.changes | map(.path) | join(", ")')
            echo "changes=$CHANGES" >> $GITHUB_OUTPUT
            
            # Create summary
            echo "### 🔍 Fingerprint Changes Detected" >> $GITHUB_STEP_SUMMARY
            echo "Native build required due to changes in:" >> $GITHUB_STEP_SUMMARY
            echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
            cat fingerprint-diff.json | jq '.changes' >> $GITHUB_STEP_SUMMARY
            echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
          else
            echo "✅ No native changes - fingerprints match"
            echo "native-changed=false" >> $GITHUB_OUTPUT
            echo "changes=" >> $GITHUB_OUTPUT
          fi
      
      - name: Store Fingerprint
        uses: actions/upload-artifact@v3
        with:
          name: fingerprint-${{ github.sha }}
          path: |
            fingerprint.json
            fingerprint-diff.json
          retention-days: 30

  check-ota-safety:
    needs: fingerprint-check
    if: needs.fingerprint-check.outputs.native-changed == 'false'
    runs-on: ubuntu-latest
    outputs:
      safe: ${{ steps.validate.outputs.safe }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Additional Safety Checks
        id: validate
        run: |
          # Run additional validation
          # Check for breaking changes in JS/TS files
          # Validate assets
          # etc.
          echo "safe=true" >> $GITHUB_OUTPUT

  deploy-ota-update:
    needs: [fingerprint-check, check-ota-safety]
    if: |
      needs.fingerprint-check.outputs.native-changed == 'false' &&
      needs.check-ota-safety.outputs.safe == 'true' &&
      github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run Tests
        run: npm test
        continue-on-error: false
      
      - name: Create Production Env File
        run: |
          cat > .env.production << EOF
          EXPO_PUBLIC_LANGUA_API_URL=${{ secrets.EXPO_PUBLIC_LANGUA_API_URL }}
          EXPO_PUBLIC_LANGUA_WS_URL=${{ secrets.EXPO_PUBLIC_LANGUA_WS_URL }}
          EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=${{ secrets.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID }}
          EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=${{ secrets.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }}
          EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=${{ secrets.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID }}
          EXPO_PUBLIC_SENTRY_DSN=${{ secrets.EXPO_PUBLIC_SENTRY_DSN }}
          EXPO_PUBLIC_SENTRY_AUTH_TOKEN=${{ secrets.EXPO_PUBLIC_SENTRY_AUTH_TOKEN }}
          EXPO_PUBLIC_SENTRY_ORG=${{ secrets.EXPO_PUBLIC_SENTRY_ORG }}
          EXPO_PUBLIC_SENTRY_PROJECT=${{ secrets.EXPO_PUBLIC_SENTRY_PROJECT }}
          EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=${{ secrets.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS }}
          EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=${{ secrets.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID }}
          EXPO_PUBLIC_HELPSCOUT_SECRET_KEY=${{ secrets.EXPO_PUBLIC_HELPSCOUT_SECRET_KEY }}
          EXPO_PUBLIC_POSTHOG_API_KEY=${{ secrets.EXPO_PUBLIC_POSTHOG_API_KEY }}
          EXPO_PUBLIC_TRANSCRIPTION_CLOUDFLARE_WORKER_URL=${{ secrets.EXPO_PUBLIC_TRANSCRIPTION_CLOUDFLARE_WORKER_URL }}
          EOF
      
      - name: Publish Update
        run: |
          source .env.production
          COMMIT_MESSAGE="${{ github.event.head_commit.message }}"
          eas update --branch production --message "$COMMIT_MESSAGE" --non-interactive
      
      - name: Post Update Info
        if: success()
        run: |
          echo "✅ OTA Update Published Successfully"
          echo "Branch: production"
          echo "Commit: ${{ github.sha }}"
          echo "Message: ${{ github.event.head_commit.message }}"

```

  trigger-native-build:
    needs: fingerprint-check
    if: needs.fingerprint-check.outputs.native-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Create Issue for Native Build
        uses: actions/github-script@v6
        with:
          script: |
            const changes = `${{ needs.fingerprint-check.outputs.changes }}`;
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🏗️ Native Build Required - Fingerprint Changed',
              body: `The native fingerprint has changed and a new build is required.
              
              **Commit:** ${{ github.sha }}
              **Author:** ${{ github.actor }}
              **Changed Files:** ${changes}
              
              ### Required Actions:
              1. Review the changes to understand what triggered the native rebuild
              2. Run \`eas build --platform all --profile production\`
              3. Test the new builds thoroughly
              4. Submit to app stores
              5. Close this issue once builds are live
              
              **Fingerprint:** ${{ needs.fingerprint-check.outputs.fingerprint }}
              `,
              labels: ['native-build-required', 'automated']
            });
      
      - name: Comment on PR (if applicable)
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '⚠️ This PR contains native changes and cannot be deployed via OTA update. A new native build will be required.'
            });
```

### Store and Track Fingerprints

Create `.github/workflows/fingerprint-tracking.yml`:

```yaml
name: Fingerprint Tracking

on:
  workflow_run:
    workflows: ["EAS Build"]
    types: [completed]
  workflow_dispatch:
    inputs:
      fingerprint:
        description: 'Manually set fingerprint for a build'
        required: false

jobs:
  store-fingerprint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate Fingerprint
        id: generate
        run: |
          npx expo install @expo/fingerprint
          FINGERPRINT=$(npx @expo/fingerprint . --platform ios --json | jq -r '.hash')
          echo "fingerprint=$FINGERPRINT" >> $GITHUB_OUTPUT
      
      - name: Store in Repository
        run: |
          # Store fingerprint with build metadata
          mkdir -p .fingerprints
          cat > .fingerprints/latest.json << EOF
          {
            "fingerprint": "${{ steps.generate.outputs.fingerprint }}",
            "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
            "commit": "${{ github.sha }}",
            "buildId": "${{ github.run_id }}"
          }
          EOF
          
          # Keep history
          cp .fingerprints/latest.json ".fingerprints/${{ github.sha }}.json"
      
      - name: Commit Fingerprint
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .fingerprints/
          git commit -m "chore: update fingerprint for ${{ github.sha }}"
          git push
```

### Advanced Fingerprint-Based Deployment

```yaml
name: Staged OTA Deployment

on:
  push:
    branches:
      - main
      - staging
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  determine-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      should-deploy: ${{ steps.env.outputs.should-deploy }}
    steps:
      - id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "should-deploy=true" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "environment=preview" >> $GITHUB_OUTPUT
            echo "should-deploy=true" >> $GITHUB_OUTPUT
          else
            echo "should-deploy=false" >> $GITHUB_OUTPUT
          fi

  safety-checks:
    needs: determine-environment
    if: needs.determine-environment.outputs.should-deploy == 'true'
    runs-on: ubuntu-latest
    outputs:
      safe: ${{ steps.validate.outputs.safe }}
      fingerprint-changed: ${{ steps.fingerprint.outputs.changed }}
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Check Fingerprint
        id: fingerprint
        run: |
          # Generate current fingerprint
          npx expo prebuild --platform ios --no-install
          CURRENT_FINGERPRINT=$(npx expo config --json | jq -r '.runtimeVersion')
          
          # Compare with last deployed fingerprint
          git checkout HEAD~1
          npx expo prebuild --platform ios --no-install
          PREVIOUS_FINGERPRINT=$(npx expo config --json | jq -r '.runtimeVersion')
          
          if [[ "$CURRENT_FINGERPRINT" != "$PREVIOUS_FINGERPRINT" ]]; then
            echo "::error::Fingerprint changed - native build required"
            echo "changed=true" >> $GITHUB_OUTPUT
            echo "Current: $CURRENT_FINGERPRINT"
            echo "Previous: $PREVIOUS_FINGERPRINT"
            exit 1
          else
            echo "changed=false" >> $GITHUB_OUTPUT
          fi
      
      - name: Validate Update Safety
        id: validate
        run: |
          # Additional validation logic
          echo "safe=true" >> $GITHUB_OUTPUT

  deploy-ota:
    needs: [determine-environment, safety-checks]
    if: needs.safety-checks.outputs.safe == 'true'
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Setup Environment
        run: |
          if [[ "${{ needs.determine-environment.outputs.environment }}" == "production" ]]; then
            cp .env.production .env
          else
            cp .env.preview .env
          fi
      
      - name: Deploy Update
        run: |
          source .env
          BRANCH="${{ needs.determine-environment.outputs.environment }}"
          MESSAGE="Deploy from ${{ github.ref }} - ${{ github.event.head_commit.message }}"
          eas update --branch $BRANCH --message "$MESSAGE" --non-interactive
      
      - name: Create Deployment
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.repos.createDeployment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: context.sha,
              environment: '${{ needs.determine-environment.outputs.environment }}',
              auto_merge: false,
              required_contexts: [],
              payload: {
                type: 'ota-update'
              }
            });

  notify-native-build-required:
    needs: safety-checks
    if: needs.safety-checks.outputs.fingerprint-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Create Issue
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Native Build Required - Fingerprint Changed',
              body: `A recent commit has changed the native fingerprint. OTA updates are blocked until a new native build is created.
              
              **Commit:** ${{ github.sha }}
              **Author:** ${{ github.actor }}
              **Message:** ${{ github.event.head_commit.message }}
              
              ### Required Actions:
              1. Run \`eas build --platform all --profile production\`
              2. Submit to app stores
              3. Close this issue once builds are live
              `,
              labels: ['native-build-required', 'high-priority']
            });
```

## EAS Build Webhooks

### Setup Webhook for Post-Build OTA

Create `eas-hooks/post-build.js`:

```javascript
// This runs after a successful build to automatically deploy an OTA update
const { execSync } = require('child_process');

module.exports = async (build) => {
  // Only run for production builds
  if (build.profile !== 'production') {
    console.log('Skipping OTA for non-production build');
    return;
  }

  // Only run for successful builds
  if (build.status !== 'finished') {
    console.log('Build not successful, skipping OTA');
    return;
  }

  try {
    // Deploy OTA update with new runtime version
    const message = `Auto-deploy after build ${build.id}`;
    execSync(`eas update --branch production --message "${message}"`, {
      stdio: 'inherit'
    });
    
    console.log('✅ OTA update deployed successfully');
  } catch (error) {
    console.error('Failed to deploy OTA update:', error);
  }
};
```

### Configure in eas.json

```json
{
  "build": {
    "production": {
      "hooks": {
        "postBuild": "./eas-hooks/post-build.js"
      }
    }
  }
}
```

## Manual Approval Workflow

Create `.github/workflows/ota-with-approval.yml`:

```yaml
name: OTA Update with Manual Approval

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'preview'
        type: choice
        options:
          - preview
          - production
      message:
        description: 'Update message'
        required: true

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      changes-summary: ${{ steps.summary.outputs.changes }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate Changes Summary
        id: summary
        run: |
          echo "changes<<EOF" >> $GITHUB_OUTPUT
          echo "## Files Changed" >> $GITHUB_OUTPUT
          git diff --name-only HEAD~5..HEAD | head -20 >> $GITHUB_OUTPUT
          echo "" >> $GITHUB_OUTPUT
          echo "## Recent Commits" >> $GITHUB_OUTPUT
          git log --oneline -5 >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
      
      - name: Post Summary
        uses: actions/github-script@v6
        with:
          script: |
            const summary = `${{ steps.summary.outputs.changes }}`;
            core.summary
              .addHeading('OTA Update Summary')
              .addRaw(summary)
              .write();

  approve:
    needs: prepare
    runs-on: ubuntu-latest
    environment: 
      name: ${{ github.event.inputs.environment }}-approval
    steps:
      - name: Approval Required
        run: echo "Waiting for manual approval..."

  deploy:
    needs: approve
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Deploy OTA Update
        run: |
          BRANCH="${{ github.event.inputs.environment }}"
          MESSAGE="${{ github.event.inputs.message }}"
          
          # Load appropriate env file
          if [[ "$BRANCH" == "production" ]]; then
            source .env.production
          else
            source .env.preview
          fi
          
          eas update --branch $BRANCH --message "$MESSAGE" --non-interactive
```

## GitHub Actions Secrets Required

Add these secrets to your GitHub repository:

```bash
# Required secrets for automation
EXPO_TOKEN                    # Your Expo access token
EXPO_PUBLIC_LANGUA_API_URL
EXPO_PUBLIC_LANGUA_WS_URL
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID
EXPO_PUBLIC_SENTRY_DSN
EXPO_PUBLIC_SENTRY_AUTH_TOKEN
EXPO_PUBLIC_SENTRY_ORG
EXPO_PUBLIC_SENTRY_PROJECT
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID
EXPO_PUBLIC_HELPSCOUT_SECRET_KEY
EXPO_PUBLIC_POSTHOG_API_KEY
EXPO_PUBLIC_TRANSCRIPTION_CLOUDFLARE_WORKER_URL
```

## Setting Up GitHub Environments

1. Go to Settings → Environments in your GitHub repo
2. Create environments:
   - `preview` - For staging updates
   - `production` - For production updates
   - `production-approval` - With required reviewers

3. Configure protection rules:
   - Add required reviewers for production
   - Set deployment branches (main only for production)

## Monitoring and Rollback

### Automated Rollback on Error Rate

Create `.github/workflows/monitor-rollback.yml`:

```yaml
name: Monitor and Auto-Rollback

on:
  schedule:
    - cron: '*/15 * * * *'  # Check every 15 minutes
  workflow_dispatch:

jobs:
  check-health:
    runs-on: ubuntu-latest
    steps:
      - name: Check Error Rate
        id: check
        run: |
          # Query your monitoring service (Sentry, PostHog, etc.)
          # This is a placeholder - implement actual monitoring logic
          ERROR_RATE=$(curl -s "https://api.sentry.io/..." | jq '.error_rate')
          
          if (( $(echo "$ERROR_RATE > 5" | bc -l) )); then
            echo "High error rate detected: $ERROR_RATE%"
            echo "should-rollback=true" >> $GITHUB_OUTPUT
          else
            echo "Error rate normal: $ERROR_RATE%"
            echo "should-rollback=false" >> $GITHUB_OUTPUT
          fi
      
      - name: Rollback if Needed
        if: steps.check.outputs.should-rollback == 'true'
        run: |
          # Get previous update ID
          PREVIOUS_UPDATE=$(eas update:list --branch production --json | jq -r '.[1].group')
          
          # Rollback
          eas update:republish --group $PREVIOUS_UPDATE --branch production
          
          # Alert team
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-Type: application/json' \
            -d '{"text":"🚨 Auto-rollback triggered due to high error rate"}'
```

## Fingerprint Integration in app.json

### Switch to Fingerprint-Based Runtime Version
Update your `app.json`:

```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

This automatically generates runtime versions based on native code changes.

### Custom Fingerprint Sources
Create `fingerprint.config.js` to customize what affects the fingerprint:

```javascript
const { Config } = require('@expo/fingerprint');

module.exports = {
  sourceSkips: {
    // Skip checking these paths
    'docs/**': 'debug',
    '**/*.test.ts': 'debug',
    '.github/**': 'debug',
  },
  // Custom hash sources
  hashSources: async () => {
    // Add custom sources that should trigger native rebuilds
    return [
      {
        type: 'file',
        filePath: 'app.json',
        // Only hash specific fields
        reasons: ['plugins', 'ios', 'android'],
      },
      {
        type: 'dir',
        filePath: 'ios',
        reasons: ['native-ios'],
      },
      {
        type: 'dir',
        filePath: 'android',
        reasons: ['native-android'],
      },
      {
        type: 'contents',
        id: 'expoConfig',
        contents: JSON.stringify(require('./app.json').expo),
        reasons: ['expo-config'],
      },
    ];
  },
};
```

## Local Fingerprint Testing

### Test Before Committing
```bash
# Install fingerprint CLI
npx expo install @expo/fingerprint

# Check current fingerprint
npx @expo/fingerprint . --platform ios

# Compare with previous commit
npx @expo/fingerprint diff --baseline HEAD~1 --current HEAD

# Check if changes are OTA-safe
npx @expo/fingerprint . --platform ios --json | jq '.sources | map(select(.type == "contents"))'
```

### Pre-commit Hook
Create `.husky/pre-push`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check fingerprint before push
echo "Checking fingerprint changes..."
BASELINE=$(git rev-parse origin/main)
CHANGES=$(npx @expo/fingerprint diff --baseline $BASELINE --current HEAD --json 2>/dev/null)

if [ ! -z "$CHANGES" ]; then
  echo "⚠️  Native changes detected in fingerprint!"
  echo "$CHANGES" | jq '.changes'
  echo ""
  echo "This will require a new native build."
  echo "Continue push? (y/n)"
  read -r response
  if [ "$response" != "y" ]; then
    exit 1
  fi
fi
```

## Best Practices for Fingerprint-Based Automation

1. **Always use fingerprint policy** for production apps
2. **Store fingerprints** with each build for tracking
3. **Compare fingerprints** before every OTA update
4. **Document fingerprint changes** in commit messages
5. **Monitor fingerprint drift** between environments
6. **Test fingerprint locally** before pushing
7. **Automate native build triggers** when fingerprint changes
8. **Track fingerprint history** for debugging

## Troubleshooting

### Common Issues

1. **Workflow not triggering**
   - Check path filters match your file structure
   - Verify branch protection rules

2. **Authentication failures**
   - Regenerate EXPO_TOKEN
   - Check token permissions

3. **Environment variables not loading**
   - Verify secrets are set in GitHub
   - Check secret names match exactly

4. **Fingerprint mismatches**
   - Ensure prebuild runs consistently
   - Check node/npm versions match locally

## Quick Start Implementation Steps

### 1. Install Fingerprint
```bash
npx expo install @expo/fingerprint
```

### 2. Update app.json
```json
{
  "expo": {
    "runtimeVersion": {
      "policy": "fingerprint"
    }
  }
}
```

### 3. Create Fingerprint Config
```bash
cat > fingerprint.config.js << 'EOF'
module.exports = {
  sourceSkips: {
    'docs/**': 'debug',
    '**/*.md': 'debug',
    '.github/**': 'debug',
  }
};
EOF
```

### 4. Test Fingerprint Locally
```bash
# Generate fingerprint
npx @expo/fingerprint . --platform ios

# Check what would change
npx @expo/fingerprint diff --baseline HEAD~1 --current HEAD
```

### 5. Create GitHub Workflow
Copy the fingerprint-based workflow to `.github/workflows/ota-fingerprint.yml`

### 6. Add GitHub Secrets
Add all your production environment variables as GitHub secrets

### 7. Test the Workflow
```bash
# Create a test branch
git checkout -b test-ota-workflow

# Make a JS-only change
echo "// test" >> App.tsx

# Push and watch the workflow
git add . && git commit -m "test: OTA workflow"
git push origin test-ota-workflow

# Watch the workflow
gh run watch
```

## Commands Reference

```bash
# Check fingerprint
npx @expo/fingerprint . --platform ios

# Compare fingerprints
npx @expo/fingerprint diff --baseline main --current HEAD

# Test workflow locally
act -j fingerprint-check --secret-file .env.production

# Trigger manual deployment
gh workflow run ota-update-fingerprint.yml

# View workflow runs
gh run list --workflow=ota-update-fingerprint.yml

# Debug fingerprint issues
npx @expo/fingerprint . --platform ios --json | jq '.sources'
```