import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlashList, type ViewToken } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { useForYouFeed } from '@/features/marketplace/hooks/useForYouFeed';
import ProductFeedItem from '@/features/marketplace/components/ProductFeedItem';
import { VideoPlayerPool } from '@/features/marketplace/components/VideoPlayerPool';
import MarketplaceFeedSkeleton from '@/features/marketplace/components/MarketplaceFeedSkeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMainTabStore } from '@/stores/useMainTabStore';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import type { ForYouProduct } from '@/features/marketplace/services/products';
import { colors } from '@/theme';

export default function ForYouFeed(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const itemHeight = height;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setMainTab = useMainTabStore((s) => s.setMainTab);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<ForYouProduct>[] }) => {
      const next = viewableItems[0]?.index ?? 0;
      setCurrentIndex((prev) => {
        if (prev !== next) {
          Haptics.selectionAsync().catch(() => {});
        }
        return next;
      });
    },
  );

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useForYouFeed();

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data?.pages],
  );

  // Prefetch only the first page's thumbnails — later pages prefetch
  // naturally as they scroll into view.
  const firstPageItems = data?.pages[0]?.items;
  useEffect(() => {
    if (!firstPageItems?.length) return;
    const urls = firstPageItems
      .slice(0, 8)
      .map((i) => i.media.thumbnailUrl ?? i.media.url)
      .filter((u): u is string => !!u);
    urls.forEach((url) => {
      void Image.prefetch(url, 'memory-disk');
    });
  }, [firstPageItems]);

  const onPressSignIn = (): void => {
    void lightHaptic();
    router.push('/(auth)/login');
  };

  const onPressExploreMarketplace = (): void => {
    void lightHaptic();
    setMainTab('marketplace');
  };

  // Anon: show sign-in CTA. The hook's `enabled` already suppressed the
  // fetch; data is undefined and isLoading is false.
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons
          name="sparkles-outline"
          size={48}
          color="rgba(255,255,255,0.25)"
        />
        <Text style={styles.empty}>{t('forYou.signInPrompt')}</Text>
        <Pressable
          onPress={onPressSignIn}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{t('auth.signIn')}</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <MarketplaceFeedSkeleton />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.message}>{t('marketplace.loadError')}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons
          name="sparkles-outline"
          size={48}
          color="rgba(255,255,255,0.25)"
        />
        <Text style={styles.empty}>{t('forYou.empty')}</Text>
        <Pressable
          onPress={onPressExploreMarketplace}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{t('forYou.exploreMarketplace')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <VideoPlayerPool slots={3}>
      <View style={styles.container}>
        <FlashList<ForYouProduct>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ProductFeedItem
              item={item}
              itemHeight={itemHeight}
              isActive={index === currentIndex}
              insetsTop={insets.top}
              tabBarHeight={tabBarHeight}
            />
          )}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={1.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        />
      </View>
    </VideoPlayerPool>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  empty: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
