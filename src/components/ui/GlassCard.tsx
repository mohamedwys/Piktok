import { Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import {
  blur,
  colors,
  radii,
  spacing,
  type BlurIntensityKey,
  type GlassVariant,
  type RadiusKey,
  type SpacingKey,
} from '@/theme'

export type GlassCardProps = {
  variant?: GlassVariant
  intensity?: BlurIntensityKey
  radius?: RadiusKey
  padding?: SpacingKey
  border?: boolean
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
  testID?: string
  accessibilityLabel?: string
}

const isIOS = Platform.OS === 'ios'

export function GlassCard({
  variant = 'dark',
  intensity = 'regular',
  radius = 'lg',
  padding,
  border = true,
  style,
  children,
  testID,
  accessibilityLabel,
}: GlassCardProps) {
  const tokens = colors.glass[variant]
  const base: ViewStyle = {
    borderRadius: radii[radius],
    overflow: 'hidden',
    ...(padding !== undefined ? { padding: spacing[padding] } : null),
    ...(border ? { borderWidth: 1, borderColor: tokens.border } : null),
  }

  if (isIOS) {
    return (
      <BlurView
        tint="dark"
        intensity={blur.intensity[intensity]}
        style={[base, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </BlurView>
    )
  }

  return (
    <View
      style={[base, { backgroundColor: tokens.bg }, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  )
}

export default GlassCard
