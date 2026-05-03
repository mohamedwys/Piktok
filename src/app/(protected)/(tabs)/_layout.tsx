import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar, {
  BAR_BOTTOM_MARGIN,
  TAB_BAR_HEIGHT,
} from '@/components/navigation/CustomTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // RN reserves `tabBarStyle.height` worth of screen-content space.
        // We reserve the visible bar height + the floating bottom margin
        // + the bottom safe-area inset. The FAB's protrusion zone above
        // the bar is overlap, NOT reserved space (otherwise it would
        // push the feed up and produce a flat-rectangle look).
        // `useBottomTabBarHeight()` returns this value, so callers
        // anchored to the bar's top edge (e.g. ProductActionRail's
        // `bottom: tabBarHeight + 16`) sit at the right vertical
        // position above the floating pill.
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + BAR_BOTTOM_MARGIN + insets.bottom,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
        },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="friends" options={{ title: t('tabs.categories') }} />
      <Tabs.Screen name="newPost" options={{ title: t('tabs.sell') }} />
      <Tabs.Screen name="inbox" options={{ title: t('tabs.messages') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
