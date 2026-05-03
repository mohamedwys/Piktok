import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProductSheetStore } from '@/stores/useProductSheetStore';
import { colors } from '@/theme';

// Phase E.2 — deep-link landing route for `client://product/<id>` URLs
// shared from the action rail. The product detail UI is a global bottom
// sheet driven by useProductSheetStore (mounted in (protected)/_layout.tsx).
// This thin route opens that sheet and replaces itself with the home tab so
// the sheet sits over the marketplace feed instead of an empty backdrop —
// closing the sheet then drops the user on a familiar surface.
//
// The setTimeout(0) defer waits one tick for `router.replace` to mount the
// home stack before the sheet's open() call resolves; without it the sheet
// can briefly render against an unmounted parent on cold starts.
export default function ProductDeepLinkRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openSheet = useProductSheetStore((s) => s.open);

  useEffect(() => {
    if (typeof id !== 'string' || id.length === 0) return;
    router.replace('/(protected)/(tabs)');
    const t = setTimeout(() => openSheet(id), 0);
    return () => clearTimeout(t);
  }, [id, openSheet, router]);

  return <View style={styles.backdrop} />;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
