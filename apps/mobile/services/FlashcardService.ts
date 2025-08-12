import { FilterOptions } from '@/components/cards/FilterModal';
import { API_URL } from '@/constants/api';

export interface FlashcardData {
  front: string;
  back: string;
  language: string;
  context_sentence?: string;
  translated_sentence?: string;
  flashcardable_id?: string;
  flashcardable_type?: string;
  flashcard_type?: string;
  tags?: string[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  language: string;
  context_sentence?: string;
  tags: string[];
  flashcard_type: string;
  easiness_factor?: number;
  interval?: number;
  repetitions?: number;
  last_viewed_at?: string;
  due_on?: string;
  last_response?: number;
  created_at: string;
  updated_at: string;
  word_info?: WordInfo | null;
}

export interface FlashcardStats {
  learned_count: number;
  almost_learned_count: number;
  saved_count: number;
}

export interface FlashcardFilters {
  query?: string;
}

export interface FlashcardsResponse {
  flashcards: Flashcard[];
  metadata: {
    learned_count: number;
    almost_learned_count: number;
    saved_count: number;
  };
}

export interface FlashcardResponse {
  id: string;
  quality: 1 | 3 | 5; // 1 = Didn't know, 3 = Guessed correctly, 5 = Knew it
  practice_mode: 'recall' | 'listen' | 'produce';
}

interface WordInfo {
  article?: string;
  explain: string;
  gender?: string;
  human_readable: string;
  lemma: string;
  morph: string;
  pos: string;
  processed_token: string;
  tag: string;
  text: string;
  token_text: string;
}

export interface RecallResponse {
  flashcard: Flashcard | null;
  common_word?: any;
  remaining_count: number;
  message?: string;
  cloze?: {
    clozeSentence: string;
    fullSentence: string;
    translation: string;
  };
}

export interface NoCardsResponse {
  flashcard: null;
  message: string;
  remaining_count: 0;
}

interface BatchFlashcardData {
  front: string;
  back: string;
  tags?: string[];
}

interface BatchCreateParams {
  flashcards: BatchFlashcardData[];
  language: string;
  flashcard_type: string;
  batch_interval_offset?: number;
}

export interface RecallParams {
  language?: string;
  practice_mode?: string;
  reset_not_known?: boolean;
  filters?: FilterOptions;
  isCloze?: boolean;
}

export interface ResetProgressResponse {
  message: string;
  reset_count: number;
  flashcard: Flashcard | null;
  remaining_count: number;
}

interface UsageExamplesResponse {
  word: string;
  language: string;
  result: {
    examples: Array<{
      source: string;
      translation: string;
    }>;
  };
}

interface FlashcardHintResponse {
  hint: {
    source: string;
    translation: string;
  };
}

interface PhraseExamplesResponse {
  result: {
    phrases: Array<{
      source: string;
      translation: string;
    }>;
  };
}

interface SimilarWordsResponse {
  result: {
    similar_words: Array<{
      source: string;
      translation: string;
    }>;
  };
}

export interface AllMeaningsResponse {
  translations: Array<{
    source: string;
    translation: string;
  }>;
}

export interface GeneratedWord {
  word: string;
  translation: string;
}

export interface GenerateWordsResponse {
  words: GeneratedWord[];
  cache_key: string;
}

export interface GeneratedFlashcard {
  word: string;
  translation: string;
  context_sentence?: string;
  context_translation?: string;
}

export interface GenerateFlashcardsResponse {
  generated_words: GeneratedFlashcard[];
}

export type WordType = 'recently_saved' | 'almost_learned' | 'next_due_for_review';

export const FLASHCARD_STATUS = {
  NOT_PRACTICED: 0,
  DIFFICULT: 1,
  ALMOST_LEARNED: 3,
  LEARNED: 5
} as const;

class FlashcardService {
  private token: string;

  constructor(token: string) {
    if (!token) {
      console.error('Warning: FlashcardService initialized with empty token');
    }
    // Ensure token is properly formatted
    this.token = token || '';
  }

