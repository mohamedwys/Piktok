import { View, FlatList, Pressable, Text, ViewToken, StyleSheet, useWindowDimensions } from 'react-native'
import React, { useMemo, useRef, useState } from 'react'
import PostListItem from '@/components/PostListItem';
import posts from "@/data/posts.json"
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import TopFeedSwitch from '@/components/GenericComponents/TopFeedSwitch';
import MarketplaceScreen from '@/features/marketplace/screens/MarketplaceScreen';
import MarketplaceFilterSheet from '@/features/marketplace/components/MarketplaceFilterSheet';
import { useFilterSheetStore } from '@/stores/useFilterSheetStore';
import {
  useMarketplaceFilters,
  activeFilterCount,
} from '@/stores/useMarketplaceFilters';
import { useMainTabStore, type MainTabId } from '@/stores/useMainTabStore';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const { t } = useTranslation();
  const MAIN_TABS = useMemo<{ id: MainTabId; label: string }[]>(() => ([
    { id: 'pour-toi', label: t('feed.forYou') },
    { id: 'marketplace', label: t('feed.marketplace') },
  ]), [t]);
  const { height } = useWindowDimensions(); // ← prefer hook over Dimensions.get
  const tabBarHeight = useBottomTabBarHeight(); // ← exact tab bar height
  const ITEM_HEIGHT = height - tabBarHeight;
// accounts for home indicator
  const insets = useSafeAreaInsets();
  const topBarTop = insets.top + 12;
  const mainTab = useMainTabStore((s) => s.mainTab);
  const setMainTab = useMainTabStore((s) => s.setMainTab);
  const [currentIndex, setCurrentIndex] = useState(0);
  const filters = useMarketplaceFilters((s) => s.filters);
  const filterCount = activeFilterCount(filters);

  const onPressSearch = (): void => {
    void mediumHaptic();
    useFilterSheetStore.getState().open();
  };
  const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: ViewToken[]}) => {
 if (viewableItems.length > 0) {
setCurrentIndex(viewableItems[0]?.index || 0)
 }
  })

  const handleMainTabChange = (id: string) => {
    if (id === 'pour-toi' || id === 'marketplace') {
      setMainTab(id);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={[styles.topBar, { top: topBarTop }]}>
        <MaterialIcons name="live-tv" size={24} color="white" />
        <View style={styles.switchContainer}>
          <TopFeedSwitch
            tabs={MAIN_TABS}
            activeId={mainTab}
            onChange={handleMainTabChange}
          />
        </View>
        <Pressable
          onPress={onPressSearch}
          hitSlop={10}
          style={({ pressed }) => [styles.searchButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="search" size={24} color="white" />
          {filterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

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
    </View>
  )
}

const styles = StyleSheet.create({
  switchContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  tabContent: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    display: 'none',
  },
  searchButton: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FE2C55',
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
})
