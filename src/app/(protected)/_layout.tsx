import { useAuthStore } from "@/stores/useAuthStore";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";

export default function ProtectedLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated()
  );

  useEffect(() => {
    const unsubFinish = useAuthStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    setHydrated(useAuthStore.persist.hasHydrated());
    return () => {
      unsubFinish();
    };
  }, []);

  if (!hydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href={"/login"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
