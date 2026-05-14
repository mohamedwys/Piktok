import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { env } from './env';

let initialized = false;

/**
 * Initialize Sentry once. Idempotent — safe to call multiple times.
 * Called from app/_layout.tsx at the top of the component before any
 * other side effects.
 *
 * The DSN comes from EXPO_PUBLIC_SENTRY_DSN (set in eas.json per
 * profile + a local .env override for dev). If unset, init is a no-op
 * — useful for local dev when you don't want events sent.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // Silent — dev environment without DSN configured.
    return;
  }
  Sentry.init({
    dsn,
    environment: env.ENVIRONMENT,
    enabled: !__DEV__,
    // Release tag: "mony@<version>+<buildNumber>". EAS sets these.
    release: `mony@${Constants.expoConfig?.version ?? 'unknown'}+${
      Constants.expoConfig?.ios?.buildNumber
      ?? Constants.expoConfig?.android?.versionCode
      ?? 'unknown'
    }`,
    // Performance: explicitly disabled for v1. Errors only.
    tracesSampleRate: 0,
    // Attach the JS stack trace to every event.
    attachStacktrace: true,
    // Don't auto-capture console messages — too noisy. We use the
    // ErrorBoundary + manual capture from queryClient.
    beforeSend(event) {
      // Strip auth tokens or any other PII from URLs in breadcrumbs.
      if (event.request?.url) {
        event.request.url = event.request.url
          .replace(/access_token=[^&]+/gi, 'access_token=REDACTED')
          .replace(/refresh_token=[^&]+/gi, 'refresh_token=REDACTED')
          .replace(/apikey=[^&]+/gi, 'apikey=REDACTED');
      }
      return event;
    },
  });
  initialized = true;
}

/**
 * Bind the current user to Sentry events. Called from the auth state
 * listener. On sign-out, pass null to clear.
 */
export function setSentryUser(
  user: { id: string; email?: string | null } | null,
): void {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    // Email is optional. If you want to redact PII per GDPR, omit it.
    email: user.email ?? undefined,
  });
}

/**
 * Manual capture for non-throw errors (e.g. fire-and-forget catches in
 * services). Used from queryClient.ts's default mutation onError.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
