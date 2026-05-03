import React, { useCallback, useMemo, useState } from 'react';
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
import { Pressable, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import FormField from '@/components/profile/FormField';
import SectionHeader from '@/components/profile/SectionHeader';
import {
  changePassword,
  IncorrectCurrentPasswordError,
} from '@/features/auth/services/auth';

const PASSWORD_MIN = 8;

type FormState = {
  current: string;
  next: string;
  confirm: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { current: '', next: '', confirm: '' };

export default function ChangePasswordScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback((next: FormState): FormErrors => {
    const e: FormErrors = {};
    if (next.current.length === 0) {
      e.current = t('profile.validationPasswordRequired');
    }
    if (next.next.length < PASSWORD_MIN) {
      e.next = t('profile.validationPasswordTooShort');
    }
    if (next.confirm !== next.next) {
      e.confirm = t('profile.validationPasswordMismatch');
    }
    return e;
  }, [t]);

  const visibleErrors = useMemo(() => validate(form), [form, validate]);
  const formValid =
    Object.keys(visibleErrors).length === 0
    && form.current.length > 0
    && form.next.length >= PASSWORD_MIN
    && form.confirm === form.next;

  const setField = useCallback(<K extends keyof FormState>(
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

  const handleSave = useCallback(async () => {
    const finalErrors = validate(form);
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(form.current, form.next);
      Alert.alert(
        t('profile.changePasswordSuccessTitle'),
        t('profile.changePasswordSuccessBody'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      if (err instanceof IncorrectCurrentPasswordError) {
        setErrors({ current: t('profile.validationCurrentPasswordIncorrect') });
      } else {
        const message =
          err instanceof Error ? err.message : t('common.errorGeneric');
        Alert.alert(t('profile.changePasswordSuccessTitle'), message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, validate, router, t]);

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
          {t('profile.changePasswordTitle')}
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
          <SectionHeader title={t('profile.sectionSecurity')} />

          <FormField
            label={t('profile.changePasswordCurrentLabel')}
            value={form.current}
            onChangeText={(v) => setField('current', v)}
            error={errors.current}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />
          <FormField
            label={t('profile.changePasswordNewLabel')}
            value={form.next}
            onChangeText={(v) => setField('next', v)}
            error={errors.next}
            helper={t('profile.changePasswordHelper')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <FormField
            label={t('profile.changePasswordConfirmLabel')}
            value={form.confirm}
            onChangeText={(v) => setField('confirm', v)}
            error={errors.confirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
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
});
