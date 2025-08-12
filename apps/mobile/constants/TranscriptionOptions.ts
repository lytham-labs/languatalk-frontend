type TranscriptionOptionType = {
  label: string;
  value: string;
  model: string;
};

type TranscriptionOptionsMap = {
  [key: string]: TranscriptionOptionType;
};

export const TRANSCRIPTION_OPTIONS: TranscriptionOptionsMap = {
  v1: {
    label: 'V1 (recommended)',
    value: 'v1',
    model: 'scribe_v1_with_language'
  },
  v2: {
    label: 'V2 (backup)',
    value: 'v2',
    model: 'whisper-1'
  },
  v3: {
    label: 'V3 (experimental)',
    value: 'v3',
    model: 'gemini'
  },
  v4: {
    label: 'V4 (gpt-4o-audio-preview)',
    value: 'v4',
    model: 'gpt-4o-audio-preview-2024-12-17'
  },
  v5: {
    label: 'V5 (Whisper Turbo)',
    value: 'v5',
    model: 'whisper-turbo'
  },
  v6: {
    label: 'V6 (Gemini Pro)',
    value: 'v6',
    model: 'gemini-pro'
  },
  v7: {
    label: 'V7 (Deepgram)',
    value: 'v7',
    model: 'deepgram'
  },
  v8: {
    label: 'V8 (Elevenlabs)',
    value: 'v8',
    model: 'scribe_v1'
  },
  v9: {
    label: 'V9 (shows word by word)',
    value: 'v9',
    model: 'speechmatics'
  }
} as const;

// Helper function to get model name from transcription mode
export const getTranscriptionModel = (mode: string): string => {
  return TRANSCRIPTION_OPTIONS[mode]?.model || TRANSCRIPTION_OPTIONS.v1.model;
};
