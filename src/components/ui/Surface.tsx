import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'
import { colors, radii, spacing, type RadiusKey, type SpacingKey } from '@/theme'

export type SurfaceVariant = 'surface' | 'surfaceElevated' | 'surfaceOverlay'

export type SurfaceProps = ViewProps & {
  variant?: SurfaceVariant
  radius?: RadiusKey
  padding?: SpacingKey
  border?: boolean
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

const variantBg: Record<SurfaceVariant, string> = {
  surface: colors.surface,
  surfaceElevated: colors.surfaceElevated,
  surfaceOverlay: colors.surfaceOverlay,
}

const variantBorder: Record<SurfaceVariant, string> = {
  surface: colors.border,
  surfaceElevated: colors.borderStrong,
  surfaceOverlay: colors.border,
}

export function Surface({
  variant = 'surface',
  radius = 'lg',
  padding,
  border = true,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const composed: ViewStyle = {
    backgroundColor: variantBg[variant],
    borderRadius: radii[radius],
    ...(padding !== undefined ? { padding: spacing[padding] } : null),
    ...(border
      ? { borderWidth: 1, borderColor: variantBorder[variant] }
      : null),
  }

  return (
    <View {...rest} style={[composed, style]}>
      {children}
    </View>
  )
}

export default Surface
