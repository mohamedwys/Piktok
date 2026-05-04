import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Text as RNText, TextInput as RNTextInput } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import * as SplashScreen from "expo-splash-screen"
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
import { syncAuthFromSupabase, subscribeToAuthChanges } from "@/stores/useAuthStore"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { useExchangeRatesRefresh } from "@/hooks/useExchangeRatesRefresh"
import { typography } from "@/theme"

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
  const queryClientRef = useRef<QueryClient | null>(null)
  if (queryClientRef.current === null) {
    queryClientRef.current = new QueryClient()
  }

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
    Promise.all([initI18n(), syncAuthFromSupabase()]).then(() => {
      setI18nReady(true)
    })
    const unsub = subscribeToAuthChanges()
    return () => unsub()
  }, [])

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
        <ThemeProvider value={myTheme}>
          <QueryClientProvider client={queryClientRef.current}>
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
