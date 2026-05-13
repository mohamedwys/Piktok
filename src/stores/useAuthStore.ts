import { User } from '@/types/types';
import { create } from 'zustand';
import { supabase, AUTH_REDIRECT_URL } from '@/lib/supabase'
import { clearPushTokenForCurrentUser } from '@/services/pushNotifications';

export type RegisterResult =
  | { confirmed: true }
  | { confirmed: false; email: string };

// Thrown by login() when Supabase reports the account exists but its
// email hasn't been confirmed yet. Callers should branch on this to
// show a friendly "check your inbox" message instead of the raw
// Supabase string.
export class EmailNotConfirmedError extends Error {
  readonly code = 'email_not_confirmed' as const;
  constructor(message = 'Email not confirmed') {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}

type AuthStore = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    username: string,
  ) => Promise<RegisterResult>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>()(
  (set) => ({
    user: null,
    isAuthenticated: false,
    login: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          // Supabase reports `error.code === 'email_not_confirmed'` on
          // recent SDKs and falls back to the message text on older
          // ones. Match both so we surface a consistent UX.
          const code = (error as { code?: string }).code;
          if (code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
            throw new EmailNotConfirmedError(error.message);
          }
          throw error;
        }
        if (!data.user) throw new Error('Sign-in returned no user.');

        const { user } = data;
        set({
          user: {
            id: user.id,
            email: user.email!,
            username: user.user_metadata.username,
          },
          isAuthenticated: true,
        })
      },
      register: async (
        email: string,
        password: string,
        username: string,
      ): Promise<RegisterResult> => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: AUTH_REDIRECT_URL,
          },
        })
        if (error) throw error;
        if (!data.user) throw new Error('Sign-up returned no user.');

        // No session means the project requires email confirmation.
        // Don't flip isAuthenticated — the JWT only lands after the
        // user clicks the link.
        if (!data.session) {
          return { confirmed: false, email: data.user.email ?? email };
        }

        const { user } = data;
        set({
          user: {
            id: user.id,
            email: user.email!,
            username: user.user_metadata.username,
          },
          isAuthenticated: true,
        })
        return { confirmed: true };
      },
      logout: async () => {
        // Phase 6 / C1: drop this device's push token BEFORE signOut --
        // after signOut, auth.uid() is null and the RLS-gated delete
        // would no-op. Failures are swallowed inside the helper so
        // logout never blocks on cleanup.
        await clearPushTokenForCurrentUser();
        const { error } = await supabase.auth.signOut();
        // Clear local state optimistically. The auth listener will reconcile
        // if signOut failed and a session somehow survives.
        set({ user: null, isAuthenticated: false });
        if (error) throw error;
      },
  })
)

/**
 * Hydrate the Zustand auth store from the actual Supabase session.
 *
 * Zustand's persist middleware caches `{ user, isAuthenticated }` in
 * AsyncStorage independently of Supabase's own session storage, so the two
 * can drift apart (e.g. after a bundle identifier change or an expired
 * session). Call this on app boot to make Supabase the source of truth.
 */
export async function syncAuthFromSupabase(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    return;
  }
  const u = data.session.user;
  useAuthStore.setState({
    user: {
      id: u.id,
      email: u.email ?? '',
      username: (u.user_metadata?.username as string) ?? '',
    },
    isAuthenticated: true,
  });
}

/**
 * Subscribe the Zustand auth store to Supabase auth state changes (token
 * refresh, sign-out, session expiry). Returns an unsubscribe function for
 * cleanup.
 */
export function subscribeToAuthChanges(): () => void {
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      return;
    }
    const u = session.user;
    useAuthStore.setState({
      user: {
        id: u.id,
        email: u.email ?? '',
        username: (u.user_metadata?.username as string) ?? '',
      },
      isAuthenticated: true,
    });
  });
  return () => sub.subscription.unsubscribe();
}