  async getFlashcards(filters: FlashcardFilters = {}): Promise<FlashcardsResponse> {
    try {
      const params = new URLSearchParams();

      if (filters.query) {
        params.append('query', filters.query);
      }

      const response = await fetch(`${API_URL}/api/v1/flashcards?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch flashcards');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      throw error;
    }
  }

  async getFlashcardStats(): Promise<FlashcardStats> {
    try {
      const flashcards = await this.getFlashcards();

      const stats = {
        learned_count: flashcards.flashcards.filter(f => f.last_response && f.last_response >= 4).length,
        almost_learned_count: flashcards.flashcards.filter(f => f.last_response && f.last_response >= 2 && f.last_response < 4).length,
        saved_count: flashcards.flashcards.length
      };

      return stats;
    } catch (error) {
      console.error('Error fetching flashcard stats:', error);
      throw error;
    }
  }

  async processResponse(id: string, quality: 1 | 3 | 5): Promise<void> {
    try {
      const params = new URLSearchParams({
        id: id,
        quality: quality.toString(),
        practice_mode: 'recall'
      });

      const result = await fetch(`${API_URL}/api/v1/flashcards/process_response?${params}`, {
        method: 'GET',  // Changed from POST to GET
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!result.ok) {
        throw new Error('Failed to process flashcard response');
      }
    } catch (error) {
      console.error('Error processing flashcard response:', error);
      throw error;
    }
  }

  async deleteFlashcard(id: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/v1/flashcards/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      throw error;
    }
  }

  async addFlashcard(flashcardData: FlashcardData, flashcardType?: string): Promise<Flashcard> {
    try {
      const dataToSend = {
        ...flashcardData,
        flashcard_type: flashcardType || 'word'
      };

      // Check if token already has Bearer prefix
      const authToken = this.token.startsWith('Bearer ') ? this.token : `Bearer ${this.token}`;

      const response = await fetch(`${API_URL}/api/v1/flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({ flashcard: dataToSend })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error response:', errorData);

        // Check for duplicate key violation
        if (response.status === 422 || response.status === 500) {
          const errorString = JSON.stringify(errorData);
          if (errorString.includes('unique constraint') ||
            errorString.includes('already exists') ||
            errorString.includes('duplicate key')) {
            throw new Error(`Flashcard with front "${dataToSend.front}" already exists`);
          }
        }

        throw new Error(errorData.error || 'Failed to add flashcard');
      }

      return response.json();
    } catch (error) {
      console.error('Error adding flashcard:', error);
      throw error;
    }
  }

  async getNextRecallCard(params: RecallParams): Promise<RecallResponse> {
    try {
      console.log('FlashcardService - Received params:', params);
      const queryParams = new URLSearchParams();

      // Add base params
      if (params.language) queryParams.append('language', params.language);
      if (params.practice_mode) queryParams.append('practice_mode', params.practice_mode);
      if (params.reset_not_known) queryParams.append('reset_not_known', 'true');
      if (params.isCloze) queryParams.append('is_cloze', 'true');

      // Handle filters
      if (params.filters) {
        console.log('FlashcardService - Processing filters:', params.filters);

        // Handle status filters - take only first status
        if (params.filters.status && params.filters.status.length > 0) {
          const statusMap: { [key: string]: number } = {
            'not_practiced': FLASHCARD_STATUS.NOT_PRACTICED,
            'difficult': FLASHCARD_STATUS.DIFFICULT,
            'almost_learned': FLASHCARD_STATUS.ALMOST_LEARNED,
            'learned': FLASHCARD_STATUS.LEARNED
          };

          const status = params.filters.status[0];
          if (statusMap[status] !== undefined) {
            console.log('FlashcardService - Adding status:', status, statusMap[status]);
            queryParams.append('filters[last_response]', statusMap[status].toString());
          }
        }

        // Handle month filters - take only first month
        if (params.filters.months && params.filters.months.length > 0) {
          const monthYear = params.filters.months[0];
          const [month, year] = monthYear.split('-');
          console.log('FlashcardService - Adding month:', `${month} ${year}`);
          queryParams.append('filters[month]', `${month} ${year}`);
        }

        if (params.filters.tags && params.filters.tags.length > 0) {
          params.filters.tags.forEach(tag => {
            queryParams.append('filters[tag][]', tag);
          });
        }
      }

      const finalUrl = `${API_URL}/api/v1/flashcards/recall_next?${queryParams}`;
      console.log('FlashcardService - Final URL:', finalUrl);

      const response = await fetch(finalUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error('Failed to fetch next recall card');
      }

      const data = await response.json();
      console.log('FlashcardService - Response data:', data);

      if (!data.flashcard) {
        return {
          flashcard: null,
          remaining_count: 0,
          message: data.message || "No more flashcards available for review today",
        };
      }

      if (data.word_info) {
        data.flashcard.word_info = data.word_info;
      }

      return {
        flashcard: data.flashcard,
        common_word: data.common_word,
        remaining_count: data.remaining_count,
        cloze: data.cloze,
      };
    } catch (error) {
      console.error('Error getting next recall card:', error);
      throw error;
    }
  }

