import { Link } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { useAuthStore } from '@/stores/useAuthStore';
import ResponsiveContainer from '@/components/GenericComponents/ResponsiveContainer';

const BRAND_PRIMARY = '#FE2C55';

export default function Register(): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);

  const handleRegister = async (): Promise<void> => {
    void mediumHaptic();
    if (!email || !password || !username) {
      Alert.alert(t('auth.missingFields'));
      return;
    }
    try {
      setLoading(true);
      await useAuthStore.getState().register(email, password, username);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('common.errorGeneric');
      Alert.alert(t('auth.registerFailed'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.usernamePlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <Pressable
            onPress={handleRegister}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              isLoading && styles.pressed,
            ]}
          >
            <Text style={styles.submitText}>
              {isLoading
                ? t('auth.submittingRegister')
                : t('auth.createAccount')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{`${t('auth.hasAccount')} `}</Text>
          <Link href="/(auth)/login" style={styles.linkText}>
            {t('auth.signIn')}
          </Link>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    marginTop: 6,
  },
  form: {
    marginTop: 40,
    gap: 14,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  pressed: {
    opacity: 0.85,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
