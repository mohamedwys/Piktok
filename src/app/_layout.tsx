import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { initI18n } from "@/i18n"

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
    initI18n().then(() => setI18nReady(true))
  }, [])

  if (!isI18nReady) {
    return null
  }

  return (
    <ThemeProvider value={myTheme}>
      <QueryClientProvider client={queryClientRef.current}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
