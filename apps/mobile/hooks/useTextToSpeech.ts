import { useState, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AVPlaybackStatus } from 'expo-av';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';

interface AudioState {
    isLoading: boolean;
    isPlaying: boolean;
    isPaused?: boolean;
    fileUri: string | null;
    alignmentData: AlignmentData | null;
}

interface AlignmentData {
    chars: string[];
    charStartTimesMs: number[];
    charEndTimesMs: number[];
    charDurationsMs: number[];
}

interface UseTextToSpeechProps {
    language: string;
    voice: string;
    voice_provider?: string;
    audioPlayerService?: any; // Replace with actual type if available
}

export const useTextToSpeech = ({
    language,
    voice,
    voice_provider = 'elevenlabs',
    audioPlayerService
}: UseTextToSpeechProps) => {
    const [audioStates, setAudioStates] = useState<Record<string, AudioState>>({});
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const { token } = useAuth();
    // Helper functions for base64 conversion
    const chunkToBase64 = (byteArray: Uint8Array): string => {
        const CHUNK_SIZE = 1024; // Process 1KB at a time
        let result = "";

        for (let i = 0; i < byteArray.length; i += CHUNK_SIZE) {
            const chunk = byteArray.slice(i, i + CHUNK_SIZE);
            result += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }

        return result;
    };

    const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;

        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return btoa(binary);
    };

    const fetchAndPlayAudio = useCallback(async (text: string) => {
        // RESUME if paused and sound is loaded
        if (audioStates[text]?.isPaused && sound) {
            await sound.playAsync();
            setAudioStates(prevStates => ({
                ...prevStates,
                [text]: {
                    ...(prevStates[text] || {}),
                    isPlaying: true,
                    isPaused: false,
                },
            }));
            return;
        }

        // Check if we already have a cached file
        if (audioStates[text]?.fileUri) {
            // If we have a cached file, just play it
            setAudioStates(prevStates => ({
                ...prevStates,
                [text]: {
                    ...(prevStates[text] || {}),
                    isLoading: true,
                },
            }));

            await playAudio(text, audioStates[text].fileUri as string);
            return;
        }

        // Update state to loading
        setAudioStates(prevStates => ({
            ...prevStates,
            [text]: {
                ...(prevStates[text] || {}),
                isLoading: true,
                isPlaying: false,
                fileUri: prevStates[text]?.fileUri || null,
                alignmentData: prevStates[text]?.alignmentData || null,
            },
        }));

        try {
            const response = await fetch(
                `${API_URL}/api/v1/stream_text_to_speech`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        text,
                        language,
                        voice,
                        voice_provider
                    }),
                }
            );
            console.log('Response:', response);

            if (!response.ok) throw new Error("Failed to fetch audio");

            // Get the text from the blob
            const responseData = await response.text();
            const textContent = responseData;

            // Process the text stream
            const lines = textContent.split('\n');
            let audioBytes = "";
            let alignmentData: AlignmentData = {
                chars: [],
                charStartTimesMs: [],
                charEndTimesMs: [],
                charDurationsMs: []
            };

            // Process each line
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const responseDict = JSON.parse(line);
                        if (responseDict.audio_base64) {
                            const audioBytesChunk = atob(responseDict.audio_base64);
                            audioBytes += audioBytesChunk;
                        }

                        if (responseDict.alignment) {
                            if (responseDict.alignment.characters) {
                                alignmentData.chars = [
                                    ...alignmentData.chars,
                                    ...responseDict.alignment.characters
                                ];
                            }

                            if (responseDict.alignment.character_start_times_seconds) {
                                alignmentData.charStartTimesMs = [
                                    ...alignmentData.charStartTimesMs,
                                    ...responseDict.alignment.character_start_times_seconds.map(
                                        (time: number) => time * 1000
                                    )
                                ];
                            }

                            if (responseDict.alignment.character_end_times_seconds) {
                                alignmentData.charEndTimesMs = [
                                    ...alignmentData.charEndTimesMs,
                                    ...responseDict.alignment.character_end_times_seconds.map(
                                        (time: number) => time * 1000
                                    )
                                ];
                            }

                            // Calculate durations
                            alignmentData.charDurationsMs = alignmentData.charEndTimesMs.map(
                                (endTime, i) => endTime - alignmentData.charStartTimesMs[i]
                            );
                        }
                    } catch (e) {
                        console.error('Error parsing JSON line:', e);
                    }
                }
            }

            // Convert accumulated audioBytes to Uint8Array
            const byteArray = new Uint8Array(audioBytes.length);
            for (let i = 0; i < audioBytes.length; i++) {
                byteArray[i] = audioBytes.charCodeAt(i);
            }

            // Save the audio file
            const fileName = `audio_${Date.now()}.mp3`;
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            // Process the byteArray directly without using String.fromCharCode(...byteArray)
            await FileSystem.writeAsStringAsync(
                fileUri,
                FileSystem.EncodingType.Base64 === 'base64'
                    ? arrayBufferToBase64(byteArray.buffer)
                    : btoa(chunkToBase64(byteArray)),
                { encoding: FileSystem.EncodingType.Base64 }
            );

            setAudioStates(prevStates => ({
                ...prevStates,
                [text]: {
                    ...(prevStates[text] || {}),
                    fileUri,
                    alignmentData,
                    isLoading: false,
                },
            }));

            // Play the audio
            await playAudio(text, fileUri);
        } catch (error) {
            console.error("Error fetching audio:", error);
            setAudioStates(prevStates => ({
                ...prevStates,
                [text]: {
                    ...(prevStates[text] || {}),
                    isLoading: false,
                },
            }));
        }
    }, [token, language, voice, voice_provider, API_URL]);

    const playAudio = useCallback(async (text: string, audioUrl: string) => {
        try {
            // If using external audio player service
            if (audioPlayerService) {
                await audioPlayerService.playSound(
                    audioUrl,
                    null,
                    text,
                    false,
                    'off',
                    text,
                    (status: AVPlaybackStatus) => {
                        if (status.isLoaded) {
                            if (status.didJustFinish || !status.isPlaying) {
                                setAudioStates(prevStates => ({
                                    ...prevStates,
                                    [text]: {
                                        ...(prevStates[text] || {}),
                                        isPlaying: false,
                                        isPaused: false,
                                    },
                                }));
                            } else if (status.isPlaying) {
                                setAudioStates(prevStates => ({
                                    ...prevStates,
                                    [text]: {
                                        ...(prevStates[text] || {}),
                                        isPlaying: true,
                                        isPaused: false,
                                    },
                                }));
                            }
                        }
                    }
                );
            } else {
                // Using Expo Audio directly if no service is provided
                if (sound) {
                    await sound.unloadAsync();
                }

                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: true },
                    (status) => {
                        if (status.isLoaded) {
                            if (status.didJustFinish || !status.isPlaying) {
                                setAudioStates(prevStates => ({
                                    ...prevStates,
                                    [text]: {
                                        ...(prevStates[text] || {}),
                                        isPlaying: false,
                                        isPaused: false,
                                    },
                                }));
                            } else if (status.isPlaying) {
                                setAudioStates(prevStates => ({
                                    ...prevStates,
                                    [text]: {
                                        ...(prevStates[text] || {}),
                                        isPlaying: true,
                                        isPaused: false,
                                    },
                                }));
                            }
                        }
                    }
                );

                setSound(newSound);

                // Start playing
                await newSound.playAsync();

                setAudioStates(prevStates => ({
                    ...prevStates,
                    [text]: {
                        ...(prevStates[text] || {}),
                        isPlaying: true,
                        isPaused: false,
                    },
                }));
            }
        } catch (error) {
            console.error("Error playing audio:", error);
            setAudioStates(prevStates => ({
                ...prevStates,
                [text]: {
                    ...(prevStates[text] || {}),
                    isPlaying: false,
                    isPaused: false,
                },
            }));
        }
    }, [audioPlayerService, sound]);

    const stopAudio = useCallback(async (text?: string) => {
        try {
            if (audioPlayerService) {
                await audioPlayerService.stopSound();
            } else if (sound) {
                await sound.stopAsync();
                await sound.unloadAsync();
                setSound(null);
            }

            if (text) {
                setAudioStates(prevStates => ({
                    ...prevStates,
                    [text]: {
                        ...(prevStates[text] || {}),
                        isPlaying: false,
                        isPaused: false,
                    },
                }));
            } else {
                // Stop all playing audio
                setAudioStates(prevStates => {
                    const newStates = { ...prevStates };
                    Object.keys(newStates).forEach(key => {
                        if (newStates[key].isPlaying) {
                            newStates[key] = {
                                ...newStates[key],
                                isPlaying: false,
                                isPaused: false,
                            };
                        }
                    });
                    return newStates;
                });
            }
        } catch (error) {
            console.error("Error stopping audio:", error);
        }
    }, [audioPlayerService, sound]);

    // Cleanup function
    const cleanup = useCallback(async () => {
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }
        if (audioPlayerService) {
            await audioPlayerService.stopSound();
        }
    }, [sound, audioPlayerService]);

    // Add pauseAudio function
    const pauseAudio = useCallback(async (text?: string) => {
        try {
            if (audioPlayerService) {
                await audioPlayerService.pauseSound();
            } else if (sound) {
                await sound.pauseAsync();
            }
            if (text) {
                setAudioStates(prevStates => ({
                    ...prevStates,
                    [text]: {
                        ...(prevStates[text] || {}),
                        isPlaying: false,
                        isPaused: true,
                    },
                }));
            }
        } catch (error) {
            console.error("Error pausing audio:", error);
        }
    }, [audioPlayerService, sound]);

    return {
        playText: fetchAndPlayAudio,
        stopAudio,
        pauseAudio,
        cleanup,
        audioStates,
    };
}; 
