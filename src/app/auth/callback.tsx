import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

// This route lives outside the (auth) and (protected) groups on
// purpose: it must be reachable both signed-out (the typical case
// arriving from the email link) and signed-in (if the user clicks
// a stale link mid-session), so neither group's _layout gate is
// what we want here.

type Status = 'pending' | 'error';

function parseFragmentParams(url: string): URLSearchParams {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return new URLSearchParams();
  return new URLSearchParams(url.substring(hashIdx + 1));
}

function decodeSupabaseError(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

// Phase 6 / C3: gate setSession on the deep link's source. The
// AUTH_REDIRECT_URL configured in lib/supabase.ts is
// `client://auth/callback`, so any incoming URL whose scheme + host +
// path don't match exactly is rejected. Rejected URLs are silently
// ignored -- they could be a stale link from an older build, a
// prefetch from another route, or a malicious app pushing a forged
// token pair into setSession.
const EXPECTED_SCHEME = 'client:';
const EXPECTED_HOST = 'auth';
const EXPECTED_PATH = '/callback';

function isTrustedAuthDeepLink(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === EXPECTED_SCHEME &&
      u.hostname === EXPECTED_HOST &&
      u.pathname === EXPECTED_PATH
    );
  } catch {
    return false;
  }
}

export default function AuthCallback(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('pending');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleUrl(url: string | null): Promise<void> {
      if (!url || cancelled) return;
      // Phase 6 / C3: trust gate. Silently drop URLs that don't match
      // the expected client://auth/callback shape -- this is BEFORE any
      // token parsing or supabase.auth.setSession call.
      if (!isTrustedAuthDeepLink(url)) return;
      try {
        const params = parseFragmentParams(url);
        const errParam = params.get('error_description') ?? params.get('error');
        if (errParam) {
          throw new Error(decodeSupabaseError(errParam));
        }

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (!access_token || !refresh_token) {
          throw new Error('Missing confirmation tokens.');
        }

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;
        if (cancelled) return;

        router.replace('/');
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : t('common.errorGeneric');
        setErrorMsg(message);
        setStatus('error');
        // Brief pause so the user can see what failed, then route
        // back to login. We don't have the email here, so we can't
        // re-open verify-email with a meaningful resend target.
        setTimeout(() => {
          if (!cancelled) router.replace('/(auth)/login');
        }, 2500);
      }
    }

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router, t]);

  return (
    <View style={styles.container}>
      {status === 'pending' ? (
        <>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.label}>{t('auth.callbackPending')}</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('auth.callbackErrorTitle')}</Text>
          {errorMsg ? <Text style={styles.detail}>{errorMsg}</Text> : null}
          <Text style={styles.detail}>{t('auth.callbackReturning')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    marginTop: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  detail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
});
