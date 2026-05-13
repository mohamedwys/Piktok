import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Pressable, Surface, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useUpdateMySeller } from '@/features/marketplace/hooks/useUpdateMySeller';
import {
  type UpdateMySellerInput,
} from '@/features/marketplace/services/sellers';
import EditProfileLocationSheet from '@/components/profile/EditProfileLocationSheet';
import FormField from '@/components/profile/FormField';
import SectionHeader from '@/components/profile/SectionHeader';
import TypedConfirmModal from '@/components/profile/TypedConfirmModal';
import { useEditProfileLocationSheetStore } from '@/stores/useEditProfileLocationSheetStore';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  deleteAvatarByUrl,
  uploadAvatar,
} from '@/lib/storage/avatars';
import { deleteMyAccount } from '@/features/auth/services/auth';
import { supabase } from '@/lib/supabase';
import type { GeoLocation } from '@/lib/geocoding/types';

const BIO_MAX = 500;
const URL_PATTERN = /^https?:\/\//i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

type FormState = {
  name: string;
  bio: string;
  website: string;
  phonePublic: string;
  emailPublic: string;
  latitude: number | null;
  longitude: number | null;
  locationText: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: '',
  bio: '',
  website: '',
  phonePublic: '',
  emailPublic: '',
  latitude: null,
  longitude: null,
  locationText: '',
};

