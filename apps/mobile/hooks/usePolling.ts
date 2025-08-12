import { useState, useRef, useCallback, useEffect } from 'react';
import { API_URL } from '@/constants/api';
import { ChatData, Message } from '@/types/chat';
import { useChatData } from '@/contexts/ChatDataContext';

interface UsePollingProps {
    token: string | null | undefined;
    handlePlayAudio: (audioUrl: string, wordTimings: any, chatMessageId: string, text: string) => void;
    usePollingSystem: boolean;
    setIsWaitingForResponse: (waiting: boolean) => void;
    setIsRefreshing: (refreshing: boolean) => void;
}

export const usePolling = ({
    token,
    handlePlayAudio,
    usePollingSystem,
    setIsWaitingForResponse,
    setIsRefreshing
}: UsePollingProps) => {
    // State management
    const { state: chatState, dispatch: chatDataDispatch, addMessage } = useChatData();
    const [showResponseTimeout, setShowResponseTimeout] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [pendingMessageIds, setPendingMessageIds] = useState<Set<string>>(new Set());

    // Refs
    const responseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastPollTimeRef = useRef<number | null>(null);
    const pendingMessageIdsRef = useRef<Set<string>>(new Set());
    const isRefreshingRef = useRef(false);
    const pollingAfterRefreshRef = useRef(false);

    // Constants
    const MAX_POLLING_DURATION = 20000;
    const POLLING_INTERVAL = 2000;
    const POLLING_INTERVAL_AFTER_REFRESH = 1000;

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
        setIsPolling(false);
    }, []);

    const fetchLatestChatData = useCallback(async (): Promise<ChatData | null> => {
        if (!chatState?.chat.id || !token) return null;

        try {
            console.log('[REFRESH] Fetching latest chat data...');
            const response = await fetch(`${API_URL}/api/v1/chats/${chatState.chat.id}`, {
                headers: {
                    'Authorization': `${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch chat data');
            }

            const data: ChatData = await response.json();
            console.log('[REFRESH] Successfully fetched latest chat data');
            return data;
        } catch (error) {
            console.error('[REFRESH] Error fetching chat data:', error);
            return null;
        }
    }, [chatState?.chat.id, token]);

    const startPolling = useCallback(() => {
        if (isPolling || !usePollingSystem) return;

        setIsPolling(true);
        lastPollTimeRef.current = Date.now();

        const interval = pollingAfterRefreshRef.current
            ? POLLING_INTERVAL_AFTER_REFRESH
            : POLLING_INTERVAL;

        pollingIntervalRef.current = setInterval(async () => {
            if (!chatState?.chat.id) {
                stopPolling();
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/v1/chats/${chatState.chat.id}`, {
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                const data: ChatData = await response.json();
                const newMessages = data.messages.filter(newMsg =>
                    !chatState?.messages?.some(existingMsg =>
                        existingMsg.chat_message_id === newMsg.chat_message_id
                    ) && !pendingMessageIdsRef.current.has(newMsg.chat_message_id)
                );

                if (newMessages.length > 0 && newMessages[0].audio_url) {
                    pendingMessageIdsRef.current.add(newMessages[0].chat_message_id);
                    setPendingMessageIds(new Set(pendingMessageIdsRef.current));

                    setShowResponseTimeout(false);
                    stopPolling();
                    handlePlayAudio(
                        newMessages[0].audio_url,
                        newMessages[0].word_timings,
                        newMessages[0].chat_message_id,
                        newMessages[0].content
                    );
                }
            } catch (error) {
                console.error('[POLLING] Error:', error);
                stopPolling();
            }
        }, interval);

        pollingTimeoutRef.current = setTimeout(() => {
            stopPolling();
        }, MAX_POLLING_DURATION);
    }, [chatState?.chat.id, chatState?.messages, token, isPolling, usePollingSystem, handlePlayAudio, stopPolling]);

    const handleRefreshChat = useCallback(async () => {
        if (!usePollingSystem || isRefreshingRef.current) return;

        console.log('[REFRESH] Starting chat refresh...');
        isRefreshingRef.current = true;
        setIsRefreshing(true);

        // Stop current polling
        stopPolling();

        // Fetch the latest chat data
        const latestChatData = await fetchLatestChatData();

        if (latestChatData) {
            // Check if there are new messages that need to be played
            const currentMessageIds = chatState?.messages.map(msg => msg.chat_message_id) || [];
            const newMessages = latestChatData.messages.filter(msg =>
                !currentMessageIds.includes(msg.chat_message_id)
            );
            
            // Find assistant messages with audio that need to be played
            const assistantMessagesWithAudio = newMessages.filter(msg =>
                msg.role === 'assistant' && msg.audio_url
            );
            
            // If we found new messages, clear the waiting state FIRST
            // This removes the LoadingDots placeholder before adding messages
            if (newMessages.length > 0) {
                console.log('[REFRESH] Found new messages, clearing waiting state');
                setIsWaitingForResponse(false);
                setShowResponseTimeout(false);
            }
            
            // Add only the new messages instead of replacing all chat data
            // This prevents the FlashList from blanking and maintains message state
            // Ensure hide_text is false so the messages are visible
            for (const newMsg of newMessages) {
                console.log('[REFRESH] Adding new message:', {
                    chat_message_id: newMsg.chat_message_id,
                    role: newMsg.role,
                    content: newMsg.content?.substring(0, 100),
                    hide_text: newMsg.hide_text,
                    audio_url: newMsg.audio_url,
                    audio_only: newMsg.audio_only
                });
                await addMessage({ ...newMsg, hide_text: false });
            }

            if (assistantMessagesWithAudio.length > 0) {
                console.log('[REFRESH] Found new messages with audio, playing audio');
                // Play the latest assistant message with audio
                const latestMessage = assistantMessagesWithAudio[assistantMessagesWithAudio.length - 1];
                handlePlayAudio(
                    latestMessage.audio_url,
                    latestMessage.word_timings,
                    latestMessage.chat_message_id,
                    latestMessage.content
                );
            } else if (newMessages.length > 0) {
                console.log('[REFRESH] Found new messages but no audio yet, continuing to poll');
                // Found messages but no audio, continue polling
                pollingAfterRefreshRef.current = true;
                startPolling();
            } else {
                console.log('[REFRESH] No new messages found, continuing to poll');
                // No new messages found, continue polling with faster interval
                pollingAfterRefreshRef.current = true;
                startPolling();
            }
        } else {
            console.log('[REFRESH] Failed to fetch chat data, continuing to poll');
            // If fetch failed, continue polling
            pollingAfterRefreshRef.current = true;
            startPolling();
        }

        setTimeout(() => {
            isRefreshingRef.current = false;
            pollingAfterRefreshRef.current = false;
            setIsRefreshing(false);
        }, 1000);
    }, [usePollingSystem, stopPolling, startPolling, fetchLatestChatData, addMessage, chatState, handlePlayAudio, setShowResponseTimeout, setIsWaitingForResponse, setIsRefreshing]);

    useEffect(() => {
        if (!usePollingSystem) return;
        return () => {
            stopPolling();
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        };
    }, [usePollingSystem, stopPolling]);

    return {
        showResponseTimeout,
        isPolling,
        pendingMessageIds,
        handleRefreshChat,
        startPolling,
        stopPolling,
        setShowResponseTimeout,
        responseTimeoutRef
    };
}; 
