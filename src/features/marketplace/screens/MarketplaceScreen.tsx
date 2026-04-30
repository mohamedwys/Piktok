import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProducts } from '@/features/marketplace/hooks/useProducts';
import type { Product } from '@/features/marketplace/types/product';

function formatPrice(value: number, currency: Product['currency']): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

function ProductCard({ item }: { item: Product }): React.ReactElement {
  const imageUri = item.media.thumbnailUrl ?? item.media.url;
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: imageUri }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>
        <View style={styles.sellerRow}>
          <Text style={styles.sellerName}>{item.seller.name}</Text>
          {item.seller.verified ? (
            <Text style={styles.verified}> ✓</Text>
          ) : null}
        </View>
        {item.stock.label ? (
          <Text style={styles.stockLabel}>{item.stock.label}</Text>
        ) : (
          <Text style={styles.stockLabel}>
            {item.stock.available ? 'En stock' : 'Indisponible'}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function MarketplaceScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError } = useProducts();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>
          Impossible de charger le marketplace.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={data.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard item={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  separator: {
    height: 12,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#222',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  price: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sellerName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  verified: {
    color: '#4da3ff',
    fontSize: 13,
    fontWeight: '700',
  },
  stockLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
