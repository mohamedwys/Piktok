import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlassCard, Pressable, Text } from '@/components/ui';
import { colors, motion, spacing } from '@/theme';
import { formatActionCount } from '@/lib/format';

export type LikeButtonSize = 'md' | 'lg';

export type LikeButtonProps = {
  isLiked: boolean;
  count: number;
  onToggle: () => void;
  size?: LikeButtonSize;
  disabled?: boolean;
};

const SIZING: Record<LikeButtonSize, { diameter: number; iconSize: number }> = {
  md: { diameter: 48, iconSize: 22 },
  lg: { diameter: 56, iconSize: 26 },
};

const RING_DURATION_MS = 380;

export default function LikeButton({
  isLiked,
  count,
  onToggle,
  size = 'md',
  disabled = false,
}: LikeButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const { diameter, iconSize } = SIZING[size];

  const heartScale = useSharedValue(1);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (!isLiked) {
      heartScale.value = withSequence(
        withSpring(1.35, motion.spring.snappy),
        withSpring(1.0, motion.spring.gentle),
      );
      ringScale.value = 0;
      ringOpacity.value = 0.6;
      ringScale.value = withTiming(1, { duration: RING_DURATION_MS });
      ringOpacity.value = withTiming(0, { duration: RING_DURATION_MS });
    }
    onToggle();
  }, [disabled, heartScale, isLiked, onToggle, ringOpacity, ringScale]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const accessibilityLabel = isLiked
    ? t('actionRail.unlikeAriaLabel')
    : t('actionRail.likeAriaLabel', { count });

  return (
    <Pressable
      haptic="medium"
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: isLiked, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={{ alignItems: 'center' }}
    >
      <View
        style={{
          width: diameter,
          height: diameter,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GlassCard
          variant="dark"
          radius="pill"
          style={{
            width: diameter,
            height: diameter,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={heartStyle}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={iconSize}
              color={isLiked ? colors.brand : colors.text.primary}
            />
          </Animated.View>
        </GlassCard>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              borderRadius: diameter / 2,
              borderWidth: 2,
              borderColor: colors.brand,
            },
            ringStyle,
          ]}
        />
      </View>
      <Text
        variant="caption"
        color="primary"
        style={{ marginTop: spacing.xs, fontSize: 11 }}
      >
        {formatActionCount(count)}
      </Text>
    </Pressable>
  );
}
