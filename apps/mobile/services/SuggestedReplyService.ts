import { API_URL } from '@/constants/api';

export class SuggestedReplyService {
  constructor(private token: string) {}

  fetch(chatId: number, chatMessageId: string | undefined, text: string, language: string, context: string | undefined) {
    return fetch(`${API_URL}/api/v1/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${this.token}`,
      },
      body: JSON.stringify({
        chat_id: chatId, 
        chat_message_id: chatMessageId, 
        text, 
        language, 
        context,
      }),
    })
    .then(response => response.json());
  }
}
