import AsyncStorage from '@react-native-async-storage/async-storage';

export const getStoredAudioUri = async (messageId: string): Promise<string | null> => {
  try {
    const audioKey = `audioUrl_${messageId}`;

    return await AsyncStorage.getItem(audioKey);
  } catch (error) {
    console.log('Error getting audio URI:', error);
    
    return null;
  }
};

export const storeAudioUri = async (messageId: string, uri: string): Promise<void> => {
  try {
    const audioKey = `audioUrl_${messageId}`;
    
    await AsyncStorage.setItem(audioKey, uri);
  } catch (error) {
    console.log('Error storing audio URI:', error);
  }
};

export const removeAudioUri = async (messageId: string): Promise<void> => {
  try {
    const audioKey = `audioUrl_${messageId}`;

    await AsyncStorage.removeItem(audioKey);
  } catch (error) {
    console.log('Error removing audio URI:', error);
  }
}; 
