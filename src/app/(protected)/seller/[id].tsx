import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSeller } from '@/features/marketplace/hooks/useSeller';
import { useSellerProducts } from '@/features/marketplace/hooks/useSellerProducts';
import SellerProductCard from '@/features/marketplace/components/SellerProductCard';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import { lightHaptic } from '@/features/marketplace/utils/haptics';

const BRAND_PRIMARY = '#FE2C55';

export default function SellerProfileScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTablet } = useDeviceLayout();
  const numColumns = isTablet ? 3 : 2;
  const lang = i18n.language;

  const { data: seller, isLoading: loadingSeller, isError: errorSeller } = useSeller(id ?? null);
  const { data: products, isLoading: loadingProducts } = useSellerProducts(id ?? null);

  const onPressBack = () => {
    void lightHaptic();
    router.back();
  };

  if (loadingSeller) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (errorSeller || !seller) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={onPressBack} style={[styles.backBtn, { top: insets.top + 12 }]}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </Pressable>
        <Text style={styles.errorText}>{t('seller.loadError')}</Text>
      </View>
    );
  }

  const memberSince = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(seller.createdAt));

  const Header = (
    <View style={styles.header}>
      <View style={styles.avatarWrap}>
        {seller.avatarUrl ? (
          <Image source={{ uri: seller.avatarUrl }} style={styles.avatarImg} />
        ) : null}
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{seller.name}</Text>
        {seller.verified ? (
          <Ionicons name="checkmark-circle" size={18} color="#3b9eff" style={{ marginLeft: 6 }} />
        ) : null}
        {seller.isPro ? (
          <View style={styles.proPill}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.memberSince}>{t('seller.memberSince', { date: memberSince })}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Ionicons name="star" size={14} color="#FFC83D" />
          <Text style={styles.statText}>{` ${seller.rating.toFixed(1)}`}</Text>
        </View>
        <View style={styles.statDot} />
        <Text style={styles.statText}>
          {`${formatCount(seller.salesCount)} ${t('marketplace.salesUnit', { count: seller.salesCount })}`}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>{t('seller.listings')}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable
        onPress={onPressBack}
        style={({ pressed }) => [styles.backBtn, { top: insets.top + 12 }, pressed && { opacity: 0.6 }]}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>
      <FlatList
        data={products ?? []}
        keyExtractor={(p) => p.id}
        numColumns={numColumns}
        key={numColumns}
        ListHeaderComponent={Header}
        renderItem={({ item }) => <SellerProductCard product={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={
          loadingProducts ? (
            <View style={styles.center}><ActivityIndicator color="#fff" /></View>
          ) : (
            <Text style={styles.emptyText}>{t('seller.empty')}</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  header: { paddingTop: 56, paddingBottom: 16, alignItems: 'center', gap: 6 },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#222', overflow: 'hidden',
    borderWidth: 2, borderColor: BRAND_PRIMARY,
  },
  avatarImg: { width: 96, height: 96 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  proPill: {
    marginLeft: 8,
    backgroundColor: '#7C5CFC',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  proText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  memberSince: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statBlock: { flexDirection: 'row', alignItems: 'center' },
  statText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  statDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 8 },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 24, marginLeft: 0,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center',
    marginTop: 40,
  },
  errorText: { color: '#fff', fontSize: 14 },
});
