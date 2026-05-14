import { PostHog } from 'posthog-react-native';

// Local JSON type. The Posthog v4 SDK requires event properties to be
// JSON-serializable but does not re-export the JsonType alias at its
// package root, so we mirror the shape here.
type JsonType =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonType }
  | JsonType[];

let client: PostHog | null = null;

/**
 * Initialize Posthog once at app boot. Returns the client instance, or
 * null when the API key is unset (silent no-op for local dev without
 * Posthog configured).
 *
 * Called from src/app/_layout.tsx after fonts + auth boot is ready.
 */
export async function initPosthog(): Promise<PostHog | null> {
  if (client) return client;

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  if (!apiKey) {
    // No key configured — Posthog is disabled. Capture / identify
    // calls become no-ops via the null-check below.
    return null;
  }

  client = new PostHog(apiKey, {
    host,
    // Disable automatic IP capture for GDPR. The user_id (set via
    // identify) is the canonical user reference; IP adds no value
    // and creates GDPR exposure.
    disableGeoip: true,
    // Capture native crashes / app-lifecycle events — these include
    // "Application Opened", "Application Backgrounded".
    captureAppLifecycleEvents: true,
    // Native autocapture is OFF by default in v3.x. Keep it off — we
    // instrument events explicitly via capture() calls.
  });

  // Best-practice: prefer event flushes batched on a timer + on app
  // backgrounded. Defaults are reasonable; do not override unless
  // events go missing.

  return client;
}

/**
 * Bind a user to subsequent capture() events. Called from the auth
 * state listener. Pass null on sign-out.
 */
export function identifyUser(
  user: { id: string; email?: string | null } | null,
): void {
  if (!client) return;
  if (!user) {
    void client.reset();
    return;
  }
  client.identify(user.id, user.email ? { email: user.email } : undefined);
}

/**
 * Capture an event. Null-safe.
 */
export function captureEvent(
  event: string,
  properties?: Record<string, JsonType>,
): void {
  if (!client) return;
  client.capture(event, properties);
}

/**
 * Read a boolean feature flag synchronously. Returns the default
 * value if Posthog is unconfigured or the flag is loading.
 *
 * For boolean kill-switches: default = "feature ENABLED" so that an
 * outage of Posthog doesn't disable features.
 */
export function getFeatureFlag(
  flagKey: string,
  defaultValue: boolean,
): boolean {
  if (!client) return defaultValue;
  const value = client.getFeatureFlag(flagKey);
  if (typeof value === 'boolean') return value;
  return defaultValue;
}

/** Direct client access for the rare case the helpers don't cover. */
export function getPosthogClient(): PostHog | null {
  return client;
}
