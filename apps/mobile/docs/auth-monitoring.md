# Authentication Error Monitoring with Sentry

This document outlines how authentication errors and issues are tracked using Sentry to identify patterns in authentication failures and logout problems.

## Overview

The AuthContext integrates with Sentry to capture authentication errors and problematic logout events, helping identify issues without tracking normal user behavior.

## Sentry Events Tracked

### 1. **Problematic Logout Events** (Warning Level)
Only automatic/unexpected logouts are tracked (manual logouts are NOT tracked):

```typescript
// Triggers for these logout reasons only:
- 'invalid_token' (401/403 responses)
- 'network_error' (immediate logout on non-network errors)  
- 'non_network_error' (JSON parsing, etc.)
- 'initialization_error' (startup auth failures)
```

**Sentry Tags:**
- `auth_action: logout`
- `logout_reason: <reason>`
- `platform: ios|android`

**Extra Data:**
- `reason`: Specific logout reason
- `hadToken`: Whether user had a stored token
- `wasAuthenticated`: Whether user was authenticated
- `platform`: iOS or Android
- `appVersion`: development or production
- `timestamp`: ISO timestamp

### 2. **Authentication Resilience Issues** (Warning Level)
When auth check fails after 3 retries but user is kept logged in:

```typescript
Sentry.captureMessage('Authentication check failed - kept user logged in', {
  level: 'warning',
  tags: {
    auth_action: 'retry_failed_but_kept_logged_in',
    error_type: 'network_error|other_error'
  }
});
```

### 3. **Login/Signup Failures** (Exception Level)
Failed login and signup attempts:

```typescript
// Tags for filtering
auth_action: 'login_failed|signup_failed'
platform: 'ios|android'

// Extra context
email: user@example.com
timestamp: ISO timestamp
```

### 4. **Auth Cleanup Errors** (Exception Level)
Errors during authentication cleanup process:

```typescript
// Tags
auth_action: 'cleanup_error'
```

## Sentry Dashboard Queries

### Monitor Logout Patterns
```
tags:auth_action:logout
```

### Track Authentication Resilience
```
message:"Authentication check failed - kept user logged in"
```

### Monitor Login Failures
```
tags:auth_action:login_failed OR tags:auth_action:signup_failed
```

### Platform-Specific Issues
```
tags:auth_action:logout AND tags:platform:ios
tags:auth_action:logout AND tags:platform:android
```

### Network vs Auth Issues
```
tags:logout_reason:network_error
tags:logout_reason:invalid_token
```

## Alerts to Set Up

### 1. **High Logout Rate Alert**
- **Query**: `tags:auth_action:logout AND tags:logout_reason:invalid_token`
- **Threshold**: More than 10 events in 10 minutes
- **Action**: Investigate potential authentication service issues

### 2. **Network Resilience Alert**
- **Query**: `message:"Authentication check failed - kept user logged in"`
- **Threshold**: More than 5 events in 5 minutes
- **Action**: Check API health and network conditions

### 3. **Login Failure Spike**
- **Query**: `tags:auth_action:login_failed`
- **Threshold**: More than 20 events in 15 minutes
- **Action**: Investigate authentication service or credential issues

### 4. **Platform-Specific Issues**
- **Query**: `tags:auth_action:logout AND tags:platform:ios`
- **Threshold**: Significantly higher than Android
- **Action**: Investigate iOS-specific networking or app lifecycle issues

## Benefits

### 1. **Error-Focused Monitoring**
- Track only problematic logouts, not normal user behavior
- Distinguish between network issues vs actual auth failures
- Identify platform-specific authentication problems

### 2. **Resilience Monitoring**
- Track cases where users are kept logged in despite auth failures
- Monitor when the retry mechanism reaches its limits
- Identify patterns in authentication service degradation

### 3. **Proactive Issue Detection**
- Get alerted to spikes in authentication failures
- Identify login/signup service issues quickly
- Monitor authentication cleanup errors

### 4. **Privacy-Focused Approach**
- No tracking of successful authentication events
- No breadcrumbs for normal user flows
- Focus only on errors and issues that need investigation

## Development vs Production

### Development
- All events logged to console
- Sentry breadcrumbs for context
- Full error details in Sentry

### Production
- Console logging reduced
- Sentry captures warnings and errors
- Sensitive data (passwords) excluded from tracking

## Privacy Considerations

### Data Included:
- Email addresses (for login/signup failures)
- Platform and app version
- Timestamps and error types
- Authentication states (boolean flags)

### Data Excluded:
- Passwords or authentication tokens
- Personal user data beyond email
- Sensitive application state

The email addresses are only tracked for login/signup failures to help with user support and are not stored permanently in logs.