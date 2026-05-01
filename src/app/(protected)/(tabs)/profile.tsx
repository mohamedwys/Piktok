import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/i18n';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { useMyProducts } from '@/features/marketplace/hooks/useMyProducts';
import { useMyOrders } from '@/features/marketplace/hooks/useMyOrders';
import { useDeleteProduct } from '@/features/marketplace/hooks/useDeleteProduct';
import { timeAgo } from '@/features/marketplace/utils/timeAgo';
import { getLocalized } from '@/i18n/getLocalized';
import SellerProductCard from '@/features/marketplace/components/SellerProductCard';
import SellerProductCardSkeleton from '@/features/marketplace/components/SellerProductCardSkeleton';
import type { Product } from '@/features/marketplace/types/product';
import type { Order, OrderStatus } from '@/features/marketplace/services/orders';

const BRAND_PRIMARY = '#FE2C55';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
};

const ORDER_STATUS_PILL: Record<
  OrderStatus,
  { bg: string; fg: string; key: string }
> = {
  pending: { bg: '#FFC83D', fg: '#1a1100', key: 'orders.statusPending' },
  paid: { bg: '#33D17A', fg: '#062817', key: 'orders.statusPaid' },
  failed: { bg: 'rgba(243,97,97,0.85)', fg: '#fff', key: 'orders.statusFailed' },
  cancelled: { bg: 'rgba(243,97,97,0.85)', fg: '#fff', key: 'orders.statusCancelled' },
  refunded: { bg: 'rgba(255,255,255,0.18)', fg: '#fff', key: 'orders.statusRefunded' },
};

function formatOrderAmount(value: number, currency: Order['currency']): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

