import { createContext } from 'react';
import { WebSocketContextType } from './types';

export const WebSocketContext = createContext<WebSocketContextType | null>(null);