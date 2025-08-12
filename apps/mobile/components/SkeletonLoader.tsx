import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonLoaderProps {
  styleType?: 'default' | 'simple'; // 'default' for multiple sections, 'simple' for single layout
  sections?: {
    rows: number;
    showTitle?: boolean;
    showButton?: boolean;
  }[];
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  styleType = 'default',
  sections = [{ rows: 3, showTitle: true, showButton: true }],
}) => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['hsl(200, 20%, 80%)', 'hsl(200, 20%, 95%)'],
  });

  if (styleType === 'simple') {
    return (
      <View style={styles.simpleSkeletonContainer}>
        <Animated.View style={[styles.simpleSkeletonText, { backgroundColor }]} />
        <Animated.View style={[styles.simpleSkeletonTextBody, { backgroundColor }]} />
        <Animated.View style={[styles.simpleSkeletonFooter, { backgroundColor }]} />
      </View>
    );
  }

  // Default style with sections
  const renderSkeletonRow = () => (
    <View style={styles.skeletonRow}>
      <Animated.View style={[styles.skeletonText, { backgroundColor, width: '60%' }]} />
      <Animated.View style={[styles.skeletonText, { backgroundColor, width: '30%' }]} />
    </View>
  );

  const renderSection = (section: SkeletonLoaderProps['sections'][0], index: number) => (
    <React.Fragment key={index}>
      {section.showTitle && <Animated.View style={[styles.skeletonTitle, { backgroundColor }]} />}
      {[...Array(section.rows)].map((_, rowIndex) => (
        <React.Fragment key={rowIndex + '-' + index}>{renderSkeletonRow()}</React.Fragment>
      ))}
      {section.showButton && <Animated.View style={[styles.skeletonButton, { backgroundColor }]} />}
      {index < sections.length - 1 && <Animated.View style={[styles.skeletonDivider, { backgroundColor }]} />}
    </React.Fragment>
  );

  return (
    <View style={styles.skeletonContainer}>
      {sections.map(renderSection)}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: {
    marginTop: 10,
  },
  skeletonTitle: {
    width: '70%',
    height: 24,
    marginBottom: 16,
    borderRadius: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skeletonText: {
    height: 16,
    borderRadius: 4,
  },
  skeletonDivider: {
    width: '100%',
    height: 1,
    marginVertical: 16,
  },
  skeletonButton: {
    width: '40%',
    height: 36,
    borderRadius: 18,
    marginBottom: 16,
  },
  simpleSkeletonContainer: {
    marginTop: 10,
  },
  simpleSkeletonText: {
    width: '100%',
    height: 10,
    marginBottom: 5,
    borderRadius: 5,
  },
  simpleSkeletonTextBody: {
    width: '75%',
    height: 10,
    marginBottom: 5,
    borderRadius: 5,
  },
  simpleSkeletonFooter: {
    width: '30%',
    height: 10,
    marginBottom: 5,
    borderRadius: 5,
  },
});

export default SkeletonLoader;
