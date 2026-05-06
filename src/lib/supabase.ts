import { AppState, type NativeEventSubscription } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
})

// Deferred to a hook lifecycle: registering an AppState listener at
// module-load triggers a synchronous TurboModule call to RCTAppState
// during JS bundle parse. On iOS 26 release builds the UIScene is
// not yet attached at that point and the call throws NSException.
// Call from a useEffect after mount instead.
let supabaseAuthAppStateSubscription: NativeEventSubscription | null = null
export function registerSupabaseAuthAppStateListener(): () => void {
  if (supabaseAuthAppStateSubscription) return () => {}
  supabaseAuthAppStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
  return () => {
    supabaseAuthAppStateSubscription?.remove()
    supabaseAuthAppStateSubscription = null
  }
}