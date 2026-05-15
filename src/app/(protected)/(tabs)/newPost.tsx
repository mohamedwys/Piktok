import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useCreateProduct,
  useListingCap,
  useProduct,
  useUpdateProduct,
  ListingCapReachedError,
  type CreateProductInput,
  type UpdateProductInput,
} from '@/features/marketplace';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';
import { useStripeConnectStatus } from '@/features/marketplace/hooks/useStripeConnectStatus';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import { captureEvent } from '@/lib/posthog';
import { WEB_BASE_URL } from '@/lib/web/constants';
import { CATEGORIES, findCategory } from '@/features/marketplace/data/categories';
import { getLocalized } from '@/i18n/getLocalized';
import { colors } from '@/theme';
import ProUpgradeBanner from '@/components/marketplace/ProUpgradeBanner';
import { useDismissedBanners } from '@/stores/useDismissedBanners';
import { useUpgradeFlow } from '@/hooks/useUpgradeFlow';
import {
  useUserLocation,
  useHasLocation,
} from '@/features/location/stores/useUserLocation';
import { useLocationSheetStore } from '@/stores/useLocationSheetStore';
import { geocodeForSubmit } from '@/lib/geocoding/utils';
import { toast } from '@/shared/ui/toast';

type MediaType = 'image' | 'video';
type PickerMode = 'none' | 'category' | 'subcategory';

