import { API_URL } from '@/constants/api';

export class TextCorrectionService {
  constructor(private token: string) {}

  fetchCorrection(chatId: string, chatMessageId: string, text: string, language: string, context: string | null, clientProvider: string, model: string, debug: boolean = false) {
    return fetch(`${API_URL}/api/v1/text_correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        chat_id: chatId,
        chat_message_id: chatMessageId,
        text,
        language,
        context,
        client_provider: clientProvider,
        model,
        debug
      })
    })
    .then(response => response.json())
  }
}
