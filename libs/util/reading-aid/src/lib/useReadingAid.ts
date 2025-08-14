import { useContext } from 'react';
import { ReadingAidContext } from './ReadingAidContext';
import { ReadingAidContextValue } from './types';

export const useReadingAid = (): ReadingAidContextValue => {
  const context = useContext(ReadingAidContext);
  if (!context) {
    throw new Error('useReadingAid must be used within a ReadingAidProvider');
  }
  return context;
};