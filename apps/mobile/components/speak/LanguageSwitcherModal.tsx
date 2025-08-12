import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { GlobalFontStyleSheet } from '@/constants/Font';
import {
  LEARNING_LANGUAGES_ARRAY,
  LANGUAGE_FLAGS,
  DIALECT_FLAGS,
  LANGUAGE_DIALECTS,
  AVAILABLE_LANGUAGES,
} from '@/constants/Lists';
import { UserSettingsContext } from '@/contexts/UserSettingsContext';
import * as Haptics from 'expo-haptics';
import cx from 'classnames';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: "I'm only just getting started" },
  { value: 'basic', label: 'Basic (A2)', description: 'I can handle relatively simple conversations' },
  { value: 'intermediate', label: 'Intermediate (B1)', description: 'I can chat about many things but struggle with fast/complex language' },
  { value: 'advanced', label: 'Advanced (B2+)', description: 'I want to get closer to a native level' },
];

interface LanguageSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  currentLanguage: string;
  currentDialect?: string;
  currentLanguageLevel?: string;
  onLanguageChange: (language: string, dialect?: string, level?: string) => Promise<void>;
}

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

export default function LanguageSwitcherModal({
  visible,
  onClose,
  currentLanguage,
  currentDialect,
  currentLanguageLevel,
  onLanguageChange,
}: LanguageSwitcherModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [selectedDialect, setSelectedDialect] = useState(currentDialect);
  const [selectedLevel, setSelectedLevel] = useState(currentLanguageLevel || 'intermediate');
  const [showLevelSelection, setShowLevelSelection] = useState(false);
  const [showDialectSelection, setShowDialectSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLanguage, setLoadingLanguage] = useState<string | null>(null);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const [starredLanguages, setStarredLanguages] = useState<string[]>([]);
  const [languageLevels, setLanguageLevels] = useState<Record<string, string>>({});
  const scrollViewRef = useRef<ScrollView>(null);

  // Load starred languages and language levels on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load starred languages
        const savedStarred = await AsyncStorage.getItem('starred_languages');
        if (savedStarred) {
          const starred = JSON.parse(savedStarred);
          setStarredLanguages(starred);
          
          // Auto-star current language if not already starred
          if (currentLanguage && !starred.includes(currentLanguage)) {
            const newStarred = [...starred, currentLanguage];
            setStarredLanguages(newStarred);
            await AsyncStorage.setItem('starred_languages', JSON.stringify(newStarred));
          }
        } else if (currentLanguage) {
          // No starred languages yet, star the current one
          const newStarred = [currentLanguage];
          setStarredLanguages(newStarred);
          await AsyncStorage.setItem('starred_languages', JSON.stringify(newStarred));
        }
        
        // Load language levels
        const savedLevels = await AsyncStorage.getItem('language_levels');
        if (savedLevels) {
          setLanguageLevels(JSON.parse(savedLevels));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, [currentLanguage]);

  const toggleStarred = async (language: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStarred = starredLanguages.includes(language)
      ? starredLanguages.filter(l => l !== language)
      : [...starredLanguages, language];
    
    setStarredLanguages(newStarred);
    try {
      await AsyncStorage.setItem('starred_languages', JSON.stringify(newStarred));
    } catch (error) {
      console.error('Error saving starred languages:', error);
    }
  };

  const filteredLanguages = React.useMemo(() => {
    return LEARNING_LANGUAGES_ARRAY.filter(lang =>
      lang.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Sort languages with starred ones first
  const sortedLanguages = React.useMemo(() => {
    return [...filteredLanguages].sort((a, b) => {
      const aStarred = starredLanguages.includes(a.value);
      const bStarred = starredLanguages.includes(b.value);
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      return 0;
    });
  }, [filteredLanguages, starredLanguages]);

  const dialectOptions = selectedLanguage && selectedLanguage in LANGUAGE_DIALECTS
    ? LANGUAGE_DIALECTS[selectedLanguage as keyof typeof LANGUAGE_DIALECTS]
    : null;

  useEffect(() => {
    if (selectedLanguage && !Object.keys(AVAILABLE_LANGUAGES).includes(selectedLanguage)) {
      setShowUnsupportedWarning(true);
    } else {
      setShowUnsupportedWarning(false);
    }
  }, [selectedLanguage]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      // Only reset if we're opening fresh (not already in a loading state from previous interaction)
      if (!isLoading) {
        setSelectedLanguage(currentLanguage);
        setSelectedDialect(currentDialect);
        setSelectedLevel(languageLevels[currentLanguage] || currentLanguageLevel || 'intermediate');
        setSearchQuery('');
        setLoadingLanguage(null);
        setShowLevelSelection(false);
        setShowDialectSelection(false);
      }
    } else {
      // Modal is closing - reset loading state for next time
      setIsLoading(false);
    }
  }, [visible]);

  const getLanguageFlag = (language: string, dialect?: string) => {
    if (dialect && DIALECT_FLAGS[dialect as keyof typeof DIALECT_FLAGS]) {
      return DIALECT_FLAGS[dialect as keyof typeof DIALECT_FLAGS];
    }
    return LANGUAGE_FLAGS[language as keyof typeof LANGUAGE_FLAGS] || '🌐';
  };

  const handleLanguageSelect = async (language: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedLanguage(language);
    // Always reset dialect when selecting a new language
    setSelectedDialect(undefined);
    
    // Load saved level for this language
    const savedLevel = languageLevels[language] || currentLanguageLevel || 'intermediate';
    setSelectedLevel(savedLevel);
    
    // Check if this language has dialects
    const hasDialects = language in LANGUAGE_DIALECTS;
    
    if (hasDialects) {
      // If has dialects, go to dialect selection first
      setShowDialectSelection(true);
    } else {
      // If no dialects, go directly to level selection
      setShowLevelSelection(true);
    }
    
    // Scroll to top
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleDialectSelect = async (dialect: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDialect(dialect);
    
    // Move from dialect selection to level selection
    setShowDialectSelection(false);
    setShowLevelSelection(true);
    
    // Scroll to top to show level selection
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };
  
  const handleLevelSelect = async (level: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLevel(level);
    setIsLoading(true);
    
    try {
      // Save level for this language
      const newLevels = { ...languageLevels, [selectedLanguage]: level };
      setLanguageLevels(newLevels);
      await AsyncStorage.setItem('language_levels', JSON.stringify(newLevels));
      
      // Auto-star the selected language if not already starred
      if (!starredLanguages.includes(selectedLanguage)) {
        const newStarred = [...starredLanguages, selectedLanguage];
        setStarredLanguages(newStarred);
        await AsyncStorage.setItem('starred_languages', JSON.stringify(newStarred));
      }
      
      // Apply the language change
      await onLanguageChange(selectedLanguage, selectedDialect, level);
      onClose();
    } catch (error) {
      console.error('Error changing language:', error);
      setIsLoading(false);
    }
  };


  const renderLanguageItem = ({ item }: { item: { label: string; value: string } }) => {
    const isSelected = item.value === selectedLanguage;
    const flag = getLanguageFlag(item.value);
    const isStarred = starredLanguages.includes(item.value);

    return (
      <>
        <View style={styles.languageItemContainer}>
          <TouchableOpacity
            style={[
              styles.languageItem,
              isSelected && styles.selectedItem,
              { borderColor: isSelected ? Colors[colorScheme ?? 'light'].tint : 'transparent' }
            ]}
            onPress={() => handleLanguageSelect(item.value)}
          >
            <Text style={styles.flagEmoji}>{flag}</Text>
            <Text
              style={[
                styles.languageText,
                { color: isDark ? Colors.dark.text : Colors.light.text },
                isSelected && { color: Colors[colorScheme ?? 'light'].tint }
              ]}
            >
              {item.label}
            </Text>
            {isSelected && loadingLanguage !== item.value && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={Colors[colorScheme ?? 'light'].tint}
                style={styles.checkIcon}
              />
            )}
            {loadingLanguage === item.value && (
              <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.starButton}
            onPress={() => toggleStarred(item.value)}
          >
            <Ionicons
              name={isStarred ? "star" : "star-outline"}
              size={20}
              color={isStarred ? "#FFD700" : (isDark ? Colors.dark.icon : Colors.light.icon)}
            />
          </TouchableOpacity>
        </View>
      </>
    );
  };


  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
              maxHeight: showLevelSelection ? (isTablet ? '70%' : '80%') : (isTablet ? '80%' : '90%'),
              width: isTablet ? '50%' : '90%',
            }
          ]}
        >
          <View style={styles.header}>
            {(showLevelSelection || showDialectSelection) && !isLoading && (
              <TouchableOpacity 
                onPress={() => {
                  if (showLevelSelection) {
                    setShowLevelSelection(false);
                    // If we have dialects, go back to dialect selection
                    if (dialectOptions && dialectOptions.length > 0) {
                      setShowDialectSelection(true);
                    }
                  } else if (showDialectSelection) {
                    setShowDialectSelection(false);
                  }
                }} 
                style={styles.backButton}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={isDark ? Colors.dark.text : Colors.light.text}
                />
              </TouchableOpacity>
            )}
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? Colors.dark.text : Colors.light.text }
              ]}
            >
              {showLevelSelection ? 'Select Your Level' : 
               showDialectSelection ? 'Select Dialect' : 
               'Choose Language'}
            </Text>
            {!isLoading && (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? Colors.dark.text : Colors.light.text}
                />
              </TouchableOpacity>
            )}
          </View>

          {!showLevelSelection && !showDialectSelection && (
            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={isDark ? Colors.dark.icon : Colors.light.icon}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: isDark ? Colors.dark.text : Colors.light.text,
                    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7'
                  }
                ]}
                placeholder="Search languages..."
                placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}
          

          {showUnsupportedWarning && (
            <View style={styles.warningContainer}>
              <View style={styles.warningIcon}>
                <Text style={styles.warningIconText}>!</Text>
              </View>
              <Text style={[styles.warningText, { color: isDark ? '#FFB545' : '#FF9500' }]}>
                {selectedLanguage === 'chinese' || selectedLanguage === 'japanese' ?
                  'Heads up: we\'re working on getting the app to work flawlessly with this language. For now, we recommend using the website.'
                  : 'This language isn\'t fully supported at this time (e.g. no transliteration).'
                }
              </Text>
            </View>
          )}

          <ScrollView 
            ref={scrollViewRef} 
            style={[
              styles.contentContainer,
              showLevelSelection && styles.levelContentContainer
            ]} 
            showsVerticalScrollIndicator={false}
          >
            {!showLevelSelection && !showDialectSelection ? (
              <FlatList
                data={sortedLanguages}
                renderItem={renderLanguageItem}
                keyExtractor={(item) => item.value}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            ) : showDialectSelection ? (
              <View style={{ flex: 1 }}>
                {/* Selected language summary */}
                <View style={styles.selectedSummary}>
                  <Text style={[styles.selectedSummaryText, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
                    {getLanguageFlag(selectedLanguage)} {LEARNING_LANGUAGES_ARRAY.find(l => l.value === selectedLanguage)?.label}
                  </Text>
                </View>
                
                {/* Dialect selection */}
                <View style={styles.dialectSection}>
                  <Text style={[styles.dialectTitle, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
                    Select your preferred dialect
                  </Text>
                  {dialectOptions?.map((dialectItem) => (
                    <TouchableOpacity
                      key={dialectItem.value}
                      style={[
                        styles.dialectItem,
                        selectedDialect === dialectItem.value && styles.selectedItem,
                        { borderColor: selectedDialect === dialectItem.value ? Colors[colorScheme ?? 'light'].tint : 'transparent' }
                      ]}
                      onPress={() => handleDialectSelect(dialectItem.value)}
                    >
                      <Text style={styles.flagEmoji}>{getLanguageFlag(selectedLanguage, dialectItem.value)}</Text>
                      <Text
                        style={[
                          styles.dialectText,
                          { color: isDark ? Colors.dark.text : Colors.light.text },
                          selectedDialect === dialectItem.value && { color: Colors[colorScheme ?? 'light'].tint }
                        ]}
                      >
                        {dialectItem.label}
                      </Text>
                      {selectedDialect === dialectItem.value && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={Colors[colorScheme ?? 'light'].tint}
                          style={styles.checkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {/* Selected language/dialect summary */}
                <View style={styles.selectedSummary}>
                  <Text style={[styles.selectedSummaryText, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
                    {getLanguageFlag(selectedLanguage, selectedDialect)} {LEARNING_LANGUAGES_ARRAY.find(l => l.value === selectedLanguage)?.label}
                    {selectedDialect && ` (${dialectOptions?.find(d => d.value === selectedDialect)?.label})`}
                  </Text>
                </View>
                
                {/* Level selection */}
                <View style={styles.levelSection}>
                  <Text style={[styles.levelTitle, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
                    Select your level
                  </Text>
                  {LANGUAGE_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level.value}
                      style={[
                        styles.levelItem,
                        selectedLevel === level.value && styles.selectedItem,
                        { borderColor: selectedLevel === level.value ? Colors[colorScheme ?? 'light'].tint : 'transparent' }
                      ]}
                      onPress={() => handleLevelSelect(level.value)}
                      disabled={isLoading}
                    >
                      <View style={styles.levelContent}>
                        <Text
                          style={[
                            styles.levelLabel,
                            { color: isDark ? Colors.dark.text : Colors.light.text },
                            selectedLevel === level.value && { color: Colors[colorScheme ?? 'light'].tint }
                          ]}
                        >
                          {level.label}
                        </Text>
                        <Text
                          style={[
                            styles.levelDescription,
                            { color: isDark ? Colors.gray[300] : Colors.gray[400] }
                          ]}
                        >
                          {level.description}
                        </Text>
                      </View>
                      {selectedLevel === level.value && !isLoading && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={Colors[colorScheme ?? 'light'].tint}
                          style={styles.checkIcon}
                        />
                      )}
                      {selectedLevel === level.value && isLoading && (
                        <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].tint} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Loading overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
              <Text style={[styles.loadingText, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
                Updating language settings...
              </Text>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  backButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  contentContainer: {
    maxHeight: 400,
  },
  levelContentContainer: {
    maxHeight: 500,
  },
  languageItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
  },
  starButton: {
    padding: 8,
  },
  selectedItem: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  flagEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  languageText: {
    fontSize: 16,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 8,
  },
  separator: {
    height: 8,
  },
  dialectSection: {
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  dialectTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  dialectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 6,
  },
  dialectText: {
    fontSize: 14,
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  warningIcon: {
    backgroundColor: '#FFB545',
    borderRadius: 12,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  warningIconText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
  },
  selectedSummary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 10,
  },
  selectedSummaryText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  levelSection: {
    paddingHorizontal: 8,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    marginBottom: 10,
  },
  levelContent: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});