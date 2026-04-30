import { Stack } from "expo-router";

export default function ProtectedLayout() {
  // Free browsing: no auth gate at the route level.
  // Per-action auth is enforced via useRequireAuth() in components.
  return <Stack screenOptions={{ headerShown: false }} />;
}
