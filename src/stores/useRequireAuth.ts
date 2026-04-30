import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './useAuthStore';
import type { User } from '@/types/types';

type UseRequireAuthResult = {
  isAuthenticated: boolean;
  user: User | null;
  /**
   * Returns true if the user is authenticated. Otherwise shows an Alert
   * with a "Sign in" CTA that routes to /(auth)/login and returns false,
   * letting callers `if (!requireAuth()) return;` to gate an action.
   */
  requireAuth: () => boolean;
};

export function useRequireAuth(): UseRequireAuthResult {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { t } = useTranslation();

  const requireAuth = (): boolean => {
    if (isAuthenticated) return true;
    Alert.alert(
      t('auth.signInRequired.title'),
      t('auth.signInRequired.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.signIn'),
          onPress: () => router.push('/(auth)/login'),
        },
      ]
    );
    return false;
  };

  return { isAuthenticated, user, requireAuth };
}
