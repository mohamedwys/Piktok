import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '@/components/GenericComponents/Avatar';
import { useSeller } from '@/features/marketplace/hooks/useSeller';
import { useSellerProducts } from '@/features/marketplace/hooks/useSellerProducts';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import SellerProductCard from '@/features/marketplace/components/SellerProductCard';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import { formatCount as formatCountIntl } from '@/lib/format';
import { lightHaptic } from '@/features/marketplace/utils/haptics';
import { useAuthStore } from '@/stores/useAuthStore';
import { Chip } from '@/components/ui';
import FollowButton from '@/components/profile/FollowButton';
import MessageButton from '@/components/profile/MessageButton';
import { colors } from '@/theme';

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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: mySeller } = useMySeller(isAuthenticated);
  const isOwnProfile = !!mySeller && !!seller && mySeller.id === seller.id;

  const onPressEditProfile = (): void => {
    void lightHaptic();
    router.push('/(protected)/edit-seller-profile');
  };

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
      <View style={styles.avatarRing}>
        <Avatar name={seller.name} uri={seller.avatarUrl} size={96} />
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
      <View style={styles.socialStatsRow}>
        <Pressable
          onPress={() => {
            void lightHaptic();
            router.push(`/(protected)/seller/${seller.id}/followers` as Href);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('social.viewFollowersAriaLabel', {
            count: seller.followersCount,
          })}
          style={({ pressed }) => [styles.socialStatBlock, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.socialStatNumber}>
            {formatCountIntl(seller.followersCount, lang === 'fr' ? 'fr-FR' : 'en-US')}
          </Text>
          <Text style={styles.socialStatLabel}>{t('social.followers')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void lightHaptic();
            router.push(`/(protected)/seller/${seller.id}/following` as Href);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('social.viewFollowingAriaLabel', {
            count: seller.followingCount,
          })}
          style={({ pressed }) => [styles.socialStatBlock, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.socialStatNumber}>
            {formatCountIntl(seller.followingCount, lang === 'fr' ? 'fr-FR' : 'en-US')}
          </Text>
          <Text style={styles.socialStatLabel}>{t('social.following_count_label')}</Text>
        </Pressable>
      </View>
      {seller.bio ? <Text style={styles.bio}>{seller.bio}</Text> : null}
      <View style={styles.actionRow}>
        {isOwnProfile ? (
          <Chip
            label={t('profile.editProfile')}
            variant="outlined"
            size="md"
            leadingIcon={
              <Ionicons name="create-outline" size={14} color={colors.text.primary} />
            }
            onPress={onPressEditProfile}
            accessibilityLabel={t('profile.editProfile')}
          />
        ) : (
          <>
            <FollowButton sellerId={seller.id} sellerName={seller.name} size="md" />
            <MessageButton sellerId={seller.id} sellerName={seller.name} size="md" />
          </>
        )}
      </View>
      {seller.isPro && (seller.website || seller.phonePublic || seller.emailPublic) ? (
        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>{t('sellerProfile.contactPro')}</Text>
          {seller.website ? (
            <Pressable
              onPress={() => {
                void lightHaptic();
                void Linking.openURL(seller.website as string);
              }}
              style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="globe-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.contactText} numberOfLines={1}>{seller.website}</Text>
            </Pressable>
          ) : null}
          {seller.phonePublic ? (
            <Pressable
              onPress={() => {
                void lightHaptic();
                void Linking.openURL(`tel:${seller.phonePublic}`);
              }}
              style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.contactText} numberOfLines={1}>{seller.phonePublic}</Text>
            </Pressable>
          ) : null}
          {seller.emailPublic ? (
            <Pressable
              onPress={() => {
                void lightHaptic();
                void Linking.openURL(`mailto:${seller.emailPublic}`);
              }}
              style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="mail-outline" size={16} color="rgba(255,255,255,0.85)" />
              <Text style={styles.contactText} numberOfLines={1}>{seller.emailPublic}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  avatarRing: {
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.brand,
  },
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
  socialStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 8,
  },
  socialStatBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  socialStatNumber: { color: '#fff', fontSize: 14, fontWeight: '700' },
  socialStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
  },
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
  bio: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  contactCard: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  contactLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  contactText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    flex: 1,
  },
});
