import { API_URL } from '@/constants/api';

export class CorrectionExplanationService {
  constructor(private token: string) {}

  fetchExplanation(chatId: number, chatMessageId: string, correctionText: string, messageText: string, responseText: string, language: string, clientProvider: string, model: string) {
    return fetch(`${API_URL}/api/v1/correction_explanation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        chat_id: chatId,
        chat_message_id: chatMessageId,
        correction_text: correctionText,
        message_text: messageText,
        response_text: responseText,
        language,
        client_provider: clientProvider,
        model
      })
    })
    .then(response => response.json())
  }
}
