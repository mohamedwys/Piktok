import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResponsiveContainer from '@/components/GenericComponents/ResponsiveContainer';
import { supabase, AUTH_REDIRECT_URL } from '@/lib/supabase';
import { colors } from '@/theme';

const RESEND_COOLDOWN_S = 60;
const POLL_INTERVAL_MS = 5000;

export default function VerifyEmail(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [cooldown, setCooldown] = useState<number>(0);
  const [resending, setResending] = useState<boolean>(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Tick the resend cooldown once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Defensive: poll the local session every 5s. This catches one
  // specific race — the deep-link callback at /auth/callback fires
  // setSession() while this screen is still mounted, but the
  // auth-state listener in _layout.tsx hasn't yet propagated to
  // flip isAuthenticated and trigger the layout's Redirect.
  //
  // This does NOT catch cross-device confirmations (e.g. user taps
  // the email link on desktop while this screen sits on mobile).
  // getSession() only reads local storage; without a session token
  // already on this device, polling has nothing to find. True
  // cross-device pickup would need Supabase Realtime or a push
  // notification — out of scope for this iteration.
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session && !cancelled) {
        clearInterval(interval);
        router.replace('/');
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  const handleResend = async (): Promise<void> => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setResendNotice(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      if (error) {
        setResendNotice(error.message);
      } else {
        setResendNotice(t('auth.verifyResendSuccess'));
        setCooldown(RESEND_COOLDOWN_S);
      }
    } finally {
      setResending(false);
    }
  };

  const resendDisabled = !email || cooldown > 0 || resending;
  const resendLabel = resending
    ? t('auth.verifyResending')
    : cooldown > 0
      ? t('auth.verifyResendIn', { seconds: cooldown })
      : t('auth.verifyResend');

  return (
    <ResponsiveContainer>
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.verifySubtitle')}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
        <Text style={styles.instructions}>{t('auth.verifyInstructions')}</Text>

        <Pressable
          onPress={handleResend}
          disabled={resendDisabled}
          style={({ pressed }) => [
            styles.resendButton,
            resendDisabled && styles.resendDisabled,
            pressed && !resendDisabled && styles.pressed,
          ]}
        >
          <Text style={styles.resendText}>{resendLabel}</Text>
        </Pressable>

        {resendNotice ? (
          <Text style={styles.notice}>{resendNotice}</Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {`${t('auth.verifyWrongEmail')} `}
          </Text>
          <Link href="/(auth)/register" replace style={styles.linkText}>
            {t('auth.verifyStartOver')}
          </Link>
        </View>
      </View>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
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
  email: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 18,
  },
  instructions: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  resendButton: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  resendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  notice: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 14,
    textAlign: 'center',
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
