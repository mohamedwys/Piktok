import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from './Text'
import { Pressable, type PressableHaptic } from './Pressable'
import { GlassCard } from './GlassCard'
import { colors, spacing } from '@/theme'

export type IconButtonVariant = 'glass' | 'filled' | 'ghost'
export type IconButtonSize = 'sm' | 'md' | 'lg'

export type IconButtonProps = {
  icon: React.ReactNode
  onPress?: () => void
  variant?: IconButtonVariant
  size?: IconButtonSize
  label?: string
  haptic?: PressableHaptic
  accessibilityLabel: string
  testID?: string
  style?: StyleProp<ViewStyle>
}

const diameter: Record<IconButtonSize, number> = {
  sm: 36,
  md: 48,
  lg: 56,
}

export function IconButton({
  icon,
  onPress,
  variant = 'glass',
  size = 'md',
  label,
  haptic = 'light',
  accessibilityLabel,
  testID,
  style,
}: IconButtonProps) {
  const d = diameter[size]
  const radius = d / 2

  const circleBase: ViewStyle = {
    width: d,
    height: d,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  }

  let circle: React.ReactNode
  if (variant === 'glass') {
    circle = (
      <GlassCard variant="dark" radius="pill" style={circleBase}>
        {icon}
      </GlassCard>
    )
  } else if (variant === 'filled') {
    circle = (
      <View style={[circleBase, { backgroundColor: colors.brand }]}>{icon}</View>
    )
  } else {
    circle = (
      <View style={[circleBase, { backgroundColor: 'transparent' }]}>{icon}</View>
    )
  }

  const content = label ? (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      {circle}
      <Text variant="caption" color="primary">
        {label}
      </Text>
    </View>
  ) : (
    circle
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        haptic={haptic}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={style}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </View>
  )
}

export default IconButton
