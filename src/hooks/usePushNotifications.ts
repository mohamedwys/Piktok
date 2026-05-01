import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  registerForPushNotificationsAsync,
  savePushToken,
  type PushNotificationData,
} from '@/services/pushNotifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function navigateFromData(
  data: PushNotificationData | undefined,
  router: ReturnType<typeof useRouter>,
): void {
  if (!data) return;
  if (typeof data.conversation_id === 'string' && data.conversation_id) {
    router.push(`/(protected)/conversation/${data.conversation_id}`);
  }
}

export function usePushNotifications(): void {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    void (async () => {
      const token = await registerForPushNotificationsAsync().catch(() => null);
      if (!mounted || !token) return;
      await savePushToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceName: Device.deviceName ?? null,
      });
    })();

    if (!handledColdStart.current) {
      handledColdStart.current = true;
      void Notifications.getLastNotificationResponseAsync().then((resp) => {
        if (!resp || !mounted) return;
        navigateFromData(
          resp.notification.request.content.data as PushNotificationData,
          router,
        );
      });
    }

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      navigateFromData(
        resp.notification.request.content.data as PushNotificationData,
        router,
      );
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [userId, router]);
}
