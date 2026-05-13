import { Platform, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors, radii, spacing } from '@/theme'
import TabBarItem from './TabBarItem'
import SellFAB from './SellFAB'

export const TAB_BAR_HEIGHT = 64
export const CUTOUT_PROTRUSION = 28
/**
 * Horizontal inset for the floating pill bar (from screen edges).
 * The reference design shows the bar inset by ~12px on each side.
 */
export const BAR_HORIZONTAL_MARGIN = 12
/**
 * Vertical gap between the bar's bottom edge and the bottom safe-area
 * inset. Makes the bar float visibly above the iOS home indicator.
 */
export const BAR_BOTTOM_MARGIN = 8
/**
 * Total slot height excluding the bottom safe-area inset.
 * The slot is taller than the visual bar to make room for the
 * raised FAB at its top — see comment on the outer View below.
 */
export const TAB_BAR_SLOT_HEIGHT =
  TAB_BAR_HEIGHT + CUTOUT_PROTRUSION + BAR_BOTTOM_MARGIN
const FAB_COLUMN_WIDTH = 80
const SELL_ROUTE_NAME = 'newPost'
const ICON_SIZE = 24
/**
 * On wide screens (iPad portrait/landscape) the 5 tab slots get
 * spread very far apart with `flex: 1`. Cluster the items + FAB into
 * a centered max-width region so each tab feels reachable. The dark
 * surface still spans the same visible bar width (also clamped).
 */
const TAB_BAR_MAX_CONTENT_WIDTH = 640

type IconRenderer = (props: { color: string }) => React.ReactNode

type TabConfig = {
  labelKey: string
  active: IconRenderer
  inactive: IconRenderer
  badge?: boolean
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: {
    labelKey: 'tabs.home',
    active: ({ color }) => (
      <Ionicons name="home" size={ICON_SIZE} color={color} />
    ),
    inactive: ({ color }) => (
      <Ionicons name="home-outline" size={ICON_SIZE} color={color} />
    ),
  },
  friends: {
    labelKey: 'tabs.categories',
    active: ({ color }) => (
      <Ionicons name="grid" size={ICON_SIZE} color={color} />
    ),
    inactive: ({ color }) => (
      <Ionicons name="grid-outline" size={ICON_SIZE} color={color} />
    ),
  },
  inbox: {
    labelKey: 'tabs.messages',
    active: ({ color }) => (
      <Ionicons name="chatbubble" size={ICON_SIZE} color={color} />
    ),
    inactive: ({ color }) => (
      <Ionicons name="chatbubble-outline" size={ICON_SIZE} color={color} />
    ),
  },
  profile: {
    labelKey: 'tabs.profile',
    active: ({ color }) => (
      <Ionicons name="person" size={ICON_SIZE} color={color} />
    ),
    inactive: ({ color }) => (
      <Ionicons name="person-outline" size={ICON_SIZE} color={color} />
    ),
  },
}

export type CustomTabBarProps = BottomTabBarProps & {
  /** Optional override for the unread-messages badge on the inbox tab. */
  unreadMessages?: boolean
}

export function CustomTabBar({
  state,
  navigation,
  unreadMessages = false,
}: CustomTabBarProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  // Layout strategy: the outer floats absolute over the screen content so
  // the feed (product image, etc.) extends to the full viewport behind us.
  //
  // The bar surface is a floating rounded-pill View — inset
  // BAR_HORIZONTAL_MARGIN from screen edges, lifted BAR_BOTTOM_MARGIN
  // above the home-indicator zone, with all four corners rounded. The
  // FAB protrudes CUTOUT_PROTRUSION above the bar's top edge and casts
  // its own shadow so the visual separation reads cleanly without an
  // SVG cutout.
  //
  // `tabBarStyle.height` (set in _layout.tsx) reserves the SOLID bar +
  // bottom margin so the home feed sizes its content to stop above the
  // floating bar. The protrusion zone is overlap, not reserved space.
  const slotHeight = TAB_BAR_SLOT_HEIGHT + insets.bottom

  // Constrain the bar AND the inner items + FAB cluster to a centered
  // max-width region. On phones the bar fills the screen minus the
  // horizontal margin; on tablets/landscape the bar floats centered at
  // up to TAB_BAR_MAX_CONTENT_WIDTH wide. Horizontal safe-area insets
  // are honored so notched landscape iPhones don't clip the bar under
  // the notch.
  const usableWidth = Math.max(
    0,
    width - insets.left - insets.right - BAR_HORIZONTAL_MARGIN * 2,
  )
  const contentWidth = Math.min(usableWidth, TAB_BAR_MAX_CONTENT_WIDTH)
  const contentLeft =
    insets.left +
    BAR_HORIZONTAL_MARGIN +
    (usableWidth - contentWidth) / 2
  // FAB sits at the center of the content cluster (NOT screen center)
  // so it stays aligned with the bar's center on tablets / landscape.
  const cx = contentLeft + contentWidth / 2

  const goToSell = () => {
    navigation.navigate(SELL_ROUTE_NAME as never)
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: slotHeight,
      }}
    >
      {/* Floating pill background — rounded rectangle inset from screen
          edges, lifted above the home-indicator zone. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: CUTOUT_PROTRUSION,
          left: contentLeft,
          width: contentWidth,
          height: TAB_BAR_HEIGHT,
          backgroundColor: colors.surface,
          borderRadius: radii.xxl,
          borderWidth: 1,
          borderColor: colors.border,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            },
            android: {
              elevation: 8,
            },
            default: {},
          }),
        }}
      />

      <View
        style={{
          marginTop: CUTOUT_PROTRUSION,
          width: contentWidth,
          marginLeft: contentLeft,
          flexDirection: 'row',
          alignItems: 'center',
          height: TAB_BAR_HEIGHT,
          paddingHorizontal: spacing.sm,
        }}
      >
        {state.routes.map((route, index) => {
          if (route.name === SELL_ROUTE_NAME) {
            // Empty slot under the FAB — pointerEvents box-none lets touches
            // in the narrow strips beside the FAB pass through to the feed
            // beneath the bar.
            return (
              <View
                key={route.key}
                pointerEvents="box-none"
                style={{ flex: 1 }}
                accessibilityElementsHidden
              />
            )
          }

          const config = TAB_CONFIG[route.name]
          if (!config) {
            return <View key={route.key} style={{ flex: 1 }} />
          }

          const isFocused = state.index === index
          // Inactive tabs in the reference are clearly visible (not muted to
          // a quiet 0.42 opacity). secondary (~0.68) reads as "available" while
          // still letting the active tab's solid white pop.
          const iconColor = isFocused
            ? colors.text.primary
            : colors.text.secondary
          const renderIcon = isFocused ? config.active : config.inactive

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            })
          }

          const label = t(config.labelKey)
          const showBadge = route.name === 'inbox' ? unreadMessages : false

          return (
            <TabBarItem
              key={route.key}
              icon={renderIcon({ color: iconColor })}
              label={label}
              active={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              badge={showBadge}
              accessibilityLabel={label}
            />
          )
        })}
      </View>

      {/* FAB sits at the top of the slot — no negative positioning, no
          dependency on overflow:'visible'. With FAB diameter 56 and
          CUTOUT_PROTRUSION 28, the top half of the FAB is in the
          transparent protrusion zone (above the bar) and the bottom half
          overlaps the bar's top edge. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: cx - FAB_COLUMN_WIDTH / 2,
          width: FAB_COLUMN_WIDTH,
          alignItems: 'center',
        }}
      >
        <SellFAB onPress={goToSell} />
      </View>
    </View>
  )
}

export default CustomTabBar
