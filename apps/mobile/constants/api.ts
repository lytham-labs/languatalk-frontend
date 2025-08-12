export const API_URL = process.env.EXPO_PUBLIC_LANGUA_API_URL || (__DEV__ ? 'http://localhost:3000' : 'https://languatalk.com');
export const WS_URL = process.env.EXPO_PUBLIC_LANGUA_WS_URL || (__DEV__ ? 'ws://localhost:8080/cable' : 'wss://languatalk.com/cable');
export const TRANSCRIPTION_CLOUDFLARE_WORKER_URL = process.env.EXPO_PUBLIC_TRANSCRIPTION_CLOUDFLARE_WORKER_URL || 'https://elevenlabs-aig.lythamlabs.workers.dev';
