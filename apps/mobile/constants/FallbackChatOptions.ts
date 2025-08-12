interface ChatOption {
  key: string;
  label: string;
  topics?: { key: string; label: string }[];
}

interface ApiResponse {
  chat_options: {
    roleplay: ChatOption[];
    general?: ChatOption[];
    debate: ChatOption[];
    chat_about_anything: ChatOption[];
    vocab: ChatOption[];
    grammar: ChatOption[];
    guided: ChatOption[];
    custom_conversation?: ChatOption[];
  };
  chat_form: {
    mode_options: [string, string][] | { [key: string]: string };
    voice_options: { [key: string]: string };
    all_voice_options: { [key: string]: { [key: string]: string } };
    ai_model_options: [string, string][];
    transcription_mode_options: [string, string][];
    transcription_model_options?: any;
    speed_options: [string, string][];
    language: string;
    mode: string;
    display_selected_options: string;
    voice: string;
    selected_vocab?: string | null;
  };
  new_user?: boolean;
  language_warning: boolean;
  vocab_list?: string[];
  user_prompts?: { id: number; title: string; prompt: string; }[];
}

// Complete voice options from actual API
const FALLBACK_ALL_VOICE_OPTIONS = {
  "default": {
    "Maria (female)": "dorothy_female_elevenlabs",
    "Daniel (male)": "charlie_male_elevenlabs",
    "Antoni (male)": "antoni_male_elevenlabs"
  },
  "arabic": {
    "Mustafa (male)": "mustafa_male_elevenlabs",
    "Sara (female)": "sara_female_elevenlabs",
    "Youssef (male)": "youssef_male_elevenlabs",
    "Nadine (female)": "nadine_female_elevenlabs",
    "Ahmed (male)": "ahmed_male_elevenlabs",
    "Omar (male)": "ash_male_openai",
    "Fatima (female)": "alloy_female_openai"
  },
  "chinese": {
    "Iris (female)": "iris_female_elevenlabs",
    "Kevin (male)": "kevin_male_elevenlabs",
    "Vivian (female)": "vivian_female_elevenlabs",
    "Lilly (female)": "lilly_female_elevenlabs",
    "Ming (male)": "ash_male_openai",
    "Mei (female)": "alloy_female_openai"
  },
  "croatian": {
    "Maja (female)": "maja_female_elevenlabs",
    "Ivan (male)": "ivan_male_elevenlabs",
    "Luka (male)": "ash_male_openai",
    "Ana (female)": "alloy_female_openai"
  },
  "czech": {
    "Petr (male)": "petr_male_elevenlabs",
    "Ivana (female)": "ivana_female_elevenlabs",
    "Jan (male)": "ash_male_openai",
    "Eva (female)": "alloy_female_openai"
  },
  "danish": {
    "Peter (Denmark, M)": "peter_male_elevenlabs",
    "Anna (Denmark, F)": "anna_female_elevenlabs",
    "Anna (Denmark, F, slower)": "annaslow_female_elevenlabs",
    "William (male)": "ash_male_openai",
    "Ida (female)": "alloy_female_openai"
  },
  "dutch": {
    "Ruth (Netherlands, F)": "ruth_female_elevenlabs",
    "Eric (Netherlands, M)": "eric_male_elevenlabs",
    "Helen (Netherlands, F)": "dorothy_female_elevenlabs",
    "Christophe (Belgium, M)": "christophe_male_elevenlabs",
    "Guillaume (Belgium, M)": "guillaume_male_elevenlabs",
    "Daan (Netherlands, M)": "ash_male_openai",
    "Emma (Netherlands, F)": "alloy_female_openai"
  },
  "english": {
    "Lucy (UK, F)": "lucy_female_elevenlabs",
    "John (UK, M)": "john_male_elevenlabs",
    "Liz (UK, F)": "liz_female_elevenlabs",
    "Dave (USA, M)": "dave_male_elevenlabs",
    "David (UK, M)": "david_male_elevenlabs",
    "Brian (USA, M)": "morgan_male_elevenlabs",
    "Rebecca (USA, F)": "rebecca_female_elevenlabs",
    "Joey (USA, M)": "joey_male_elevenlabs",
    "Dal (British Indian, M)": "dal_male_elevenlabs",
    "Charlie (Australia, M)": "charlie_male_elevenlabs",
    "Adam (UK, M)": "ballad_male_openai",
    "Michael (USA, M)": "ash_male_openai",
    "Olivia (USA, F)": "alloy_female_openai"
  },
  "finnish": {
    "Maria (female)": "maria_female_elevenlabs",
    "Mikael (male)": "mikael_male_elevenlabs",
    "Emilia (female)": "emilia_female_elevenlabs",
    "Leo (male)": "ash_male_openai",
    "Sofia (female)": "alloy_female_openai"
  },
  "french": {
    "Vincent (France, M, faster)": "vincentfast_male_elevenlabs",
    "Gaelle (France, F)": "gaelle_female_elevenlabs",
    "Eden (France, F)": "eden_female_elevenlabs",
    "Vincent (France, M)": "vincent_male_elevenlabs",
    "Nicolas (France, M)": "nicolas_male_elevenlabs",
    "Hélène (France, F)": "helene_female_elevenlabs",
    "Jean (Canada, M)": "jean_male_elevenlabs",
    "Lucas (France, M)": "ash_male_openai",
    "Léa (France, F)": "alloy_female_openai"
  },
  "hindi": {
    "Shreya (female)": "shreya_female_elevenlabs",
    "Raashid (male)": "raashid_male_elevenlabs",
    "Nikita (female)": "nikita_female_elevenlabs",
    "Rohan (male)": "ash_male_openai",
    "Priya (female)": "alloy_female_openai"
  },
  "german": {
    "Natalia (Germany, F)": "natalia_female_elevenlabs",
    "Natalia (Germany, F, slower)": "nataliaslow_female_elevenlabs",
    "Stefan (Germany, M)": "stefan_male_elevenlabs",
    "Julia (Germany, F)": "julia_female_elevenlabs",
    "Jakob (Germany, M, slower)": "jakob_male_elevenlabs",
    "Lorenz (Austria, M)": "lorenz_male_elevenlabs",
    "Leo (Germany, M, slower)": "leo_male_elevenlabs",
    "Maximilian (Germany, M)": "ash_male_openai",
    "Hannah (Germany, F)": "alloy_female_openai"
  },
  "greek": {
    "Dimitrios (male)": "dimitrios_male_elevenlabs",
    "Maria (female)": "maria_female_elevenlabs",
    "Georgios (male)": "ash_male_openai",
    "Eleni (female)": "alloy_female_openai"
  },
  "italian": {
    "Francesco (male)": "francesco_male_elevenlabs",
    "Cristina (female)": "cristina_female_elevenlabs",
    "Fabio (male)": "fabio_male_elevenlabs",
    "Alessandro (male)": "alessandro_male_elevenlabs",
    "Maria (female)": "dorothy_female_elevenlabs",
    "Marco (male)": "marco_male_elevenlabs",
    "Leonardo (male)": "ash_male_openai",
    "Giulia (female)": "alloy_female_openai"
  },
  "japanese": {
    "Yuki (female)": "yuki_female_elevenlabs",
    "Hiroki (male)": "hiroki_male_elevenlabs",
    "Ken (male)": "ken_male_elevenlabs",
    "Kaito (male)": "kaito_male_elevenlabs",
    "Shinji (male)": "shinji_male_elevenlabs",
    "Haruto (male, recommended)": "ash_male_openai",
    "Akari (female, recommended)": "alloy_female_openai"
  },
  "korean": {
    "Kim (female)": "kim_female_elevenlabs",
    "Choi (male)": "choi_male_elevenlabs",
    "Kwon (male)": "kwon_male_elevenlabs",
    "Minjun (male)": "ash_male_openai",
    "Jiwoo (female)": "alloy_female_openai"
  },
  "norwegian": {
    "Magnus (male)": "magnus_male_elevenlabs",
    "Linnea (female)": "linnea_female_elevenlabs",
    "Jakob (male)": "ash_male_openai",
    "Nora (female)": "alloy_female_openai"
  },
  "polish": {
    "Lena (female)": "lena_female_elevenlabs",
    "Damian (male)": "damian_male_elevenlabs",
    "Renata (female)": "renata_female_elevenlabs",
    "Jakub (male)": "jakub_male_elevenlabs",
    "Piotr (male)": "ash_male_openai",
    "Zofia (female)": "alloy_female_openai"
  },
  "portuguese": {
    "Catiá (Brazil, F)": "catia_female_elevenlabs",
    "Gabriel (Brazil, M)": "charlie_male_elevenlabs",
    "Beatriz (Brazil, F)": "dorothy_female_elevenlabs",
    "Afonso (Portugal, M)": "afonso_male_elevenlabs",
    "Francisco (Portugal, M)": "francisco_male_elevenlabs",
    "Lucas (Brazil, M)": "ash_male_openai",
    "Julia (Brazil, F)": "alloy_female_openai"
  },
  "romanian": {
    "Maria (female)": "dorothy_female_elevenlabs",
    "Daniel (male)": "charlie_male_elevenlabs",
    "Dorin (male)": "antoni_male_elevenlabs",
    "Andrei (male)": "ash_male_openai",
    "Elena (female)": "alloy_female_openai"
  },
  "russian": {
    "Marat (male)": "marat_male_elevenlabs",
    "Anya (female)": "anya_female_elevenlabs",
    "Nadia (female)": "nadia_female_elevenlabs",
    "Ivan (male)": "ash_male_openai",
    "Anastasia (female)": "alloy_female_openai"
  },
  "spanish": {
    "Maria (Spain, F)": "maria_female_elevenlabs",
    "Miguel (Spain, M, faster)": "miguel_male_elevenlabs",
    "Cristian (Spain, M)": "cristian_male_elevenlabs",
    "Daniela (Latin America, F)": "daniela_female_elevenlabs",
    "Ana (Mexico, F)": "ana_female_elevenlabs",
    "Ana (Mexico, F, slower)": "anaslow_female_elevenlabs",
    "Santiago (Mexico, M)": "santiago_male_elevenlabs",
    "Enrique (Mexico, M)": "enrique_male_elevenlabs",
    "Valeria (Argentina, F)": "valeria_female_elevenlabs",
    "Mateo (Argentina, M)": "mateo_male_elevenlabs",
    "Natalia (Colombia, F)": "nataliaspanish_female_elevenlabs",
    "Yinet (Colombia, F)": "yinet_female_elevenlabs",
    "Diego (Peru, M)": "diego_male_elevenlabs",
    "Facundo (Uruguay, M)": "facundo_male_elevenlabs",
    "Fernanda (Chile, F)": "fernanda_female_elevenlabs",
    "Alexandra (Spain, F)": "alexandra_female_elevenlabs",
    "Alberto (Spain, M)": "alberto_male_elevenlabs",
    "Carlos (Latin America, M)": "ash_male_openai",
    "Sofia (Latin America, F)": "alloy_female_openai"
  },
  "swedish": {
    "Nils (male)": "nils_male_elevenlabs",
    "Sanna (female)": "sanna_female_elevenlabs",
    "Astrid (female)": "astrid_female_elevenlabs",
    "Oliver (male)": "oliver_male_elevenlabs",
    "William (male)": "ash_male_openai",
    "Alice (female)": "alloy_female_openai"
  },
  "turkish": {
    "Hasan (male)": "hasan_male_elevenlabs",
    "Ceren (female)": "ceren_female_elevenlabs",
    "Emre (male)": "emre_male_elevenlabs",
    "Isra (female)": "isra_female_elevenlabs",
    "Mehmet (male)": "ash_male_openai",
    "Zeynep (female)": "alloy_female_openai"
  },
  "thai": {
    "Default Voice": "default_voice"
  }
};

