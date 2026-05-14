import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { WEB_BASE_URL } from '@/lib/web/constants';
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
import { useMySales } from '@/features/marketplace/hooks/useMySales';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useDeleteProduct } from '@/features/marketplace/hooks/useDeleteProduct';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';
import ProUpgradeBanner from '@/components/marketplace/ProUpgradeBanner';
import { useDismissedBanners } from '@/stores/useDismissedBanners';
import { useUpgradeFlow } from '@/hooks/useUpgradeFlow';
import { timeAgo } from '@/features/marketplace/utils/timeAgo';
import { getLocalized } from '@/i18n/getLocalized';
import { formatCount } from '@/lib/format';
import SellerProductCard from '@/features/marketplace/components/SellerProductCard';
import SellerProductCardSkeleton from '@/features/marketplace/components/SellerProductCardSkeleton';
import CurrencyPicker from '@/components/profile/CurrencyPicker';
import {
  Avatar,
  Pressable,
  ProBadge,
  Surface,
  Text,
  VerifiedCheck,
} from '@/components/ui';
import type { Product } from '@/features/marketplace/types/product';
import type { Order, OrderStatus } from '@/features/marketplace/services/orders';
import { colors, radii, spacing } from '@/theme';
import { NotificationOptInModal } from '@/features/notifications/components/NotificationOptInModal';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  fr: 'Français',
  en: 'English',
};

const ORDER_STATUS_PILL: Record<
  OrderStatus,
  { bg: string; fg: string; key: string }
> = {
  pending: { bg: colors.feedback.gold, fg: '#1a1100', key: 'orders.statusPending' },
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
            transition={120}
            cachePolicy="memory-disk"
          />
        ) : null}
      </View>
      <View style={styles.orderMiddle}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" weight="bold" style={styles.orderAmount}>
          {formatOrderAmount(order.amount, order.currency)}
        </Text>
        <Text variant="caption" color="tertiary">
          {timeAgo(order.createdAt, lang)}
        </Text>
      </View>
      <View style={[styles.orderPill, { backgroundColor: pill.bg }]}>
        <Text style={[styles.orderPillText, { color: pill.fg }]}>
          {t(pill.key)}
        </Text>
      </View>
    </View>
  );
}

