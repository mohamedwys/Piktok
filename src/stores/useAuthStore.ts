import { User } from '@/types/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase'

type AuthStore = {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      login: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error;
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
      register: async (email: string, password: string, username: string) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        })
        if (error) throw error;
        if (!data.user) throw new Error('Sign-up returned no user.');

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
      logout: async () => {
        const { error } = await supabase.auth.signOut();

        if (!error) {
          set({
            user: null,
            isAuthenticated: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
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