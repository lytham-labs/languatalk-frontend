// Backward compatibility exports
// This file allows existing code to continue importing from the original context files
// while using the new shared implementations under the hood

import React from 'react';

// Re-export the shared providers and hooks with original names
export {
  useAuth,
  useUserSettings, 
  useWebSocket,
  useReadingAid,
  SharedContextProviders as AuthProvider,
} from './SharedContextProviders';

// Legacy provider names for backward compatibility
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { SharedContextProviders } = require('./SharedContextProviders');
  return <SharedContextProviders>{children}</SharedContextProviders>;
};

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // UserSettings is now provided by SharedContextProviders
  return <>{children}</>;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // WebSocket is now provided by SharedContextProviders
  return <>{children}</>;
};

export const ReadingAidProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ReadingAid is now provided by SharedContextProviders
  return <>{children}</>;
};