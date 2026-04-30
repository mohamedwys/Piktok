import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useProducts } from '@/features/marketplace/hooks/useProducts';
import ProductFeedItem from '@/features/marketplace/components/ProductFeedItem';
import type { Product } from '@/features/marketplace/types/product';

export default function MarketplaceScreen(): React.ReactElement {
  const { height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const itemHeight = height - tabBarHeight;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setCurrentIndex(viewableItems[0]?.index ?? 0);
    },
  );

  const { data, isLoading, isError } = useProducts();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.message}>
          Impossible de charger le marketplace.
        </Text>
      </View>
    );
  }

  if (data.items.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.message}>Aucun produit pour l&apos;instant.</Text>
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
