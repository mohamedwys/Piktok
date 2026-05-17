import { Ionicons } from '@expo/vector-icons';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';
import { Link, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useRef, useState } from 'react';
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
import { Pressable as UIPressable, Text as UIText } from '@/components/ui';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { supabase } from '@/lib/supabase';
import { WEB_BASE_URL } from '@/lib/web/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import ResponsiveContainer from '@/components/GenericComponents/ResponsiveContainer';
import { colors } from '@/theme';

export default function Register(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [tosAccepted, setTosAccepted] = useState<boolean>(false);
  const captchaRef = useRef<ConfirmHcaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaVisible, setCaptchaVisible] = useState<boolean>(false);

  const handleRegister = async (): Promise<void> => {
    void mediumHaptic();
    if (!email || !password || !username) {
      Alert.alert(t('auth.missingFields'));
      return;
    }
    if (!tosAccepted) {
      return;
    }
    if (!captchaToken) {
      captchaRef.current?.show();
      setCaptchaVisible(true);
      return;
    }
    try {
      setLoading(true);
      const result = await useAuthStore
        .getState()
        .register(email, password, username, captchaToken);
      if (!result.confirmed) {
        // Replace, not push: back-button shouldn't return to a register
        // form already submitted to Supabase.
        router.replace({
          pathname: '/(auth)/verify-email',
          params: { email: result.email },
        });
        // Email confirmation required: TOS acceptance stamp lands on
        // first authed action (follow-up phase will wire a global
        // first-authed-action hook).
      } else {
        try {
          await supabase.rpc('set_my_tos_accepted');
        } catch {
          // Silent: best-effort stamp; the next authed action can retry.
        }
        // (auth) layout's reactive Redirect handles navigation into the
        // protected tree.
      }
    } catch (error) {
      // Captcha tokens are single-use: clear so retry re-prompts.
      setCaptchaToken(null);
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

          <UIPressable
            haptic="light"
            onPress={() => setTosAccepted((v) => !v)}
            style={styles.tosRow}
          >
            <View
              style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}
            >
              {tosAccepted && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </View>
            <UIText
              variant="caption"
              color="secondary"
              style={styles.tosText}
            >
              {t('auth.tosAccept')}{' '}
              <UIText
                variant="caption"
                style={styles.link}
                onPress={() =>
                  WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/legal/terms`)
                }
              >
                {t('auth.tosTerms')}
              </UIText>{' '}
              {t('auth.tosAnd')}{' '}
              <UIText
                variant="caption"
                style={styles.link}
                onPress={() =>
                  WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/legal/privacy`)
                }
              >
                {t('auth.tosPrivacy')}
              </UIText>
            </UIText>
          </UIPressable>

          <Pressable
            onPress={handleRegister}
            disabled={isLoading || !tosAccepted || captchaVisible}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || isLoading || !tosAccepted || captchaVisible) &&
                styles.pressed,
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
      <ConfirmHcaptcha
        ref={captchaRef}
        siteKey={process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? ''}
        baseUrl="https://mony-psi.vercel.app"
        languageCode={i18n.language === 'fr' ? 'fr' : 'en'}
        size="invisible"
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          if (message === 'open') {
            return;
          }
          if (
            message === 'cancel' ||
            message === 'error' ||
            message === 'expired'
          ) {
            captchaRef.current?.hide();
            setCaptchaVisible(false);
            return;
          }
          setCaptchaToken(message);
          captchaRef.current?.hide();
          setCaptchaVisible(false);
        }}
      />
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
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    paddingVertical: 4,
  },
  tosText: {
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  link: {
    color: colors.brand,
    textDecorationLine: 'underline',
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
