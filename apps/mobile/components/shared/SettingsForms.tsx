import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText';
import { Controller } from 'react-hook-form'; // Import necessary hooks
import NativePicker from '@/components/shared/NativePicker';
import { LEARNING_LANGUAGES_ARRAY, NATIVE_LANGUAGES_ARRAY, LEVELS_OPTIONS_ARRAY } from '@/constants/Lists';
import { GlobalFontStyleSheet } from '@/constants/Font';


const SettingsPicker = ({selectedValue, items, onValueChange, label, placeholderLabel, labelRight, disabled}: {selectedValue?: string | null, items?: {label: string, value: string}[], onValueChange: (value:string) => void, label: string, placeholderLabel: string, labelRight?: () => React.ReactNode, disabled?: boolean}) => {
    return (
        <>
            <View className="flex-row items-center mb-1">
            <Text style={GlobalFontStyleSheet.textBase} className="font-medium mb-1 text-gray-700 dark:text-gray-300">{label}</Text>
                {labelRight && labelRight()}
            </View>
            {items && (
                <NativePicker
                    selectedValue={selectedValue}
                    onValueChange={onValueChange}
                    items={items}
                    placeholderLabel={placeholderLabel}
                    disabled={disabled}
                />
            )}
        </>
    )
}

const FirstNameInput = ({label = 'What\'s your first name?', control}: {label?: string, control: any}) => {
    return (
        <>
            <ThemedText className="font-medium mb-1 text-gray-700 dark:text-gray-300" type="default">{label}</ThemedText>
            <Controller
                control={control}
                name="firstName"
                rules={{ required: { value: true, message: "First name is required" } }}
                render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                        <View className="border border-blue-500 rounded-lg overflow-hidden">
                            <TextInput
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            placeholder="Enter your first name"
                            className="p-2 text-gray-700 dark:text-gray-300"
                            style={GlobalFontStyleSheet.textInput}
                            />
                        </View>
                        { error && (<Text className="text-red-500 mt-1">{error.message}</Text> )}  
                    </>
                )}
            />
        </>
    )
};

const LearningLanguagePicker = ({onValueChange, label = 'What language do you want to learn?', control, rules}: {onValueChange: (value:string) => void, label?: string, control: any, rules: any}) => {
    return (
        <>
            <Controller
                control={control}
                name="learningLanguage" // Name for the form field
                rules={rules}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                        <Text style={GlobalFontStyleSheet.textBase} className="font-medium mb-1 text-gray-700 dark:text-gray-300">{label}</Text>
                        <NativePicker
                            selectedValue={value}
                            onValueChange={(value) => {
                                console.log('changed from learningLanguage: ', value);
                                onValueChange(value); // Call the parent function to handle fetch
                                onChange(value); // Update form state
                            }}
                            items={LEARNING_LANGUAGES_ARRAY}
                            placeholderLabel='Select language'
                        />
                        {/* Add error message */}
                        {error && (<Text className="text-red-500 mt-1">{error.message}</Text>)}
                    </>
                )}
            />
        </>
    );
};

const LanguageDialectPicker = ({onValueChange, label = 'What is your preferred dialect?', control, dialectOptions, rules}: {onValueChange: (value:string) => void, label?: string, control: any, dialectOptions: any, rules: any}) => {
    return (
        <Controller
            control={control}
            name="preferredDialect" // Name for the form field
            rules={rules}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
                <>
                    <Text style={GlobalFontStyleSheet.textBase} className="font-medium mb-1 text-gray-700 dark:text-gray-300">{label}</Text>
                    <NativePicker
                        selectedValue={value}
                        onValueChange={(value) => {
                            onValueChange(value); // Call the parent function to handle fetch
                            onChange(value); // Update form state
                        }}
                        items={dialectOptions}
                        placeholderLabel='Select dialect'
                    />
                    {error && <Text className="text-red-500 mt-1">{error.message}</Text>}
                </>
            )}
        />
    );
};

const NativeLanguagePicker = ({onValueChange, label = 'What language should we show translations in?', control, rules}: {onValueChange: (value:string) => void, label?: string, control: any, rules: any}) => {
    return (
        <Controller
            control={control}
            name="nativeLanguage" // Name for the form field
            rules={rules}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
                <>
                    <Text style={GlobalFontStyleSheet.textBase} className="font-medium mb-1 text-gray-700 dark:text-gray-300">{label}</Text>
                    <NativePicker
                        selectedValue={value}
                        onValueChange={(value) => {
                            onValueChange(value); // Call the parent function to handle fetch
                            onChange(value); // Update form state
                        }}
                        items={NATIVE_LANGUAGES_ARRAY}
                        placeholderLabel='Select language'
                    />
                    {error && <Text className="text-red-500 mt-1">{error.message}</Text>}
                </>
            )}
        />
    );
};

const LearningLevelPicker = ({onValueChange, label = "What's your current level?", control, rules}: {onValueChange: (value:string) => void, label?: string, control: any, rules: any}) => {
    return (
        <>
            <Text style={GlobalFontStyleSheet.textBase} className="font-medium mb-1 text-gray-700 dark:text-gray-300">{label}</Text>
            <Controller
                control={control}
                name="languageLevel" // Name for the form field
                rules={rules}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <>
                        <NativePicker
                            selectedValue={value}
                            onValueChange={(value) => {
                                onValueChange(value); // Call the parent function to handle fetch
                                onChange(value); // Update form state
                            }}
                            items={LEVELS_OPTIONS_ARRAY}
                            placeholderLabel='Select level'
                        />
                        {error && <Text className="text-red-500 mt-1">{error.message}</Text>}
                    </>
                )}
            />
        </>
    );
};

export const fieldLookupTable = {
    'learningLanguage': 'stream_language',
    'preferredDialect': 'preferred_dialect',
    'nativeLanguage': 'langua_native_language',
    'languageLevel': 'stream_language_level',
    'flashcardsOrdering': 'flashcards_ordering_technique',
}

export { FirstNameInput, LearningLanguagePicker, NativeLanguagePicker, LanguageDialectPicker, LearningLevelPicker, SettingsPicker };
