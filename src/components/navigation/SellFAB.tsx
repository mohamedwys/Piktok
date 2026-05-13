import { Platform, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text } from '@/components/ui'
import { colors, spacing } from '@/theme'

export const SELL_FAB_DIAMETER = 56

export type SellFABProps = {
  onPress: () => void
  /** Override the localized "Vendre" label. */
  label?: string
  accessibilityLabel?: string
}

export function SellFAB({ onPress, label, accessibilityLabel }: SellFABProps) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('tabs.sell')

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        haptic="medium"
        pressScale={0.92}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? resolvedLabel}
      >
        <View
          style={{
            width: SELL_FAB_DIAMETER,
            height: SELL_FAB_DIAMETER,
            borderRadius: SELL_FAB_DIAMETER / 2,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              },
              android: {
                elevation: 6,
              },
              default: {},
            }),
          }}
        >
          <Ionicons name="add" size={26} color={colors.brandText} />
        </View>
      </Pressable>
      <Text
        variant="caption"
        color="primary"
        style={{ marginTop: spacing.xs, fontSize: 11, lineHeight: 13 }}
      >
        {resolvedLabel}
      </Text>
    </View>
  )
}

export default SellFAB
