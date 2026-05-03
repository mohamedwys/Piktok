import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Image, type ImageSource } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Text } from './Text'
import { colors } from '@/theme'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type AvatarProps = {
  source?: ImageSource | number
  name?: string
  size?: AvatarSize
  /**
   * Optional pixel-precise diameter override. When provided, takes
   * precedence over `size`. Use sparingly — prefer the `size` token
   * scale unless matching a legacy component dimension.
   */
  diameter?: number
  verified?: boolean
  borderColor?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  accessibilityLabel?: string
}

const diameter: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
}

function initialOf(name: string | undefined): string {
  if (!name) return '?'
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?'
}

export function Avatar({
  source,
  name,
  size = 'md',
  diameter: diameterOverride,
  verified = false,
  borderColor,
  style,
  testID,
  accessibilityLabel,
}: AvatarProps) {
  const d = diameterOverride ?? diameter[size]
  const radius = d / 2
  const hasImage = source !== undefined && source !== null

  const wrapperStyle: ViewStyle = {
    width: d,
    height: d,
    borderRadius: radius,
    backgroundColor: hasImage ? colors.surfaceElevated : colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(borderColor !== undefined ? { borderWidth: 2, borderColor } : null),
  }

  const initialFontSize = Math.round(d * 0.42)

  const verifiedSize = Math.max(14, Math.round(d * 0.32))
  const verifiedIconSize = Math.round(verifiedSize * 0.7)

  return (
    <View style={style} testID={testID} accessibilityLabel={accessibilityLabel}>
      <View style={wrapperStyle}>
        {hasImage ? (
          <Image
            source={source}
            style={{ width: d, height: d }}
            contentFit="cover"
          />
        ) : (
          <Text
            variant="title"
            color="primary"
            style={{ fontSize: initialFontSize, lineHeight: initialFontSize * 1.1 }}
          >
            {initialOf(name)}
          </Text>
        )}
      </View>
      {verified ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: verifiedSize,
            height: verifiedSize,
            borderRadius: verifiedSize / 2,
            backgroundColor: colors.verified,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          <Ionicons
            name="checkmark"
            size={verifiedIconSize}
            color={colors.text.primary}
          />
        </View>
      ) : null}
    </View>
  )
}

export default Avatar
