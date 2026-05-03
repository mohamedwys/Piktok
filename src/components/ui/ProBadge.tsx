import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from './Text'
import { colors, radii, spacing, typography } from '@/theme'

export type ProBadgeSize = 'sm' | 'md'

export type ProBadgeProps = {
  size?: ProBadgeSize
  label?: string
  style?: StyleProp<ViewStyle>
}

const sizeMap: Record<
  ProBadgeSize,
  { paddingVertical: number; paddingHorizontal: number; fontSize: number }
> = {
  sm: {
    paddingVertical: 1,
    paddingHorizontal: spacing.xs + 2,
    fontSize: typography.size.xs - 1,
  },
  md: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    fontSize: typography.size.xs,
  },
}

export function ProBadge({ size = 'sm', label = 'PRO', style }: ProBadgeProps) {
  const sz = sizeMap[size]
  return (
    <View
      style={[
        {
          backgroundColor: colors.proBadge,
          borderRadius: radii.xs,
          paddingVertical: sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: colors.proBadgeText,
          fontSize: sz.fontSize,
          fontFamily: typography.family.sansBold,
          letterSpacing: typography.tracking.ultraWide,
          textTransform: 'uppercase',
          lineHeight: sz.fontSize * 1.1,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export default ProBadge
