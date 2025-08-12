import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, RefreshControl, Dimensions, StyleSheet, Text } from 'react-native';
import { ThemedText } from '@/components/shared/ThemedText';
import { ThemedView } from '@/components/shared/ThemedView';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { 
  faHeart, faTimes, faPlus, faSync, faDownload,
  faMoon, faClock, faChevronLeft, faMagicWandSparkles, faXmark,
  
} from '@fortawesome/pro-solid-svg-icons';
import { faTrash, faPencil } from '@fortawesome/pro-regular-svg-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { GlobalFontStyleSheet } from '@/constants/Font';
import { useAuth } from '@/contexts/AuthContext';
import Notification from '@/components/Notification';
import { router } from 'expo-router';
import MemoriesService, { Memory, Category } from '@/services/MemoriesService';
import MemoriesHelper from '@/utils/MemoriesHelper';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutUp, useAnimatedStyle, withSpring, useSharedValue, interpolate, Extrapolate } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import MemoryModal from '@/components/MemoryModal';
import { colorScheme } from 'nativewind';

const { width: screenWidth } = Dimensions.get('window');

// Determine bento cell size for better fitting
const getCellSize = (index: number): 'small' | 'medium' | 'large' => {
  // Create a pattern that ensures cards fit together
  // Large cards take full width, medium cards take ~half, small cards take ~third
  if (index === 0) return 'large'; // First card is always large
  
  // Pattern for better fitting: large, medium+medium, small+small+small, repeat
  const position = (index - 1) % 6; // 6-card pattern
  
  if (position === 0) return 'large'; // Every 6th card (after first) is large
  if (position === 1 || position === 2) return 'medium'; // 2 medium cards side by side
  return 'small'; // 3 small cards in a row
};



