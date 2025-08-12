import React from 'react';
import { View, Modal, ScrollView, Pressable, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FontAwesome6 } from '@expo/vector-icons';

interface BottomUpWindowProps {
  isVisible: boolean;
  onClose: () => void;
  content: React.ReactNode;
}

const BottomUpWindow: React.FC<BottomUpWindowProps> = ({ isVisible, onClose, content }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.bottomUpWindow,
              isDark ? styles.darkBackground : styles.lightBackground
            ]}>
              <Pressable style={styles.bottomUpClose} onPress={onClose}>
                <FontAwesome6 
                  name="xmark" 
                  size={20} 
                  color={isDark ? '#fff' : '#000'} 
                />
              </Pressable>
              <ScrollView 
                style={styles.bottomUpContent}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={true}
              >
                {content}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomUpWindow: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  lightBackground: {
    backgroundColor: 'white',
  },
  darkBackground: {
    backgroundColor: '#1c1c1e',
  },
  bottomUpContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  bottomUpClose: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 8,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
});

export default BottomUpWindow;
