import { DarkTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useRef } from "react"

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

  return (
    <ThemeProvider value={myTheme}>
      <QueryClientProvider client={queryClientRef.current}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
