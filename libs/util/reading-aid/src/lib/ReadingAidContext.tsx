import { createContext } from 'react';
import { ReadingAidContextValue } from './types';

export const ReadingAidContext = createContext<ReadingAidContextValue | null>(null);