function SaleRow({
  order,
  lang,
  t,
}: {
  order: Order;
  lang: string;
  t: (key: string) => string;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const pill = ORDER_STATUS_PILL[order.status];
  const title = order.productTitle ? getLocalized(order.productTitle, lang) : '';
  const hasDetails =
    !!order.shippingAddress || !!order.buyerPhone || !!order.buyerName;
  const phone = order.buyerPhone;
  const addressLines = order.shippingAddress
    ? [
        order.shippingAddress.line1,
        order.shippingAddress.line2,
        [order.shippingAddress.postal_code, order.shippingAddress.city]
          .filter(Boolean)
          .join(' '),
        order.shippingAddress.country,
      ]
        .filter((v): v is string => !!v && v.length > 0)
        .join('\n')
    : null;

  return (
    <Pressable
      haptic={hasDetails ? 'light' : undefined}
      onPress={() => {
        if (hasDetails) setExpanded((v) => !v);
      }}
      pressScale={hasDetails ? 0.99 : undefined}
    >
      <View style={styles.orderRow}>
        <View style={styles.orderThumbWrap}>
          {order.productThumbnail ? (
            <Image
              source={{ uri: order.productThumbnail }}
              style={styles.orderThumb}
              transition={120}
              cachePolicy="memory-disk"
            />
          ) : null}
        </View>
        <View style={styles.orderMiddle}>
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" weight="bold" style={styles.orderAmount}>
            {formatOrderAmount(order.amount, order.currency)}
          </Text>
          <Text variant="caption" color="tertiary">
            {timeAgo(order.createdAt, lang)}
          </Text>
        </View>
        <View style={[styles.orderPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.orderPillText, { color: pill.fg }]}>
            {t(pill.key)}
          </Text>
        </View>
        {hasDetails ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.text.tertiary}
            style={styles.saleChevron}
          />
        ) : null}
      </View>
      {expanded ? (
        <View style={styles.saleExpanded}>
          {order.buyerName ? (
            <View style={styles.saleField}>
              <Ionicons
                name="person-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text variant="caption" color="primary">
                {order.buyerName}
              </Text>
            </View>
          ) : null}
          {phone ? (
            <Pressable
              haptic="light"
              onPress={() => {
                void Linking.openURL(`tel:${phone}`);
              }}
              style={styles.saleField}
            >
              <Ionicons name="call-outline" size={14} color={colors.brand} />
              <Text variant="caption" style={{ color: colors.brand }}>
                {phone}
              </Text>
            </Pressable>
          ) : null}
          {addressLines ? (
            <View style={styles.saleAddress}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.text.tertiary}
              />
              <Text variant="caption" color="primary" style={{ flex: 1 }}>
                {addressLines}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

type StatBlockProps = {
  count: number;
  label: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

function StatBlock({
  count,
  label,
  onPress,
  accessibilityLabel,
}: StatBlockProps): React.ReactElement {
  const lang = useTranslation().i18n.language;
  const formatted = formatCount(count, lang === 'fr' ? 'fr-FR' : 'en-US');
  const content = (
    <View style={styles.statBlock}>
      <Text style={styles.statNumber}>{formatted}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
  if (!onPress) return <View style={styles.statPressable}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.statPressable}
    >
      {content}
    </Pressable>
  );
}

type AccountRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  showDivider?: boolean;
  danger?: boolean;
};

function AccountRow({
  icon,
  label,
  onPress,
  showDivider = false,
  danger = false,
}: AccountRowProps): React.ReactElement {
  return (
    <Pressable haptic="light" onPress={onPress} pressScale={0.98}>
      <View
        style={[
          styles.accountRow,
          showDivider && styles.accountRowDivider,
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? colors.feedback.danger : colors.text.secondary}
        />
        <Text
          variant="body"
          style={{
            flex: 1,
            color: danger ? colors.feedback.danger : colors.text.primary,
          }}
        >
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </View>
    </Pressable>
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
  const mySalesQuery = useMySales(isAuthenticated);
  const mySellerQuery = useMySeller(isAuthenticated);
  const deleteMutation = useDeleteProduct();
  const [showNotifModal, setShowNotifModal] = useState(false);

  const seller = mySellerQuery.data;
  const listingsCount = myProductsQuery.data?.length ?? 0;

  // Phase H.4 — own-profile Pro pitch banner. Always 'soft' emphasis
  // (no urgency trigger; this is a passive pitch, not a cap warning).
  // Visibility: authed + non-Pro + not dismissed in the last 24h.
  // Pro sellers see nothing here — the cross-banner invariant from
  // PRO_AUDIT.md §6.
  const isPro = useIsPro();
  const profilePitchDismissed = useDismissedBanners((s) =>
    s.isDismissed('profile-pro-pitch'),
  );
  const dismissBanner = useDismissedBanners((s) => s.dismiss);
  const openUpgradeFlow = useUpgradeFlow();
  const showProfilePitch =
    isAuthenticated && !isPro && !profilePitchDismissed;
  const displayName =
    seller?.name
    || user?.username
    || user?.email?.split('@')[0]
    || t('profile.title');

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

  const onPressViewPublic = (): void => {
    if (!seller) return;
    void lightHaptic();
    router.push(`/(protected)/seller/${seller.id}` as Href);
  };

  const onPressFollowers = (): void => {
    if (!seller) return;
    void lightHaptic();
    router.push(`/(protected)/seller/${seller.id}/followers` as Href);
  };

  const onPressFollowing = (): void => {
    if (!seller) return;
    void lightHaptic();
    router.push(`/(protected)/seller/${seller.id}/following` as Href);
  };

  const onPressLocation = (): void => {
    void lightHaptic();
    router.push('/(protected)/edit-seller-profile');
  };

  const onPressManageSubscription = (): void => {
    void lightHaptic();
    if (Platform.OS === 'ios') {
      void Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      void Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else {
      void WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/dashboard`);
    }
  };

  const onPressSignOut = (): void => {
    Alert.alert(
      t('profile.signOutTitle'),
      t('profile.signOutBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOutConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await useAuthStore.getState().logout();
            } catch (err) {
              Alert.alert(
                t('profile.signOutError'),
                err instanceof Error ? err.message : String(err),
              );
            }
            router.replace('/(protected)/(tabs)');
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isAuthenticated ? (
          <Surface
            variant="surfaceElevated"
            radius="xxl"
            padding="xl"
            style={styles.heroCard}
          >
            <View style={styles.heroIdentity}>
              <View style={styles.avatarRing}>
                <Avatar
                  source={
                    seller?.avatarUrl ? { uri: seller.avatarUrl } : undefined
                  }
                  name={displayName}
                  size="xl"
                />
              </View>

              <View style={styles.nameRow}>
                <Text
                  variant="title"
                  weight="bold"
                  numberOfLines={1}
                  style={styles.heroName}
                >
                  {displayName}
                </Text>
                {seller?.verified ? <VerifiedCheck size={16} /> : null}
                {seller?.isPro ? <ProBadge size="sm" /> : null}
              </View>

              {user?.email ? (
                <Text
                  variant="caption"
                  color="tertiary"
                  numberOfLines={1}
                  style={styles.heroEmail}
                >
                  {user.email}
                </Text>
              ) : null}

              {seller?.locationText ? (
                <Pressable
                  onPress={onPressLocation}
                  haptic="light"
                  hitSlop={6}
                  style={styles.locationChip}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.changeLocation')}
                >
                  <Ionicons name="location-outline" size={14} color={colors.brand} />
                  <Text variant="caption" weight="semibold" style={styles.locationText}>
                    {seller.locationText}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={onPressLocation}
                  haptic="light"
                  hitSlop={6}
                  style={styles.locationChipMuted}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.addLocation')}
                >
                  <Ionicons name="add" size={14} color={colors.text.secondary} />
                  <Text variant="caption" weight="semibold" color="secondary">
                    {t('profile.addLocation')}
                  </Text>
                </Pressable>
              )}

              {seller?.bio ? (
                <Text
                  variant="body"
                  color="secondary"
                  style={styles.heroBio}
                  numberOfLines={3}
                >
                  {seller.bio}
                </Text>
              ) : null}
            </View>

            <View style={styles.statsRow}>
              <StatBlock
                count={listingsCount}
                label={t('profile.listingsCountLabel')}
              />
              <View style={styles.statsDivider} />
              <StatBlock
                count={seller?.followersCount ?? 0}
                label={t('social.followers')}
                onPress={seller ? onPressFollowers : undefined}
                accessibilityLabel={t('social.viewFollowersAriaLabel', {
                  count: seller?.followersCount ?? 0,
                })}
              />
              <View style={styles.statsDivider} />
              <StatBlock
                count={seller?.followingCount ?? 0}
                label={t('social.following_count_label')}
                onPress={seller ? onPressFollowing : undefined}
                accessibilityLabel={t('social.viewFollowingAriaLabel', {
                  count: seller?.followingCount ?? 0,
                })}
              />
            </View>

            {seller && (seller.rating > 0 || seller.salesCount > 0) ? (
              <View style={styles.metaRow}>
                {seller.rating > 0 ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="star" size={14} color={colors.feedback.gold} />
                    <Text variant="caption" weight="semibold" color="secondary">
                      {seller.rating.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                {seller.salesCount > 0 ? (
                  <View style={styles.metaItem}>
                    <Ionicons name="bag-handle-outline" size={14} color={colors.text.secondary} />
                    <Text variant="caption" weight="semibold" color="secondary">
                      {`${formatCount(seller.salesCount, currentLang === 'fr' ? 'fr-FR' : 'en-US')} ${t('marketplace.salesUnit', { count: seller.salesCount })}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.heroActions}>
              <Pressable
                onPress={onPressEditSeller}
                haptic="light"
                style={styles.editBtn}
                accessibilityRole="button"
                accessibilityLabel={t('profile.editProfile')}
              >
                <Ionicons name="create-outline" size={16} color={colors.brandText} />
                <Text variant="body" weight="semibold" style={styles.editBtnText}>
                  {t('profile.editProfile')}
                </Text>
              </Pressable>
              {seller ? (
                <Pressable
                  onPress={onPressViewPublic}
                  haptic="light"
                  style={styles.viewPublicBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.viewPublic')}
                >
                  <Ionicons name="eye-outline" size={16} color={colors.text.primary} />
                  <Text variant="body" weight="semibold">
                    {t('profile.viewPublic')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Surface>
        ) : (
          <View style={styles.guestHeader}>
            <Text variant="display" weight="bold">
              {t('profile.guestHeading')}
            </Text>
            <Text variant="body" color="secondary" style={styles.guestSubtitle}>
              {t('profile.guestSubtitle')}
            </Text>
            <View style={styles.ctaStack}>
              <Pressable onPress={onPressSignIn} haptic="medium" style={styles.ctaPrimary}>
                <Text style={styles.ctaPrimaryText}>{t('auth.signIn')}</Text>
              </Pressable>
              <Pressable
                onPress={onPressCreateAccount}
                haptic="light"
                style={styles.ctaSecondary}
              >
                <Text style={styles.ctaSecondaryText}>
                  {t('auth.createAccount')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {showProfilePitch ? (
          <ProUpgradeBanner
            title={t('pro.profileBannerTitle')}
            body={t('pro.profileBannerBody')}
            ctaLabel={t('pro.upgradeCta')}
            onPressCta={openUpgradeFlow}
            onDismiss={() => dismissBanner('profile-pro-pitch')}
            emphasis="soft"
          />
        ) : null}

        {isAuthenticated ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" weight="bold" style={styles.sectionLabel}>
                {t('myListings.title')}
              </Text>
              {listingsCount > 0 ? (
                <Text variant="caption" color="tertiary">
                  {formatCount(listingsCount, currentLang === 'fr' ? 'fr-FR' : 'en-US')}
                </Text>
              ) : null}
            </View>
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
            ) : listingsCount === 0 ? (
              <Text variant="caption" color="tertiary">
                {t('myListings.empty')}
              </Text>
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
            <View style={styles.sectionHeader}>
              <Text variant="caption" weight="bold" style={styles.sectionLabel}>
                {t('orders.title')}
              </Text>
              {(myOrdersQuery.data?.length ?? 0) > 0 ? (
                <Text variant="caption" color="tertiary">
                  {formatCount(myOrdersQuery.data?.length ?? 0, currentLang === 'fr' ? 'fr-FR' : 'en-US')}
                </Text>
              ) : null}
            </View>
            {myOrdersQuery.isLoading ? (
              <ActivityIndicator color={colors.text.secondary} />
            ) : (myOrdersQuery.data?.length ?? 0) === 0 ? (
              <Text variant="caption" color="tertiary">
                {t('orders.empty')}
              </Text>
            ) : (
              <Surface variant="surfaceElevated" radius="lg" border>
                {(myOrdersQuery.data ?? []).map((order, idx, arr) => (
                  <View
                    key={order.id}
                    style={
                      idx < arr.length - 1
                        ? styles.orderRowWithDivider
                        : undefined
                    }
                  >
                    <OrderRow order={order} lang={currentLang} t={t} />
                  </View>
                ))}
              </Surface>
            )}
          </View>
        ) : null}

        {isAuthenticated && (mySalesQuery.data?.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="caption" weight="bold" style={styles.sectionLabel}>
                {t('sales.title')}
              </Text>
              <Text variant="caption" color="tertiary">
                {formatCount(
                  mySalesQuery.data?.length ?? 0,
                  currentLang === 'fr' ? 'fr-FR' : 'en-US',
                )}
              </Text>
            </View>
            <Surface variant="surfaceElevated" radius="lg" border>
              {(mySalesQuery.data ?? []).map((order, idx, arr) => (
                <View
                  key={order.id}
                  style={
                    idx < arr.length - 1
                      ? styles.orderRowWithDivider
                      : undefined
                  }
                >
                  <SaleRow order={order} lang={currentLang} t={t} />
                </View>
              ))}
            </Surface>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="caption" weight="bold" style={styles.sectionLabel}>
            {t('profile.settings')}
          </Text>
          <Surface variant="surfaceElevated" radius="lg" padding="md" border>
            <View style={styles.settingsRow}>
              <Text variant="body" weight="semibold">
                {t('profile.language')}
              </Text>
              <View style={styles.pillRow}>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isActive = lang === currentLang;
                  return (
                    <Pressable
                      key={lang}
                      onPress={() => onPressLang(lang)}
                      haptic="light"
                      style={[
                        styles.pill,
                        isActive ? styles.pillActive : styles.pillInactive,
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
                          size={14}
                          color={colors.brandText}
                          style={styles.pillIcon}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.settingsDivider} />
            <CurrencyPicker />
          </Surface>
        </View>

        {isAuthenticated ? (
          <View style={styles.section}>
            <Text variant="caption" weight="bold" style={styles.sectionLabel}>
              {t('profile.account')}
            </Text>
            <Surface variant="surfaceElevated" radius="lg" border>
              <AccountRow
                icon="notifications-outline"
                label={t('notifications.settingsRow')}
                onPress={() => setShowNotifModal(true)}
                showDivider
              />
              <AccountRow
                icon="create-outline"
                label={t('profile.editProfile')}
                onPress={onPressEditSeller}
                showDivider
              />
              <AccountRow
                icon="heart-outline"
                label={t('onboarding.editTitle')}
                onPress={() =>
                  // as Href: brand-new route, the typed-routes manifest
                  // catches up on next dev-server start.
                  router.push('/(protected)/onboarding?edit=1' as Href)
                }
                showDivider
              />
              {seller ? (
                <AccountRow
                  icon="eye-outline"
                  label={t('profile.viewPublic')}
                  onPress={onPressViewPublic}
                  showDivider
                />
              ) : null}
              {isPro ? (
                <AccountRow
                  icon="globe-outline"
                  label={t('pro.openWebDashboard')}
                  onPress={() =>
                    WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/pro`)
                  }
                  showDivider
                />
              ) : null}
              {isPro ? (
                <AccountRow
                  icon="card-outline"
                  label={t('settings.manageSubscription')}
                  onPress={onPressManageSubscription}
                  showDivider
                />
              ) : null}
              <AccountRow
                icon="log-out-outline"
                label={t('auth.signOut')}
                onPress={onPressSignOut}
                danger
              />
            </Surface>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="caption" weight="bold" style={styles.sectionLabel}>
            {t('settings.legal.title')}
          </Text>
          <Surface variant="surfaceElevated" radius="lg" border>
            <AccountRow
              icon="document-text-outline"
              label={t('settings.legal.privacy')}
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/legal/privacy`)}
              showDivider
            />
            <AccountRow
              icon="document-text-outline"
              label={t('settings.legal.terms')}
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/legal/terms`)}
              showDivider
            />
            <AccountRow
              icon="shield-checkmark-outline"
              label={t('settings.legal.childSafety')}
              onPress={() => WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/legal/child-safety`)}
            />
          </Surface>
        </View>
      </ScrollView>
      <NotificationOptInModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },

  // Hero card
  heroCard: {
    gap: spacing.lg,
  },
  heroIdentity: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  heroName: {
    fontSize: 22,
    color: colors.text.primary,
    flexShrink: 1,
  },
  heroEmail: {
    marginTop: -2,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,90,92,0.12)',
    borderColor: 'rgba(255,90,92,0.32)',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  locationText: {
    color: colors.brand,
  },
  locationChipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceOverlay,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  heroBio: {
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },

  // Stats grid
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statPressable: {
    flex: 1,
  },
  statBlock: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  statNumber: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    textTransform: 'lowercase',
    letterSpacing: 0.4,
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: colors.border,
  },

  // Meta row (rating + sales)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  // Hero action buttons
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  editBtnText: {
    color: colors.brandText,
  },
  viewPublicBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },

  // Guest
  guestHeader: {
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  guestSubtitle: {
    lineHeight: 20,
  },
  ctaStack: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ctaPrimary: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    color: colors.brandText,
    fontSize: 15,
    fontWeight: '700',
  },
  ctaSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },

  // Sections
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: colors.text.tertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Settings row
  settingsRow: {
    gap: spacing.sm,
  },
  settingsDivider: {
    marginVertical: spacing.md,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pillActive: {
    backgroundColor: colors.brand,
  },
  pillInactive: {
    backgroundColor: colors.surfaceOverlay,
    borderColor: colors.border,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
  },
  pillTextActive: {
    color: colors.brandText,
    fontWeight: '700',
  },
  pillTextInactive: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
  pillIcon: {
    marginLeft: spacing.xs,
  },

  // Account rows
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  accountRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  // Listings skeleton
  skeletonGrid: {
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },

  // Orders
  orderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  orderRowWithDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  orderThumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
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
  orderAmount: {
    color: colors.text.primary,
    marginTop: 2,
  },
  orderPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  orderPillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Sales (Phase 8 / Track B)
  saleChevron: {
    marginLeft: spacing.xs,
  },
  saleExpanded: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  saleField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saleAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: 2,
  },
});