  async resetProgress(language?: string): Promise<ResetProgressResponse> {
    try {
      const response = await fetch(`${API_URL}/api/v1/flashcards/reset_progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          flashcard: { language }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reset flashcard progress');
      }

      const data = await response.json();
      return {
        message: data.message,
        reset_count: data.reset_count,
        flashcard: data.flashcard,
        remaining_count: data.remaining_count
      };
    } catch (error) {
      console.error('Error resetting flashcard progress:', error);
      throw error;
    }
  }

  async batchCreateFlashcards(params: BatchCreateParams): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/v1/flashcards/batch_create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error('Failed to batch create flashcards');
      }

      return response.json();
    } catch (error) {
      console.error('Error batch creating flashcards:', error);
      throw error;
    }
  }

  async getUsageExamples(
    word: string,
    language: string,
    translatedWord: string
  ): Promise<UsageExamplesResponse['result']> {
    try {
      const response = await fetch(`${API_URL}/api/v1/usage_examples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          word,
          language,
          prompt: 'flashcard',
          translated_word: translatedWord,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch usage examples');
      }

      const data: UsageExamplesResponse = await response.json();
      return data.result;
    } catch (error) {
      console.error('Error fetching usage examples:', error);
      throw error;
    }
  }

  async getFlashcardHint(
    word: string,
    language: string,
    translatedWord: string,
    toLanguage: string = 'english'
  ): Promise<FlashcardHintResponse['hint']> {
    try {
      const response = await fetch(`${API_URL}/api/v1/flashcard_hints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          word,
          language,
          usage_type: 'flashcard',
          translated_word: translatedWord,
          to_language: toLanguage,
        }),
      });
      console.log('response', response);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch flashcard hint');
      }

      const data: FlashcardHintResponse = await response.json();
      console.log('data', data.hint);
      return data.hint;
    } catch (error) {
      console.error('Error fetching flashcard hint:', error);
      throw error;
    }
  }

  async getFlashcardDefinition(
    word: string,
    language: string
    ): Promise<{ source: string; translation: string }> {
    try {
      const response = await fetch(`${API_URL}/api/v1/definitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          word,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch definition');
      }

      const data = await response.json();
      return {
        source: word,
        translation: data.definition
      };
    } catch (error) {
      console.error('Error fetching definition:', error);
      throw error;
    }
  }

  async getPhraseExamples(
    word: string,
    language: string
  ): Promise<PhraseExamplesResponse['result']> {
    try {
      const response = await fetch(`${API_URL}/api/v1/phrase_examples`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          word,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch phrase examples');
      }

      const data: PhraseExamplesResponse = await response.json();
      console.log('data', data.result);
      return data.result;
    } catch (error) {
      console.error('Error fetching phrase examples:', error);
      throw error;
    }
  }

