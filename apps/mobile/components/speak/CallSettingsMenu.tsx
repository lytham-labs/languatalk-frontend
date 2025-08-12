import React from 'react';
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Platform, StyleSheet } from 'react-native';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useRouter } from 'expo-router';

type CallSettingsMenuProps = {
  isVisible: boolean;
  onClose: () => void;
  onSettingsPress: () => void;
  onEndChat: () => void;
  openHelpScout?: (user: any) => void;
  userSettings?: { user: any };
};

export const CallSettingsMenu = ({
  isVisible,
  onClose,
  onSettingsPress,
  onEndChat,
  openHelpScout,
  userSettings,
}: CallSettingsMenuProps) => {
  const router = useRouter();

  return (
    <Modal 
      transparent={true} 
      animationType="fade" 
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onSettingsPress();
              }}
              style={styles.menuItem}
            >
              <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>Settings</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                onPress={() => {
                  openHelpScout?.(userSettings?.user);
                }}
                style={styles.menuItem}
              >
                <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>Help Articles</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  router.push('/help');
                }}
                style={styles.menuItem}
              >
                <Text style={[GlobalFontStyleSheet.textMd, styles.menuItemText]}>Help Articles</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    marginTop: Platform.OS === 'ios' ? 80 : 60,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: '#000',
  },
}); 