// Language name mapping for display
const LANGUAGE_DISPLAY_NAMES: { [key: string]: string } = {
  'english': 'English',
  'spanish': 'Spanish',
  'french': 'French',
  'german': 'German',
  'italian': 'Italian',
  'portuguese': 'Portuguese',
  'dutch': 'Dutch',
  'russian': 'Russian',
  'chinese': 'Chinese',
  'japanese': 'Japanese',
  'korean': 'Korean',
  'arabic': 'Arabic',
  'hindi': 'Hindi',
  'polish': 'Polish',
  'turkish': 'Turkish',
  'swedish': 'Swedish',
  'norwegian': 'Norwegian',
  'danish': 'Danish',
  'finnish': 'Finnish',
  'greek': 'Greek',
  'czech': 'Czech',
  'romanian': 'Romanian',
  'croatian': 'Croatian',
  'thai': 'Thai'
};

// Chat options from actual API (language-agnostic)
const FALLBACK_CHAT_OPTIONS = {
  "roleplay": [
    {
      "key": "travel",
      "label": "Travel",
      "topics": [
        { "key": "checking_into_hotel", "label": "Checking into a hotel" },
        { "key": "ordering_in_restaurant", "label": "Ordering in a restaurant" },
        { "key": "buying_train_ticket", "label": "Buying a train ticket" },
        { "key": "asking_for_directions", "label": "Asking a local for directions" },
        { "key": "renting_car", "label": "Renting a car" },
        { "key": "asking_for_recommendations", "label": "Asking for local recommendations" },
        { "key": "checking_in_airport", "label": "Checking in at the airport" },
        { "key": "booking_city_tour", "label": "Booking a city tour" },
        { "key": "talking_to_police", "label": "Talking to the police, reporting having been robbed" }
      ]
    },
    {
      "key": "living_in_a_new_country",
      "label": "Living in a new country",
      "topics": [
        { "key": "opening_a_bank_account", "label": "Opening a bank account" },
        { "key": "meeting_new_neighbour", "label": "Meeting your new neighbour" },
        { "key": "enrolling_children_in_school", "label": "Enrolling your children in school" },
        { "key": "calling_estate_agent", "label": "Calling an estate agent" },
        { "key": "considering_joining_gym", "label": "At a gym, considering joining" },
        { "key": "telling_doctor_concern", "label": "Telling the doctor about a concern" },
        { "key": "trying_to_buy_metro_pass", "label": "Trying to buy a metro pass" },
        { "key": "calling_plumber", "label": "Calling a plumber due to a leak" },
        { "key": "talking_to_expat", "label": "Talking to another expat about events and bin collection" }
      ]
    },
    {
      "key": "work_and_business",
      "label": "Work and business",
      "topics": [
        { "key": "attending_a_job_interview", "label": "Attending a Job Interview" },
        { "key": "getting_help_from_a_career_advisor", "label": "Getting help from a career adviser" },
        { "key": "discussing_work_with_a_colleague", "label": "Discussing work with a colleague" },
        { "key": "requesting_holiday_time_from_your_manager", "label": "Requesting holiday time from your manager" },
        { "key": "meeting_hr_to_request_to_work_remotely", "label": "Meeting HR to request to work remotely" },
        { "key": "discussing_work_life_balance_with_a_colleague", "label": "Discussing work-life balance with a colleague" },
        { "key": "pitching_a_business_idea", "label": "Pitching a Business Idea (have your idea ready!)" }
      ]
    },
    {
      "key": "social_and_family_life",
      "label": "Social and family life",
      "topics": [
        { "key": "going_on_a_date_with_a_guy", "label": "Going on a date with a guy" },
        { "key": "going_on_a_date_with_a_lady", "label": "Going on a date with a lady" },
        { "key": "planning_the_weekly_food_shop_with_your_partner", "label": "Planning the weekly food shop with your partner" },
        { "key": "persuading_your_kid_to_do_their_homework", "label": "Persuading your kid to do their homework" },
        { "key": "planning_a_family_outing", "label": "Planning a family outing" }
      ]
    },
    {
      "key": "custom",
      "label": "Custom",
      "topics": [
        { "key": "custom_topic", "label": "You pick a topic/idea" }
      ]
    }
  ],
  "debate": [
    { "key": "everyone_should_be_vegan", "label": "Everyone should be vegan." },
    { "key": "all_people_should_have_universal_basic_income", "label": "All people should have Universal Basic Income." },
    { "key": "bottled_water_should_be_banned", "label": "Bottled water should be banned." },
    { "key": "remote_work_is_more_productive_than_office_work", "label": "Remote work is more productive than office work." },
    { "key": "social_media_should_be_prohibited_until_adulthood", "label": "Social media should be prohibited until adulthood." },
    { "key": "fossil_fuels_should_be_banned", "label": "Fossil fuels should be banned." },
    { "key": "a_four_day_work_week_should_be_the_norm", "label": "A four day work week should be the norm." },
    { "key": "the_usa_will_soon_be_overtaken_by_china", "label": "The USA will soon be overtaken by China." },
    { "key": "flying_should_be_taxed_heavily_to_prevent_climate_change", "label": "Flying should be taxed heavily to prevent climate change." },
    { "key": "euthanasia_should_be_legalised_everywhere", "label": "Euthanasia should be legalised everywhere." },
    { "key": "violent_video_games_should_be_banned", "label": "Violent video games should be banned." },
    { "key": "nuclear_power_is_safe_and_sustainable", "label": "Nuclear power is safe and sustainable." },
    { "key": "private_schools_should_not_exist", "label": "Private schools should not exist." },
    { "key": "artificial_intelligence_is_good_for_society", "label": "Artificial Intelligence is good for society." },
    { "key": "climate_change_is_the_most_significant_threat_to_humanity", "label": "Climate change is the most significant threat to humanity." },
    { "key": "governments_should_censor_fake_news", "label": "Governments should censor fake news." },
    { "key": "junk_food_should_be_taxed_heavily", "label": "Junk food should be taxed heavily." },
    { "key": "cars_should_be_banned_in_city_centres_to_reduce_pollution", "label": "Cars should be banned in city centres to reduce pollution." },
    { "key": "custom_chose_a_topic", "label": "Custom - Choose a topic" }
  ],
  "chat_about_anything": [
    { "key": "free_chat", "label": "General conversation" },
    {
      "key": "my_life",
      "label": "My life",
      "topics": [
        { "key": "day", "label": "My day or plans" },
        { "key": "grateful", "label": "What I'm grateful for" },
        { "key": "goals", "label": "My goals & aspirations" }
      ]
    },
    { "key": "free_chat_lots_of_slang", "label": "Chat with lots of slang (intermediate +)" }
  ],
  "vocab": [
    { "key": "practice_describing_things", "label": "Practice describing things" },
    { "key": "create_a_story_together", "label": "Create a story together" },
    { "key": "learn_idiom", "label": "Learn idioms (multiple choice)" }
  ],
  "grammar": [
    { "key": "choose_a_tense_and_translate_sentences", "label": "Translate from native to target language" },
    { "key": "translate_sentences_to_native", "label": "Translate from target to native language" },
    { "key": "error_correction_choice", "label": "Error correction on your chosen topic" },
    { "key": "ask_me_open_ended_questions", "label": "Ask me open-ended questions" },
    { "key": "ask_me_multiple_choice_questions", "label": "Ask me multiple choice questions" },
    { "key": "verb_focus", "label": "Focus on a specific verb" },
    { "key": "ask_a_grammar_question_explanations_in_english", "label": "Ask a grammar question, explanations in native language" },
    { "key": "ask_a_grammar_question_explanations_in_target_language", "label": "Ask a grammar question, explanations in target language" }
  ],
  "guided": [
    { "key": "introduce_yourself", "label": "Introduce yourself" },
    { "key": "get_help_and_check_for_understanding", "label": "Get help and check for understanding" },
    { "key": "describe_your_best_friend", "label": "Describe your best friend" },
    { "key": "meet_someone_new", "label": "Meet someone new" },
    { "key": "discuss_what_food_you_like_and_dislike", "label": "Discuss what food you like and dislike" },
    { "key": "describe_a_day_in_your_life", "label": "Describe a day in your life" },
    { "key": "discuss_what_activities_you_like_and_dislike", "label": "Discuss what activities you like and dislike" },
    { "key": "shop_at_a_supermarket", "label": "Shop at a supermarket" }
  ],
  "custom_conversation": [
    { "key": "create_new", "label": "Create custom conversation" }
  ]
};