  async getSimilarWords(
    word: string,
    language: string
  ): Promise<SimilarWordsResponse['result']> {
    try {
      const cleanedWord = word.trim().toLowerCase();

      const response = await fetch(`${API_URL}/api/v1/similar_words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          word: cleanedWord,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch similar words');
      }

      const data: SimilarWordsResponse = await response.json();
      console.log('data', data.result);
      return data.result;

    } catch (error) {
      console.error('Error fetching similar words:', error);
      throw error;
    }
  }

  async getAllMeanings(
    word: string,
    language: string,
    targetLanguage: string
  ): Promise<AllMeaningsResponse> {
    try {
      const response = await fetch('https://translation-worker.lythamlabs.workers.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: word,
          language: language,
          target_language: targetLanguage,
          translation_type: 'multiple'
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      return data.translations;
    } catch (error) {
      console.error('Error fetching multiple translations:', error);
      throw error;
    }
  };

  async addSelectedWords(
    words: string[],
    cacheKey: string,
    language: string,
    topic?: string
  ): Promise<void> {
    try {
      // Check if token already has Bearer prefix
      const authToken = this.token.startsWith('Bearer ') ? this.token : `Bearer ${this.token}`;

      const response = await fetch(`${API_URL}/api/v1/vocabulary/add_selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          words,
          cache_key: cacheKey,
          language,
          topic
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error response:', errorData);
        throw new Error(errorData.error || 'Failed to add selected words');
      }
    } catch (error) {
      console.error('Error adding selected words:', error);
      throw error;
    }
  }

  async deleteVocabulary(word: string, language: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/v1/vocabulary`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          word,
          language
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete vocabulary');
      }
    } catch (error) {
      console.error('Error deleting vocabulary:', error);
      throw error;
    }
  }

  async bulkDeleteVocabulary(words: string[], language: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/v1/vocabulary/bulk_delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          words,
          language
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete vocabularies');
      }
    } catch (error) {
      console.error('Error deleting vocabularies:', error);
      throw error;
    }
  }

  async updateTags(flashcardIds: string[], tags: string[]): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/v1/vocabulary/update_tags`, {
        method: 'PUT',  // Changed to PUT
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          flashcard_ids: flashcardIds,  // Changed to match backend parameter
          tags: tags.join(',')  // Join tags into comma-separated string
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update tags');
      }
    } catch (error) {
      console.error('Error updating tags:', error);
      throw error;
    }
  }

  async updateFlashcard(id: string, data: {
    front?: string;
    back?: string;
    tags?: string[];
  }): Promise<Flashcard> {
    try {
      const response = await fetch(`${API_URL}/api/v1/flashcards/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ flashcard: data })
      });

      if (!response.ok) {
        throw new Error('Failed to update flashcard');
      }

      return response.json();
    } catch (error) {
      console.error('Error updating flashcard:', error);
      throw error;
    }
  }

  async generateWords(topic: string, wordCount: number = 30): Promise<GenerateFlashcardsResponse> {
    try {
      const response = await fetch(`${API_URL}/api/v1/generate_flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          word_count: Math.min(Math.max(20, wordCount), 40), // Ensure count is between 20-40
          topic
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate words');
      }

      return response.json();
    } catch (error) {
      console.error('Error generating words:', error);
      throw error;
    }
  }

  async generateSentences(wordType: WordType, sentenceCount: number = 15): Promise<GenerateFlashcardsResponse> {
    try {
      const response = await fetch(`${API_URL}/api/v1/generate_flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          sentence_count: Math.min(Math.max(10, sentenceCount), 20), // Ensure count is between 10-20
          word_type: wordType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate sentences');
      }

      return response.json();
    } catch (error) {
      console.error('Error generating sentences:', error);
      throw error;
    }
  }

  async getAudioStream(text: string, language: string): Promise<Blob> {
    try {
      const response = await fetch(`${API_URL}/api/v1/stream_text_to_speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ text, language })
      });
      if (!response.ok) {
        throw new Error('Failed to fetch audio stream');
      }
      return await response.blob();
    } catch (error) {
      console.error('Error fetching audio stream:', error);
      throw error;
    }
  }

  /**
   * Helper method to handle response errors consistently
   * @param response Fetch response object
   * @param defaultMessage Default error message if none can be extracted
   * @returns Promise that resolves to the error message
   */
  private async handleResponseError(response: Response, defaultMessage: string = 'An error occurred'): Promise<string> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        return errorData.error || errorData.message || defaultMessage;
      }
      const text = await response.text();
      return text || defaultMessage;
    } catch (error) {
      console.error('Error parsing error response:', error);
      return defaultMessage;
    }
  }
}

export default FlashcardService;
