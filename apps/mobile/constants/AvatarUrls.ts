interface VoiceDetails {
  name: string;
  voice_id: string;
  gender: string;
  avatar_number?: number | null;
  country?: string;
  dialect?: string;
  speed?: string;
  preview_url?: string;
}

interface VoiceOptions {
  [key: string]: VoiceDetails;
}

interface LanguageVoiceOptions {
  [key: string]: VoiceOptions;
}

// Custom avatar URLs for specific voices
const CUSTOM_AVATAR_IMAGE_URL: { [key: string]: string } = {
  'eden': 'https://cdn.languastream.com/Avatars%2Feden.jpg',
  'natalia': 'https://cdn.languastream.com/Avatars%2Fnatalia.jpg',
  'nataliaslow': 'https://cdn.languastream.com/Avatars%2Fnatalia.jpg',
  'dave': 'https://cdn.languastream.com/Avatars%2Fdave.png',
  'vincent': 'https://cdn.languastream.com/Avatars%2Fvincent.webp',
  'vincentfast': 'https://cdn.languastream.com/Avatars%2Fvincent.webp',
  'miguel': 'https://cdn.languastream.com/Avatars%2Fmiguel.jpg',
  'ana': 'https://cdn.languastream.com/Avatars%2Fana.jpg',
  'anaslow': 'https://cdn.languastream.com/Avatars%2Fana.jpg'
};

