import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useMySeller } from '@/features/marketplace/hooks/useMySeller';
import { useUpdateMySeller } from '@/features/marketplace/hooks/useUpdateMySeller';
import { lightHaptic, mediumHaptic } from '@/features/marketplace/utils/haptics';

const BRAND_PRIMARY = '#FE2C55';

export default function EditSellerProfileScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: existing, isLoading } = useMySeller(true);
  const updateMutation = useUpdateMySeller();

  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!existing) return;
    setBio(existing.bio ?? '');
    setWebsite(existing.website ?? '');
    setPhone(existing.phonePublic ?? '');
    setEmail(existing.emailPublic ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const onPressBack = () => {
    void lightHaptic();
    router.back();
  };

  const onSubmit = () => {
    void mediumHaptic();
    updateMutation.mutate(
      {
        bio: bio.trim(),
        website: website.trim(),
        phonePublic: phone.trim(),
        emailPublic: email.trim(),
      },
      {
        onSuccess: () => {
          Alert.alert(t('sellerProfile.saveSuccess'));
          router.back();
        },
        onError: (err) => {
          Alert.alert(t('sellerProfile.saveFail'), err.message);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const submitting = updateMutation.isPending;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable
        onPress={onPressBack}
        style={({ pressed }) => [
          styles.backBtn,
          { top: insets.top + 12 },
          pressed && { opacity: 0.6 },
        ]}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('sellerProfile.editTitle')}</Text>
            <Text style={styles.subtitle}>{t('sellerProfile.editSubtitle')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('sellerProfile.bio')}</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={t('sellerProfile.bioPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              numberOfLines={4}
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('sellerProfile.website')}</Text>
            <TextInput
              value={website}
              onChangeText={setWebsite}
              placeholder={t('sellerProfile.websitePlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('sellerProfile.phone')}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('sellerProfile.phonePlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('sellerProfile.email')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('sellerProfile.emailPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || submitting) && { opacity: 0.7 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('sellerProfile.save')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: {
    position: 'absolute',
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 80,
    gap: 16,
  },
  header: { gap: 4 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  field: { gap: 6 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  submitButton: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
