import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFeatureFlag } from 'posthog-react-native';
import { ChatDataProvider } from '@/contexts/ChatDataContext';
import { AudioProvider } from '@/contexts/AudioContext';
import { SelectionProvider } from '@/contexts/SelectionContext';
import { ChatModeProvider } from '@/contexts/ChatModeContext';
import { AlternativeResponseProvider } from '@/contexts/AlternativeResponseContext';
import { CorrectionProvider } from '@/contexts/CorrectionContext';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { SuggestionsProvider } from '@/contexts/SuggestionsContext';
// flagged chat
import UnflaggedChatScreen from './chat_unflagged';
import { Chat } from '@/components/speak/Chat';

export default function ChatScreen() {
  const { chatId, initialData } = useLocalSearchParams();
  const isUsingNewChatScreen = useFeatureFlag('use_new_chat_screen');
  const isUsingJapanesePronunciation = useFeatureFlag('japanese-reading-aid-native');

  if (isUsingNewChatScreen) {
    console.log('********************* NEW CHAT SCREEN *********************'); 
  } else {
    console.log('********************* OLD CHAT SCREEN *********************');
  }


  

  return (
    // <FlaggedChatScreen />
    <>
    {isUsingNewChatScreen ? (
        <ChatDataProvider chatId={chatId as string} initialData={initialData ? JSON.parse(initialData as string) : null}>
          <AlternativeResponseProvider>
            <CorrectionProvider>
              <TranslationProvider>
                <SuggestionsProvider>
                  <SelectionProvider>
                    <Chat isChatFlagged={isUsingNewChatScreen} isUsingJapanesePronunciation={isUsingJapanesePronunciation} />
                  </SelectionProvider>
                </SuggestionsProvider>
              </TranslationProvider>
            </CorrectionProvider>
          </AlternativeResponseProvider>
        </ChatDataProvider>
      ) : (<UnflaggedChatScreen />)
    }
    </>
  );
}