function OrderRow({
  order,
  lang,
  t,
}: {
  order: Order;
  lang: string;
  t: (key: string) => string;
}): React.ReactElement {
  const pill = ORDER_STATUS_PILL[order.status];
  const title = order.productTitle ? getLocalized(order.productTitle, lang) : '';
  return (
    <View style={styles.orderRow}>
      <View style={styles.orderThumbWrap}>
        {order.productThumbnail ? (
          <Image
            source={{ uri: order.productThumbnail }}
            style={styles.orderThumb}
          />
        ) : null}
      </View>
      <View style={styles.orderMiddle}>
        <Text style={styles.orderTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.orderAmount}>
          {formatOrderAmount(order.amount, order.currency)}
        </Text>
        <Text style={styles.orderDate}>{timeAgo(order.createdAt, lang)}</Text>
      </View>
      <View style={[styles.orderPill, { backgroundColor: pill.bg }]}>
        <Text style={[styles.orderPillText, { color: pill.fg }]}>
          {t(pill.key)}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, user } = useRequireAuth();
  const currentLang = i18n.language as SupportedLanguage;
  const myProductsQuery = useMyProducts(isAuthenticated);
  const myOrdersQuery = useMyOrders(isAuthenticated);
  const deleteMutation = useDeleteProduct();

  const handleEdit = (productId: string): void => {
    void lightHaptic();
    router.push({
      pathname: '/(protected)/(tabs)/newPost',
      params: { editId: productId },
    });
  };

  const handleDelete = (productId: string): void => {
    Alert.alert(
      t('myListings.deleteConfirmTitle'),
      t('myListings.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('myListings.delete'),
          style: 'destructive',
          onPress: () => {
            void mediumHaptic();
            deleteMutation.mutate(productId, {
              onError: (err) =>
                Alert.alert(t('myListings.deleteFailed'), err.message),
            });
          },
        },
      ],
    );
  };

  const renderMyProduct = ({ item }: { item: Product }): React.ReactElement => (
    <SellerProductCard
      product={item}
      showOwnerActions
      onDelete={handleDelete}
      onEdit={handleEdit}
    />
  );

  const onPressLang = (lang: SupportedLanguage): void => {
    if (lang === currentLang) return;
    void lightHaptic();
    void setLanguage(lang);
  };

  const onPressSignIn = (): void => {
    void lightHaptic();
    router.push('/(auth)/login');
  };

  const onPressCreateAccount = (): void => {
    void lightHaptic();
    router.push('/(auth)/register');
  };

  const onPressEditSeller = (): void => {
    void lightHaptic();
    router.push('/(protected)/edit-seller-profile');
  };

  const onPressSignOut = (): void => {
    void lightHaptic();
    void (async () => {
      await useAuthStore.getState().logout();
      router.replace('/(protected)/(tabs)');
    })();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top + 16 }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isAuthenticated ? (
          <>
            <Text style={styles.title}>{t('profile.title')}</Text>
            {user?.email ? (
              <Text style={styles.email}>{user.email}</Text>
            ) : null}
          </>
        ) : (
          <View style={styles.guestHeader}>
            <Text style={styles.title}>{t('profile.guestHeading')}</Text>
            <Text style={styles.guestSubtitle}>
              {t('profile.guestSubtitle')}
            </Text>
            <View style={styles.ctaStack}>
              <Pressable
                onPress={onPressSignIn}
                style={({ pressed }) => [
                  styles.ctaPrimary,
                  pressed && styles.pillPressed,
                ]}
              >
                <Text style={styles.ctaPrimaryText}>{t('auth.signIn')}</Text>
              </Pressable>
              <Pressable
                onPress={onPressCreateAccount}
                style={({ pressed }) => [
                  styles.ctaSecondary,
                  pressed && styles.pillPressed,
                ]}
              >
                <Text style={styles.ctaSecondaryText}>
                  {t('auth.createAccount')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.settings')}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('profile.language')}</Text>
            <View style={styles.pillRow}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = lang === currentLang;
                return (
                  <Pressable
                    key={lang}
                    onPress={() => onPressLang(lang)}
                    style={({ pressed }) => [
                      styles.pill,
                      isActive ? styles.pillActive : styles.pillInactive,
                      pressed && styles.pillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isActive ? styles.pillTextActive : styles.pillTextInactive,
                      ]}
                    >
                      {LANGUAGE_LABELS[lang]}
                    </Text>
                    {isActive ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color="#fff"
                        style={styles.pillIcon}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {isAuthenticated ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('myListings.title')}</Text>
            {myProductsQuery.isLoading ? (
              <View style={styles.skeletonGrid}>
                <View style={styles.skeletonRow}>
                  <SellerProductCardSkeleton />
                  <SellerProductCardSkeleton />
                </View>
                <View style={styles.skeletonRow}>
                  <SellerProductCardSkeleton />
                  <SellerProductCardSkeleton />
                </View>
              </View>
            ) : (myProductsQuery.data?.length ?? 0) === 0 ? (
              <Text style={styles.emptyText}>{t('myListings.empty')}</Text>
            ) : (
              <FlatList
                data={myProductsQuery.data ?? []}
                key={2}
                numColumns={2}
                keyExtractor={(item) => item.id}
                renderItem={renderMyProduct}
                scrollEnabled={false}
                columnWrapperStyle={{ gap: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              />
            )}
          </View>
        ) : null}

        {isAuthenticated ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('orders.title')}</Text>
            {myOrdersQuery.isLoading ? (
              <ActivityIndicator />
            ) : (myOrdersQuery.data?.length ?? 0) === 0 ? (
              <Text style={styles.emptyText}>{t('orders.empty')}</Text>
            ) : (
              <View>
                {(myOrdersQuery.data ?? []).map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    lang={currentLang}
                    t={t}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {isAuthenticated ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.account')}</Text>
            <Pressable
              onPress={onPressEditSeller}
              style={({ pressed }) => [
                styles.editSellerButton,
                pressed && styles.pillPressed,
              ]}
            >
              <Ionicons name="storefront-outline" size={18} color="#fff" />
              <Text style={styles.editSellerText}>{t('sellerProfile.edit')}</Text>
            </Pressable>
            <Pressable
              onPress={onPressSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.pillPressed,
              ]}
            >
              <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 28,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  email: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    marginTop: 6,
  },
  guestHeader: {
    gap: 12,
  },
  guestSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  ctaStack: {
    gap: 10,
    marginTop: 6,
  },
  ctaPrimary: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  row: {
    gap: 10,
  },
  rowLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: BRAND_PRIMARY,
  },
  pillInactive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  pillPressed: {
    opacity: 0.7,
  },
  pillText: {
    fontSize: 14,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  pillTextInactive: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  pillIcon: {
    marginLeft: 6,
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderColor: BRAND_PRIMARY,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: BRAND_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  skeletonGrid: {
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editSellerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  editSellerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  orderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  orderThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  orderThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  orderMiddle: {
    flex: 1,
  },
  orderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  orderAmount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  orderDate: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  orderPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  orderPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
