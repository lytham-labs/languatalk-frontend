type VoiceOptionMap = {
  [key: string]: {
    [label: string]: string;
  };
};

export const ELEVENLABS_CHAT_VOICE_OPTIONS: VoiceOptionMap = {
  croatian: {
    "Ivan (male)": "ivan_male_elevenlabs",
    "Maja (female)": "maja_female_elevenlabs"
  },
  czech: {
    "Ivana (female)": "ivana_female_elevenlabs",
    "Petr (male)": "petr_male_elevenlabs"
  },
  danish: {
    "Anna (Denmark, F)": "anna_female_elevenlabs",
    "Anna (Denmark, F, slower)": "annaslow_female_elevenlabs",
    "Peter (Denmark, M)": "peter_male_elevenlabs"
  },
  default: {
    "Antoni (male)": "antoni_male_elevenlabs",
    "Daniel (male)": "charlie_male_elevenlabs",
    "Maria (female)": "dorothy_female_elevenlabs"
  },
  dutch: {
    "Christophe (Belgium, M)": "christophe_male_elevenlabs",
    "Eric (Netherlands, M)": "eric_male_elevenlabs",
    "Guillaume (Belgium, M)": "guillaume_male_elevenlabs",
    "Helen (Netherlands, F)": "dorothy_female_elevenlabs",
    "Ruth (Netherlands, F)": "ruth_female_elevenlabs"
  },
  english: {
    "Lucy (UK, F)": "lucy_female_elevenlabs",
    "Brian (USA, M)": "morgan_male_elevenlabs",
    "Charlie (Australia, M)": "charlie_male_elevenlabs",
    "Dal (British Indian, M)": "dal_male_elevenlabs",
    "Dave (USA, M)": "dave_male_elevenlabs",
    "David (UK, M)": "david_male_elevenlabs",
    "Joey (USA, M)": "joey_male_elevenlabs",
    "John (UK, M)": "john_male_elevenlabs",
    "Liz (UK, F)": "liz_female_elevenlabs",
    "Rebecca (USA, F)": "rebecca_female_elevenlabs"
  },
  finnish: {
    "Emilia (female)": "emilia_female_elevenlabs",
    "Maria (female)": "maria_female_elevenlabs",
    "Mikael (male)": "mikael_male_elevenlabs"
  },
  french: {
    "Eden (France, F)": "eden_female_elevenlabs",
    "Hélène (France, F)": "helene_female_elevenlabs",
    "Jean (Canada, M)": "jean_male_elevenlabs",
    "Nicolas (France, M)": "nicolas_male_elevenlabs",
    "Vincent (France, M)": "vincent_male_elevenlabs",
    "Vincent (France, M, faster)": "vincentfast_male_elevenlabs"
  },
  german: {
    "Jakob (Germany, M, slower)": "jakob_male_elevenlabs",
    "Julia (Germany, F)": "julia_female_elevenlabs",
    "Leo (Germany, M, slower)": "leo_male_elevenlabs",
    "Lorenz (Austria, M)": "lorenz_male_elevenlabs",
    "Natalia (Germany, F)": "natalia_female_elevenlabs",
    "Natalia (Germany, F, slower)": "nataliaslow_female_elevenlabs",
    "Stefan (Germany, M)": "stefan_male_elevenlabs"
  },
  greek: {
    "Dimitrios (male)": "dimitrios_male_elevenlabs",
    "Maria (female)": "maria_female_elevenlabs"
  },
  hindi: {
    "Nikita (female)": "nikita_female_elevenlabs",
    "Raashid (male)": "raashid_male_elevenlabs",
    "Shreya (female)": "shreya_female_elevenlabs"
  },
  italian: {
    "Alessandro (male)": "alessandro_male_elevenlabs",
    "Cristina (female)": "cristina_female_elevenlabs",
    "Fabio (male)": "fabio_male_elevenlabs",
    "Francesco (male)": "francesco_male_elevenlabs",
    "Marco (male)": "marco_male_elevenlabs",
    "Maria (female)": "dorothy_female_elevenlabs"
  },
  norwegian: {
    "Linnea (female)": "linnea_female_elevenlabs",
    "Magnus (male)": "magnus_male_elevenlabs"
  },
  polish: {
    "Damian (male)": "damian_male_elevenlabs",
    "Jakub (male)": "jakub_male_elevenlabs",
    "Lena (female)": "lena_female_elevenlabs",
    "Renata (female)": "renata_female_elevenlabs"
  },
  portuguese: {
    "Afonso (Portugal, M)": "afonso_male_elevenlabs",
    "Beatriz (Brazil, F)": "dorothy_female_elevenlabs",
    "Catiá (Brazil, F)": "catia_female_elevenlabs",
    "Gabriel (Brazil, M)": "charlie_male_elevenlabs"
  },
  romanian: {
    "Daniel (male)": "charlie_male_elevenlabs",
    "Dorin (male)": "antoni_male_elevenlabs",
    "Maria (female)": "dorothy_female_elevenlabs"
  },
  russian: {
    "Anya (female)": "anya_female_elevenlabs",
    "Marat (male)": "marat_male_elevenlabs",
    "Nadia (female)": "nadia_female_elevenlabs"
  },
  spanish: {
    "Ana (Mexico, F)": "ana_female_elevenlabs",
    "Ana (Mexico, F, slower)": "anaslow_female_elevenlabs",
    "Cristian (Spain, M)": "cristian_male_elevenlabs",
    "Daniela (Latin America, F)": "daniela_female_elevenlabs",
    "Diego (Peru, M)": "diego_male_elevenlabs",
    "Enrique (Mexico, M)": "enrique_male_elevenlabs",
    "Facundo (Uruguay, M)": "facundo_male_elevenlabs",
    "Fernanda (Chile, F)": "fernanda_female_elevenlabs",
    "Maria (Spain, F)": "maria_female_elevenlabs",
    "Mateo (Argentina, M)": "mateo_male_elevenlabs",
    "Miguel (Spain, M, faster)": "miguel_male_elevenlabs",
    "Natalia (Colombia, F)": "nataliaspanish_female_elevenlabs",
    "Santiago (Mexico, M)": "santiago_male_elevenlabs",
    "Valeria (Argentina, F)": "valeria_female_elevenlabs",
    "Yinet (Colombia, F)": "yinet_female_elevenlabs"
  },
  swedish: {
    "Astrid (female)": "astrid_female_elevenlabs",
    "Nils (male)": "nils_male_elevenlabs",
    "Oliver (male)": "oliver_male_elevenlabs",
    "Sanna (female)": "sanna_female_elevenlabs"
  },
  turkish: {
    "Ceren (female)": "ceren_female_elevenlabs",
    "Emre (male)": "emre_male_elevenlabs",
    "Hasan (male)": "hasan_male_elevenlabs",
    "Isra (female)": "isra_female_elevenlabs"
  }
} as const;

