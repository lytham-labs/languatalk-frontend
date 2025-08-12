import { API_URL } from '@/constants/api';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface GeminiTranscriptionOptions {
    audioUri: string;            // local file URI of the recorded audio
    language: string;            // language code for transcription
    dialect?: string;            // optional dialect code
    nativeLanguage?: string;     // optional native language for Gemini transcription
    variant?: 'gemini' | 'gemini-pro'; // choose 'gemini' (default) or 'gemini-pro'
}

export class GeminiTranscriptionService {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    /**
     * Transcribes the given audio using the Gemini transcription service.
     *
     * It reads the file from the audioUri, converts it to a base64 string,
     * and sends a POST request to the streaming endpoint:
     * `${API_URL}/api/v1/stream_speech_to_texts`
     *
     * The response is a text/event-stream. This method reads all the chunks,
     * extracts the JSON from lines prefixed with "data: ", and concatenates the
     * resulting transcribed text.
     *
     * @param options GeminiTranscriptionOptions object
     * @returns The transcribed text as a Promise<string>
     */
    async transcribe(options: GeminiTranscriptionOptions): Promise<string> {
        // Read the audio file as a base64 encoded string.
        const base64Audio = await FileSystem.readAsStringAsync(options.audioUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Extract the file extension from the audio URI instead of hardcoding it.
        const extractFileExtension = (uri: string): string => {
            const match = uri.match(/(\.[0-9a-z]+)(?:[\?#]|$)/i);
            return match ? match[1] : '.m4a';
        };
        const fileExtension = extractFileExtension(options.audioUri);

        // Build the multipart form data.
        const formData = new FormData();
        formData.append('audio', base64Audio);
        formData.append('file_extension', fileExtension);
        formData.append('language', options.language);
        if (options.dialect) {
            formData.append('dialect', options.dialect);
        }
        if (options.nativeLanguage) {
            formData.append('native_language', options.nativeLanguage);
        }
        // Set the model parameter based on the variant.
        // When set to 'gemini', the backend will use model "gemini-1.5-flash-002", 
        // and when set to 'gemini-pro' it will use "gemini-1.5-pro-002".
        const modelParam = options.variant === 'gemini-pro' ? 'gemini-pro' : 'gemini';
        formData.append('model', modelParam);

        try {
            // Note the updated endpoint using the streaming controller.
            const response = await fetch(`${API_URL}/api/v1/stream_speech_to_text`, {
                method: 'POST',
                headers: {
                    'Authorization': `${this.token}`,
                    // multipart/form-data will be set automatically including the correct boundary.
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            if (!response.ok) {
                // Try to read text (or JSON) as error information.
                const errorData = await response.text();
                throw new Error(errorData || 'Speech to text request failed');
            }

            // Check the response type; we expect a text/event-stream
            const contentType = response.headers.get('Content-Type');
            let finalTranscription = '';

            if (contentType && contentType.includes('text/event-stream')) {
                // Read entire response as text.
                const streamText = await response.text();
                // The stream is expected to have events of the form:
                // data: { "text": "..." } followed by two newlines.
                const chunks = streamText.split("\n\n");
                for (let chunk of chunks) {
                    if (chunk.startsWith("data: ")) {
                        const jsonStr = chunk.substring("data: ".length);
                        try {
                            const payload = JSON.parse(jsonStr);
                            if (payload.text) {
                                finalTranscription += payload.text;
                            }
                        } catch (e) {
                            // Ignore parse errors for non-JSON chunks.
                        }
                    }
                }
                if (finalTranscription) {
                    return finalTranscription;
                } else {
                    throw new Error('No text returned from transcription');
                }
            } else {
                // Fallback: if not a streaming response, process as JSON.
                const data = await response.json();
                if (data.text) {
                    return data.text;
                } else {
                    throw new Error('No text returned from transcription');
                }
            }
        } catch (error) {
            throw error;
        }
    }
} 
