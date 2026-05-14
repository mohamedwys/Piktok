import "@/lib/polyfills"
import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Platform, Text as RNText, TextInput as RNTextInput } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter"
import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from "@expo-google-fonts/fraunces"
import ErrorBoundary from "@/components/ErrorBoundary"
import { initI18n } from "@/i18n"
import { syncAuthFromSupabase, subscribeToAuthChanges, useAuthStore } from "@/stores/useAuthStore"
import { registerSupabaseAuthAppStateListener } from "@/lib/supabase"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { useExchangeRatesRefresh } from "@/hooks/useExchangeRatesRefresh"
import { typography } from "@/theme"
import { queryClient } from "@/lib/queryClient"
import { restoreSubscriptions } from "@/features/iap/services"
import { MY_SUBSCRIPTION_KEY } from "@/features/marketplace/hooks/useMySubscription"

SplashScreen.preventAutoHideAsync().catch(() => {})

const myTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: 'white',
  }
}

// Module-scoped flag — Fast Refresh re-runs the module body but
// preserves module-level state, so this prevents stacking the
// Inter fontFamily on top of itself across reloads.
let defaultPropsApplied = false

// TODO(phase-3): remove once every <RN Text> usage is migrated to the
// <Text> primitive in src/components/ui/Text.tsx (which sets fontFamily natively).
function applyTextDefaultFontFamily() {
  if (defaultPropsApplied) return
  defaultPropsApplied = true
  // Deliberate, contained use of defaultProps so the existing
  // ~50+ <Text> usages pick up Inter without a manual migration.
  // Future code should use the <Text> primitive in components/ui.
  const RNTextAny = RNText as unknown as { defaultProps?: { style?: unknown } }
  RNTextAny.defaultProps = RNTextAny.defaultProps || {}
  RNTextAny.defaultProps.style = [
    RNTextAny.defaultProps.style,
    { fontFamily: typography.family.sans },
  ]
  const RNTextInputAny = RNTextInput as unknown as { defaultProps?: { style?: unknown } }
  RNTextInputAny.defaultProps = RNTextInputAny.defaultProps || {}
  RNTextInputAny.defaultProps.style = [
    RNTextInputAny.defaultProps.style,
    { fontFamily: typography.family.sans },
  ]
}

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  })

  const [isI18nReady, setI18nReady] = useState(false)
  useEffect(() => {
    const cleanupAppState = registerSupabaseAuthAppStateListener()
    Promise.all([initI18n(), syncAuthFromSupabase()]).then(() => {
      setI18nReady(true)
    })
    const unsub = subscribeToAuthChanges()
    return () => {
      cleanupAppState()
      unsub()
    }
  }, [])

  // Silent restore-purchases on app launch (Phase 8 / Track A). Catches
  // the reinstall / new-device case where Apple or Google know about an
  // active subscription but the local DB row is missing. Web has no IAP.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const qc = useRef(queryClient).current
  useEffect(() => {
    if (!isI18nReady || !isAuthenticated) return
    if (Platform.OS === 'web') return
    let cancelled = false
    void restoreSubscriptions().then(() => {
      if (!cancelled) {
        void qc.invalidateQueries({ queryKey: MY_SUBSCRIPTION_KEY })
      }
    })
    return () => { cancelled = true }
  }, [isI18nReady, isAuthenticated, qc])

  usePushNotifications()
  useExchangeRatesRefresh()

  const isReady = isI18nReady && (fontsLoaded || !!fontsError)

  useEffect(() => {
    if (isReady) {
      applyTextDefaultFontFamily()
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [isReady])

  if (!isReady) {
    return null
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <ThemeProvider value={myTheme}>
          <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