export default function SellScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = Boolean(editId);
  const { data: existing, isLoading: loadingProduct } = useProduct(editId ?? null);
  const { mutate: createListing, isPending } = useCreateProduct();
  const updateMutation = useUpdateProduct();

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [mediaIsOriginal, setMediaIsOriginal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [attributesText, setAttributesText] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [location, setLocation] = useState('');
  const [stockAvailable, setStockAvailable] = useState(true);
  const [shippingFree, setShippingFree] = useState(false);
  const [pickupAvailable, setPickupAvailable] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('none');
  // Phase 8 / Track B: hybrid purchase model. Pro sellers can opt
  // into direct-buy on a per-listing basis; non-Pro sellers keep the
  // default 'contact_only' and the toggle is not rendered for them.
  // Track F.C.5 gates the toggle further on Stripe Connect readiness:
  // a Pro seller without an active Connect account sees the toggle
  // disabled with a deep-link to /pro/payouts on web.
  const isPro = useIsPro();
  const connect = useStripeConnectStatus();
  const showBuyNowGate = isPro && !connect.loading && !connect.isConnected;
  const [purchaseMode, setPurchaseMode] =
    useState<'buy_now' | 'contact_only'>('contact_only');
  const [openingConnect, setOpeningConnect] = useState(false);
  const submittingRef = useRef(false);
  const gateShownRef = useRef(false);

  const hasUserLocation = useHasLocation();
  const userDisplayName = useUserLocation((s) => s.displayName);
  const openLocationSheet = useLocationSheetStore((s) => s.open);

  // Phase H.4 — sell-flow upsell banner state. Visibility:
  //   - Hidden while the cap query is loading (avoids flicker).
  //   - Hidden for Pro sellers (the cap doesn't apply to them).
  //   - Hidden for 24h after the user dismisses via the X button.
  //   - Hidden in edit mode — the cap only applies to the create
  //     path; editing an existing listing is always allowed.
  // Urgent emphasis kicks in when remaining ≤ 2 (8/10 or 9/10
  // used) — the user is about to hit the wall, so the banner
  // visually escalates to filled coral CTA + urgent border.
  const cap = useListingCap();
  const capDismissed = useDismissedBanners((s) =>
    s.isDismissed('sell-flow-cap'),
  );
  const dismissBanner = useDismissedBanners((s) => s.dismiss);
  const openUpgradeFlow = useUpgradeFlow();
  const showSellFlowBanner =
    !isEdit && !cap.loading && !cap.isPro && !capDismissed;
  const sellFlowBannerEmphasis: 'soft' | 'urgent' =
    cap.remaining <= 2 ? 'urgent' : 'soft';

  const onPressPrefillLocation = (): void => {
    void lightHaptic();
    if (hasUserLocation && userDisplayName) {
      setLocation(userDisplayName);
      return;
    }
    openLocationSheet();
  };

  // F.C.5 gate telemetry: fire once per mount when the gate first appears.
  // The ref prevents duplicate events on benign re-renders (form state,
  // keyboard transitions). It resets on screen unmount, which matches the
  // intended "once per session of this screen" semantic.
  useEffect(() => {
    if (showBuyNowGate && !gateShownRef.current) {
      gateShownRef.current = true;
      captureEvent('pro_buy_now_gate_shown', { surface: 'mobile_sell' });
    }
  }, [showBuyNowGate]);

  const onPressSetUpConnect = async (): Promise<void> => {
    void lightHaptic();
    captureEvent('pro_buy_now_gate_tapped');
    setOpeningConnect(true);
    try {
      await WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/pro/payouts`, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } finally {
      setOpeningConnect(false);
    }
  };

  const selectedCategory = categoryId ? findCategory(categoryId) : undefined;
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (s) => s.id === subcategoryId
  );

  useEffect(() => {
    if (!existing) return;
    setTitle(getLocalized(existing.title, i18n.language));
    setDescription(getLocalized(existing.description, i18n.language));
    setPriceText(String(existing.price));
    if (existing.categoryId) setCategoryId(existing.categoryId);
    if (existing.subcategoryId) setSubcategoryId(existing.subcategoryId);
    setAttributesText(
      existing.attributes
        .map((a) => getLocalized(a.label, i18n.language))
        .join(', '),
    );
    setDimensions(existing.dimensions ?? '');
    setStockAvailable(existing.stock.available);
    setShippingFree(existing.shipping.free);
    setPickupAvailable(existing.pickup?.available ?? false);
    setLocation(existing.location ?? '');
    setMediaUri(existing.media.url);
    setMediaType(existing.media.type);
    setMediaIsOriginal(true);
    setPurchaseMode(existing.purchaseMode ?? 'contact_only');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const player = useVideoPlayer(
    mediaType === 'video' ? mediaUri : null,
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  const onPressSignIn = (): void => {
    void lightHaptic();
    router.push('/(auth)/login');
  };

  const launchCamera = async (): Promise<void> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('sell.fail'), t('sell.cameraPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setMediaUri(a.uri);
      setMediaType(a.type === 'video' ? 'video' : 'image');
      setMediaIsOriginal(false);
    }
  };

  const launchGallery = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('sell.fail'), t('sell.galleryPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setMediaUri(a.uri);
      setMediaType(a.type === 'video' ? 'video' : 'image');
      setMediaIsOriginal(false);
    }
  };

  const promptMediaSource = (): void => {
    void lightHaptic();
    Alert.alert(
      t('sell.sourcePrompt'),
      undefined,
      [
        { text: t('sell.sourceCamera'), onPress: () => { void launchCamera(); } },
        { text: t('sell.sourceGallery'), onPress: () => { void launchGallery(); } },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const onSubmit = async (): Promise<void> => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
    if (!mediaUri || !mediaType) {
      Alert.alert(t('sell.fail'), t('sell.missingMedia'));
      return;
    }
    if (
      !title.trim() ||
      !description.trim() ||
      !priceText.trim() ||
      !selectedCategory ||
      !selectedSubcategory
    ) {
      Alert.alert(t('sell.fail'), t('sell.missingFields'));
      return;
    }
    const price = Number(priceText.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert(t('sell.fail'), t('sell.invalidPrice'));
      return;
    }

    const attributes = attributesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((label, i) => ({ id: `attr-${i}`, label }));

    void mediumHaptic();

    // Best-effort submit-time geocoding for the create path. Silent on
    // failure — the listing is saved regardless. (Edit path doesn't yet
    // re-geocode; see G.8 changelog follow-ups.)
    const trimmedLocation = location.trim();
    const coords =
      !isEdit && trimmedLocation.length > 0
        ? await geocodeForSubmit(trimmedLocation)
        : null;

    if (isEdit && editId) {
      const updatePayload: UpdateProductInput = {
        title: title.trim(),
        description: description.trim(),
        price,
        currency: 'EUR',
        category: {
          primary: selectedCategory.label,
          secondary: selectedSubcategory.label,
        },
        categoryId: selectedCategory.id,
        subcategoryId: selectedSubcategory.id,
        attributes,
        dimensions: dimensions.trim() || undefined,
        stockAvailable,
        shippingFree,
        pickupAvailable,
        purchaseMode,
        location: location.trim() || undefined,
        newMediaUri: mediaIsOriginal ? undefined : mediaUri,
        newMediaType: mediaIsOriginal ? undefined : mediaType,
      };
      updateMutation.mutate(
        { id: editId, input: updatePayload },
        {
          onSuccess: () => {
            toast.success(
              t('sell.updateSuccessTitle'),
              t('sell.updateSuccessMessage'),
            );
            router.back();
          },
          onError: (err) => {
            toast.error(t('sell.updateFail'), err.message ?? t('common.errorGeneric'));
          },
        },
      );
      return;
    }

    const payload: CreateProductInput = {
      title: title.trim(),
      description: description.trim(),
      price,
      currency: 'EUR',
      mediaUri,
      mediaType,
      category: {
        primary: selectedCategory.label,
        secondary: selectedSubcategory.label,
      },
      categoryId: selectedCategory.id,
      subcategoryId: selectedSubcategory.id,
      attributes,
      dimensions: dimensions.trim() || undefined,
      stockAvailable,
      shippingFree,
      pickupAvailable,
      purchaseMode,
      location: trimmedLocation || undefined,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : null),
    };

    createListing(payload, {
      onSuccess: () => {
        toast.success(t('sell.success'));
        setMediaUri(null);
        setMediaType(null);
        setTitle('');
        setDescription('');
        setPriceText('');
        setCategoryId(null);
        setSubcategoryId(null);
        setAttributesText('');
        setDimensions('');
        setLocation('');
        setStockAvailable(true);
        setShippingFree(false);
        setPickupAvailable(false);
        setPurchaseMode('contact_only');
        router.replace('/(protected)/(tabs)');
      },
      onError: (err) => {
        // H.3: free-tier cap is the structured branch — surface a
        // distinct dialog with an upgrade CTA. H.5 consolidation:
        // the "Upgrade to Pro" button now routes through the shared
        // `useUpgradeFlow` hook so the cap modal, the sell-flow
        // banner, the profile pitch banner, and the action-rail
        // checkout-gate all open the same web flow via the same
        // code path.
        if (err instanceof ListingCapReachedError) {
          Alert.alert(
            t('sell.listingCapReachedTitle'),
            t('sell.listingCapReachedBody', { cap: err.cap }),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('sell.upgradeToPro'),
                onPress: openUpgradeFlow,
              },
            ],
          );
          return;
        }
        toast.error(t('sell.fail'), err.message ?? t('common.errorGeneric'));
      },
    });
    } finally {
      submittingRef.current = false;
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <View style={styles.guestWrap}>
          <Text style={styles.title}>{t('sell.title')}</Text>
          <Text style={styles.guestSubtitle}>{t('sell.guestHint')}</Text>
          <Pressable
            onPress={onPressSignIn}
            style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.ctaPrimaryText}>{t('auth.signIn')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isEdit && loadingProduct) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const headerTitle = isEdit ? t('sell.editTitle') : t('sell.title');
  const headerSubtitle = isEdit ? t('sell.editSubtitle') : t('sell.subtitle');
  const submitting = isEdit ? updateMutation.isPending : isPending;
  const submitLabel = isEdit
    ? (updateMutation.isPending ? t('sell.updating') : t('sell.update'))
    : (isPending ? t('sell.submitting') : t('sell.submit'));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {showSellFlowBanner ? (
              <ProUpgradeBanner
                title={t('pro.sellFlowBannerTitle', {
                  used: cap.used,
                  cap: cap.cap ?? 0,
                })}
                body={t('pro.sellFlowBannerBody')}
                ctaLabel={t('pro.upgradeCta')}
                onPressCta={openUpgradeFlow}
                onDismiss={() => dismissBanner('sell-flow-cap')}
                emphasis={sellFlowBannerEmphasis}
              />
            ) : null}

            <View>
              <Text style={styles.title}>{headerTitle}</Text>
              <Text style={styles.subtitle}>{headerSubtitle}</Text>
            </View>

            <View>
              <Pressable
                onPress={promptMediaSource}
                style={({ pressed }) => [
                  styles.mediaArea,
                  !mediaUri && styles.mediaAreaEmpty,
                  pressed && styles.pressed,
                ]}
              >
                {mediaUri && mediaType === 'image' ? (
                  <Image
                    source={{ uri: mediaUri }}
                    style={styles.mediaPreview}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="memory-disk"
                  />
                ) : null}
                {mediaUri && mediaType === 'video' ? (
                  <VideoView
                    player={player}
                    style={styles.mediaPreview}
                    contentFit="cover"
                    nativeControls={false}
                  />
                ) : null}
                {!mediaUri ? (
                  <View style={styles.mediaPlaceholder}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={36}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.mediaPlaceholderText}>
                      {t('sell.mediaPicker')}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              {mediaUri ? (
                <Text style={styles.mediaReplaceHint}>
                  {t('sell.mediaPickerReplace')}
                </Text>
              ) : null}
            </View>

            <Field
              label={t('sell.titleLabel')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('sell.titlePlaceholder')}
            />

            <Field
              label={t('sell.descriptionLabel')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('sell.descriptionPlaceholder')}
              multiline
            />

            <Field
              label={t('sell.priceLabel')}
              value={priceText}
              onChangeText={setPriceText}
              placeholder={t('sell.pricePlaceholder')}
              keyboardType="decimal-pad"
            />

            <SelectorField
              label={t('sell.categoryField')}
              displayValue={
                selectedCategory ? getLocalized(selectedCategory.label, i18n.language) : null
              }
              placeholder={t('sell.categoryPlaceholder')}
              onPress={() => {
                void lightHaptic();
                setPickerMode('category');
              }}
            />

            <SelectorField
              label={t('sell.subcategoryField')}
              displayValue={
                selectedSubcategory ? getLocalized(selectedSubcategory.label, i18n.language) : null
              }
              placeholder={
                selectedCategory ? t('sell.subcategoryPlaceholder') : t('sell.subcategoryHint')
              }
              disabled={!selectedCategory}
              onPress={() => {
                void lightHaptic();
                setPickerMode('subcategory');
              }}
            />

            <Field
              label={t('sell.attributesLabel')}
              value={attributesText}
              onChangeText={setAttributesText}
              placeholder={t('sell.attributesPlaceholder')}
              hint={t('sell.attributesHint')}
            />

            <Field
              label={t('sell.dimensionsLabel')}
              value={dimensions}
              onChangeText={setDimensions}
              placeholder={t('sell.dimensionsPlaceholder')}
            />

            <View style={styles.field}>
              <View style={styles.locationLabelRow}>
                <Text style={styles.fieldLabel}>{t('sell.locationField')}</Text>
                <Pressable
                  onPress={onPressPrefillLocation}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.prefillButton,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasUserLocation
                      ? t('sell.useMyLocation')
                      : t('sell.setMyLocation')
                  }
                >
                  <Ionicons
                    name={hasUserLocation ? 'location' : 'location-outline'}
                    size={12}
                    color={colors.brand}
                  />
                  <Text style={styles.prefillText}>
                    {hasUserLocation
                      ? t('sell.useMyLocation')
                      : t('sell.setMyLocation')}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder={t('sell.locationPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.input}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('sell.stockAvailable')}</Text>
              <Switch
                value={stockAvailable}
                onValueChange={setStockAvailable}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.brand }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('sell.shippingFree')}</Text>
              <Switch
                value={shippingFree}
                onValueChange={setShippingFree}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.brand }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('sell.pickupAvailable')}</Text>
              <Switch
                value={pickupAvailable}
                onValueChange={setPickupAvailable}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.brand }}
                thumbColor="#fff"
              />
            </View>

            {isPro ? (
              <View>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={[
                        styles.switchLabel,
                        showBuyNowGate && styles.switchLabelDisabled,
                      ]}
                    >
                      {t('sell.allowDirectBuy')}
                    </Text>
                    <Text style={styles.switchHint}>
                      {t('sell.allowDirectBuyHint')}
                    </Text>
                  </View>
                  <Switch
                    value={purchaseMode === 'buy_now'}
                    onValueChange={(v) =>
                      setPurchaseMode(v ? 'buy_now' : 'contact_only')
                    }
                    disabled={showBuyNowGate}
                    trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.brand }}
                    thumbColor="#fff"
                  />
                </View>
                {showBuyNowGate ? (
                  <View style={styles.gateBox}>
                    <Text style={styles.gateCaption}>
                      {t('pro.sellFlow.gate.caption')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        void onPressSetUpConnect();
                      }}
                      disabled={openingConnect}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('pro.sellFlow.gate.caption')}
                      style={({ pressed }) => [
                        styles.gateCta,
                        (pressed || openingConnect) && styles.pressed,
                      ]}
                    >
                      <Text style={styles.gateCtaText}>
                        {openingConnect
                          ? t('pro.sellFlow.gate.opening')
                          : t('pro.sellFlow.gate.cta')}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={colors.brand}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                void onSubmit();
              }}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || submitting) && styles.pressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>{submitLabel}</Text>
              )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerMode !== 'none'}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerMode('none')}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {pickerMode === 'category'
                ? t('sell.categoryField')
                : t('sell.subcategoryField')}
            </Text>
            <FlatList
              data={
                pickerMode === 'category'
                  ? CATEGORIES
                  : selectedCategory?.subcategories ?? []
              }
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    void lightHaptic();
                    if (pickerMode === 'category') {
                      setCategoryId(item.id);
                      setSubcategoryId(null);
                    } else {
                      setSubcategoryId(item.id);
                    }
                    setPickerMode('none');
                  }}
                  style={({ pressed }) => [
                    styles.modalRow,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.modalRowText}>
                    {getLocalized(item.label, i18n.language)}
                  </Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
            />
            <Pressable
              onPress={() => setPickerMode('none')}
              style={({ pressed }) => [
                styles.modalCancel,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type SelectorFieldProps = {
  label: string;
  displayValue: string | null;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
};

function SelectorField({
  label,
  displayValue,
  placeholder,
  onPress,
  disabled,
}: SelectorFieldProps): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.selectorCard,
          disabled && styles.selectorCardDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.selectorValue,
            !displayValue && styles.selectorPlaceholder,
          ]}
          numberOfLines={1}
        >
          {displayValue ?? placeholder}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color="rgba(255,255,255,0.4)"
        />
      </Pressable>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad';
  hint?: string;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  hint,
}: FieldProps): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.35)"
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    gap: 16,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 4,
  },
  guestWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 12,
  },
  guestSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
  ctaPrimary: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  mediaArea: {
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  mediaAreaEmpty: {
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaPlaceholderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaReplaceHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  locationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 90, 92, 0.16)',
  },
  prefillText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fieldHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  input: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  switchHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  switchLabelDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
  gateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 90, 92, 0.10)',
    borderColor: 'rgba(255, 90, 92, 0.25)',
    borderWidth: 1,
    gap: 12,
  },
  gateCaption: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 16,
  },
  gateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 90, 92, 0.16)',
  },
  gateCtaText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  submitButton: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  selectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  selectorCardDisabled: {
    opacity: 0.5,
  },
  selectorValue: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  selectorPlaceholder: {
    color: 'rgba(255,255,255,0.35)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalRow: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  modalRowText: {
    color: '#fff',
    fontSize: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalCancel: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
