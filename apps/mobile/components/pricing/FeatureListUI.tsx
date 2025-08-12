// FeatureList.js
import React from 'react';
import { View, Text } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck } from '@fortawesome/pro-solid-svg-icons/faCheck';
import { getDeviceType, getIconSize, GlobalFontStyleSheet } from '@/constants/Font';
const FeatureList = ({ features }: {features:string[]}) => {
    return (
        <View className="px-1 py-4">
            {features.map((feature, index) => (
                <View className='flex flex-row items-center mt-1'>
                    <FontAwesomeIcon icon={faCheck} size={getIconSize(16)} className="text-gray-500 dark:text-white mr-4" />
                    <Text key={index} style={ getDeviceType() === 'tablet' ? GlobalFontStyleSheet.textSm : GlobalFontStyleSheet.textMd} className="mb-2 pr-4 text-gray-500 dark:text-white">{feature}</Text>
                </View>
            ))}
        </View>
    );
};

export default FeatureList;