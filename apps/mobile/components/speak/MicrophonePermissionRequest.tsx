import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMicrophone, faGear, faRotateRight } from '@fortawesome/pro-solid-svg-icons';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface MicrophonePermissionRequestProps {
  onRequestPermission: () => void;
  errorType?: 'permission' | 'initialization' | 'connection' | 'generic';
}

const MicrophonePermissionRequest = ({ 
  onRequestPermission, 
  errorType = 'permission' 
}: MicrophonePermissionRequestProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const openSettings = async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
    } else {
      await Linking.openSettings();
    }
  };

  const getErrorContent = () => {
    switch (errorType) {
      case 'permission':
        return {
          title: 'Enable Microphone Access',
          description: 'To practice speaking, we need access to your microphone. You can enable this in your device settings.',
          primaryButton: {
            text: 'Open Settings',
            action: openSettings,
            icon: faGear
          },
          secondaryButton: {
            text: 'Try Again',
            action: onRequestPermission
          }
        };
      case 'initialization':
        return {
          title: 'Microphone Error',
          description: 'Unable to initialize the microphone. Please ensure no other apps are using your microphone and try again.',
          primaryButton: {
            text: 'Try Again',
            action: onRequestPermission,
            icon: faRotateRight
          }
        };
      case 'connection':
        return {
          title: 'Connection Error',
          description: 'Unable to establish a connection to the speech recognition service. Please check your internet connection and try again.',
          primaryButton: {
            text: 'Retry Connection',
            action: onRequestPermission,
            icon: faRotateRight
          }
        };
      default:
        return {
          title: 'Recording Error',
          description: 'An error occurred while trying to record audio. Please try again.',
          primaryButton: {
            text: 'Try Again',
            action: onRequestPermission,
            icon: faRotateRight
          }
        };
    }
  };

  const content = getErrorContent();

  return (
    <View style={[
      styles.overlay,
      { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' }
    ]}>
      <View style={[
        styles.container,
        { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }
      ]}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: isDark ? '#2C2C2E' : '#F5F7FA' }
        ]}>
          <FontAwesomeIcon 
            icon={faMicrophone} 
            size={32} 
            color={isDark ? '#FFFFFF' : '#00488F'} 
          />
        </View>
        
        <Text style={[
          GlobalFontStyleSheet.textLg,
          styles.title,
          { color: isDark ? '#FFFFFF' : '#1A1A1A' }
        ]}>
          {content.title}
        </Text>
        
        <Text style={[
          GlobalFontStyleSheet.textMd,
          styles.description,
          { color: isDark ? '#A0A0A5' : '#666666' }
        ]}>
          {content.description}
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={content.primaryButton.action}
          >
            {content.primaryButton.icon && (
              <FontAwesomeIcon 
                icon={content.primaryButton.icon} 
                size={18} 
                color="#FFFFFF" 
                style={styles.buttonIcon} 
              />
            )}
            <Text style={[GlobalFontStyleSheet.textMd, styles.buttonText]}>
              {content.primaryButton.text}
            </Text>
          </TouchableOpacity>

          {content.secondaryButton && (
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]}
              onPress={content.secondaryButton.action}
            >
              <Text style={[GlobalFontStyleSheet.textMd, styles.buttonText]}>
                {content.secondaryButton.text}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    backgroundColor: '#00488F',
  },
  secondaryButton: {
    backgroundColor: '#2C2C2E',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default MicrophonePermissionRequest; 