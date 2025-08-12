import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Link } from 'expo-router';

const SpeakHeaderRight = () => {
    return (
        <View className="flex flex-row gap-2 items-center mr-4">
            <Link href="/subscription" asChild>
                <Pressable className="bg-peach-500 dark:bg-white py-1.5 px-3 rounded-2xl">
                    <Text className='text-white dark:text-peach-500 font-bold'>Try Pro</Text>
                </Pressable>
            </Link>
        </View>
    );
};

export default SpeakHeaderRight;