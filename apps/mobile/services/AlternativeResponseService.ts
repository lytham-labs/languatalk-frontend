import { API_URL } from '@/constants/api';

export class AlternativeResponseService {
  constructor(private token: string) {}

  fetch(chatId: number, chatMessageId: string, text: string, language: string, context: string | null, clientProvider: string, model: string) {
    return fetch(`${API_URL}/api/v1/alternative_response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ chat_id: chatId, chat_message_id: chatMessageId, text, language, context, client_provider: clientProvider, model })
    })
    .then(response => response.json())
  }
}
