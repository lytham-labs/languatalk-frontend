export const LEARNING_LANGUAGES_ARRAY = [
    { label: 'Arabic', value: 'arabic' },
    { label: 'Chinese', value: 'chinese' },
    { label: 'Croatian', value: 'croatian' },
    { label: 'Czech', value: 'czech' },
    { label: 'Danish', value: 'danish' },
    { label: 'Dutch', value: 'dutch' },
    { label: 'English', value: 'english' },
    { label: 'Finnish', value: 'finnish' },
    { label: 'French', value: 'french' },
    { label: 'German', value: 'german' },
    { label: 'Greek', value: 'greek' },
    { label: 'Hindi', value: 'hindi' },
    { label: 'Italian', value: 'italian' },
    { label: 'Japanese', value: 'japanese' },
    { label: 'Korean', value: 'korean' },
    { label: 'Norwegian', value: 'norwegian' },
    { label: 'Polish', value: 'polish' },
    { label: 'Portuguese', value: 'portuguese' },
    { label: 'Romanian', value: 'romanian' },
    { label: 'Russian', value: 'russian' },
    { label: 'Spanish', value: 'spanish' },
    { label: 'Swedish', value: 'swedish' },
    { label: 'Thai', value: 'thai' },
    { label: 'Turkish', value: 'turkish' }
  ];

  export const AVAILABLE_LANGUAGES = {
    'arabic': 'ar',
    'croatian': 'hr',
    'czech': 'cs',
    'danish': 'da',
    'dutch': 'nl',
    'english': 'en',
    'finnish': 'fi',
    'french': 'fr',
    'german': 'de',
    'greek': 'el',
    'hindi': 'hi',
    'italian': 'it',
    'korean': 'ko',
    'norwegian': 'no',
    'polish': 'pl',
    'portuguese': 'pt',
    'romanian': 'ro',
    'russian': 'ru',
    'spanish': 'es',
    'swedish': 'sv',
    'turkish': 'tr'
  };
  
  const LEVELS_OPTIONS = {
    'Complete beginner': 'beginner',
    'Basic': 'basic',
    'Intermediate': 'intermediate',
    'Advanced': 'advanced'
  };
  
export const LEVELS_OPTIONS_ARRAY = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Basic (A2)', value: 'basic' },
    { label: 'Intermediate (B1)', value: 'intermediate' },
    { label: 'Upper-Intermediate/Advanced (B2+)', value: 'advanced' }
  ];

export const LANGUAGE_LEVEL_DESCRIPTIONS = {
    beginner: "\"I'm only just getting started\"",
    basic: "\"I can handle relatively simple conversations\"",
    intermediate: "\"I can chat about many things but struggle with fast/complex language\"",
    advanced: "\"I want to get closer to a native level\""
};

export const FLASCARDS_ORDERING_TECHNIQUES = {
  'Spaced Repetition (optimizes memorization)': 'space_repetition',
  'Spaced Repetition with Shuffle': 'space_repetition_with_shuffle',
  'Random - cards always accessible': 'random'
}

export const LANGUAGE_FLAGS = {
  'arabic': '🇸🇦',
  'chinese': '🇨🇳',
  'croatian': '🇭🇷',
  'czech': '🇨🇿',
  'danish': '🇩🇰',
  'dutch': '🇳🇱',
  'english': '🇺🇸', // Default to US
  'finnish': '🇫🇮',
  'french': '🇫🇷',
  'german': '🇩🇪',
  'greek': '🇬🇷',
  'hindi': '🇮🇳',
  'italian': '🇮🇹',
  'japanese': '🇯🇵',
  'korean': '🇰🇷',
  'norwegian': '🇳🇴',
  'polish': '🇵🇱',
  'portuguese': '🇵🇹', // Default to Portugal
  'romanian': '🇷🇴',
  'russian': '🇷🇺',
  'spanish': '🇪🇸', // Default to Spain
  'swedish': '🇸🇪',
  'thai': '🇹🇭',
  'turkish': '🇹🇷'
};

export const DIALECT_FLAGS = {
  'american_english': '🇺🇸',
  'british_english': '🇬🇧',
  'brazilian_portuguese': '🇧🇷',
  'european_portuguese': '🇵🇹',
  'latin_american_spanish': '🇲🇽', // Using Mexico flag as representative
  'castilian_spanish': '🇪🇸',
  'dutch': '🇳🇱',
  'flemish': '🇧🇪',
  'french_france': '🇫🇷',
  'french_canada': '🇨🇦'
};

export const LANGUAGE_DIALECTS = {
  english: [
    { label: 'American English', value: 'american_english' },
    { label: 'British English', value: 'british_english' }
  ],
  french: [
    { label: 'French (France)', value: 'french_france' },
    { label: 'French (Canadian)', value: 'french_canada' }
  ],
  portuguese: [
    { label: 'Brazilian Portuguese', value: 'brazilian_portuguese' },
    { label: 'European Portuguese', value: 'european_portuguese' }
  ],
  spanish: [
    { label: 'Latin American Spanish', value: 'latin_american_spanish' },
    { label: 'Castilian Spanish (Spain)', value: 'castilian_spanish' }
  ],
  dutch: [
    { label: 'Dutch (Nederlands)', value: 'dutch' },
    { label: 'Flemish', value: 'flemish' }
  ],
};
  
