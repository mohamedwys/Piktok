import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useCreateProduct,
  type CreateProductInput,
} from '@/features/marketplace';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';
import ResponsiveContainer from '@/components/GenericComponents/ResponsiveContainer';

const BRAND_PRIMARY = '#FE2C55';

type MediaType = 'image' | 'video';

export default function SellScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { mutate: createListing, isPending } = useCreateProduct();

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [categoryPrimary, setCategoryPrimary] = useState('');
  const [categorySecondary, setCategorySecondary] = useState('');
  const [attributesText, setAttributesText] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [stockAvailable, setStockAvailable] = useState(true);
  const [shippingFree, setShippingFree] = useState(false);

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

  const onSubmit = (): void => {
    if (!mediaUri || !mediaType) {
      Alert.alert(t('sell.fail'), t('sell.missingMedia'));
      return;
    }
    if (
      !title.trim() ||
      !description.trim() ||
      !priceText.trim() ||
      !categoryPrimary.trim() ||
      !categorySecondary.trim()
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

    const payload: CreateProductInput = {
      title: title.trim(),
      description: description.trim(),
      price,
      currency: 'EUR',
      mediaUri,
      mediaType,
      category: {
        primary: categoryPrimary.trim(),
        secondary: categorySecondary.trim(),
      },
      attributes,
      dimensions: dimensions.trim() || undefined,
      stockAvailable,
      shippingFree,
    };

    void mediumHaptic();
    createListing(payload, {
      onSuccess: () => {
        Alert.alert(t('sell.success'));
        setMediaUri(null);
        setMediaType(null);
        setTitle('');
        setDescription('');
        setPriceText('');
        setCategoryPrimary('');
        setCategorySecondary('');
        setAttributesText('');
        setDimensions('');
        setStockAvailable(true);
        setShippingFree(false);
        router.replace('/(protected)/(tabs)');
      },
      onError: (err) => {
        Alert.alert(t('sell.fail'), err.message || t('common.errorGeneric'));
      },
    });
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <ResponsiveContainer>
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
        </ResponsiveContainer>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ResponsiveContainer>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 8}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View>
              <Text style={styles.title}>{t('sell.title')}</Text>
              <Text style={styles.subtitle}>{t('sell.subtitle')}</Text>
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
                    resizeMode="cover"
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

            <Field
              label={t('sell.categoryPrimaryLabel')}
              value={categoryPrimary}
              onChangeText={setCategoryPrimary}
              placeholder={t('sell.categoryPrimaryPlaceholder')}
            />

            <Field
              label={t('sell.categorySecondaryLabel')}
              value={categorySecondary}
              onChangeText={setCategorySecondary}
              placeholder={t('sell.categorySecondaryPlaceholder')}
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

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('sell.stockAvailable')}</Text>
              <Switch
                value={stockAvailable}
                onValueChange={setStockAvailable}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: BRAND_PRIMARY }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('sell.shippingFree')}</Text>
              <Switch
                value={shippingFree}
                onValueChange={setShippingFree}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: BRAND_PRIMARY }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={isPending}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || isPending) && styles.pressed,
              ]}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>{t('sell.submit')}</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </ResponsiveContainer>
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
    backgroundColor: BRAND_PRIMARY,
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
  submitButton: {
    backgroundColor: BRAND_PRIMARY,
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
});
