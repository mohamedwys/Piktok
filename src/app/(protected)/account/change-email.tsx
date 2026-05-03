import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Pressable, Surface, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import FormField from '@/components/profile/FormField';
import SectionHeader from '@/components/profile/SectionHeader';
import { changeEmail } from '@/features/auth/services/auth';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentEmail(data.user?.email ?? '');
    })();
  }, []);

  const validate = useCallback(
    (value: string): string | undefined => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return t('profile.validationEmailInvalid');
      if (!EMAIL_PATTERN.test(trimmed)) {
        return t('profile.validationEmailInvalid');
      }
      if (
        currentEmail.length > 0
        && trimmed.toLowerCase() === currentEmail.toLowerCase()
      ) {
        return t('profile.validationEmailNewSameAsCurrent');
      }
      return undefined;
    },
    [currentEmail, t],
  );

  const visibleError = useMemo(
    () => (newEmail.length > 0 ? validate(newEmail) : undefined),
    [newEmail, validate],
  );

  const formValid = newEmail.length > 0 && visibleError === undefined;

  const handleSetEmail = useCallback((v: string) => {
    setNewEmail(v);
    setError(undefined);
  }, []);

  const handleSave = useCallback(async () => {
    const finalError = validate(newEmail);
    if (finalError) {
      setError(finalError);
      return;
    }
    setSubmitting(true);
    try {
      await changeEmail(newEmail.trim());
      Alert.alert(
        t('profile.changeEmailSuccessTitle'),
        t('profile.changeEmailSuccessBody'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('common.errorGeneric');
      Alert.alert(t('profile.changeEmailTitle'), message);
    } finally {
      setSubmitting(false);
    }
  }, [newEmail, validate, router, t]);

  const saveDisabled = submitting || !formValid;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <Pressable
          haptic="light"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerIcon}
          accessibilityLabel={t('common.cancel')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text.primary} />
        </Pressable>
        <Text variant="title" weight="semibold" style={styles.headerTitle}>
          {t('profile.changeEmailTitle')}
        </Text>
        <Pressable
          haptic="medium"
          onPress={() => void handleSave()}
          disabled={saveDisabled}
          hitSlop={12}
          style={styles.saveBtn}
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
          <SectionHeader title={t('profile.sectionContact')} />

          <View style={styles.currentBlock}>
            <Text variant="caption" color="secondary">
              {t('profile.changeEmailCurrentLabel')}
            </Text>
            <Text variant="body" weight="semibold">
              {currentEmail || '—'}
            </Text>
          </View>

          <FormField
            label={t('profile.changeEmailNewLabel')}
            value={newEmail}
            onChangeText={handleSetEmail}
            error={error ?? visibleError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            placeholder="email@example.com"
          />

          <Surface
            variant="surfaceElevated"
            radius="lg"
            padding="md"
            border
          >
            <Text variant="caption" color="secondary">
              {t('profile.changeEmailNotice')}
            </Text>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  headerTitle: { flex: 1, textAlign: 'center' },
  saveBtn: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  currentBlock: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
  },
});
