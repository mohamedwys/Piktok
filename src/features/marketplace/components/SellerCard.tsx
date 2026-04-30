import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/features/marketplace/types/product';
import { formatCount } from '@/features/marketplace/utils/formatCount';

type SellerCardProps = {
  seller: Product['seller'];
};

export default function SellerCard({
  seller,
}: SellerCardProps): React.ReactElement {
  const hasAvatar = seller.avatarUrl.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        {hasAvatar ? (
          <Image
            source={{ uri: seller.avatarUrl }}
            style={styles.avatarImage}
          />
        ) : null}
      </View>
      <View style={styles.textColumn}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {seller.name}
          </Text>
          {seller.verified ? (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color="#3b9eff"
              style={styles.verifiedIcon}
            />
          ) : null}
          {seller.isPro ? (
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.row}>
          <Ionicons name="star" size={11} color="#FFC83D" />
          <Text style={styles.metaText} numberOfLines={1}>
            {` ${seller.rating.toFixed(1)} (${formatCount(seller.salesCount)}) · ${formatCount(seller.salesCount)} ventes`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexShrink: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  textColumn: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  proPill: {
    marginLeft: 6,
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    flexShrink: 1,
  },
});
