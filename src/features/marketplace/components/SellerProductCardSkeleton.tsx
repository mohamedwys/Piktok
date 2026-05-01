import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export default function SellerProductCardSkeleton(): React.ReactElement {
  const pulse = useSharedValue(0.6);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.95, { duration: 800 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.image, pulseStyle]} />
      <View style={styles.info}>
        <Animated.View style={[styles.title, pulseStyle]} />
        <Animated.View style={[styles.price, pulseStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 0.7,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  image: { width: '100%', height: '70%', backgroundColor: '#262626' },
  info: { padding: 8, gap: 4 },
  title: {
    width: '80%',
    height: 12,
    borderRadius: 3,
    backgroundColor: '#262626',
  },
  price: {
    width: '40%',
    height: 14,
    borderRadius: 3,
    backgroundColor: '#262626',
  },
});
