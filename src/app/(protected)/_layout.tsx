import { Stack } from "expo-router";
import ProductDetailSheet from "@/features/marketplace/components/ProductDetailSheet";
import { ProWelcomeModalHost } from "@/features/pro/components/ProWelcomeModalHost";

export default function ProtectedLayout() {
  // Free browsing: no auth gate at the route level.
  // Per-action auth is enforced via useRequireAuth() in components.
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ProductDetailSheet />
      <ProWelcomeModalHost />
    </>
  );
}
