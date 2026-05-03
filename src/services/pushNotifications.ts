import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export type PushPlatform = 'ios' | 'android';

export type PushNotificationData = {
  conversation_id?: string;
  [key: string]: unknown;
};

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
  if (error) console.warn('savePushToken error', error.message);
}

export async function sendPushNotification(input: {
  recipientUserId: string;
  title: string;
  body: string;
  data?: PushNotificationData;
}): Promise<void> {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: input.recipientUserId,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      },
    });
  } catch (err) {
    console.warn('sendPushNotification error', err);
  }
}
