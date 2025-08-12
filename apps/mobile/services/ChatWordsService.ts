import { API_URL } from '@/constants/api';

/**
 * Service for managing saved and translated words in chat
 */
export class ChatWordsService {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    /**
     * Add a word-translation pair to saved chats
     */
    async addToSavedChats(chatId: number, word: string, translation: string) {
        try {
            console.log(`Adding to saved chats: ${word} - ${translation}`);

            const response = await fetch(`${API_URL}/api/v1/chats/${chatId}/update_saved_vocabulary`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({
                    saved_vocabulary: [
                        {
                            word: word,
                            translation: translation
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error('Failed to update saved chats');
            }

            const data = await response.json();
            console.log('Saved chats response:', data);
            return data;
        } catch (error) {
            console.error('Error updating saved chats:', error);
            throw error;
        }
    }

    /**
     * Add a word-translation pair to translated chats
     */
    async addToTranslatedChats(chatId: number, word: string, translation: string) {
        try {
            console.log(`Adding to translated chats: ${word} - ${translation}`);

            const response = await fetch(`${API_URL}/api/v1/chats/${chatId}/update_translated_vocabulary`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify({
                    translated_vocabulary: [
                        {
                            word: word,
                            translation: translation
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error('Failed to update translated chats');
            }

            const data = await response.json();
            console.log('Translated chats response:', data);
            return data;
        } catch (error) {
            console.error('Error updating translated chats:', error);
            throw error;
        }
    }
} 