export default function EditSellerProfileScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { data: existing, isLoading } = useMySeller(true);
  const updateMutation = useUpdateMySeller();
  const openLocationSheet = useEditProfileLocationSheetStore((s) => s.open);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [uploading, setUploading] = useState(false);

  // Initialize the form exactly once per mount. Two cases:
  //   (a) seller row exists -> hydrate form from it.
  //   (b) seller row does NOT exist yet (fresh account; the row is only
  //       created on first save via get_or_create_seller_for_current_user)
  //       -> prefill `name` from the auth user so the `name` validation
  //       gate doesn't silently disable the Save button before the first
  //       save can ever fire.
  // The init-once guard prevents wiping in-progress edits when `existing`
  // transitions from null -> row (e.g., after a successful avatar upload
  // creates the seller row mid-edit).
  const formInitializedRef = useRef(false);
  useEffect(() => {
    if (formInitializedRef.current) return;
    if (existing) {
      const fallbackName =
        useAuthStore.getState().user?.username
        || useAuthStore.getState().user?.email?.split('@')[0]
        || '';
      const initial: FormState = {
        name: existing.name && existing.name.length > 0
          ? existing.name
          : fallbackName,
        bio: existing.bio ?? '',
        website: existing.website ?? '',
        phonePublic: existing.phonePublic ?? '',
        emailPublic: existing.emailPublic ?? '',
        latitude: existing.latitude,
        longitude: existing.longitude,
        locationText: existing.locationText ?? '',
      };
      setForm(initial);
      setInitialForm(initial);
      formInitializedRef.current = true;
      return;
    }
    if (isLoading) return;
    const user = useAuthStore.getState().user;
    const fallbackName =
      user?.username || user?.email?.split('@')[0] || '';
    if (!fallbackName) return;
    const initial: FormState = { ...EMPTY_FORM, name: fallbackName };
    setForm(initial);
    setInitialForm(initial);
    formInitializedRef.current = true;
  }, [existing, isLoading]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const validate = useCallback((next: FormState): FormErrors => {
    const e: FormErrors = {};
    if (next.name.trim().length === 0) {
      e.name = t('profile.validationNameRequired');
    }
    if (next.website.trim().length > 0 && !URL_PATTERN.test(next.website.trim())) {
      e.website = t('profile.validationWebsiteInvalid');
    }
    if (
      next.emailPublic.trim().length > 0
      && !EMAIL_PATTERN.test(next.emailPublic.trim())
    ) {
      e.emailPublic = t('profile.validationEmailInvalid');
    }
    if (
      next.phonePublic.trim().length > 0
      && next.phonePublic.trim().length < 6
    ) {
      e.phonePublic = t('profile.validationPhoneTooShort');
    }
    if (next.bio.length > BIO_MAX) {
      e.bio = t('profile.validationBioTooLong');
    }
    return e;
  }, [t]);

  const visibleErrors = useMemo(() => validate(form), [form, validate]);
  const hasErrors = Object.keys(visibleErrors).length > 0;

  const handleSetField = useCallback(<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleLocationSelect = useCallback((loc: GeoLocation) => {
    setForm((prev) => ({
      ...prev,
      latitude: loc.latitude,
      longitude: loc.longitude,
      locationText: loc.displayName,
    }));
  }, []);

  const handlePickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('profile.permissionRequiredTitle'),
        t('profile.permissionRequiredBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.openSettings'),
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) {
      Alert.alert(
        t('profile.uploadErrorTitle'),
        t('profile.uploadErrorBody'),
      );
      return;
    }

    const previousUrl = existing?.avatarUrl ?? '';
    setUploading(true);
    try {
      const { publicUrl } = await uploadAvatar(userId, result.assets[0].uri);
      await updateMutation.mutateAsync({ avatarUrl: publicUrl });
      if (previousUrl.length > 0 && previousUrl !== publicUrl) {
        void deleteAvatarByUrl(previousUrl);
      }
    } catch {
      Alert.alert(
        t('profile.uploadErrorTitle'),
        t('profile.uploadErrorBody'),
      );
    } finally {
      setUploading(false);
    }
  }, [existing?.avatarUrl, updateMutation, t]);

  const handleDeletePhoto = useCallback(() => {
    Alert.alert(
      t('profile.deletePhotoConfirmTitle'),
      t('profile.deletePhotoConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deletePhoto'),
          style: 'destructive',
          onPress: async () => {
            const previousUrl = existing?.avatarUrl ?? '';
            setUploading(true);
            try {
              await updateMutation.mutateAsync({ avatarUrl: '' });
              if (previousUrl.length > 0) {
                void deleteAvatarByUrl(previousUrl);
              }
            } catch {
              Alert.alert(
                t('profile.deleteErrorTitle'),
                t('profile.deleteErrorBody'),
              );
            } finally {
              setUploading(false);
            }
          },
        },
      ],
    );
  }, [existing?.avatarUrl, updateMutation, t]);

  const handleEditPhoto = useCallback(() => {
    if (uploading) return;
    const hasAvatar = (existing?.avatarUrl ?? '').length > 0;
    const buttons = hasAvatar
      ? [
          { text: t('profile.choosePhoto'), onPress: () => void handlePickPhoto() },
          {
            text: t('profile.deletePhoto'),
            style: 'destructive' as const,
            onPress: handleDeletePhoto,
          },
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      : [
          { text: t('profile.choosePhoto'), onPress: () => void handlePickPhoto() },
          { text: t('common.cancel'), style: 'cancel' as const },
        ];
    Alert.alert(t('profile.editPhotoTitle'), undefined, buttons);
  }, [
    uploading,
    existing?.avatarUrl,
    handlePickPhoto,
    handleDeletePhoto,
    t,
  ]);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChangeEmail = useCallback(() => {
    router.push('/(protected)/account/change-email');
  }, [router]);

  const handleChangePassword = useCallback(() => {
    router.push('/(protected)/account/change-password');
  }, [router]);

  const handleSignOut = useCallback(() => {
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
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }, [router, t]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('profile.deleteAccountTitle'),
      t('profile.deleteAccountWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccountContinue'),
          style: 'destructive',
          onPress: () => setDeleteModalVisible(true),
        },
      ],
    );
  }, [t]);

  const handleDeleteConfirm = useCallback(async () => {
    setDeleteModalVisible(false);
    setDeleting(true);
    try {
      await deleteMyAccount();
      router.replace('/(auth)/login');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('profile.deleteErrorBody');
      Alert.alert(t('profile.deleteErrorTitle'), message);
    } finally {
      setDeleting(false);
    }
  }, [router, t]);

  const performSave = useCallback(async () => {
    // Derive a safe fallback name from the auth user. If `form.name` is
    // somehow empty when Save is tapped (auth-store didn't restore a
    // username, edge cases with empty seller rows, etc.), use the fallback
    // so the save proceeds — the get_or_create_seller_for_current_user RPC
    // will create / update the row with that name. The user can later
    // change the name in the same form. This pairs with dropping
    // `hasErrors` from the disable gate so the button is never silently
    // disabled with no recourse.
    const user = useAuthStore.getState().user;
    const fallbackName =
      user?.username || user?.email?.split('@')[0] || 'User';
    const safeForm: FormState = {
      ...form,
      name: form.name.trim().length > 0 ? form.name : fallbackName,
    };

    const finalErrors = validate(safeForm);
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return false;
    }

    const patch: UpdateMySellerInput = {};
    if (safeForm.name.trim() !== initialForm.name) {
      patch.name = safeForm.name.trim();
    }
    if (form.bio !== initialForm.bio) patch.bio = form.bio.trim();
    if (form.website !== initialForm.website) {
      patch.website = form.website.trim();
    }
    if (form.phonePublic !== initialForm.phonePublic) {
      patch.phonePublic = form.phonePublic.trim();
    }
    if (form.emailPublic !== initialForm.emailPublic) {
      patch.emailPublic = form.emailPublic.trim();
    }
    if (form.latitude !== initialForm.latitude) patch.latitude = form.latitude;
    if (form.longitude !== initialForm.longitude) {
      patch.longitude = form.longitude;
    }
    if (form.locationText !== initialForm.locationText) {
      patch.locationText = form.locationText.length > 0
        ? form.locationText
        : null;
    }

    if (Object.keys(patch).length === 0) {
      // Nothing actually changed in trimmed values.
      setInitialForm(safeForm);
      return true;
    }

    try {
      await updateMutation.mutateAsync(patch);
      setInitialForm(safeForm);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert(t('sellerProfile.saveFail'), message);
      return false;
    }
  }, [form, initialForm, updateMutation, validate, t]);

  const handleSavePress = useCallback(async () => {
    const ok = await performSave();
    if (ok) router.back();
  }, [performSave, router]);

  const handleBackPress = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      t('profile.unsavedChangesTitle'),
      t('profile.unsavedChangesBody'),
      [
        { text: t('profile.continueEditing'), style: 'cancel' },
        {
          text: t('profile.discardChanges'),
          style: 'destructive',
          onPress: () => {
            setInitialForm(form);
            // Defer navigation so the listener sees a non-dirty form.
            requestAnimationFrame(() => router.back());
          },
        },
      ],
    );
  }, [dirty, form, router, t]);

  // System back / swipe gesture guard.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty) return;
      e.preventDefault();
      Alert.alert(
        t('profile.unsavedChangesTitle'),
        t('profile.unsavedChangesBody'),
        [
          { text: t('profile.continueEditing'), style: 'cancel' },
          {
            text: t('profile.discardChanges'),
            style: 'destructive',
            onPress: () => {
              setInitialForm(form);
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return sub;
  }, [navigation, dirty, form, t]);

  const submitting = updateMutation.isPending;
  // Save is enabled whenever the form is dirty and not currently saving.
  // Validation errors are surfaced INLINE on tap (via `setErrors` inside
  // `performSave`) instead of silently disabling the button — a greyed-out
  // button with no error message is the worst UX. `hasErrors` is kept above
  // for any future use (e.g., a hint UI) but no longer gates the action.
  void hasErrors;
  const saveDisabled = submitting || !dirty;

  if (isLoading) {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          { paddingTop: insets.top + 16 },
        ]}
      >
        <ActivityIndicator color={colors.text.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Pressable
          haptic="light"
          onPress={handleBackPress}
          hitSlop={12}
          style={styles.headerIcon}
          accessibilityLabel={t('common.cancel')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
        </Pressable>
        <Text variant="title" weight="semibold" style={styles.headerTitle}>
          {t('profile.editTitle')}
        </Text>
        <Pressable
          haptic="medium"
          onPress={() => void handleSavePress()}
          disabled={saveDisabled}
          hitSlop={12}
          style={[
            styles.saveBtn,
            saveDisabled && styles.saveBtnDisabled,
          ]}
          accessibilityLabel={t('profile.saveButton')}
        >
          {submitting ? (
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <Text
              variant="body"
              weight="semibold"
              style={{
                color: saveDisabled ? colors.text.tertiary : colors.brand,
              }}
            >
              {t('profile.saveButton')}
            </Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.huge + insets.bottom },
          ]}
        >
          {/* Photo */}
          <View style={styles.photoSection}>
            <View>
              <Avatar
                source={
                  existing?.avatarUrl ? { uri: existing.avatarUrl } : undefined
                }
                name={form.name || existing?.name}
                size="xl"
              />
              {uploading ? (
                <View style={styles.avatarOverlay} pointerEvents="none">
                  <ActivityIndicator color={colors.text.primary} />
                </View>
              ) : null}
            </View>
            <Pressable
              haptic="light"
              onPress={handleEditPhoto}
              disabled={uploading}
              hitSlop={8}
            >
              <Text
                variant="caption"
                weight="semibold"
                style={{
                  color: uploading ? colors.text.tertiary : colors.brand,
                }}
              >
                {t('profile.editPhoto')}
              </Text>
            </Pressable>
          </View>

          {/* Identité */}
          <SectionHeader title={t('profile.sectionIdentity')} />
          <FormField
            label={t('profile.fieldName')}
            value={form.name}
            onChangeText={(v) => handleSetField('name', v)}
            error={errors.name}
            required
            autoCapitalize="words"
          />

          {/* À propos */}
          <SectionHeader title={t('profile.sectionAbout')} />
          <FormField
            label={t('profile.fieldBio')}
            value={form.bio}
            onChangeText={(v) => handleSetField('bio', v)}
            error={errors.bio}
            helper={`${form.bio.length}/${BIO_MAX}`}
            multiline
            maxLength={BIO_MAX}
            placeholder={t('sellerProfile.bioPlaceholder')}
          />

          {/* Contact */}
          <SectionHeader title={t('profile.sectionContact')} />
          <FormField
            label={t('profile.fieldWebsite')}
            value={form.website}
            onChangeText={(v) => handleSetField('website', v)}
            error={errors.website}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('sellerProfile.websitePlaceholder')}
          />
          <FormField
            label={t('profile.fieldPhonePublic')}
            value={form.phonePublic}
            onChangeText={(v) => handleSetField('phonePublic', v)}
            error={errors.phonePublic}
            keyboardType="phone-pad"
            placeholder={t('sellerProfile.phonePlaceholder')}
          />
          <FormField
            label={t('profile.fieldEmailPublic')}
            value={form.emailPublic}
            onChangeText={(v) => handleSetField('emailPublic', v)}
            error={errors.emailPublic}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('sellerProfile.emailPlaceholder')}
          />

          {/* Position de vente */}
          <SectionHeader title={t('profile.sectionSellingFrom')} />
          <Surface variant="surfaceElevated" radius="lg" padding="md" border>
            <View style={styles.locationRow}>
              <Ionicons name="navigate" size={18} color={colors.brand} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="body" weight="semibold" numberOfLines={2}>
                  {form.locationText
                    ? form.locationText
                    : t('profile.noLocationSet')}
                </Text>
                {form.latitude !== null && form.longitude !== null ? (
                  <Text variant="caption" color="tertiary">
                    {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                haptic="light"
                onPress={openLocationSheet}
                hitSlop={8}
              >
                <Text
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.brand }}
                >
                  {t('profile.changeLocation')}
                </Text>
              </Pressable>
            </View>
          </Surface>

          {/* Compte */}
          <SectionHeader title={t('profile.sectionAccount')} />
          <Surface variant="surfaceElevated" radius="lg" border>
            <AccountRow
              icon="mail-outline"
              label={t('profile.changeEmail')}
              onPress={handleChangeEmail}
              showDivider
            />
            <AccountRow
              icon="lock-closed-outline"
              label={t('profile.changePassword')}
              onPress={handleChangePassword}
              showDivider
            />
            <AccountRow
              icon="log-out-outline"
              label={t('profile.signOutTitle')}
              onPress={handleSignOut}
              danger
              showDivider
            />
            <AccountRow
              icon="trash-outline"
              label={t('profile.deleteAccount')}
              onPress={handleDeleteAccount}
              danger
              disabled={deleting}
            />
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>

      <EditProfileLocationSheet onSelect={handleLocationSelect} />

      <TypedConfirmModal
        visible={deleteModalVisible}
        title={t('profile.deleteAccountConfirmTitle')}
        body={t('profile.deleteAccountConfirmBody')}
        expectedPhrase={t('profile.deleteAccountConfirmPhrase')}
        confirmLabel={t('profile.deleteAccountFinal')}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </View>
  );
}

type AccountRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  showDivider?: boolean;
  danger?: boolean;
  disabled?: boolean;
};

function AccountRow({
  icon,
  label,
  onPress,
  showDivider = false,
  danger = false,
  disabled = false,
}: AccountRowProps): React.ReactElement {
  return (
    <Pressable
      haptic="light"
      onPress={onPress}
      disabled={disabled}
      pressScale={0.98}
    >
      <View
        style={[
          styles.accountRow,
          showDivider && styles.accountRowDivider,
          disabled && { opacity: 0.5 },
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
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.text.tertiary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  saveBtn: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  photoSection: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
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
});
