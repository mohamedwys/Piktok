import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import ErrorBoundary from "@/components/ErrorBoundary"
import { initI18n } from "@/i18n"
import { syncAuthFromSupabase, subscribeToAuthChanges } from "@/stores/useAuthStore"
import { usePushNotifications } from "@/hooks/usePushNotifications"

const myTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: 'white',
  }
}

export default function RootLayout() {
  const queryClientRef = useRef<QueryClient | null>(null)
  if (queryClientRef.current === null) {
    queryClientRef.current = new QueryClient()
  }

  const [isI18nReady, setI18nReady] = useState(false)
  useEffect(() => {
    Promise.all([initI18n(), syncAuthFromSupabase()]).then(() => {
      setI18nReady(true)
    })
    const unsub = subscribeToAuthChanges()
    return () => unsub()
  }, [])

  usePushNotifications()

  if (!isI18nReady) {
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
