import { View, FlatList, ViewToken, StyleSheet, useWindowDimensions } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
import PostListItem from '@/components/PostListItem';
import posts from "@/data/posts.json"
import MarketplaceScreen from '@/features/marketplace/screens/MarketplaceScreen';
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
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const ITEM_HEIGHT = height - tabBarHeight;
  const mainTab = useMainTabStore((s) => s.mainTab);
  const setMainTab = useMainTabStore((s) => s.setMainTab);
  const [currentIndex, setCurrentIndex] = useState(0);
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
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0]?.index || 0)
    }
  })

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
        <FlatList
          style={{ flex: 1 }}
          data={posts}
          renderItem={({ item, index }) => (
            <PostListItem postItem={item} isActive={index === currentIndex} itemHeight={ITEM_HEIGHT} />
          )}
          getItemLayout={(data, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index
          })}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate={"fast"}
          disableIntervalMomentum
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onEndReachedThreshold={2}
        />
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