export const getFallbackApiData = (currentLanguage?: string): ApiResponse => {
  const language = currentLanguage || 'english';
  const voiceOptions = FALLBACK_ALL_VOICE_OPTIONS[language as keyof typeof FALLBACK_ALL_VOICE_OPTIONS] || FALLBACK_ALL_VOICE_OPTIONS['default'];
  const firstVoice = Object.values(voiceOptions)[0] as string;
  
  return {
    chat_options: FALLBACK_CHAT_OPTIONS,
    chat_form: {
      mode_options: [
        ["audio_only", "Listen first (click eye to read)"],
        ["text_audio", "Listen & read"],
        ["call_mode", "Call mode (Beta)"],
        ["text_only", "Text only"]
      ],
      voice_options: voiceOptions,
      all_voice_options: FALLBACK_ALL_VOICE_OPTIONS,
      ai_model_options: [
        ["V1 (recommended, smartest)", "v1"],
        ["V2 (use if you see errors with V1)", "v2"]
      ],
      transcription_mode_options: [
        ["V1 (recommended)", "v1"],
        ["V2 (backup)", "v2"],
        ["V3 (experimental)", "v3"]
      ],
      transcription_model_options: {
        "v1": {
          "label": "V1 (multilingual)",
          "value": "v1",
          "model": "whisper-1"
        },
        "v2": {
          "label": "V2 (experimental, most accurate)",
          "value": "v2",
          "model": "gemini"
        }
      },
      speed_options: [
        ["Standard", "standard"],
        ["Slow", "slow"],
        ["Fast", "fast"]
      ],
      language: language,
      mode: "text_audio",
      display_selected_options: `You'll be chatting with ${Object.keys(voiceOptions)[0]} in Listen & read mode.`,
      voice: firstVoice,
      selected_vocab: null
    },
    language_warning: false,
    user_prompts: []
  };
};

// Export type for use in other files
export type { ApiResponse };
