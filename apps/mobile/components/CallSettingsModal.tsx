import React, { useState, useEffect } from 'react';
import CallSettingsForm from '@/components/CallSettingsForm';
import SlidingModal from '@/components/shared/SlidingModal';

interface CallSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  chatSettings: any;
  chatOptions: any;
  onSettingChange: (changes: Record<string, string | boolean>) => void;
  showCallModeOptions?: boolean;
  showTranscription?: boolean;
  onTranscriptionToggle?: () => void;
}

const CallSettingsModal: React.FC<CallSettingsModalProps> = ({
  isVisible,
  onClose,
  chatSettings,
  chatOptions,
  onSettingChange,
  showCallModeOptions = false,
  showTranscription,
  onTranscriptionToggle
}) => {
  const [pendingChanges, setPendingChanges] = useState<Record<string, string | boolean>>({});

  // Reset pending changes when modal visibility changes
  useEffect(() => {
    if (!isVisible) {
      setPendingChanges({});
    }
  }, [isVisible]);

  // Close modal if chatSettings becomes null/undefined
  useEffect(() => {
    if (isVisible && !chatSettings) {
      onClose();
    }
  }, [isVisible, chatSettings, onClose]);

  const handleSettingChange = (changes: Record<string, string | boolean>) => {
    setPendingChanges(prev => ({ ...prev, ...changes }));
  };

  const handleClose = () => {
    // Apply any pending changes before closing
    if (Object.keys(pendingChanges).length > 0) {
      onSettingChange(pendingChanges);
    }
    onClose();
  };

  return (
    <SlidingModal visible={isVisible} onClose={handleClose}>
      <CallSettingsForm
        initialChatSettings={chatSettings}
        initialChatOptions={chatOptions}
        onSettingChange={handleSettingChange}
        onClose={handleClose}
        showCallModeOptions={showCallModeOptions}
        autoSave={true}
        showTranscription={showTranscription}
        onTranscriptionToggle={onTranscriptionToggle}
      />
    </SlidingModal>
  );
};

export default CallSettingsModal;
