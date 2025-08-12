import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Dimensions, Platform, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { SenjaEmbed } from '@/components/shared/SenjaEmbed';
import { useColorScheme } from '@/hooks/useColorScheme';
import { GlobalFontStyleSheet } from '@/constants/Font';
import Button from '@/components/shared/Button';
import { faUser, faPlay } from '@fortawesome/pro-solid-svg-icons';
import { getIconSize } from '@/constants/Font';
import { Colors } from '@/constants/Colors';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';

export default function LandingScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const senjaId = colorScheme === 'dark' ? "795539b8-dfb0-4c0d-8c54-7372e9730dbe" : "58203e68-967d-4051-bdbd-cc18e8f51e83";
  
  // Calculate video dimensions
  const screenWidth = Dimensions.get('window').width;
  const videoWidth = Math.min(screenWidth - 48, 200);
  const videoHeight = videoWidth * 1.78;

  const handleNavigation = async (path: string) => {
    if (videoRef.current) {
      await videoRef.current.stopAsync();
    }
    router.push(path as any);
  };

  return (
    <ScrollView 
      contentContainerStyle={{ paddingBottom: 40 }}
      bounces={true}
      showsVerticalScrollIndicator={true}
    >
      <View className="flex-1 justify-start items-center px-6 py-10 bg-white dark:bg-gray-900">
        <Text
            
            className="text-3xl font-bold text-gray-900 dark:text-white mb-6 mt-10"
        >
            Welcome to Langua!
        </Text>
        {/* Video Container with Enhanced Border */}
        <View 
          style={{
            width: videoWidth,
            height: videoHeight,
            marginBottom: 32,
            borderRadius: 20,
            borderWidth: 3,
            borderColor: '#F87171',
            overflow: 'hidden',
            // Enhanced shadow: using a fallback for the color scheme key
            shadowColor: Colors[colorScheme || 'light'].text,
            shadowOffset: {
              width: 0,
              height: 4,
            },
            shadowOpacity: 0.3,
            shadowRadius: 4.65,
            elevation: 8,
          }}
        >
          <Video
            ref={videoRef}
            source={{
              uri: 'https://customer-ljken78317krymb6.cloudflarestream.com/d54c795806f9ec26837ad51f5dc7345a/manifest/video.m3u8'
            }}
            posterSource={{
              uri: 'https://customer-ljken78317krymb6.cloudflarestream.com/d54c795806f9ec26837ad51f5dc7345a/thumbnails/thumbnail.jpg?time=76s'
            }}
            usePoster={true}
            posterStyle={{
              zIndex: -1
            }}
            useNativeControls
            resizeMode={Platform.OS === 'android' ? ResizeMode.CONTAIN : ResizeMode.COVER}
            isLooping
            shouldPlay={isPlaying}
            isMuted={false}
            androidImplementation="MediaPlayer"
            style={{
              width: '100%',
              height: '100%',
            }}
          />
          {!isPlaying && (
            <>
              <Image
                source={{
                  uri: 'https://customer-ljken78317krymb6.cloudflarestream.com/d54c795806f9ec26837ad51f5dc7345a/thumbnails/thumbnail.jpg?time=76s'
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                }}
                resizeMode={Platform.OS === 'android' ? 'contain' : 'cover'}
              />
              <Pressable
                onPress={() => {
                  setIsPlaying(true);
                  if (videoRef.current) {
                    videoRef.current.playAsync();
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: '#F87171',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                  }}
                >
                  <FontAwesomeIcon
                    icon={faPlay}
                    size={24}
                    color="white"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </Pressable>
            </>
          )}
        </View>

        <View className="w-full max-w-sm ">
          <Button 
            onPress={() => handleNavigation('/login?signup=true')}
            iconSize={getIconSize(16)} 
            btnType={{ bg: 'bg-[#F87171] dark:bg-[#F87171]/85', textColor: 'text-white' }}
            titleSize='text-md' 
            title='Create a free account' 
            centeredItems={true} 
            containerClassNames='flex-none mb-4 text-center'
          />

          <Button 
            onPress={() => handleNavigation('/login')} 
            icon={faUser} 
            iconSize={getIconSize(16)} 
            btnType={{ bg: 'bg-gray-50 dark:bg-gray-700', textColor: 'text-gray-900 dark:text-white' }}
            titleSize='text-md' 
            title='Log in' 
            centeredItems={true} 
            containerClassNames='flex-none mb-8 text-center' 
          />
        </View>

        {/* Reviews Section */}
        <View className="w-full">
          <Text 
            style={GlobalFontStyleSheet.textXl} 
            className="font-bold text-center text-gray-900 dark:text-white mb-6"
          >
                What Learners say about Langua👇
          </Text>

          <SenjaEmbed id={senjaId} />
        </View>
      </View>
    </ScrollView>
  );
}
