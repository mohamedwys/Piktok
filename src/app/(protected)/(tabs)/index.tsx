import { View, StyleSheet, useWindowDimensions } from 'react-native'
import React, { useEffect } from 'react'
import MarketplaceScreen from '@/features/marketplace/screens/MarketplaceScreen';
import ForYouFeed from '@/features/marketplace/screens/ForYouFeed';
import MarketplaceFilterSheet from '@/features/marketplace/components/MarketplaceFilterSheet';
import LocationSheet from '@/components/feed/LocationSheet';
import CommentsSheet from '@/components/feed/CommentsSheet';
import MoreActionsSheet from '@/components/feed/MoreActionsSheet';
import { useFilterSheetStore } from '@/stores/useFilterSheetStore';
import { useLocationSheetStore } from '@/stores/useLocationSheetStore';
import {
  useMarketplaceFilters,
  activeFilterCount,
} from '@/stores/useMarketplaceFilters';
import { useMainTabStore } from '@/stores/useMainTabStore';
import { useHasLocation } from '@/features/location/stores/useUserLocation';
import { useLocationSession } from '@/features/location/stores/useLocationSession';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import MarketplaceHeader from '@/components/feed/MarketplaceHeader';

export default function HomeScreen() {
  useWindowDimensions();
  useBottomTabBarHeight();
  const mainTab = useMainTabStore((s) => s.mainTab);
  const setMainTab = useMainTabStore((s) => s.setMainTab);
  const filters = useMarketplaceFilters((s) => s.filters);
  const filterCount = activeFilterCount(filters);
  const hasLocation = useHasLocation();
  const firstLaunchDismissed = useLocationSession(
    (s) => s.firstLaunchPromptDismissedThisSession,
  );

  const onPressSearch = (): void => {
    void mediumHaptic();
    useFilterSheetStore.getState().open();
  };

  const onPressLocation = (): void => {
    void mediumHaptic();
    useLocationSheetStore.getState().open();
  };

  useEffect(() => {
    if (
      mainTab === 'marketplace' &&
      !hasLocation &&
      !firstLaunchDismissed
    ) {
      useLocationSheetStore.getState().open();
    }
  }, [mainTab, hasLocation, firstLaunchDismissed]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <MarketplaceHeader
        activeTab={mainTab}
        onPressForYou={() => setMainTab('pour-toi')}
        onPressMarketplace={() => setMainTab('marketplace')}
        onPressSearch={onPressSearch}
        onPressLocation={onPressLocation}
        filterCount={filterCount}
      />

      <View
        style={[styles.tabContent, mainTab === 'pour-toi' ? null : styles.hidden]}
        pointerEvents={mainTab === 'pour-toi' ? 'auto' : 'none'}
      >
        <ForYouFeed />
      </View>

      <View
        style={[styles.tabContent, mainTab === 'marketplace' ? null : styles.hidden]}
        pointerEvents={mainTab === 'marketplace' ? 'auto' : 'none'}
      >
        <MarketplaceScreen />
      </View>

      <MarketplaceFilterSheet />
      <LocationSheet />
      <CommentsSheet />
      <MoreActionsSheet />
    </View>
  )
}

const styles = StyleSheet.create({
  tabContent: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    display: 'none',
  },
})
