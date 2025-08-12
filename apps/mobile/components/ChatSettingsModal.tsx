import React from 'react';
import { View } from 'react-native';
import ChatSettingsForm from '@/components/ChatSettingsForm';
import SlidingModal from '@/components/shared/SlidingModal';

interface ChatSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  chatSettings: any;
  chatOptions: any;
  onSettingChange: (field: string, value: string | boolean) => void;
  disableGuidedMode?: boolean;
  isJapaneseReadingAidFlagged?: boolean;
}

const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isVisible,
  onClose,
  chatSettings,
  chatOptions,
  onSettingChange,
  disableGuidedMode,
  isJapaneseReadingAidFlagged = false,
}) => {
  return (
    <SlidingModal visible={isVisible} onClose={onClose}>
      <View className="pb-4">
        <ChatSettingsForm
          hideVoice={true}
          hideMode={true}
          disableGuidedMode={disableGuidedMode}
          initialChatSettings={chatSettings}
          initialChatOptions={chatOptions}
          onSettingChange={onSettingChange}
          showAdvancedSettings={true}
          isJapaneseReadingAidFlagged={isJapaneseReadingAidFlagged}
        />
      </View>
    </SlidingModal>
  );
};

export default ChatSettingsModal;