// Voice options for each language
const ELEVENLABS_VOICE_OPTIONS: LanguageVoiceOptions = {
  'default': {
    'dorothy': { name: "Maria", voice_id: "ThT5KcBeYPX3keUQqHPh", gender: "female", preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/ThT5KcBeYPX3keUQqHPh/981f0855-6598-48d2-9f8f-b6d92fbbe3fc.mp3" },
    'charlie': { name: "Daniel", voice_id: "IKne3meq5aSn9XLyUdCD", gender: "male", preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/IKne3meq5aSn9XLyUdCD/102de6f2-22ed-43e0-a1f1-111fa75c5481.mp3" },
    'antoni': { name: "Antoni", voice_id: "ErXwobaYiN019PkySvjV", gender: "male", preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/ee9ac367-91ee-4a56-818a-2bd1a9dbe83a.mp3" }
  },
  'arabic': {
    'mustafa': { name: "Mustafa", voice_id: "R6nda3uM038xEEKi7GFl", gender: "male", avatar_number: 56 },
    'sara': { name: "Sara", voice_id: "mRdG9GYEjJmIzqbYTidv", gender: "female", avatar_number: 63 },
    'youssef': { name: "Youssef", voice_id: "IES4nrmZdUBHByLBde0P", gender: "male", avatar_number: 63 },
    'nadine': { name: "Nadine", voice_id: "LjKPkQHpXCsWoy7Pjq4U", gender: "female", avatar_number: 62 },
    'ahmed': { name: "Ahmed", voice_id: "I6FCyzfC1FISEENiALlo", gender: "male", avatar_number: 64 }
  },
  'chinese': {
    'iris': { name: "Iris", voice_id: "ByhETIclHirOlWnWKhHc", gender: "female", avatar_number: 66 },
    'kevin': { name: "Kevin", voice_id: "WuLq5z7nEcrhppO0ZQJw", gender: "male", avatar_number: 70, speed: "slower" },
    'vivian': { name: "Vivian", voice_id: "Ca5bKgudqKJzq8YRFoAz", gender: "female", avatar_number: 65 },
    'lilly': { name: "Lilly", voice_id: "hkfHEbBvdQFNX4uWHqRF", gender: "female", avatar_number: 67 }
  },
  'croatian': {
    'maja': { name: "Maja", voice_id: "0jvpZ98RZwx5FBOSZAc3", gender: "female", avatar_number: 55 },
    'ivan': { name: "Ivan", voice_id: "vFQACl5nAIV0owAavYxE", gender: "male", avatar_number: 55 }
  },
  'czech': {
    'petr': { name: "Petr", voice_id: "KIDKfqJyZ6ASuyzsKfh5", gender: "male", avatar_number: 57 },
    'ivana': { name: "Ivana", voice_id: "12CHcREbuPdJY02VY7zT", gender: "female", avatar_number: 57 }
  },
  'danish': {
    'peter': { name: "Peter", voice_id: "qhEux886xDKbOdF7jkFP", gender: "male", country: "Denmark", avatar_number: 39 },
    'anna': { name: "Anna", voice_id: "Wcc0ONsp9ZnxykU2iPjg", gender: "female", country: "Denmark", avatar_number: 40 },
    'annaslow': { name: "Anna", voice_id: "5edmwRns1m1X9f5zBt4r", gender: "female", country: "Denmark", avatar_number: 40, speed: "slower" }
  },
  'dutch': {
    'ruth': { name: "Ruth", voice_id: "YUdpWWny7k5yb4QCeweX", gender: "female", country: "Netherlands", avatar_number: 5, dialect: "Dutch" },
    'eric': { name: "Eric", voice_id: "AVIlLDn2TVmdaDycgbo3", gender: "male", country: "Netherlands", avatar_number: 6, dialect: "Dutch" },
    'dorothy': { name: "Helen", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", country: "Netherlands", avatar_number: 9, dialect: "Dutch" },
    'christophe': { name: "Christophe", voice_id: "tRyB8BgRzpNUv3o2XWD4", gender: "male", country: "Belgium", avatar_number: 18, dialect: "Flemish" },
    'guillaume': { name: "Guillaume", voice_id: "WN6cA027izfSQ21WEO2W", gender: "male", country: "Belgium", avatar_number: 25, dialect: "Flemish" }
  },
  'english': {
    'lucy': { name: "Lucy", voice_id: "IsrZWf7KGTW3JAsBbScM", gender: "female", country: "UK", avatar_number: 73, dialect: "British English" },
    'john': { name: "John", voice_id: "wqKH7EafSGk0MjGOjE0M", gender: "male", country: "UK", avatar_number: 23, dialect: "British English" },
    'liz': { name: "Liz", voice_id: "pW5OxQoPofPJVlAljTM6", gender: "female", country: "UK", avatar_number: 16, dialect: "British English" },
    'dave': { name: "Dave", voice_id: "UyeOiXcGbU0Ff52Zj36H", gender: "male", country: "USA", avatar_number: null, dialect: "American English" },
    'david': { name: "David", voice_id: "MCBQ0gz5I1J4UYmFNYBe", gender: "male", country: "UK", avatar_number: 19, dialect: "British English" },
    'morgan': { name: "Brian", voice_id: "nPczCjzI2devNBz1zQrb", gender: "male", country: "USA", avatar_number: 56, dialect: "American English" },
    'rebecca': { name: "Rebecca", voice_id: "VuhW5Gk1D48ZTcUJMRdA", gender: "female", country: "USA", avatar_number: 19, dialect: "American English" },
    'joey': { name: "Joey", voice_id: "ryn3WBvkCsp4dPZksMIf", gender: "male", country: "USA", avatar_number: 43, dialect: "American English" },
    'dal': { name: "Dal", voice_id: "DAMTU7qpNR9gEhzXpp2b", gender: "male", country: "British Indian", avatar_number: 15, dialect: "British English" },
    'charlie': { name: "Charlie", voice_id: "IKne3meq5aSn9XLyUdCD", gender: "male", country: "Australia", avatar_number: 18, dialect: "Australian English" }
  },
  'finnish': {
    'maria': { name: "Maria", voice_id: "YSabzCJMvEHDduIDMdwV", gender: "female", avatar_number: 53 },
    'mikael': { name: "Mikael", voice_id: "3OArekHEkHv5XvmZirVD", gender: "male", avatar_number: 39 },
    'emilia': { name: "Emilia", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", avatar_number: 29 }
  },
  'french': {
    'vincentfast': { name: "Vincent", voice_id: "IU6RyuJR4MWUyGZCeJds", gender: "male", country: "France", avatar_number: null, speed: "faster" },
    'gaelle': { name: "Gaelle", voice_id: "5hxqXI8hhODPu3A59tR2", gender: "female", country: "France", avatar_number: 74 },
    'eden': { name: "Eden", voice_id: "yhPi0kw6EVwfQBByAk6u", gender: "female", country: "France", avatar_number: null },
    'vincent': { name: "Vincent", voice_id: "fL7ztW30DlGqwPFkDcOQ", gender: "male", country: "France", avatar_number: null },
    'nicolas': { name: "Nicolas", voice_id: "aQROLel5sQbj1vuIVi6B", gender: "male", country: "France", avatar_number: 4 },
    'helene': { name: "Hélène", voice_id: "imRmmzTqlLHt9Do1HufF", gender: "female", country: "France", avatar_number: 6 },
    'jean': { name: "Jean", voice_id: "E4GQ42zEV1kwul03Bl16", gender: "male", country: "Canada", avatar_number: 8, dialect: "Canadian French" }
  },
  'hindi': {
    'shreya': { name: "Shreya", voice_id: "xoV6iGVuOGYHLWjXhVC7", gender: "female", avatar_number: 42 },
    'raashid': { name: "Raashid", voice_id: "d0grukerEzs069eKIauC", gender: "male", avatar_number: 45 },
    'nikita': { name: "Nikita", voice_id: "H6QPv2pQZDcGqLwDTIJQ", gender: "female", avatar_number: 41 }
  },
  'german': {
    'natalia': { name: "Natalia", voice_id: "Gw4rZJkR4fwo80i4mwtY", gender: "female", country: "Germany", avatar_number: null },
    'nataliaslow': { name: "Natalia", voice_id: "wbAIO6jzxPqh4sejJrDM", gender: "female", country: "Germany", avatar_number: null, speed: "slower" },
    'stefan': { name: "Stefan", voice_id: "iMHt6G42evkXunaDU065", gender: "male", country: "Germany", avatar_number: 34 },
    'julia': { name: "Julia", voice_id: "v3V1d2rk6528UrLKRuy8", gender: "female", country: "Germany", avatar_number: 29 },
    'jakob': { name: "Jakob", voice_id: "FTNCalFNG5bRnkkaP5Ug", gender: "male", country: "Germany", avatar_number: 12, speed: "slower" },
    'lorenz': { name: "Lorenz", voice_id: "MHxgWgZ7ayjcFagtPw59", gender: "male", country: "Austria", avatar_number: 7, dialect: "Austrian German" },
    'leo': { name: "Leo", voice_id: "QtXsTvuI72CiSlfxczvg", gender: "male", country: "Germany", avatar_number: 2, speed: "slower" }
  },
  'greek': {
    'dimitrios': { name: "Dimitrios", voice_id: "czEPjbZ9jNJoQ7WzdyTa", gender: "male", avatar_number: 47 },
    'maria': { name: "Maria", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", avatar_number: 44 }
  },
  'italian': {
    'francesco': { name: "Francesco", voice_id: "HuK8QKF35exsCh2e7fLT", gender: "male", avatar_number: 35 },
    'cristina': { name: "Cristina", voice_id: "gtuah4ubJqUEhR7RHFVS", gender: "female", avatar_number: 1 },
    'fabio': { name: "Fabio", voice_id: "Ha21jUwaMwdgQvqNslSM", gender: "male", avatar_number: 10 },
    'alessandro': { name: "Alessandro", voice_id: "ByVILX2H5wPAwDiNVKAR", gender: "male", avatar_number: 12 },
    'dorothy': { name: "Maria", voice_id: "3DPhHWXDY263XJ1d2EPN", gender: "female", avatar_number: 31 },
    'marco': { name: "Marco", voice_id: "13Cuh3NuYvWOVQtLbRN8", gender: "male", avatar_number: 36 }
  },
  'japanese': {
    'yuki': { name: "Yuki", voice_id: "8EkOjt4xTPGMclNlh1pk", gender: "female", avatar_number: 64 },
    'hiroki': { name: "Hiroki", voice_id: "3JDquces8E8bkmvbh6Bc", gender: "male", avatar_number: 66 },
    'ken': { name: "Ken", voice_id: "hBWDuZMNs32sP5dKzMuc", gender: "male", avatar_number: 67 },
    'kaito': { name: "Kaito", voice_id: "Mv8AjrYZCBkdsmDHNwcB", gender: "male", avatar_number: 68, speed: "faster" },
    'shinji': { name: "Shinji", voice_id: "GKDaBI8TKSBJVhsCLD6n", gender: "male", avatar_number: 69, speed: "faster" }
  },
  'korean': {
    'kim': { name: "Kim", voice_id: "uyVNoMrnUku1dZyVEXwD", gender: "female", avatar_number: 58 },
    'choi': { name: "Choi", voice_id: "ZJCNdZEjYwkOElxugmW2", gender: "male", avatar_number: 62 },
    'kwon': { name: "Kwon", voice_id: "1W00IGEmNmwmsDeYy7ag", gender: "male", avatar_number: 61 }
  },
  'norwegian': {
    'magnus': { name: "Magnus", voice_id: "2dhHLsmg0MVma2t041qT", gender: "male", avatar_number: 48 },
    'linnea': { name: "Linnea", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", avatar_number: 29 }
  },
  'polish': {
    'lena': { name: "Lena", voice_id: "OOTZSkkPGHD1csczSCmT", gender: "female", avatar_number: 46 },
    'damian': { name: "Damian", voice_id: "S1JKkpuAQNsowB8ZvKRO", gender: "male", avatar_number: 48 },
    'renata': { name: "Renata", voice_id: "Pid5DJleNF2sxsuF6YKD", gender: "female", avatar_number: 47 },
    'jakub': { name: "Jakub", voice_id: "zzBTsLBFM6AOJtkr1e9b", gender: "male", avatar_number: 49 }
  },
  'portuguese': {
    'catia': { name: "Catiá", voice_id: "cyD08lEy76q03ER1jZ7y", gender: "female", country: "Brazil", avatar_number: 24, dialect: "Brazilian Portuguese" },
    'charlie': { name: "Gabriel", voice_id: "IKne3meq5aSn9XLyUdCD", gender: "male", country: "Brazil", avatar_number: 26, dialect: "Brazilian Portuguese" },
    'dorothy': { name: "Beatriz", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", country: "Brazil", avatar_number: 26, dialect: "Brazilian Portuguese" },
    'afonso': { name: "Afonso", voice_id: "aLFUti4k8YKvtQGXv0UO", gender: "male", country: "Portugal", avatar_number: 10, dialect: "European Portuguese" },
    'francisco': { name: "Francisco", voice_id: "WgE8iWzGVoJYLb5V7l2d", gender: "male", country: "Portugal", avatar_number: 47, dialect: "European Portuguese" }
  },
  'romanian': {
    'dorothy': { name: "Maria", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", avatar_number: 14 },
    'charlie': { name: "Daniel", voice_id: "IKne3meq5aSn9XLyUdCD", gender: "male", avatar_number: 18 },
    'antoni': { name: "Dorin", voice_id: "JBFqnCBsd6RMkjVDRZzb", gender: "male", avatar_number: 2 }
  },
  'russian': {
    'marat': { name: "Marat", voice_id: "vQxSi2EuaRWwBw3nn6dK", gender: "male", avatar_number: 54 },
    'anya': { name: "Anya", voice_id: "AB9XsbSA4eLG12t2myjN", gender: "female", avatar_number: 53 },
    'nadia': { name: "Nadia", voice_id: "gedzfqL7OGdPbwm0ynTP", gender: "female", avatar_number: 54 }
  },
  'spanish': {
    'maria': { name: "Maria", voice_id: "HYlEvvU9GMan5YdjFYpg", gender: "female", country: "Spain", avatar_number: 6, dialect: "Castilian Spanish" },
    'miguel': { name: "Miguel", voice_id: "ns6l0OHHgIVH9vOvMLbY", gender: "male", country: "Spain", avatar_number: 37, speed: "faster", dialect: "Castilian Spanish" },
    'cristian': { name: "Cristian", voice_id: "1MxuWc12WPRxDkgfT3kj", gender: "male", country: "Spain", avatar_number: 2, dialect: "Castilian Spanish" },
    'daniela': { name: "Daniela", voice_id: "2Lb1en5ujrODDIqmp7F3", gender: "female", country: "Latin America", avatar_number: 30, dialect: "Latin American Spanish" },
    'ana': { name: "Ana", voice_id: "Pjmx8NXtFvZLvpQAT8fu", gender: "female", country: "Mexico", dialect: "Mexican Spanish" },
    'anaslow': { name: "Ana", voice_id: "9CaBBQKWWoiREQ42sIvv", gender: "female", country: "Mexico", speed: "slower", dialect: "Mexican Spanish" },
    'santiago': { name: "Santiago", voice_id: "15bJsujCI3tcDWeoZsQP", gender: "male", country: "Mexico", avatar_number: 10, dialect: "Mexican Spanish" },
    'enrique': { name: "Enrique", voice_id: "gbTn1bmCvNgk0QEAVyfM", gender: "male", country: "Mexico", avatar_number: 9, dialect: "Mexican Spanish" },
    'valeria': { name: "Valeria", voice_id: "9oPKasc15pfAbMr7N6Gs", gender: "female", country: "Argentina", avatar_number: 1, dialect: "Argentinian Spanish" },
    'mateo': { name: "Mateo", voice_id: "D7fO4LMKxU3UYXGDpTnA", gender: "male", country: "Argentina", avatar_number: 30, dialect: "Argentinian Spanish" },
    'nataliaspanish': { name: "Natalia", voice_id: "eBthAb30UYbt2nojGXeA", gender: "female", country: "Colombia", avatar_number: 27, dialect: "Colombian Spanish" },
    'yinet': { name: "Yinet", voice_id: "GPzYRfJNEJniCw2WrKzi", gender: "female", country: "Colombia", avatar_number: 22, dialect: "Colombian Spanish" },
    'diego': { name: "Diego", voice_id: "dF1Qg3iMRirscWEMtEKb", gender: "male", country: "Peru", avatar_number: 32, dialect: "Peruvian Spanish" },
    'facundo': { name: "Facundo", voice_id: "YX5i6O5LlgNrFlUpGn1d", gender: "male", country: "Uruguay", avatar_number: 33, dialect: "Uruguayan Spanish" },
    'fernanda': { name: "Fernanda", voice_id: "JM2A9JbRp8XUJ7bdCXJc", gender: "female", country: "Chile", avatar_number: 28, dialect: "Chilean Spanish" },
    'alexandra': { name: "Alexandra", voice_id: "OjbIu84PfaIzzcURnMf0", gender: "female", country: "Spain", avatar_number: 68, dialect: "Castilian Spanish" },
    'alberto': { name: "Alberto", voice_id: "7robg6fC4CiluA37Yc1u", gender: "male", country: "Spain", avatar_number: 71, dialect: "Castilian Spanish" }
  },
  'swedish': {
    'nils': { name: "Nils", voice_id: "x0u3EW21dbrORJzOq1m9", gender: "male", avatar_number: 4 },
    'sanna': { name: "Sanna", voice_id: "4xkUqaR9MYOJHoaC1Nak", gender: "female", avatar_number: 32 },
    'astrid': { name: "Astrid", voice_id: "pFZP5JQG7iQjIQuC4Bku", gender: "female", avatar_number: 3 },
    'oliver': { name: "Oliver", voice_id: "IKne3meq5aSn9XLyUdCD", gender: "male", avatar_number: 6 }
  },
  'turkish': {
    'hasan': { name: "Hasan", voice_id: "8FtPijgQ3vtXPR9dznTz", gender: "male", avatar_number: 51 },
    'ceren': { name: "Ceren", voice_id: "aEJD8mYP0nuof1XHShVY", gender: "female", avatar_number: 50 },
    'emre': { name: "Emre", voice_id: "GLHtjkeLJ9Rxcv9JhLmh", gender: "male", avatar_number: 50 },
    'isra': { name: "Isra", voice_id: "gyxPK6bLXQAkBSCeAKvk", gender: "female", avatar_number: 51 }
  }
};

// OpenAI voice options
const OPENAI_VOICE_OPTIONS: LanguageVoiceOptions = {
  'arabic': {
    'ash': { name: "Omar", voice_id: "ash", gender: "male", avatar_number: 97 },
    'alloy': { name: "Fatima", voice_id: "alloy", gender: "female", avatar_number: 97 }
  },
  'chinese': {
    'ash': { name: "Ming", voice_id: "ash", gender: "male", avatar_number: 95 },
    'alloy': { name: "Mei", voice_id: "alloy", gender: "female", avatar_number: 95 }
  },
  'croatian': {
    'ash': { name: "Luka", voice_id: "ash", gender: "male", avatar_number: 92 },
    'alloy': { name: "Ana", voice_id: "alloy", gender: "female", avatar_number: 92 }
  },
  'czech': {
    'ash': { name: "Jan", voice_id: "ash", gender: "male", avatar_number: 93 },
    'alloy': { name: "Eva", voice_id: "alloy", gender: "female", avatar_number: 93 }
  },
  'danish': {
    'ash': { name: "William", voice_id: "ash", gender: "male", avatar_number: 86 },
    'alloy': { name: "Ida", voice_id: "alloy", gender: "female", avatar_number: 86 }
  },
  'dutch': {
    'ash': { name: "Daan", voice_id: "ash", gender: "male", country: "Netherlands", avatar_number: 81 },
    'alloy': { name: "Emma", voice_id: "alloy", gender: "female", country: "Netherlands", avatar_number: 81 }
  },
  'english': {
    'ballad': { name: "Adam", voice_id: "ballad", gender: "male", country: "UK", avatar_number: 48, dialect: "British" },
    'ash': { name: "Michael", voice_id: "ash", gender: "male", country: "USA", avatar_number: 79 },
    'alloy': { name: "Olivia", voice_id: "alloy", gender: "female", country: "USA", avatar_number: 79 }
  },
  'finnish': {
    'ash': { name: "Leo", voice_id: "ash", gender: "male", avatar_number: 84 },
    'alloy': { name: "Sofia", voice_id: "alloy", gender: "female", avatar_number: 84 }
  },
  'french': {
    'ash': { name: "Lucas", voice_id: "ash", gender: "male", country: "France", avatar_number: 75 },
    'alloy': { name: "Léa", voice_id: "alloy", gender: "female", country: "France", avatar_number: 75 }
  },
  'greek': {
    'ash': { name: "Georgios", voice_id: "ash", gender: "male", avatar_number: 88 },
    'alloy': { name: "Eleni", voice_id: "alloy", gender: "female", avatar_number: 88 }
  },
  'german': {
    'ash': { name: "Maximilian", voice_id: "ash", gender: "male", country: "Germany", avatar_number: 77 },
    'alloy': { name: "Hannah", voice_id: "alloy", gender: "female", country: "Germany", avatar_number: 77 }
  },
  'hindi': {
    'ash': { name: "Rohan", voice_id: "ash", gender: "male", avatar_number: 87 },
    'alloy': { name: "Priya", voice_id: "alloy", gender: "female", avatar_number: 87 }
  },
  'italian': {
    'ash': { name: "Leonardo", voice_id: "ash", gender: "male", avatar_number: 78 },
    'alloy': { name: "Giulia", voice_id: "alloy", gender: "female", avatar_number: 78 }
  },
  'japanese': {
    'ash': { name: "Haruto", voice_id: "ash", gender: "male", avatar_number: 94 },
    'alloy': { name: "Yui", voice_id: "alloy", gender: "female", avatar_number: 94 }
  },
  'korean': {
    'ash': { name: "Minjun", voice_id: "ash", gender: "male", avatar_number: 96 },
    'alloy': { name: "Jiwoo", voice_id: "alloy", gender: "female", avatar_number: 96 }
  },
  'norwegian': {
    'ash': { name: "Jakob", voice_id: "ash", gender: "male", avatar_number: 85 },
    'alloy': { name: "Nora", voice_id: "alloy", gender: "female", avatar_number: 85 }
  },
  'polish': {
    'ash': { name: "Piotr", voice_id: "ash", gender: "male", avatar_number: 89 },
    'alloy': { name: "Zofia", voice_id: "alloy", gender: "female", avatar_number: 89 }
  },
  'portuguese': {
    'ash': { name: "Lucas", voice_id: "ash", gender: "male", country: "Brazil", avatar_number: 82 },
    'alloy': { name: "Julia", voice_id: "alloy", gender: "female", country: "Brazil", avatar_number: 82 }
  },
  'romanian': {
    'ash': { name: "Andrei", voice_id: "ash", gender: "male", avatar_number: 83 },
    'alloy': { name: "Elena", voice_id: "alloy", gender: "female", avatar_number: 83 }
  },
  'russian': {
    'ash': { name: "Ivan", voice_id: "ash", gender: "male", avatar_number: 91 },
    'alloy': { name: "Anastasia", voice_id: "alloy", gender: "female", avatar_number: 91 }
  },
  'spanish': {
    'ash': { name: "Carlos", voice_id: "ash", gender: "male", country: "Spain", avatar_number: 76, dialect: "Latin American" },
    'alloy': { name: "Sofia", voice_id: "alloy", gender: "female", country: "Spain", avatar_number: 76, dialect: "Latin American" }
  },
  'swedish': {
    'ash': { name: "William", voice_id: "ash", gender: "male", avatar_number: 80 },
    'alloy': { name: "Alice", voice_id: "alloy", gender: "female", avatar_number: 80 }
  },
  'turkish': {
    'ash': { name: "Mehmet", voice_id: "ash", gender: "male", avatar_number: 90 },
    'alloy': { name: "Zeynep", voice_id: "alloy", gender: "female", avatar_number: 90 }
  }
};

// Gemini voice options
const GEMINI_VOICE_OPTIONS: VoiceOptions = {
  'puck': { name: "Puck", voice_id: "Puck", gender: "male" },
  'charon': { name: "Charon", voice_id: "Charon", gender: "male" },
  'kore': { name: "Kore", voice_id: "Kore", gender: "female" },
  'fenrir': { name: "Fenrir", voice_id: "Fenrir", gender: "male" },
  'aoede': { name: "Aoede", voice_id: "Aoede", gender: "female" }
};

/**
 * Get the display name for a given language and voice name
 */
export const getDisplayName = (language: string, voiceName: string): string | null => {
  const lang = language?.toLowerCase() || "default";
  const voice = voiceName?.toLowerCase();
  
  if (!voice || !ELEVENLABS_VOICE_OPTIONS[lang]?.[voice]) {
    return null;
  }
  
  return ELEVENLABS_VOICE_OPTIONS[lang][voice].name;
};

/**
 * Get the voice_id for a given language and voice name
 */
export const getVoiceId = (language: string, voiceName: string): string | null => {
  const lang = language?.toLowerCase() || "default";
  const voice = voiceName?.toLowerCase();
  
  if (!voice || !ELEVENLABS_VOICE_OPTIONS[lang]?.[voice]) {
    return null;
  }
  
  return ELEVENLABS_VOICE_OPTIONS[lang][voice].voice_id;
};

/**
 * Get the avatar URL for a given language and voice name
 */
export const getAvatarUrl = (language: string, voiceName: string, provider: string = 'elevenlabs'): string => {
  const lang = language?.toLowerCase() || "default";
  const voice = voiceName?.toLowerCase();
  
  // Check for custom avatar first
  if (voice && CUSTOM_AVATAR_IMAGE_URL[voice]) {
    return CUSTOM_AVATAR_IMAGE_URL[voice];
  }

  // Handle different providers
  switch (provider.toLowerCase()) {
    case 'openai':
      if (voice && OPENAI_VOICE_OPTIONS[lang]?.[voice]) {
        const voiceDetails = OPENAI_VOICE_OPTIONS[lang][voice];
        const gender = voiceDetails.gender.toLowerCase() === "female" ? 'f' : 'm';
        return `https://cdn.languastream.com/Avatars/${gender}${voiceDetails.avatar_number}.jpg`;
      }
      break;

    case 'gemini':
      if (voice && GEMINI_VOICE_OPTIONS[voice]) {
        const voiceDetails = GEMINI_VOICE_OPTIONS[voice];
        const gender = voiceDetails.gender.toLowerCase() === "female" ? 'f' : 'm';
        const avatarNumber = Math.floor(Math.random() * 27);
        return `https://cdn.languastream.com/Avatars/${gender}${avatarNumber}.jpg`;
      }
      break;

    case 'elevenlabs':
    default:
      // If language not found, fall back to default
      const voiceOptions = ELEVENLABS_VOICE_OPTIONS[lang] || ELEVENLABS_VOICE_OPTIONS['default'];
      
      // If voice name not found in the language, use random avatar
      if (!voice || !voiceOptions[voice]) {
        const gender = Math.random() < 0.5 ? 'm' : 'f';
        const avatarNumber = Math.floor(Math.random() * 27);
        return `https://cdn.languastream.com/Avatars/${gender}${avatarNumber}.jpg`;
      }
      
      // Get voice details
      const voiceDetails = voiceOptions[voice];
      
      // If avatar_number is specified, use it with the appropriate gender
      if (voiceDetails.avatar_number !== undefined) {
        const gender = voiceDetails.gender.toLowerCase() === "female" ? 'f' : 'm';
        return `https://cdn.languastream.com/Avatars/${gender}${voiceDetails.avatar_number}.jpg`;
      }
      
      // Fallback to random avatar with the correct gender if known
      if (voiceDetails.gender) {
        const gender = voiceDetails.gender.toLowerCase() === "female" ? 'f' : 'm';
        const avatarNumber = Math.floor(Math.random() * 27);
        return `https://cdn.languastream.com/Avatars/${gender}${avatarNumber}.jpg`;
      }
      break;
  }
  
  // Complete fallback - random gender and number
  const gender = Math.random() < 0.5 ? 'm' : 'f';
  const avatarNumber = Math.floor(Math.random() * 27);
  return `https://cdn.languastream.com/Avatars/${gender}${avatarNumber}.jpg`;
}; 
