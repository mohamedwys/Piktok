import { View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { colors, spacing } from '@/theme'
import TabBarBackground from './TabBarBackground'
import TabBarItem from './TabBarItem'
import SellFAB from './SellFAB'

export const TAB_BAR_HEIGHT = 64
export const CUTOUT_PROTRUSION = 28
/**
 * Total slot height excluding the bottom safe-area inset.
 * The slot is taller than the visual bar to make room for the
 * raised FAB at its top — see comment on the outer View below.
 */
export const TAB_BAR_SLOT_HEIGHT = TAB_BAR_HEIGHT + CUTOUT_PROTRUSION
const FAB_COLUMN_WIDTH = 80
const SELL_ROUTE_NAME = 'newPost'
const ICON_SIZE = 24
/**
 * On wide screens (iPad portrait/landscape) the 5 tab slots get
 * spread very far apart with `flex: 1`. Cluster the items + FAB into
 * a centered max-width region so each tab feels reachable. The dark
 * surface still spans the full screen width.
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
      <MaterialCommunityIcons
        name="home-variant"
        size={ICON_SIZE}
        color={color}
      />
    ),
    inactive: ({ color }) => (
      <MaterialCommunityIcons
        name="home-variant-outline"
        size={ICON_SIZE}
        color={color}
      />
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
  // the feed (product image, etc.) extends to the full viewport behind us
  // — that's the only way the bar's rounded corners and cutout are
  // visually distinct from a flat rectangle (they read AGAINST the lighter
  // feed content showing through the transparent zones).
  //
  // The outer is `slotHeight` tall (= solid bar + protrusion). Anything
  // visually "above the bar" still sits inside the outer, so we don't
  // need `overflow: 'visible'` to escape any wrapper.
  //
  // `tabBarStyle.height` (set in _layout.tsx) tells React Navigation to
  // reserve only the SOLID bar height — `useBottomTabBarHeight()`
  // consumers (the home feed) treat the protrusion zone as overlap, not
  // reserved space. The feed's bottom 28 px renders behind the bar's
  // transparent protrusion zone, with the FAB occluding a small circle
  // in the middle.
  const slotHeight = TAB_BAR_SLOT_HEIGHT + insets.bottom
  const barHeight = TAB_BAR_HEIGHT + insets.bottom

  // Constrain the items + FAB cluster to a centered region. On phones
  // (width < TAB_BAR_MAX_CONTENT_WIDTH) the cluster fills the screen.
  // On tablets/landscape it stays comfortably reachable with thumbs.
  // Horizontal safe-area insets are honored so notched landscape
  // iPhones don't clip the leading/trailing tabs under the notch.
  const usableWidth = Math.max(
    0,
    width - insets.left - insets.right,
  )
  const contentWidth = Math.min(usableWidth, TAB_BAR_MAX_CONTENT_WIDTH)
  const contentLeft = insets.left + (usableWidth - contentWidth) / 2
  // FAB sits at the center of the content cluster (NOT screen center)
  // so the cutout in the SVG aligns with it on tablets / landscape too.
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
      {/* SVG bar background — paints from CUTOUT_PROTRUSION downward. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: CUTOUT_PROTRUSION,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <TabBarBackground
          width={width}
          height={barHeight}
          cutoutCenterX={cx}
        />
      </View>

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
          overlaps the bar's cutout. */}
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