export const NATIVE_LANGUAGES_ARRAY = [
    { label: 'Afrikaans', value: 'afrikaans' },
    { label: 'Albanian', value: 'albanian' },
    { label: 'Arabic', value: 'arabic' },
    { label: 'Armenian', value: 'armenian' },
    { label: 'Azerbaijani', value: 'azerbaijani' },
    { label: 'Basque', value: 'basque' },
    { label: 'Belarusian', value: 'belarusian' },
    { label: 'Bengali', value: 'bengali' },
    { label: 'Bulgarian', value: 'bulgarian' },
    { label: 'Burmese', value: 'burmese' },
    { label: 'Catalan', value: 'catalan' },
    { label: 'Chinese (Simplified)', value: 'chinese (simplified)' },
    { label: 'Chinese (Traditional)', value: 'chinese (traditional)' },
    { label: 'Cantonese', value: 'cantonese' },
    { label: 'Corsican', value: 'corsican' },
    { label: 'Croatian', value: 'croatian' },
    { label: 'Czech', value: 'czech' },
    { label: 'Danish', value: 'danish' },
    { label: 'Dutch', value: 'dutch' },
    { label: 'English (American)', value: 'english (american)' },
    { label: 'English (British)', value: 'english (british)' },
    { label: 'Estonian', value: 'estonian' },
    { label: 'Finnish', value: 'finnish' },
    { label: 'French', value: 'french' },
    { label: 'French (Canadian)', value: 'french (canadian)' },
    { label: 'Galician', value: 'galician' },
    { label: 'German', value: 'german' },
    { label: 'German (Swiss)', value: 'german (swiss)' },
    { label: 'Greek', value: 'greek' },
    { label: 'Gujarati', value: 'gujarati' },
    { label: 'Hausa', value: 'hausa' },
    { label: 'Hebrew', value: 'hebrew' },
    { label: 'Hindi', value: 'hindi' },
    { label: 'Hungarian', value: 'hungarian' },
    { label: 'Icelandic', value: 'icelandic' },
    { label: 'Indonesian', value: 'indonesian' },
    { label: 'Irish', value: 'irish' },
    { label: 'Italian', value: 'italian' },
    { label: 'Japanese', value: 'japanese' },
    { label: 'Javanese', value: 'javanese' },
    { label: 'Kazakh', value: 'kazakh' },
    { label: 'Korean', value: 'korean' },
    { label: 'Latvian', value: 'latvian' },
    { label: 'Lithuanian', value: 'lithuanian' },
    { label: 'Luxembourgish', value: 'luxembourgish' },
    { label: 'Macedonian', value: 'macedonian' },
    { label: 'Malay', value: 'malay' },
    { label: 'Maltese', value: 'maltese' },
    { label: 'Marathi', value: 'marathi' },
    { label: 'Nepali', value: 'nepali' },
    { label: 'Norwegian', value: 'norwegian' },
    { label: 'Persian', value: 'persian' },
    { label: 'Polish', value: 'polish' },
    { label: 'Portuguese (Brazilian)', value: 'portuguese (brazilian)' },
    { label: 'Portuguese (European)', value: 'portuguese (european)' },
    { label: 'Punjabi', value: 'punjabi' },
    { label: 'Romanian', value: 'romanian' },
    { label: 'Russian', value: 'russian' },
    { label: 'Serbian', value: 'serbian' },
    { label: 'Sinhala', value: 'sinhala' },
    { label: 'Slovak', value: 'slovak' },
    { label: 'Slovenian', value: 'slovenian' },
    { label: 'Spanish (European)', value: 'spanish (european)' },
    { label: 'Spanish (Latin American)', value: 'spanish (latin american)' },
    { label: 'Swahili', value: 'swahili' },
    { label: 'Swedish', value: 'swedish' },
    { label: 'Tagalog', value: 'tagalog' },
    { label: 'Tamil', value: 'tamil' },
    { label: 'Telugu', value: 'telugu' },
    { label: 'Thai', value: 'thai' },
    { label: 'Turkish', value: 'turkish' },
    { label: 'Ukrainian', value: 'ukrainian' },
    { label: 'Urdu', value: 'urdu' },
    { label: 'Vietnamese', value: 'vietnamese' },
    { label: 'Welsh', value: 'welsh' },
    { label: 'Yiddish', value: 'yiddish' }
];

  
export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
export const DAYS_OF_WEEK_ARRAY = [
    { value: 'Mon', label: 'Mo' },
    { value: 'Tue', label: 'Tu' },
    { value: 'Wed', label: 'We' },
    { value: 'Thu', label: 'Th' },
    { value: 'Fri', label: 'Fr' },
    { value: 'Sat', label: 'Sa' },
    { value: 'Sun', label: 'Su' }
  ];
  
export const SPEED_MULTIPLIER = {
    slow: 0.70,
    normal: 0.92,
    fast: 1.16
};

export const AUTO_SEND_THRESHOLD = {
    slow: 2,
    normal: 3.3,
    fast: 4
};
