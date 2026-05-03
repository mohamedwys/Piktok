import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from './Text'
import { Pressable } from './Pressable'
import { GlassCard } from './GlassCard'
import { colors, radii, spacing, typography } from '@/theme'

export type ChipVariant = 'glass' | 'glassStrong' | 'filled' | 'outlined'
export type ChipSize = 'sm' | 'md'

export type ChipProps = {
  label: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  variant?: ChipVariant
  size?: ChipSize
  onPress?: () => void
  accessibilityLabel?: string
  testID?: string
  style?: StyleProp<ViewStyle>
}

const sizeMap: Record<
  ChipSize,
  { paddingVertical: number; paddingHorizontal: number; fontSize: number; gap: number }
> = {
  sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: typography.size.xs,
    gap: spacing.xs,
  },
  md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.sm,
    gap: spacing.sm,
  },
}

export function Chip({
  label,
  leadingIcon,
  trailingIcon,
  variant = 'glass',
  size = 'md',
  onPress,
  accessibilityLabel,
  testID,
  style,
}: ChipProps) {
  const sz = sizeMap[size]

  const inner: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sz.gap,
    paddingVertical: sz.paddingVertical,
    paddingHorizontal: sz.paddingHorizontal,
  }

  const labelColor =
    variant === 'filled' ? colors.brandText : colors.text.primary

  const labelNode = (
    <Text
      variant={size === 'sm' ? 'label' : 'caption'}
      style={{
        fontSize: sz.fontSize,
        color: labelColor,
        ...(size === 'sm' ? { letterSpacing: 0, textTransform: 'none' as const } : null),
      }}
    >
      {label}
    </Text>
  )

  const content = (
    <>
      {leadingIcon}
      {labelNode}
      {trailingIcon}
    </>
  )

  let body: React.ReactNode
  if (variant === 'glass' || variant === 'glassStrong') {
    body = (
      <GlassCard
        variant={variant === 'glass' ? 'dark' : 'darkStrong'}
        radius="pill"
        style={inner}
      >
        {content}
      </GlassCard>
    )
  } else if (variant === 'filled') {
    body = (
      <View
        style={[
          inner,
          { backgroundColor: colors.brand, borderRadius: radii.pill },
        ]}
      >
        {content}
      </View>
    )
  } else {
    body = (
      <View
        style={[
          inner,
          {
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.4)',
            backgroundColor: 'transparent',
          },
        ]}
      >
        {content}
      </View>
    )
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={style}
      >
        {body}
      </Pressable>
    )
  }

  return (
    <View
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </View>
  )
}

export default Chip
