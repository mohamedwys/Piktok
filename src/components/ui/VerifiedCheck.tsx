import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/theme'

export type VerifiedCheckProps = {
  size?: number
  style?: StyleProp<ViewStyle>
}

export function VerifiedCheck({ size = 14, style }: VerifiedCheckProps) {
  const iconSize = Math.max(8, Math.round(size * 0.7))
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.verified,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name="checkmark" size={iconSize} color={colors.text.primary} />
    </View>
  )
}

export default VerifiedCheck