export default function MemoriesScreen() {
  const { token } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? Colors.dark.text : Colors.light.text;

  const [memories, setMemories] = useState<Memory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [initialMemoryCount, setInitialMemoryCount] = useState(0);
  const [pollingProgress, setPollingProgress] = useState(0);
  const [newMemoriesFound, setNewMemoriesFound] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null); // Track which memory is being deleted
  const [deletingAll, setDeletingAll] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [saving, setSaving] = useState(false);

  // Animations
  const headerOpacity = useSharedValue(0);
  const statsScale = useSharedValue(0.8);
  const processingIconRotation = useSharedValue(0);
  
  useEffect(() => {
    headerOpacity.value = withSpring(1, { damping: 15, stiffness: 100 });
    statsScale.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  // Processing icon rotation animation
  useEffect(() => {
    if (processing) {
      processingIconRotation.value = withSpring(360, { 
        damping: 8, 
        stiffness: 100 
      });
    } else {
      processingIconRotation.value = 0;
    }
  }, [processing]);

  // Fetching routines
  const fetchMemories = async () => {
    if (!token) return;
    try {
      const data = await new MemoriesService(token).fetchMemories();
      console.log('Fetched memories:', data);
      setMemories(data.memories || []);
    } catch (error) { 
      console.error('Error fetching memories:', error);
      // Fallback to mock data for testing UI
      const mockMemories = [
        {
          id: 1,
          content: "I love traveling to new countries and experiencing different cultures",
          category: "travel",
          category_label: "Travel",
          date: "2024-01-15",
          created_at: "2024-01-15T10:30:00Z",
          updated_at: "2024-01-15T10:30:00Z"
        },
        {
          id: 2,
          content: "I work as a software developer and enjoy building mobile apps",
          category: "work",
          category_label: "Work",
          date: "2024-01-14",
          created_at: "2024-01-14T09:15:00Z",
          updated_at: "2024-01-14T09:15:00Z"
        },
        {
          id: 3,
          content: "I have a passion for cooking Italian cuisine",
          category: "interests",
          category_label: "Interests",
          date: "2024-01-13",
          created_at: "2024-01-13T16:45:00Z",
          updated_at: "2024-01-13T16:45:00Z"
        }
      ];
      setMemories(mockMemories);
      setNotification({ message: 'Using demo data - API not available', type: 'success' }); 
    }
  };
  const fetchCategories = async () => {
    if (!token) return;
    try {
      const data = await new MemoriesService(token).fetchCategories();
      console.log('Fetched categories:', data);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to mock categories
      const mockCategories = [
        { key: "travel", label: "Travel", count: 1 },
        { key: "work", label: "Work", count: 1 },
        { key: "interests", label: "Interests", count: 1 }
      ];
      setCategories(mockCategories);
    }
  };

  const extractMemories = async () => {
    if (!token) return;
    setExtracting(true);
    try {
      // Store initial memory count before extraction
      setInitialMemoryCount(memories.length);
      setNewMemoriesFound(0);
      setPollingProgress(0);
      
      const { message } = await new MemoriesService(token).extractMemories();
      setNotification({ message, type: 'success' });
      setProcessing(true); // This will trigger the useEffect to start polling
    } catch (e) {
      setNotification({ message: e instanceof Error ? e.message : 'Extraction failed', type: 'error' });
    } finally { setExtracting(false); }
  };

  // Enhanced polling mechanism with progress tracking and better UI feedback
  const startPollingMemories = () => {
    let pollInterval: NodeJS.Timeout;
    const startTime = Date.now();
    const pollDuration = 5000; // 5 seconds
    let pollCount = 0;

    const poll = async () => {
      try {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / pollDuration) * 100, 100);
        setPollingProgress(progress);

        // Check if 5 seconds have passed
        if (elapsed >= pollDuration) {
          setProcessing(false);
          setPollingProgress(100);
          
          // Final completion message with animation
          setTimeout(() => {
            if (newMemoriesFound > 0) {
              setNotification({ 
                message: `🎉 Extraction complete! Found ${newMemoriesFound} new memories`, 
                type: 'success' 
              });
            } else {
              setNotification({ 
                message: '✅ Extraction complete! No new memories found this time', 
                type: 'success' 
              });
            }
            setPollingProgress(0);
            setNewMemoriesFound(0);
          }, 300);
          
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
        
        // Fetch latest memories
        const data = await new MemoriesService(token!).fetchMemories();
        const currentCount = data.memories?.length || 0;
        const newCount = currentCount - initialMemoryCount;
        
        console.log(`Polling (${pollCount + 1}):`, currentCount, 'vs initial:', initialMemoryCount, 'new:', newCount);
        
        // Update memories and new count if we got new ones
        if (data.memories && newCount > 0) {
          setMemories(data.memories);
          setNewMemoriesFound(newCount);
          // Also refresh categories to update counts
          fetchCategories();
        }
        
        pollCount++;
        
      } catch (error) {
        console.error('Error polling memories:', error);
        // Continue polling even on error - might be temporary
      }
    };

    // Poll immediately, then every 1 second for 5 seconds total
    poll();
    pollInterval = setInterval(poll, 1000);

    // Return cleanup function
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      setPollingProgress(0);
    };
  };

  // Cleanup polling on component unmount or when processing stops
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    if (processing && token) {
      cleanup = startPollingMemories();
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [processing]); // Only re-run if processing state changes

  const deleteAll = () => Alert.alert(
    'Delete All Memories',
    'This cannot be undone.',
    [{ text:'Cancel', style:'cancel' },{ text:'Delete', style:'destructive', onPress: async () => {
      setDeletingAll(true);
      try {
        const { message } = await new MemoriesService(token!).deleteAllMemories();
        setNotification({ message, type: 'success' });
        setMemories([]);
        setCategories([]);
      } catch (e) { 
        setNotification({ message: e instanceof Error ? e.message : 'Delete failed', type: 'error' }); 
      } finally {
        setDeletingAll(false);
      }
    }}]
  );

  const deleteMemory = async (memoryId: number) => {
    setDeleting(memoryId);
    try {
      const { message } = await new MemoriesService(token!).deleteMemory(memoryId);
      setNotification({ message, type: 'success' });
      // Remove the deleted memory from the local state
      setMemories(prevMemories => prevMemories.filter(memory => memory.id !== memoryId));
      // Refresh categories to update counts
      fetchCategories();
    } catch (e) {
      setNotification({ message: e instanceof Error ? e.message : 'Failed to delete memory', type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveMemory = async (memoryData: { content: string; category: string; date?: string }) => {
    setSaving(true);
    try {
      if (editingMemory) {
        // Update existing memory
        const { memory: updatedMemory, message } = await new MemoriesService(token!).updateMemory(
          editingMemory.id,
          memoryData
        );
        setNotification({ message, type: 'success' });
        // Update the memory in local state
        setMemories(prevMemories =>
          prevMemories.map(memory =>
            memory.id === editingMemory.id ? updatedMemory : memory
          )
        );
      } else {
        // Create new memory
        const { memory: newMemory, message } = await new MemoriesService(token!).createMemory(memoryData);
        setNotification({ message, type: 'success' });
        // Add the new memory to local state
        setMemories(prevMemories => [newMemory, ...prevMemories]);
      }
      // Refresh categories to update counts
      fetchCategories();
    } catch (e) {
      setNotification({ message: e instanceof Error ? e.message : 'Failed to save memory', type: 'error' });
      throw e; // Re-throw to prevent modal from closing
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setEditingMemory(null);
    setModalVisible(true);
  };

  const openEditModal = (memory: Memory) => {
    setEditingMemory(memory);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingMemory(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMemories(), fetchCategories()]);
    setRefreshing(false);
  };

  useEffect(() => { if (token) Promise.all([fetchMemories(), fetchCategories()]).finally(() => setLoading(false)); }, [token]);

  const filtered = selectedCategory ? memories.filter(m => m.category === selectedCategory) : memories;
  console.log('Filtered memories:', filtered.length, 'Total memories:', memories.length);

  // Animated styles
  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value, transform:[{ translateY: interpolate(headerOpacity.value,[0,1],[20,0],Extrapolate.CLAMP) }] }));
  const statsStyle = useAnimatedStyle(() => ({ transform:[{ scale: statsScale.value }] }));
  const processingIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${processingIconRotation.value}deg` }]
  }));

  if (loading) {
    return (
      <ThemedView style={styles.fullCenter}>
        <Animated.View entering={FadeIn.duration(600)}>
          <ThemedText style={{ color: textColor, ...GlobalFontStyleSheet.textLg }}>
            Loading facts about you...
          </ThemedText>
        </Animated.View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.screen, { backgroundColor: isDark?Colors.dark.background:'#fff' }]}>      
      {/* Enhanced Scan Button */}
      <TouchableOpacity 
        style={[
          styles.scanBtn, 
          (extracting || processing) && styles.scanBtnDisabled
        ]} 
        onPress={extractMemories} 
        disabled={extracting || processing}
        activeOpacity={0.8}
      >
        {extracting ? (
          <Animated.View style={{ marginRight: 8 }}>
            <FontAwesomeIcon icon={faSync} size={16} color="#fff"/>
          </Animated.View>
        ) : processing ? (
          <Animated.View style={{ marginRight: 8 }}>
            <FontAwesomeIcon icon={faMagicWandSparkles} size={16} color="#fff"/>
          </Animated.View>
        ) : (
          <FontAwesomeIcon icon={faMagicWandSparkles} size={16} color="#fff" style={{ marginRight: 8 }}/>
        )}
        <Text style={{ 
          ...GlobalFontStyleSheet.textLg, 
          color: '#fff',
          fontFamily: 'Lato-Bold'
        }}>
          {extracting 
            ? 'Starting extraction...' 
            : processing 
              ? 'Scanning...' 
              : 'Scan for new facts'
          }
        </Text>
      </TouchableOpacity>

      {/* Fixed Header */}
      <Animated.View style={[styles.header, headerStyle]}>          
        <ThemedText style={{ color:textColor, ...GlobalFontStyleSheet.text2Xl, fontFamily:'Lato-Bold', marginBottom:8 }}>Facts about you</ThemedText>
        <ThemedText style={{ color:textColor, ...GlobalFontStyleSheet.textSm, lineHeight:18 }}>
        Conversations are analysed periodically to identify facts that may help conversations feel 
        more natural. You can also add facts manually or delete them. Note that the AI won't always 
        remember every fact listed here, and in certain chats, like roleplays, facts about you are not 
        provided to the AI.
        </ThemedText>
      </Animated.View>

      {/* Fixed Action Buttons */}
      <Animated.View style={[styles.actions, statsStyle]}>          
        <TouchableOpacity style={styles.actionBtn} onPress={openCreateModal}>
          <FontAwesomeIcon icon={faPlus} size={16} color={textColor}/>
          <Text style={[styles.actionText, {color:textColor}]}>Add fact</Text>
        </TouchableOpacity>
        {memories.length>0 && (
          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={deleteAll} 
            disabled={deletingAll}
          >
            <Text style={styles.deleteText}>
              {deletingAll ? 'Deleting...' : 'Delete all'}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Enhanced Processing Status */}
      {processing && (
        <Animated.View entering={SlideInDown.duration(400)} exiting={SlideOutUp.duration(300)} style={styles.processing}>          
          <Animated.View style={[styles.processingIcon, processingIconStyle]}>
            <FontAwesomeIcon icon={faMagicWandSparkles} size={16} color="#1e3a8a"/>
          </Animated.View>
          <View style={styles.processingContent}>
            <View style={styles.processingHeader}>
              <ThemedText style={styles.processingText}>Scanning conversations</ThemedText>
              {newMemoriesFound > 0 && (
                <Animated.View entering={FadeIn.duration(300)} style={styles.memoryCounter}>
                  <ThemedText style={styles.memoryCountText}>+{newMemoriesFound}</ThemedText>
                </Animated.View>
              )}
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    width: `${pollingProgress}%`
                  }
                ]}
              />
            </View>
            
            <ThemedText style={styles.processingSubtext}>
              {newMemoriesFound > 0 
                ? `Found ${newMemoriesFound} new ${newMemoriesFound === 1 ? 'memory' : 'memories'}...`
                : 'Looking for new facts about you...'
              }
            </ThemedText>
          </View>
        </Animated.View>
      )}

      {/* Scrollable Memories List */}
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#3b82f6']} // Android
            tintColor={colorScheme === 'dark' ? '#3b82f6' : '#2563eb'} // iOS
            title="Refreshing memories..."
            titleColor={textColor}
          />
        } 
        showsVerticalScrollIndicator={false}
        className="border-t rounded-t-xl border-gray-50 dark:border-gray-700"
      >
        <View style={styles.cardsContainer}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>              
              <ThemedText style={[GlobalFontStyleSheet.textXl,{color:textColor,fontFamily:'Lato-Bold'}]}>No memories yet</ThemedText>
              <ThemedText style={[GlobalFontStyleSheet.textBase,{color:textColor,opacity:0.7,textAlign:'center',marginTop:8}]}>Start by scanning for facts from your chat conversations or add them manually.</ThemedText>
            </View>
          ) : filtered.map((memory, idx) => (
            <Animated.View 
              key={memory.id} 
              entering={FadeIn.delay(idx * 100).duration(400)} 
              style={styles.cardContainer}
            >                
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={{ flex: 1 }}
              >
                <View 
                  className="flex-1 p-2 border-b border-gray-200 dark:border-gray-700 rounded-xl"
                >                    
                  <View style={styles.cardHeader}>
                    <View style={[
                      styles.badge,
                    ]}>
                      <FontAwesomeIcon 
                        icon={MemoriesHelper.getCategoryIcon(memory.category)} 
                        size={14} 
                        color={MemoriesHelper.categoryColorValue(memory.category)}
                        style={{ marginRight: 6 }}
                      />
                      <ThemedText style={{
                        color: MemoriesHelper.categoryColorValue(memory.category),
                        fontFamily: 'Lato-Bold',
                        fontSize: 12
                      }}>
                        {memory.category_label || memory.category}
                      </ThemedText>
                    </View>
                    
                    <View style={styles.cardActions}>
                      <TouchableOpacity 
                        onPress={() => openEditModal(memory)} 
                        style={[
                          styles.iconBtn,
                        ]}
                      >
                        <FontAwesomeIcon 
                          icon={faPencil} 
                          size={14} 
                          color={textColor}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          if (deleting === memory.id) return; // Prevent multiple clicks
                          Alert.alert(
                            'Delete Memory',
                            'Are you sure you want to delete this memory?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => {
                                deleteMemory(memory.id);
                              }},
                            ]
                          );
                        }} 
                        style={[
                          styles.iconBtn,
                          deleting === memory.id && { opacity: 0.5 }
                        ]}
                        disabled={deleting === memory.id}
                      >
                        <FontAwesomeIcon 
                          icon={deleting === memory.id ? faSync : faTrash} 
                          size={14} 
                          color={ isDark ? '#D54444' : '#ef4444'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <ThemedText 
                    style={{
                      fontFamily: 'Lato-Bold',
                      fontSize: 16,
                      lineHeight: 22,
                      color: textColor,
                      marginBottom: 12
                    }}
                  >
                    {memory.content}
                  </ThemedText>
                  
                  <View style={styles.dateRow}>
                    <FontAwesomeIcon 
                      icon={faClock} 
                      size={12} 
                      color={textColor} 
                      style={{opacity: 0.5, marginRight: 6}}
                    />
                    <ThemedText style={{
                      opacity: 0.5, 
                      fontSize: 12,
                      color: textColor
                    }}>
                      {(() => {
                        // Parse date as local date to avoid timezone issues
                        const dateParts = memory.date.split('-');
                        const year = parseInt(dateParts[0]);
                        const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
                        const day = parseInt(dateParts[2]);
                        const localDate = new Date(year, month, day);
                        
                        return localDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        });
                      })()}
                    </ThemedText>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
      
      {/* Memory Modal */}
      <MemoryModal
        isVisible={modalVisible}
        onClose={closeModal}
        onSave={handleSaveMemory}
        memory={editingMemory}
        categories={categories}
        loading={saving}
      />
      
      {notification && <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification(null)}/>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fullCenter: { flex:1, justifyContent:'center', alignItems:'center' },
  screen: { flex:1, paddingTop:20 },
     header: { paddingHorizontal:16, paddingBottom:12, paddingTop: 2 },
   actions: { flexDirection:'row', paddingHorizontal:16, marginBottom:12, alignItems:'center' },
   scrollContainer: { flex:1 },
  actionBtn: { flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:12, borderRadius:12, borderWidth:1, borderColor:'#ccc', marginRight:8 },
  actionText: { marginLeft:6, fontSize:14 },
  deleteBtn: { paddingVertical:8, paddingHorizontal:12, borderRadius:12, borderWidth:1, borderColor: colorScheme.get() === 'dark' ? '#D54D44' : '#ffe2e2' },
  deleteText: { color: colorScheme.get() === 'dark' ? '#D54444' : '#ef4444', fontSize:14 },
  scanBtn: { 
    position:'absolute', 
    left:60, 
    right:60, 
    bottom:40, 
    zIndex:100, 
    backgroundColor: colorScheme.get() === 'dark' ? '#2E47F6' : '#3b82f6', 
    borderRadius:20, 
    flexDirection:'row', 
    justifyContent:'center', 
    alignItems:'center', 
    padding:14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  scanBtnDisabled: {
    opacity: 0.7,
    backgroundColor: colorScheme.get() === 'dark' ? '#64748b' : '#94a3b8',
  },
  processing: { 
    flexDirection:'row', 
    alignItems:'flex-start', 
    backgroundColor:'#dbeafe', 
    margin:16, 
    padding:16, 
    borderRadius:16,
    borderWidth: 1,
    borderColor: '#93c5fd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  processingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  processingContent: { flex: 1 },
  processingHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 8
  },
  processingText: { 
    fontSize: 15, 
    color: '#1e3a8a', 
    fontFamily: 'Lato-Bold' 
  },
  memoryCounter: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center'
  },
  memoryCountText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Lato-Bold'
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#bfdbfe',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  processingSubtext: { 
    fontSize: 13, 
    color: '#1e3a8a', 
    opacity: 0.8,
    lineHeight: 18
  },
     cardsContainer: { paddingHorizontal:16, paddingBottom:120, paddingTop:8 },
   empty: { flex:1, alignItems:'center', marginTop:40 },
   cardContainer: { marginBottom:16, borderRadius:16 },
   card: { backgroundColor:'#fff', padding:16, borderRadius:16, borderWidth:1 },
   cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
   badge: { borderRadius:12, paddingHorizontal:8, paddingVertical:4, flexDirection:'row', alignItems:'center' },
   dateRow: { flexDirection:'row', alignItems:'center' },
   cardActions: { flexDirection:'row', gap:8 },
   iconBtn: { padding:8, borderRadius:8 }
});
                           