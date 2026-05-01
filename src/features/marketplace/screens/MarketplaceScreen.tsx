import React, { useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useFilteredProducts } from '@/features/marketplace/hooks/useFilteredProducts';
import ProductFeedItem from '@/features/marketplace/components/ProductFeedItem';
import MarketplaceFeedSkeleton from '@/features/marketplace/components/MarketplaceFeedSkeleton';
import type { Product } from '@/features/marketplace/types/product';

export default function MarketplaceScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const itemHeight = height - tabBarHeight;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setCurrentIndex(viewableItems[0]?.index ?? 0);
    },
  );

  const { data, isLoading, isError } = useFilteredProducts();

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

  if (data.items.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.message}>{t('marketplace.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<Product>
        data={data.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ProductFeedItem
            item={item}
            itemHeight={itemHeight}
            isActive={index === currentIndex}
          />
        )}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
