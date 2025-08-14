import { useContext } from 'react';
import { UserSettingsContext } from './UserSettingsContext';
import { UserSettingsContextType } from './types';

export const useUserSettings = (): UserSettingsContextType => {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettings must be used within a UserSettingsProvider');
  }
  return context;
};