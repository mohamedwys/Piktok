import { forwardRef } from 'react'
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { motion } from '@/theme'

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable)

export type PressableHaptic = 'light' | 'medium' | 'heavy'

const hapticImpact: Record<PressableHaptic, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
}

export type PressableProps = Omit<
  RNPressableProps,
  'style' | 'children'
> & {
  haptic?: PressableHaptic
  pressScale?: number
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  {
    haptic,
    pressScale = 0.96,
    onPressIn,
    onPressOut,
    onPress,
    style,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(pressScale, motion.spring.snappy)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motion.spring.snappy)
        onPressOut?.(e)
      }}
      onPress={(e) => {
        if (haptic && !disabled) {
          Haptics.impactAsync(hapticImpact[haptic]).catch(() => {})
        }
        onPress?.(e)
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  )
})

export default Pressable
