import { View } from 'react-native'
import { Pressable, Text } from '@/components/ui'
import { colors, spacing } from '@/theme'

export type TabBarItemProps = {
  icon: React.ReactNode
  label: string
  active: boolean
  onPress: () => void
  onLongPress?: () => void
  badge?: boolean
  accessibilityLabel: string
  testID?: string
}

export function TabBarItem({
  icon,
  label,
  active,
  onPress,
  onLongPress,
  badge = false,
  accessibilityLabel,
  testID,
}: TabBarItemProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      haptic="light"
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <View>
        {icon}
        {badge ? (
          <View
            pointerEvents="none"
            // No surface-color border ring — the reference shows a clean
            // coral dot directly against the icon. The dot's small size and
            // contrast against the icon read fine without separation.
            style={{
              position: 'absolute',
              top: -1,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.brand,
            }}
          />
        ) : null}
      </View>
      <Text
        variant="caption"
        color={active ? 'primary' : 'secondary'}
        numberOfLines={1}
        // `allowFontScaling={false}` keeps the bar's vertical rhythm
        // intact even if the user has accessibility text scaling enabled.
        // The label still scales reasonably across devices via the
        // numberOfLines clamp.
        allowFontScaling={false}
        style={{
          marginTop: spacing.xs,
          fontSize: 11,
          lineHeight: 13,
          maxWidth: '100%',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default TabBarItem
