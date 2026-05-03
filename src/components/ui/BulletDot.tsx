import { View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '@/theme'

export type BulletDotProps = {
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
}

export function BulletDot({
  size = 3,
  color = colors.text.tertiary,
  style,
}: BulletDotProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

export default BulletDot
