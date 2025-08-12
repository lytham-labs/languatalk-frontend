import { API_URL } from '@/constants/api';

export class GuidedModeReplyService {
  constructor(private token: string) {}

  fetch(chatId: number, chatMessageId: string | null | undefined, text: string, language: string, context: string | null | undefined) {
    return fetch(`${API_URL}/api/v1/guided_mode_reply`, {
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
