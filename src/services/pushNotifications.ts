import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { mmkvSync } from '@/shared/storage/mmkv';
import { colors } from '@/theme';

export type PushPlatform = 'ios' | 'android';

export type PushNotificationData = {
  conversation_id?: string;
  [key: string]: unknown;
};

// MMKV slot for the current device's Expo push token. We persist this at
// registration time so the signOut cleanup path (C1) can scope its
// `delete from push_tokens` to THIS device only -- deleting all of the
// user's tokens would log them out of every other device they own.
const PUSH_TOKEN_MMKV_KEY = 'push.token.current';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    final = requested;
  }
  if (final !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: colors.brand,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
      ?.projectId;
  if (!projectId) return null;

  const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResp.data;
}

export async function savePushToken(input: {
  token: string;
  platform: PushPlatform;
  deviceName: string | null;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;

  // Upsert keyed on the unique expo_push_token. If a different user previously
  // registered this device, RLS will reject the on-conflict update — that case
  // requires manual cleanup and is rare enough to leave as a known limitation.
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: u.user.id,
      expo_push_token: input.token,
      platform: input.platform,
      device_name: input.deviceName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' },
  );
  if (error) {
    if (__DEV__) console.warn('savePushToken error', error.message);
    return;
  }
  mmkvSync.setString(PUSH_TOKEN_MMKV_KEY, input.token);
}

// Phase 6 / C1: called from useAuthStore.logout BEFORE supabase.auth.signOut.
// Must run while we still have an auth.uid() -- after signOut RLS would
// reject the delete. Scope is THIS device only (via the MMKV-cached token)
// so other devices the user owns stay subscribed.
export async function clearPushTokenForCurrentUser(): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const stored = mmkvSync.getString(PUSH_TOKEN_MMKV_KEY);
    if (!stored) return;
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', u.user.id)
      .eq('expo_push_token', stored);
    mmkvSync.delete(PUSH_TOKEN_MMKV_KEY);
  } catch {
    // Silent -- user is logging out; UX should not block on cleanup.
  }
}

export async function sendPushNotification(input: {
  recipientUserId: string;
  conversationId: string;
  title: string;
  body: string;
  data?: PushNotificationData;
}): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        conversation_id: input.conversationId,
        user_id: input.recipientUserId,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('sendPushNotification error', err);
  }
}
