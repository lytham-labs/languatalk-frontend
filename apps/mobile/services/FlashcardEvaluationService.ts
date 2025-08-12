import { API_URL } from '@/constants/api';
import { useWebSocket } from '@/contexts/ActionCableWebSocketContext';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface EvaluationResult {
    verdict: 'correct' | 'incorrect' | 'borderline';
    explanation: string;
    raw_response: string;
    fuzzy_score?: number;
    matched_by?: 'fuzzy_match' | 'llm';
}

interface ApiResponse {
    result?: EvaluationResult;
    evaluation_id?: string;
    job_id?: string;
    message?: string;
    fuzzy_score?: number;
}

interface EvaluationUpdate {
    status: 'processing' | 'completed' | 'error';
    message?: string;
    result?: EvaluationResult;
}

export class FlashcardEvaluationService {
    private token: string;
    private activeEvaluations: Map<string, { cleanup: () => void }> = new Map();
    
    constructor(token: string) {
        this.token = token;
    }

    private generateEvaluationId(): string {
        return uuidv4();
    }

    async evaluateAnswer(
        expectedAnswer: string, 
        userGuess: string, 
        isAudio: boolean = false,
        webSocket: ReturnType<typeof useWebSocket>
    ): Promise<EvaluationResult> {
        try {
            // Generate an evaluation ID first
            const evaluationId = this.generateEvaluationId();

            // Try fuzzy match first via REST API
            const response = await fetch(`${API_URL}/api/v1/flashcard_evaluations`, {
                method: 'POST',
                headers: {
                    'Authorization': this.token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    evaluation_id: evaluationId,
                    expected_answer: expectedAnswer,
                    user_guess: userGuess,
                    is_audio: isAudio,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to evaluate answer');
            }

            const data: ApiResponse = await response.json();
            
            // If we got a direct result (fuzzy match succeeded), return it immediately
            if (data.result) {
                console.log('Fuzzy match succeeded:', data.result);
                return data.result;
            }

            // If no immediate result, we need to wait for LLM evaluation via WebSocket
            if (!data.evaluation_id) {
                // Use our generated ID if not provided by server
                data.evaluation_id = evaluationId;
            }

            console.log('Fuzzy match failed, waiting for LLM evaluation:', {
                evaluationId: data.evaluation_id,
                jobId: data.job_id,
                fuzzyScore: data.fuzzy_score
            });

            // Convert evaluation ID to a number for the channel ID
            const channelId = parseInt(data.evaluation_id.replace(/-/g, '').slice(0, 10), 36);
            
            // Return a promise that resolves when the WebSocket delivers the LLM result
            return new Promise<EvaluationResult>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    this.cleanupEvaluation(data.evaluation_id!, webSocket, channelId);
                    reject(new Error('LLM evaluation timed out'));
                }, 30000);

                const handleMessage = (event: MessageEvent) => {
                    // Parse the data properly
                    const rawData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                    console.log('Received WebSocket message:', rawData);
                    
                    // Extract the actual evaluation data
                    const update = rawData.data || rawData;
                    
                    if (update.status === 'completed' && update.result) {
                        console.log('LLM evaluation completed:', update.result);
                        this.cleanupEvaluation(data.evaluation_id!, webSocket, channelId);
                        resolve(update.result);
                    } else if (update.status === 'error') {
                        console.error('LLM evaluation failed:', update.message);
                        this.cleanupEvaluation(data.evaluation_id!, webSocket, channelId);
                        reject(new Error(update.message || 'LLM evaluation failed'));
                    } else if (update.status === 'processing') {
                        console.log('LLM evaluation progress:', update.message);
                    }
                };
                
                // Store cleanup function
                this.activeEvaluations.set(data.evaluation_id!, {
                    cleanup: () => {
                        clearTimeout(timeoutId);
                        webSocket.removeMessageListener(channelId, handleMessage);
                        webSocket.closeWebSocket(channelId, 'FlashcardEvaluationChannel');
                    }
                });

                // Connect to WebSocket and listen for messages
                webSocket.connectWebSocket(channelId, {
                    name: 'FlashcardEvaluationChannel',
                    params: { evaluation_id: data.evaluation_id }
                });
                
                webSocket.onMessage(channelId, handleMessage);

                // Wait for connection to establish
                webSocket.waitForConnection(channelId).then(connected => {
                    if (!connected) {
                        this.cleanupEvaluation(data.evaluation_id!, webSocket, channelId);
                        reject(new Error('Failed to establish WebSocket connection'));
                    }
                });
            });
        } catch (error) {
            console.error('Error evaluating answer:', error);
            throw error;
        }
    }

    private cleanupEvaluation(evaluationId: string, webSocket: ReturnType<typeof useWebSocket>, channelId: number) {
        const evaluation = this.activeEvaluations.get(evaluationId);
        if (evaluation) {
            evaluation.cleanup();
            this.activeEvaluations.delete(evaluationId);
        }
    }

    cleanup() {
        this.activeEvaluations.forEach(evaluation => {
            evaluation.cleanup();
        });
        this.activeEvaluations.clear();
    }
}
