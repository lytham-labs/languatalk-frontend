import React from 'react';
import { View, Dimensions } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronDown } from '@fortawesome/pro-duotone-svg-icons/faChevronDown';
import RNPickerSelect from 'react-native-picker-select';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getFontSize } from '@/constants/Font';

interface Item {
    label: string;
    value: string;
}

export default function NativePicker({ placeholderLabel = 'Select an item. . .', items, onValueChange, selectedValue = null, faIcon, disabled = false } : {placeholderLabel?: string, items: Item[], onValueChange: (value: string) => void, selectedValue?: string | null, faIcon?: any, disabled?: boolean}) {
    const colorScheme = useColorScheme();
    const { width } = Dimensions.get('window');
    const isTablet = width >= 768;

    const placeholder = placeholderLabel === '' || placeholderLabel === ' ' || placeholderLabel === null ? {} : { label: placeholderLabel, value: null };

    return (
        <View
            onStartShouldSetResponder={(evt) => {
                // Only claim touch events if they're not directly on the picker
                const { locationX, locationY } = evt.nativeEvent;
                return locationX < 0 || locationX > width || locationY < 0;
            }}
            onMoveShouldSetResponder={() => false}
            onResponderTerminationRequest={() => true}
        >
            <RNPickerSelect
                useNativeAndroidPickerStyle={false}
                fixAndroidTouchableBug={true}
                items={items}
                onValueChange={onValueChange}
                Icon={() => <FontAwesomeIcon icon={faIcon || faChevronDown} style={{ color: Colors[colorScheme ?? 'light'].text}}  />}
                value={selectedValue}
                placeholder={placeholder}
                style={{
                    inputIOS: {
                        fontSize: getFontSize(16),
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                        borderWidth: 0.5,
                        borderColor: colorScheme === 'dark' ? '#4B5563' : '#D1D5DB',
                        backgroundColor: 'transparent',
                        borderRadius: 8,
                        color: Colors[colorScheme ?? 'light'].text,
                        paddingRight: 30,
                    },
                    placeholder: {
                        color: Colors[colorScheme ?? 'light'].text,
                    },
                    inputAndroid: {
                        fontSize: getFontSize(16),
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderWidth: 0.5,
                        borderColor: colorScheme === 'dark' ? '#4B5563' : '#D1D5DB',
                        backgroundColor: 'transparent',
                        borderRadius: 8,
                        color: Colors[colorScheme ?? 'light'].text,
                        paddingRight: 30,
                    },
                    iconContainer: {
                        top: isTablet ? 16 : 12,
                        right: 12,
                    }
                }}
                disabled={disabled}
            />
        </View>
    );
}

