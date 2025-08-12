# Authentication Usage Examples

This document shows how to use the updated authentication system with refresh tokens.

## Using the createAuthenticatedRequest Method

The `createAuthenticatedRequest` method automatically handles token refresh when needed:

```typescript
import { useAuth } from '@/contexts/AuthContext';

const MyComponent = () => {
  const { createAuthenticatedRequest } = useAuth();
  
  const fetchUserData = async () => {
    try {
      // This will automatically refresh the token if it's expired
      const response = await createAuthenticatedRequest(
        `${API_URL}/api/v1/user/profile`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Handle success
      } else {
        // Handle error
      }
    } catch (error) {
      console.error('Request failed:', error);
    }
  };
};
```

## Error Handling Examples

### Login Error Handling
```typescript
const handleLogin = async (email: string, password: string) => {
  try {
    await login(email, password);
    // Navigate to home
  } catch (error) {
    if (error.message === 'Invalid email or password') {
      // Show specific error message
      Alert.alert('Login Failed', 'Please check your email and password');
    } else {
      // Show generic error
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  }
};
```

### Signup Error Handling
```typescript
const handleSignup = async (data: SignupData) => {
  try {
    await signup(data.name, data.email, data.password, data.receiveEmails);
    // Navigate to onboarding
  } catch (error) {
    if (error.message.includes(':')) {
      // Validation errors
      Alert.alert('Validation Error', error.message);
    } else {
      Alert.alert('Signup Failed', 'Please try again later.');
    }
  }
};
```

## Token Refresh Flow

The authentication system now handles token refresh automatically:

1. When a request returns 401 with `token_expired` error code
2. The system attempts to refresh using the stored refresh token
3. If successful, the original request is retried with the new token
4. If refresh fails, the user is logged out

## Migration Notes

- All authentication methods now store both access and refresh tokens
- The backend accepts both `token` and `access_token` fields for compatibility
- Refresh tokens expire after 1 year
- Access tokens expire after 90 days (vs 24 days previously)
- Token refresh happens automatically - no manual intervention needed

## Testing Authentication

To test the authentication flow:

1. Login/signup and verify both tokens are stored
2. Wait for access token to expire (or manually expire it in backend)
3. Make an authenticated request and verify it auto-refreshes
4. Check Sentry for proper error tracking with new error codes