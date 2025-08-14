import { createContext } from 'react';
import { UserSettingsContextType } from './types';

export const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);