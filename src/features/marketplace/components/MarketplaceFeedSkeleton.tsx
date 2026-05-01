import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarketplaceFeedSkeleton(): React.ReactElement {
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const itemHeight = height - tabBarHeight;
  const topRowTop = insets.top + 78;

  const pulse = useSharedValue(0.6);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.95, { duration: 800 }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[styles.container, { height: itemHeight }]}>
      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.mediaBg, pulseStyle]}
      />

      <View style={[styles.topRow, { top: topRowTop }]}>
        <Animated.View style={[styles.sellerCard, pulseStyle]} />
        <Animated.View style={[styles.priceCard, pulseStyle]} />
      </View>

      <View style={styles.rail}>
        <Animated.View style={[styles.railCircle, styles.railBuy, pulseStyle]} />
        <Animated.View style={[styles.railLine, pulseStyle]} />
        <Animated.View style={[styles.railIcon, pulseStyle]} />
        <Animated.View style={[styles.railLine, pulseStyle]} />
        <Animated.View style={[styles.railIcon, pulseStyle]} />
        <Animated.View style={[styles.railLine, pulseStyle]} />
        <Animated.View style={[styles.railIcon, pulseStyle]} />
      </View>

      <View style={styles.bottomPanel}>
        <Animated.View style={[styles.titleLine, pulseStyle]} />
        <View style={styles.chipRow}>
          <Animated.View style={[styles.chip, pulseStyle]} />
          <Animated.View style={[styles.chip, pulseStyle]} />
          <Animated.View style={[styles.chip, pulseStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#000' },
  mediaBg: { backgroundColor: '#1a1a1a' },
  topRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  sellerCard: {
    flex: 1.5,
    height: 60,
    backgroundColor: '#262626',
    borderRadius: 14,
  },
  priceCard: {
    flex: 1,
    height: 90,
    backgroundColor: '#262626',
    borderRadius: 14,
  },
  rail: {
    position: 'absolute',
    right: 14,
    bottom: 20,
    alignItems: 'flex-end',
    gap: 14,
  },
  railBuy: { width: 56, height: 56, borderRadius: 28 },
  railCircle: { backgroundColor: '#FE2C55', opacity: 0.4 },
  railIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#262626',
  },
  railLine: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#262626',
  },
  bottomPanel: {
    position: 'absolute',
    left: 12,
    right: '30%',
    bottom: 24,
  },
  titleLine: {
    width: '70%',
    height: 22,
    borderRadius: 4,
    backgroundColor: '#262626',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    width: 70,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#262626',
  },
});
