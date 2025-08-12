import GlobalChatSettingsPanel from '@/components/settings/GlobalChatSettingsPanel';
import { useFeatureFlag } from 'posthog-react-native';

export default function ChatSettingsScreen() {
  const isJapaneseReadingAidFlagged = useFeatureFlag('japanese-reading-aid-native');

  return (
    <GlobalChatSettingsPanel 
      isJapaneseReadingAidFlagged={isJapaneseReadingAidFlagged}
    />
  );
}
