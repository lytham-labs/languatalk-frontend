import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import FlashcardService from "@/services/FlashcardService";
import ExerciseBase from "@/components/cards/ExerciseBase";
import AudioPlayerService from "@/services/AudioPlayerService";
import * as FileSystem from "expo-file-system";
import { API_URL } from "@/constants/api";
import useUserSettings from '@/services/api/useUserSettings';

export default function RecallScreen() {
  const { token } = useAuth();
  const flashcardService = new FlashcardService(token ?? "");
  const audioPlayerService = new AudioPlayerService();
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const { userSettings } = useUserSettings();
  const [voice, setVoice] = useState<string>('');

  useEffect(() => {
    if (userSettings?.team?.chat_settings?.voice) {
      const fullVoice = userSettings.team.chat_settings.voice;
      // Only use the voice if it contains "elevenlabs"
      if (fullVoice.toLowerCase().includes('elevenlabs')) {
        const shortVoice = fullVoice.split('_')[0];
        setVoice(shortVoice);
      } else {
        setVoice('');
      }
    }
  }, [userSettings]);

  const howItWorksSteps = [
    "Try to recall the translation",
    "Say or write it via the mic/keyboard buttons (or to save time, click on the card to reveal the answer).",
    "If you were wrong, swipe left. Knew it? Swipe right. Correct but guessed? Swipe down.",
  ];

  const handlePlayAudio = async (text: string, language: string, tags?: string[]) => {
    setIsLoadingAudio(true);
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
            text: text,
            language: language,
            voice_provider: 'elevenlabs',
            voice: voice
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to fetch audio");

      // Get the text from the blob for 11Labs
      const blob = await response.blob();
      const textResponse = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });

      // Process the text stream
      const lines = textResponse.split('\n');
      let audioBytes = "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const responseDict = JSON.parse(line);
            if (responseDict.audio_base64) {
              const audioBytesChunk = atob(responseDict.audio_base64);
              audioBytes += audioBytesChunk;
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

      const fileUri = FileSystem.documentDirectory + "temp_audio.mp3";
      await FileSystem.writeAsStringAsync(
        fileUri,
        btoa(String.fromCharCode(...byteArray)),
        { encoding: FileSystem.EncodingType.Base64 }
      );

      await audioPlayerService.playSound(
        fileUri,
        null,
        'recall-mode',
        false,
        'off',
        text,
        () => {}
      );
    } catch (error) {
      console.error("Error fetching audio:", error);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <ExerciseBase
      mode="recall"
      title="Recall"
      flashcardService={flashcardService}
      onPlayAudio={handlePlayAudio}
      isLoadingAudio={isLoadingAudio}
      howItWorksSteps={howItWorksSteps}
    />
  );
}
