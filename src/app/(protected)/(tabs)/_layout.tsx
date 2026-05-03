import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomTabBar, { TAB_BAR_HEIGHT } from '@/components/navigation/CustomTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // RN reserves `tabBarStyle.height` worth of screen-content space.
        // We reserve only the SOLID bar height (TAB_BAR_HEIGHT + inset) —
        // not the FAB's protrusion zone. That zone sits ABOVE the reserved
        // slot and overlaps the screen content. The bar's curves and
        // rounded corners read against the lighter feed showing through
        // the transparent zones; reserving the protrusion height too
        // would push the feed up and produce a flat-rectangle look.
        // `useBottomTabBarHeight()` returns this value, so the home feed
        // sizes its items to fit above the solid bar.
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + insets.bottom,
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
