# Migration Guide: Using Shared Context Providers

This guide shows how to migrate from the old individual context providers to the new shared, platform-agnostic providers.

## Before (Current Implementation)

```tsx
// app/_layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
import { ReadingAidProvider } from '@/contexts/ReadingAidContext';
import { ActionCableProvider } from '@/contexts/ActionCableWebSocketContext';

const RootLayout = () => {
  return (
    <AuthProvider>
      <UserSettingsProvider>
        <ReadingAidProvider>
          <ActionCableProvider>
            <RootLayoutNav />
          </ActionCableProvider>
        </ReadingAidProvider>
      </UserSettingsProvider>
    </AuthProvider>
  );
};
```

## After (New Shared Implementation)

### Option 1: Full Migration (Recommended)

```tsx
// app/_layout.tsx
import { SharedContextProviders } from '@/contexts/SharedContextProviders';

const RootLayout = () => {
  return (
    <SharedContextProviders>
      <RootLayoutNav />
    </SharedContextProviders>
  );
};
```

### Option 2: Backward Compatible (Gradual Migration)

```tsx
// app/_layout.tsx
// Keep existing imports but they now use shared providers internally
import { AuthProvider } from '@/contexts/BackwardCompatibleContexts';
import { UserSettingsProvider } from '@/contexts/BackwardCompatibleContexts';
import { ReadingAidProvider } from '@/contexts/BackwardCompatibleContexts';
import { WebSocketProvider } from '@/contexts/BackwardCompatibleContexts';

const RootLayout = () => {
  return (
    <AuthProvider>
      <UserSettingsProvider>
        <ReadingAidProvider>
          <WebSocketProvider>
            <RootLayoutNav />
          </WebSocketProvider>
        </ReadingAidProvider>
      </UserSettingsProvider>
    </AuthProvider>
  );
};
```

## Hook Usage (No Changes Required)

```tsx
// Component code remains the same
import { useAuth } from '@/contexts/SharedContextProviders';
import { useUserSettings } from '@/contexts/SharedContextProviders';
import { useWebSocket } from '@/contexts/SharedContextProviders';
import { useReadingAid } from '@/contexts/SharedContextProviders';

const MyComponent = () => {
  const { isAuthenticated, login, logout } = useAuth();
  const { userSettings, updateUserSettings } = useUserSettings();
  const { connectWebSocket, sendMessage } = useWebSocket();
  const { isJapaneseReadingAidEnabledAndReady } = useReadingAid();
  
  // All existing hook APIs remain the same
};
```

## Benefits of Migration

1. **Platform Agnostic**: Context logic now works across React Native and Web
2. **Better Testing**: Easier to mock and test with dependency injection
3. **Cleaner Architecture**: Business logic separated from platform-specific code
4. **Type Safety**: Improved TypeScript interfaces and error handling
5. **Consistent APIs**: Standardized patterns across all contexts

## Migration Steps

1. **Test Current Implementation**: Ensure all existing functionality works
2. **Install New Dependencies**: The shared libraries are already available in the Nx workspace
3. **Update Imports**: Change imports to use `SharedContextProviders`
4. **Test All Features**: Verify auth, user settings, websockets, and reading aid still work
5. **Remove Old Context Files**: Once confident, remove old context implementations

## Rollback Plan

If issues arise, simply revert the imports:

```tsx
// Rollback to old contexts
import { AuthProvider } from '@/contexts/AuthContext';
import { UserSettingsProvider } from '@/contexts/UserSettingsContext';
// etc...
```

The old context files remain available for rollback purposes.