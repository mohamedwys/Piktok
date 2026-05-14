import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { IconButton, Pressable, Text } from '@/components/ui'
import { colors, spacing, zIndex as zIndexTokens } from '@/theme'
import { getFeatureFlag } from '@/lib/posthog'
import LocationChip from './LocationChip'

/**
 * Visual height of the header content (excluding top safe-area inset).
 * Now spans two rows: the tab/search row + the LocationChip row.
 * Consumers (e.g. ProductFeedItem) use this to anchor overlays just
 * below the header.
 */
const TAB_ROW_HEIGHT = 48
const LOCATION_ROW_HEIGHT = 40
export const MARKETPLACE_HEADER_ROW_HEIGHT =
  TAB_ROW_HEIGHT + LOCATION_ROW_HEIGHT

/**
 * On wide screens (iPad portrait/landscape) the centered tab cluster
 * + search button stretch across acres of negative space. Cluster
 * the chrome into a centered max-width region so it stays anchored
 * near the eye-line on phones AND tablets.
 */
const HEADER_MAX_CONTENT_WIDTH = 640

export type MarketplaceTabId = 'pour-toi' | 'marketplace'

export type MarketplaceHeaderProps = {
  activeTab: MarketplaceTabId
  onPressForYou: () => void
  onPressMarketplace: () => void
  onPressSearch: () => void
  onPressLocation?: () => void
  filterCount?: number
  style?: StyleProp<ViewStyle>
}

type TabItemProps = {
  label: string
  active: boolean
  onPress: () => void
}

function TabItem({ label, active, onPress }: TabItemProps) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      hitSlop={spacing.sm}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <View style={{ alignItems: 'center' }}>
        <Text
          variant="title"
          weight={active ? 'semibold' : 'medium'}
          color={active ? 'primary' : 'tertiary'}
        >
          {label}
        </Text>
        <View
          style={{
            marginTop: spacing.xs,
            height: 2,
            width: '100%',
            borderRadius: 1,
            backgroundColor: active ? colors.text.primary : 'transparent',
          }}
        />
      </View>
    </Pressable>
  )
}

export function MarketplaceHeader({
  activeTab,
  onPressForYou,
  onPressMarketplace,
  onPressSearch,
  onPressLocation,
  filterCount = 0,
  style,
}: MarketplaceHeaderProps) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { t } = useTranslation()

  // Kill switch read once at mount. Default = true so a Posthog
  // outage does NOT take down the feature.
  const forYouEnabled = getFeatureFlag('show_for_you_tab', true)

  // Honor horizontal safe-area insets (notched landscape iPhones) AND
  // cluster the row into a centered max-width region on wide screens.
  const usableWidth = Math.max(0, width - insets.left - insets.right)
  const contentWidth = Math.min(usableWidth, HEADER_MAX_CONTENT_WIDTH)
  const horizontalPad = Math.max(spacing.lg, (usableWidth - contentWidth) / 2)

  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top,
          zIndex: zIndexTokens.overlay,
        },
        style,
      ]}
    >
      <View
        pointerEvents="box-none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: insets.left + horizontalPad,
          paddingRight: insets.right + horizontalPad,
          height: TAB_ROW_HEIGHT,
        }}
      >
        <View pointerEvents="none" style={{ flex: 1 }} />

        <View
          pointerEvents="box-none"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.lg,
          }}
        >
          {forYouEnabled ? (
            <TabItem
              label={t('feed.forYou')}
              active={activeTab === 'pour-toi'}
              onPress={onPressForYou}
            />
          ) : null}
          <TabItem
            label={t('feed.marketplace')}
            active={activeTab === 'marketplace'}
            onPress={onPressMarketplace}
          />
        </View>

        <View
          pointerEvents="box-none"
          style={{ flex: 1, alignItems: 'flex-end' }}
        >
          <View>
            <IconButton
              variant="glass"
              size="md"
              icon={
                <Ionicons name="search" size={18} color={colors.text.primary} />
              }
              onPress={onPressSearch}
              accessibilityLabel={t('common.search')}
            />
            {filterCount > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.brand,
                  borderWidth: 1.5,
                  borderColor: colors.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.brandText,
                    fontSize: 10,
                    fontWeight: '800',
                    lineHeight: 12,
                  }}
                >
                  {filterCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
          height: LOCATION_ROW_HEIGHT,
        }}
      >
        {onPressLocation ? <LocationChip onPress={onPressLocation} /> : null}
      </View>
    </View>
  )
}

export default MarketplaceHeader