export const OPENAI_VOICE_OPTIONS: VoiceOptionMap = {
  arabic: {
    "Omar (male)": "ash_male_openai",
    "Fatima (female)": "alloy_female_openai"
  },
  chinese: {
    "Ming (male)": "ash_male_openai", 
    "Mei (female)": "alloy_female_openai"
  },
  croatian: {
    "Luka (male)": "ash_male_openai",
    "Ana (female)": "alloy_female_openai"
  },
  czech: {
    "Jan (male)": "ash_male_openai",
    "Eva (female)": "alloy_female_openai"
  },
  danish: {
    "William (male)": "ash_male_openai",
    "Ida (female)": "alloy_female_openai"
  },
  dutch: {
    "Daan (Netherlands, M)": "ash_male_openai",
    "Emma (Netherlands, F)": "alloy_female_openai"
  },
  english: {
    "Adam (UK, M)": "ballad_male_openai",
    "Michael (USA, M)": "ash_male_openai",
    "Olivia (USA, F)": "alloy_female_openai"
  },
  finnish: {
    "Leo (male)": "ash_male_openai",
    "Sofia (female)": "alloy_female_openai"
  },
  french: {
    "Lucas (France, M)": "ash_male_openai",
    "Léa (France, F)": "alloy_female_openai"
  },
  greek: {
    "Georgios (male)": "ash_male_openai",
    "Eleni (female)": "alloy_female_openai"
  },
  german: {
    "Maximilian (Germany, M)": "ash_male_openai",
    "Hannah (Germany, F)": "alloy_female_openai"
  },
  hindi: {
    "Rohan (male)": "ash_male_openai",
    "Priya (female)": "alloy_female_openai"
  },
  italian: {
    "Leonardo (male)": "ash_male_openai",
    "Giulia (female)": "alloy_female_openai"
  },
  japanese: {
    "Haruto (male)": "ash_male_openai",
    "Yui (female)": "alloy_female_openai"
  },
  korean: {
    "Minjun (male)": "ash_male_openai",
    "Jiwoo (female)": "alloy_female_openai"
  },
  norwegian: {
    "Jakob (male)": "ash_male_openai",
    "Nora (female)": "alloy_female_openai"
  },
  polish: {
    "Piotr (male)": "ash_male_openai",
    "Zofia (female)": "alloy_female_openai"
  },
  portuguese: {
    "Lucas (Brazil, M)": "ash_male_openai",
    "Julia (Brazil, F)": "alloy_female_openai"
  },
  romanian: {
    "Andrei (male)": "ash_male_openai",
    "Elena (female)": "alloy_female_openai"
  },
  russian: {
    "Ivan (male)": "ash_male_openai",
    "Anastasia (female)": "alloy_female_openai"
  },
  spanish: {
    "Carlos (Latin American, M)": "ash_male_openai",
    "Sofia (Latin American, F)": "alloy_female_openai"
  },
  swedish: {
    "William (male)": "ash_male_openai",
    "Alice (female)": "alloy_female_openai"
  },
  turkish: {
    "Mehmet (male)": "ash_male_openai",
    "Zeynep (female)": "alloy_female_openai"
  }
} as const;

