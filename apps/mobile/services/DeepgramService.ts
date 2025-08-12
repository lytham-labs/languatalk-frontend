import { API_URL } from '@/constants/api';
import { Buffer } from 'buffer';

export class DeepgramService {
  private socket: WebSocket | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectionAttempts = 0;
  private readonly MAX_RECONNECTION_ATTEMPTS = 5;
  private readonly RECONNECTION_DELAY = 2000;
  private isReconnecting = false;
  private isIntentionalDisconnect = false;
  private finalizedText = '';
  private currentPartialText = '';

  constructor(
    private token: string,
    private chatId: string,
    private languageCode: string,
    private onTranscript: (text: string, isFinal: boolean) => void,
    private onConnectionStatus: (status: 'connected' | 'disconnected' | 'error') => void,
    private onError?: (message: string) => void
  ) {}

  async connect() {
    try {
      if (this.socket?.readyState === WebSocket.OPEN) {
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/deepgram_keys`, {
        method: 'POST',
        headers: {
          'Authorization': `${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chat_id: this.chatId })
      });

      const data = await response.json();
      
      const wsUrl = `wss://api.deepgram.com/v1/listen?` + 
        `model=nova-2&` +
        `language=${this.languageCode}&` +
        `interim_results=true&` +
        `smart_format=true&` +
        `endpointing=550&` +
        `utterance_end_ms=1000&` +
        `filler_words=true&` +
        `encoding=linear16&` +
        `sample_rate=16000`;

      this.socket = new WebSocket(wsUrl, [
        'token',
        data.api_key
      ]);

      console.log('WebSocket URL:', wsUrl);
      console.log('Connecting to Deepgram with protocols:', ['token', data.api_key]);

      this.socket.onopen = () => {
        console.log('WebSocket opened');
        this.isReconnecting = false;
        this.onConnectionStatus('connected');
        this.setupKeepAlive();
      };

      this.socket.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        const data = JSON.parse(event.data);
        if (data.type === 'Results') {
          this.processTranscript(data);
        }
      };

      this.socket.onerror = (error) => {
        console.error('Deepgram error:', error);
        this.onError?.('Speech recognition error occurred. Please try again.');
        this.handleError();
      };

      this.socket.onclose = () => {
        this.handleDisconnection();
      };

    } catch (error) {
      console.error('Error connecting to Deepgram:', error);
      this.onError?.('Failed to connect to speech recognition service. Please check your internet connection and try again.');
      this.handleError();
    }
  }

  private extractTranscript(data: any): string | null {
    try {
      const transcript = data.channel.alternatives[0].transcript;
      return transcript ? transcript.trim() : null;
    } catch (error) {
      console.error('Error extracting transcript:', error);
      this.onError?.('Error processing speech recognition results. Please try again.');
      return null;
    }
  }

  private processTranscript(data: any) {
    const content = this.extractTranscript(data);
  
    if (!content) {
      return;
    }
  
    if (data.is_final) {
      // When is_final is true, we have a finalized portion of the transcript
      this.finalizedText = this.combineTexts(this.finalizedText, content);
      this.currentPartialText = '';
    } else {
      // Interim results update the current partial text
      this.currentPartialText = content;
    }
  
    if (data.speech_final) {
      // speech_final indicates the end of an utterance
      // You can process the finalized utterance here
      const utteranceText = this.combineTexts(this.finalizedText, this.currentPartialText);
      this.onTranscript(utteranceText, true);
      // Reset the transcripts for the next utterance
      this.finalizedText = '';
      this.currentPartialText = '';
    } else {
      // Provide interim updates
      const combinedText = this.combineTexts(this.finalizedText, this.currentPartialText);
      this.onTranscript(combinedText, false);
    }
  }

  private combineTexts(...texts: string[]): string {
    return texts.filter(text => text && text.trim().length > 0).join(' ').trim();
  }

  clearTranscript() {
    this.finalizedText = '';
    this.currentPartialText = '';
  }

  private setupKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    this.keepAliveInterval = setInterval(() => {
      this.socket?.send(JSON.stringify({ type: 'KeepAlive' }));
    }, 3000);
  }

  private handleError() {
    console.log('Deepgram error');
    this.onConnectionStatus('error');
    this.handleDisconnection();
  }

  private handleDisconnection() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.isIntentionalDisconnect) {
      return;
    }

    this.isReconnecting = true;
    this.onConnectionStatus('disconnected');
    this.reconnect();
  }

  private async reconnect() {
    if (this.isIntentionalDisconnect || this.reconnectionAttempts >= this.MAX_RECONNECTION_ATTEMPTS) {
      this.isReconnecting = false;
      return;
    }

    this.reconnectionAttempts++;
    console.log(`Attempting to reconnect to Deepgram (Attempt ${this.reconnectionAttempts})`);

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Failed to reconnect to Deepgram:', error);
        this.reconnect();
      });
    }, this.RECONNECTION_DELAY);
  }

  send(audioData: Buffer) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('Sending audio data to Deepgram', audioData);
      this.socket.send(audioData);
    }
  }

  finalize() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('Sending CloseStream message to Deepgram');
      this.socket.send(JSON.stringify({ type: 'CloseStream' }));
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (this.socket) {
      console.log('Disconnecting from Deepgram', this.socket);
      this.socket.close(1000, 'Normal closure');
      this.socket = null;
    }
    this.isReconnecting = false;
  }
} 
