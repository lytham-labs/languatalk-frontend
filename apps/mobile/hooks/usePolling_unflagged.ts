import { useState, useRef, useCallback, useEffect } from 'react';
import { API_URL } from '@/constants/api';
import { ChatData } from '@/types/chat';

interface UsePollingProps {
    chatData: ChatData | null;
    token: string | null;
    handlePlayAudio: (audioUrl: string, wordTimings: any, chatMessageId: string, text: string) => void;
    usePollingSystem: boolean;
    setIsWaitingForResponse?: (waiting: boolean) => void;
    setChatData?: (updater: (prev: ChatData | null) => ChatData | null) => void;
}

export const usePollingUnflagged = ({
    chatData,
    token,
    handlePlayAudio,
    usePollingSystem,
    setIsWaitingForResponse,
    setChatData
}: UsePollingProps) => {
    // State management
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
    const processedMessageIdsRef = useRef<Set<string>>(new Set());  // Track all messages we've already processed
    const MAX_PROCESSED_MESSAGES = 200;

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

    const startPolling = useCallback(() => {
        if (isPolling || !usePollingSystem) return;

        setIsPolling(true);
        lastPollTimeRef.current = Date.now();

        const interval = pollingAfterRefreshRef.current
            ? POLLING_INTERVAL_AFTER_REFRESH
            : POLLING_INTERVAL;

        pollingIntervalRef.current = setInterval(async () => {
            if (!chatData?.chat.id) {
                stopPolling();
                return;
            }

            try {
                console.log('[POLLING_UNFLAGGED] Polling - checking for new messages...');
                const response = await fetch(`${API_URL}/api/v1/chats/${chatData.chat.id}`, {
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                const data: ChatData = await response.json();
                console.log('[POLLING_UNFLAGGED] Polling - fetched messages count:', data.messages.length);
                
                const newMessages = data.messages.filter(newMsg => {
                    // Skip if we've already processed this message
                    if (processedMessageIdsRef.current.has(newMsg.chat_message_id)) {
                        console.log('[POLLING_UNFLAGGED] Skipping already processed message:', newMsg.chat_message_id);
                        return false;
                    }
                    
                    // Skip if message already exists in chat
                    const existsInChat = chatData.messages.some(existingMsg =>
                        existingMsg.chat_message_id === newMsg.chat_message_id
                    );
                    
                    // Skip if message is pending
                    const isPending = pendingMessageIdsRef.current.has(newMsg.chat_message_id);
                    
                    if (existsInChat || isPending) {
                        return false;
                    }
                    
                    return true;
                });

                console.log('[POLLING_UNFLAGGED] Polling - new messages found:', newMessages.length);
                
                if (newMessages.length > 0) {
                    // Log details about each new message
                    newMessages.forEach(msg => {
                        console.log('[POLLING_UNFLAGGED] Found new message:', {
                            id: msg.chat_message_id,
                            role: msg.role,
                            content_preview: msg.content?.substring(0, 30),
                            has_audio: !!msg.audio_url
                        });
                    });
                    
                    // Mark ALL messages as processed immediately to prevent re-adding
                    newMessages.forEach(msg => {
                        processedMessageIdsRef.current.add(msg.chat_message_id);
                        console.log('[POLLING_UNFLAGGED] Marked message as processed:', msg.chat_message_id, 'role:', msg.role);
                    });
                    
                    // Clean up if we exceed the limit
                    if (processedMessageIdsRef.current.size > MAX_PROCESSED_MESSAGES) {
                        const entries = Array.from(processedMessageIdsRef.current);
                        processedMessageIdsRef.current = new Set(entries.slice(-MAX_PROCESSED_MESSAGES));
                        console.log('[POLLING_UNFLAGGED] Cleaned up processedMessageIdsRef to', MAX_PROCESSED_MESSAGES, 'entries');
                    }
                    
                    // Update chat display with ALL new messages (in case WebSocket failed)
                    if (setChatData) {
                        console.log('[POLLING_UNFLAGGED] Polling - updating chat with new messages');
                        setChatData(prevData => {
                            if (!prevData) return prevData;
                            
                            // Double-check for duplicates before adding
                            const messagesToAdd = newMessages.filter(newMsg => 
                                !prevData.messages.some(existing => 
                                    existing.chat_message_id === newMsg.chat_message_id
                                )
                            );
                            
                            if (messagesToAdd.length < newMessages.length) {
                                console.log('[POLLING_UNFLAGGED] WARNING: Some messages already exist in chat, filtering duplicates');
                                console.log('[POLLING_UNFLAGGED] Original new messages:', newMessages.length, 'After filtering:', messagesToAdd.length);
                            }
                            
                            const updatedData = {
                                ...prevData,
                                messages: [...prevData.messages, ...messagesToAdd]
                            };
                            console.log('[POLLING_UNFLAGGED] Chat updated - total messages now:', updatedData.messages.length);
                            return updatedData;
                        });
                    } else {
                        console.log('[POLLING_UNFLAGGED] WARNING: Polling - setChatData not provided!');
                    }
                    
                    // Check for assistant messages with audio
                    const assistantMessages = newMessages.filter(msg => msg.role === 'assistant');
                    const messageWithAudio = assistantMessages.find(msg => msg.audio_url);
                    
                    if (messageWithAudio) {
                        console.log('[POLLING_UNFLAGGED] Found assistant message with audio, clearing timeout');
                        pendingMessageIdsRef.current.add(messageWithAudio.chat_message_id);
                        setPendingMessageIds(new Set(pendingMessageIdsRef.current));

                        setShowResponseTimeout(false);
                        // Clear waiting state when we find a message with audio
                        if (setIsWaitingForResponse) {
                            console.log('[POLLING_UNFLAGGED] Clearing isWaitingForResponse');
                            setIsWaitingForResponse(false);
                        }
                        stopPolling();
                        
                        // Check if this message was already in the original chat data (arrived via WebSocket)
                        const messageExistedBefore = chatData.messages.some(msg => 
                            msg.chat_message_id === messageWithAudio.chat_message_id
                        );
                        
                        if (!messageExistedBefore) {
                            // Only play audio if this message wasn't already in the chat
                            // This means it genuinely arrived via polling, not WebSocket
                            console.log('[POLLING_UNFLAGGED] Playing audio for NEW message from polling');
                            handlePlayAudio(
                                messageWithAudio.audio_url,
                                messageWithAudio.word_timings,
                                messageWithAudio.chat_message_id,
                                messageWithAudio.content
                            );
                        } else {
                            console.log('[POLLING_UNFLAGGED] Message already existed in chat (from WebSocket), not playing audio again');
                        }
                    } else if (assistantMessages.length > 0) {
                        console.log('[POLLING_UNFLAGGED] Assistant messages found but no audio yet - stopping polling');
                        // Clear waiting state since we have a message
                        if (setIsWaitingForResponse) {
                            console.log('[POLLING_UNFLAGGED] Clearing isWaitingForResponse (message without audio)');
                            setIsWaitingForResponse(false);
                        }
                        setShowResponseTimeout(false);
                        // Stop polling since we got the assistant response
                        stopPolling();
                    }
                } else {
                    console.log('[POLLING_UNFLAGGED] No new messages in this poll');
                }
            } catch (error) {
                console.error('[POLLING] Error:', error);
                stopPolling();
            }
        }, interval);

        pollingTimeoutRef.current = setTimeout(() => {
            stopPolling();
        }, MAX_POLLING_DURATION);
    }, [chatData, token, isPolling, usePollingSystem, handlePlayAudio, stopPolling, setIsWaitingForResponse, setChatData]);

    const handleRefreshChat = useCallback(async () => {
        if (!usePollingSystem || isRefreshingRef.current) return;
        
        console.log('[POLLING_UNFLAGGED] handleRefreshChat called');
        console.log('[POLLING_UNFLAGGED] Current chat ID:', chatData?.chat?.id);
        console.log('[POLLING_UNFLAGGED] Current messages count:', chatData?.messages?.length);
        isRefreshingRef.current = true;
        
        // Clear timeout states when refresh is pressed
        setShowResponseTimeout(false);
        if (setIsWaitingForResponse) {
            setIsWaitingForResponse(false);
        }
        
        stopPolling();
        
        // Try to fetch latest data immediately on refresh
        if (chatData?.chat.id && token) {
            try {
                console.log('[POLLING_UNFLAGGED] Fetching latest chat data on refresh...');
                const response = await fetch(`${API_URL}/api/v1/chats/${chatData.chat.id}`, {
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const data: ChatData = await response.json();
                    console.log('[POLLING_UNFLAGGED] Fetched data - messages count:', data.messages.length);
                    
                    // Log existing messages
                    console.log('[POLLING_UNFLAGGED] Existing message IDs:', 
                        chatData.messages.map(m => m.chat_message_id));
                    console.log('[POLLING_UNFLAGGED] Fetched message IDs:', 
                        data.messages.map(m => m.chat_message_id));
                    
                    const newMessages = data.messages.filter(newMsg => {
                        // Skip if we've already processed this message
                        if (processedMessageIdsRef.current.has(newMsg.chat_message_id)) {
                            console.log('[POLLING_UNFLAGGED] Refresh - Skipping already processed message:', newMsg.chat_message_id);
                            return false;
                        }
                        
                        // Skip if message already exists in chat
                        const existsInChat = chatData.messages.some(existingMsg =>
                            existingMsg.chat_message_id === newMsg.chat_message_id
                        );
                        
                        // Skip if message is pending
                        const isPending = pendingMessageIdsRef.current.has(newMsg.chat_message_id);
                        
                        if (existsInChat || isPending) {
                            return false;
                        }
                        
                        return true;
                    });

                    console.log('[POLLING_UNFLAGGED] New messages found:', newMessages.length);
                    
                    if (newMessages.length > 0) {
                        // Log and mark ALL messages as processed
                        newMessages.forEach(msg => {
                            processedMessageIdsRef.current.add(msg.chat_message_id);
                            console.log('[POLLING_UNFLAGGED] Refresh - Marked message as processed:', msg.chat_message_id, 'role:', msg.role);
                            console.log('[POLLING_UNFLAGGED] New message:', {
                                id: msg.chat_message_id,
                                role: msg.role,
                                content: msg.content?.substring(0, 50),
                                has_audio: !!msg.audio_url
                            });
                        });
                        
                        // Clean up if we exceed the limit
                        if (processedMessageIdsRef.current.size > MAX_PROCESSED_MESSAGES) {
                            const entries = Array.from(processedMessageIdsRef.current);
                            processedMessageIdsRef.current = new Set(entries.slice(-MAX_PROCESSED_MESSAGES));
                            console.log('[POLLING_UNFLAGGED] Refresh - Cleaned up processedMessageIdsRef to', MAX_PROCESSED_MESSAGES, 'entries');
                        }
                        
                        // Add ALL new messages to the chat display (in case WebSocket failed)
                        if (setChatData) {
                            console.log('[POLLING_UNFLAGGED] setChatData is available, adding messages to chat display');
                            console.log('[POLLING_UNFLAGGED] Messages to add:', newMessages.map(m => ({
                                id: m.chat_message_id,
                                role: m.role,
                                content_preview: m.content?.substring(0, 30)
                            })));
                            setChatData(prevData => {
                                if (!prevData) {
                                    console.log('[POLLING_UNFLAGGED] ERROR: prevData is null, cannot update');
                                    return prevData;
                                }
                                
                                // Double-check for duplicates before adding
                                const messagesToAdd = newMessages.filter(newMsg => 
                                    !prevData.messages.some(existing => 
                                        existing.chat_message_id === newMsg.chat_message_id
                                    )
                                );
                                
                                if (messagesToAdd.length < newMessages.length) {
                                    console.log('[POLLING_UNFLAGGED] WARNING: Some messages already exist in chat (refresh), filtering duplicates');
                                    console.log('[POLLING_UNFLAGGED] Original new messages:', newMessages.length, 'After filtering:', messagesToAdd.length);
                                }
                                
                                const updatedData = {
                                    ...prevData,
                                    messages: [...prevData.messages, ...messagesToAdd]
                                };
                                console.log('[POLLING_UNFLAGGED] Updated chat data - new message count:', updatedData.messages.length);
                                return updatedData;
                            });
                            console.log('[POLLING_UNFLAGGED] setChatData call completed');
                        } else {
                            console.log('[POLLING_UNFLAGGED] WARNING: setChatData is not provided, cannot update chat display!');
                        }
                        
                        // Check if any assistant messages have audio
                        const assistantMessages = newMessages.filter(msg => msg.role === 'assistant');
                        const messageWithAudio = assistantMessages.find(msg => msg.audio_url);
                        if (messageWithAudio) {
                            console.log('[POLLING_UNFLAGGED] Found message with audio, playing it');
                            pendingMessageIdsRef.current.add(messageWithAudio.chat_message_id);
                            setPendingMessageIds(new Set(pendingMessageIdsRef.current));
                            
                            handlePlayAudio(
                                messageWithAudio.audio_url,
                                messageWithAudio.word_timings,
                                messageWithAudio.chat_message_id,
                                messageWithAudio.content
                            );
                            return; // Don't start polling since we found audio
                        } else {
                            console.log('[POLLING_UNFLAGGED] Assistant messages found but no audio yet - message should be visible now');
                            // Don't start polling since we found the assistant response
                            return;
                        }
                    } else {
                        console.log('[POLLING_UNFLAGGED] No new messages found on refresh, continuing to poll');
                        // Only start polling if we didn't find any new messages
                        pollingAfterRefreshRef.current = true;
                        console.log('[POLLING_UNFLAGGED] Starting polling after refresh');
                        startPolling();
                    }
                } else {
                    console.error('[POLLING_UNFLAGGED] Failed to fetch - status:', response.status);
                    // Start polling on error
                    pollingAfterRefreshRef.current = true;
                    startPolling();
                }
            } catch (error) {
                console.error('[POLLING_UNFLAGGED] Error fetching on refresh:', error);
                // Start polling on error
                pollingAfterRefreshRef.current = true;
                startPolling();
            }
        } else {
            // No chat ID or token, just start polling
            pollingAfterRefreshRef.current = true;
            console.log('[POLLING_UNFLAGGED] Starting polling after refresh (no chat ID)');
            startPolling();
        }

        setTimeout(() => {
            isRefreshingRef.current = false;
            pollingAfterRefreshRef.current = false;
        }, 1000);
    }, [usePollingSystem, stopPolling, startPolling, setIsWaitingForResponse, chatData, token, handlePlayAudio, setChatData]);

    // Log when hook is initialized with setChatData
    useEffect(() => {
        console.log('[POLLING_UNFLAGGED] Hook mounted/updated - setChatData available:', !!setChatData);
    }, [setChatData]);
    
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
