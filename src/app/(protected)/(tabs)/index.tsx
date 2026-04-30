import { View, FlatList, ViewToken, StyleSheet, useWindowDimensions } from 'react-native'
import React, { useRef, useState } from 'react'
import PostListItem from '@/components/PostListItem';
import posts from "@/data/posts.json"
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import FeedTab from '@/components/GenericComponents/FeedTab';
import TopFeedSwitch from '@/components/GenericComponents/TopFeedSwitch';
import MarketplaceScreen from '@/features/marketplace/screens/MarketplaceScreen';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = {
  EXPLORE: 'Explore',
  FOLLOWING: 'Following',
  FOR_YOU: 'For You'
};

type MainTabId = 'pour-toi' | 'marketplace';

const MAIN_TABS: { id: MainTabId; label: string }[] = [
  { id: 'pour-toi', label: 'Pour toi' },
  { id: 'marketplace', label: 'Marketplace' },
];

const TOP_BAR_HEIGHT = 36;

export default function HomeScreen() {
  const { height } = useWindowDimensions(); // ← prefer hook over Dimensions.get
  const tabBarHeight = useBottomTabBarHeight(); // ← exact tab bar height
  const ITEM_HEIGHT = height - tabBarHeight;
// accounts for home indicator
  const insets = useSafeAreaInsets();
  const topBarTop = insets.top + 12;
  const subTabsTop = topBarTop + TOP_BAR_HEIGHT + 4;
  const [mainTab, setMainTab] = useState<MainTabId>('pour-toi');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(TABS.FOR_YOU);
  const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: ViewToken[]}) => {
 if (viewableItems.length > 0) {
setCurrentIndex(viewableItems[0]?.index || 0)
 }
  })
  console.log(currentIndex)

  const handleMainTabChange = (id: string) => {
    if (id === 'pour-toi' || id === 'marketplace') {
      setMainTab(id);
    }
  };

  return (
     <View style={{ flex: 1 }}>
      <View style={[styles.topBar, { top: topBarTop }]}>
        <MaterialIcons name="live-tv" size={24} color="white" />
        <View style={styles.switchContainer}>
          <TopFeedSwitch
            tabs={MAIN_TABS}
            activeId={mainTab}
            onChange={handleMainTabChange}
          />
        </View>
        <Ionicons name="search" size={24} color="white" />
      </View>

      <View
        style={[styles.tabContent, mainTab === 'pour-toi' ? null : styles.hidden]}
        pointerEvents={mainTab === 'pour-toi' ? 'auto' : 'none'}
      >
        <View style={[styles.subTabsRow, { top: subTabsTop }]}>
          <FeedTab title={TABS.EXPLORE} setActiveTab={setActiveTab} activeTab={activeTab} />
          <FeedTab title={TABS.FOLLOWING} setActiveTab={setActiveTab} activeTab={activeTab} />
          <FeedTab title={TABS.FOR_YOU} setActiveTab={setActiveTab} activeTab={activeTab} />
        </View>

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
  subTabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
  tabContent: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    display: 'none',
  },
})
