import { useAuthStore } from "@/stores/useAuthStore";
import { useMySeller } from "@/features/marketplace/hooks/useMySeller";
import { Redirect, Stack, type Href } from "expo-router";

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // useMySeller is gated by `enabled` — when not authenticated this is a
  // no-op query (isLoading=false, data=undefined). When the layout
  // re-renders after login/register flips isAuthenticated, the query
  // resolves and we can decide where to send the user.
  const mySellerQuery = useMySeller(isAuthenticated);

  if (!isAuthenticated) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-email" />
      </Stack>
    );
  }

  // Defer the redirect until we know whether onboarding is needed. The user
  // briefly stays on the auth screen they just submitted; we'd rather have
  // a 100-300ms pause than bounce them through the home tab first.
  if (mySellerQuery.isLoading) {
    return null;
  }

  // Empty interests (or missing seller row) means onboarding hasn't been
  // completed yet. The onboarding screen itself can be skipped — skipping
  // leaves interests at [], which means future logins will keep prompting
  // until the user either picks 3 OR explicitly visits "Edit interests"
  // and saves an empty selection. v0 accepts that retry — a future
  // refinement can persist a "skipped" flag.
  const interests = mySellerQuery.data?.interests ?? [];
  if (interests.length === 0) {
    // `as Href` — the typed-routes manifest at .expo/types/router.d.ts is
    // regenerated at dev-server start; until then this brand-new route is
    // not in the union. Same pattern used elsewhere in the codebase for
    // dynamic seller routes.
    return <Redirect href={'/(protected)/onboarding' as Href} />;
  }
  return <Redirect href="/" />;
}
