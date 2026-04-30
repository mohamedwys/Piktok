import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { useProduct } from '@/features/marketplace/hooks/useProduct';
import { useUserEngagement } from '@/features/marketplace/hooks/useUserEngagement';
import { useToggleBookmark } from '@/features/marketplace/hooks/useToggleBookmark';
import { attributeIcon } from '@/features/marketplace/utils/attributeIcon';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { useRequireAuth } from '@/stores/useRequireAuth';
import { getLocalized } from '@/i18n/getLocalized';
import { formatCount } from '@/features/marketplace/utils/formatCount';
import type {
  Product,
  ProductAttribute,
} from '@/features/marketplace/types/product';

const BRAND_PRIMARY = '#FE2C55';
const SHEET_BG = '#0a0a0a';
const BOOKMARK_COLOR = '#FFC83D';

function formatPrice(value: number, currency: Product['currency']): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(value);
}

function ChipIcon({ iconKey }: { iconKey?: string }): React.ReactElement {
  const icon = attributeIcon(iconKey);
  if (icon.family === 'ionicons') {
    return (
      <Ionicons
        name={icon.name as React.ComponentProps<typeof Ionicons>['name']}
        size={11}
        color="#fff"
      />
    );
  }
  if (icon.family === 'material') {
    return (
      <MaterialIcons
        name={icon.name as React.ComponentProps<typeof MaterialIcons>['name']}
        size={11}
        color="#fff"
      />
    );
  }
  return <View style={styles.dot} />;
}

function AttributeChip({
  attribute,
  lang,
}: {
  attribute: ProductAttribute;
  lang: string;
}): React.ReactElement {
  return (
    <View style={styles.chip}>
      <ChipIcon iconKey={attribute.iconKey} />
      <Text style={styles.chipText}>
        {` ${getLocalized(attribute.label, lang)}`}
      </Text>
    </View>
  );
}

export default function ProductDetailSheet(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const productId = useProductSheetStore((s) => s.productId);
  const close = useProductSheetStore((s) => s.close);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  const { data: product, isLoading, isError } = useProduct(productId);
  const { data: engagement } = useUserEngagement();
  const isBookmarked = product
    ? (engagement?.bookmarkedIds.has(product.id) ?? false)
    : false;
  const toggleBookmark = useToggleBookmark(product?.id ?? '');
  const { requireAuth } = useRequireAuth();

  useEffect(() => {
    if (productId) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [productId]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) close();
    },
    [close],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        opacity={0.6}
      />
    ),
    [],
  );

  const onPressBookmark = (): void => {
    if (!product) return;
    if (!requireAuth()) return;
    void lightHaptic();
    toggleBookmark.mutate(isBookmarked);
  };

  const onPressBuyNow = (): void => {
    void mediumHaptic();
    if (!requireAuth()) return;
    // Real checkout flow is wired in a future step.
  };

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={styles.ctaContainer}>
          <Pressable
            onPress={onPressBuyNow}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text style={styles.ctaText}>{t('marketplace.buyNow')}</Text>
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, requireAuth],
  );

  const renderContent = (): React.ReactElement => {
    if (isLoading) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator color="#fff" />
        </View>
      );
    }
    if (isError || !product) {
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.errorText}>{t('marketplace.loadProductError')}</Text>
        </View>
      );
    }

    const title = getLocalized(product.title, lang);
    const description = getLocalized(product.description, lang);
    const stockLabel = product.stock.label
      ? getLocalized(product.stock.label, lang)
      : product.stock.available
        ? t('marketplace.inStock')
        : t('marketplace.outOfStock');
    const shippingLabel = product.shipping.label
      ? getLocalized(product.shipping.label, lang)
      : product.shipping.free
        ? t('marketplace.freeShipping')
        : t('marketplace.shippingTbd');
    const hasAvatar = product.seller.avatarUrl.length > 0;

    return (
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          source={{ uri: product.media.thumbnailUrl ?? product.media.url }}
          style={styles.hero}
          resizeMode="cover"
        />

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatPrice(product.price, product.currency)}
            </Text>
            <Pressable onPress={onPressBookmark} hitSlop={10}>
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={isBookmarked ? BOOKMARK_COLOR : '#fff'}
              />
            </Pressable>
          </View>

          <Text style={styles.title}>{title}</Text>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: product.stock.available
                    ? '#33D17A'
                    : '#F36161',
                },
              ]}
            />
            <Text style={styles.stockText}>{` ${stockLabel}`}</Text>
            <MaterialIcons
              name="local-shipping"
              size={13}
              color="rgba(255,255,255,0.85)"
              style={styles.shippingIcon}
            />
            <Text style={styles.shippingText}>{` ${shippingLabel}`}</Text>
          </View>

          {description.length > 0 ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}

          {product.attributes.length > 0 ? (
            <View style={styles.chipsRow}>
              {product.attributes.map((attr) => (
                <AttributeChip key={attr.id} attribute={attr} lang={lang} />
              ))}
            </View>
          ) : null}

          {product.dimensions && product.dimensions.length > 0 ? (
            <View style={styles.dimensionsChip}>
              <MaterialIcons name="straighten" size={11} color="#fff" />
              <Text style={styles.chipText}>{` ${product.dimensions}`}</Text>
            </View>
          ) : null}

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              {hasAvatar ? (
                <Image
                  source={{ uri: product.seller.avatarUrl }}
                  style={styles.sellerAvatarImg}
                />
              ) : null}
            </View>
            <View style={styles.sellerText}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {product.seller.name}
                </Text>
                {product.seller.verified ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color="#3b9eff"
                    style={styles.verifiedIcon}
                  />
                ) : null}
              </View>
              <View style={styles.sellerMetaRow}>
                <Ionicons name="star" size={11} color={BOOKMARK_COLOR} />
                <Text style={styles.sellerMetaText} numberOfLines={1}>
                  {` ${product.seller.rating.toFixed(1)} · ${formatCount(
                    product.seller.salesCount,
                  )} ${t('marketplace.salesUnit', {
                    count: product.seller.salesCount,
                  })}`}
                </Text>
              </View>
            </View>
            <Pressable style={styles.profilePill} hitSlop={6}>
              <Text style={styles.profilePillText}>
                {t('common.viewProfile')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheetScrollView>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      {renderContent()}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: SHEET_BG,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  hero: {
    width: '100%',
    height: 280,
    backgroundColor: '#1a1a1a',
  },
  body: {
    padding: 16,
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  stockText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  shippingIcon: {
    marginLeft: 12,
  },
  shippingText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dimensionsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  sellerAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sellerText: {
    flex: 1,
    flexShrink: 1,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  sellerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sellerMetaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    flexShrink: 1,
  },
  profilePill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  profilePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  ctaContainer: {
    paddingHorizontal: 16,
  },
  ctaButton: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