// Default voice selection logic (matching server-side Stream::ElevenlabsGenerateAudioService.default_voice)
export const getDefaultVoiceForLanguage = (language: string, dialect?: string): string => {
  // First check dialect-specific defaults
  if (dialect) {
    switch (dialect) {
      case 'american_english':
        return 'morgan_male_elevenlabs';
      case 'british_english':
        return 'lucy_female_elevenlabs';
      case 'european_portuguese':
        return 'afonso_male_elevenlabs';
      case 'brazilian_portuguese':
        return 'catia_female_elevenlabs';
      case 'castilian_spanish':
        return 'maria_female_elevenlabs';
      case 'latin_american_spanish':
        return 'santiago_male_elevenlabs';
      case 'flemish':
        return 'christophe_male_elevenlabs';
      case 'dutch':
        return 'ruth_female_elevenlabs';
      default:
        // Fall through to language defaults
    }
  }

  // Language-specific defaults
  switch (language) {
    case 'arabic':
      return 'ash_male_openai'; // No Arabic voices in ElevenLabs yet
    case 'chinese':
      return 'alloy_female_openai'; // No Chinese voices in ElevenLabs yet
    case 'croatian':
      return 'maja_female_elevenlabs';
    case 'czech':
      return 'petr_male_elevenlabs';
    case 'danish':
      return 'peter_male_elevenlabs';
    case 'finnish':
      return 'mikael_male_elevenlabs';
    case 'french':
      return 'vincent_male_elevenlabs'; // Use vincent instead of gaelle
    case 'german':
      return 'stefan_male_elevenlabs';
    case 'greek':
      return 'dimitrios_male_elevenlabs';
    case 'hindi':
      return 'shreya_female_elevenlabs';
    case 'italian':
      return 'francesco_male_elevenlabs';
    case 'japanese':
      return 'alloy_female_openai'; // Use OpenAI for Japanese
    case 'korean':
      return 'alloy_female_openai'; // Use OpenAI for Korean
    case 'norwegian':
      return 'magnus_male_elevenlabs';
    case 'polish':
      return 'lena_female_elevenlabs';
    case 'portuguese':
      return 'catia_female_elevenlabs'; // Default to Brazilian
    case 'romanian':
      return 'dorothy_female_elevenlabs'; // Use default voice
    case 'russian':
      return 'marat_male_elevenlabs';
    case 'spanish':
      return 'santiago_male_elevenlabs'; // Default to Latin American
    case 'swedish':
      return 'sanna_female_elevenlabs';
    case 'turkish':
      return 'hasan_male_elevenlabs';
    case 'english':
      return 'lucy_female_elevenlabs'; // Default to British
    default:
      return 'dorothy_female_elevenlabs'; // Fallback to default voice
  }
};
