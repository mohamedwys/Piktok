import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Surface, Text } from '@/components/ui';
import { ProUpgradeBanner } from '@/components/marketplace/ProUpgradeBanner';
import { useIsPro } from '@/features/marketplace/hooks/useIsPro';
import { useProductAnalytics } from '@/features/marketplace/hooks/useProductAnalytics';
import { useUpgradeFlow } from '@/hooks/useUpgradeFlow';
import { colors, spacing } from '@/theme';

/**
 * Phase H.13 — Pro-gated analytics surface for the OWNER of a product.
 *
 * Renders one of four states (in priority order):
 *
 *   1. `!isOwner`    → null (mount-anywhere safety; the gate is internal
 *                      so the ProductDetailSheet doesn't need its own
 *                      conditional).
 *   2. `!isPro`      → soft `<ProUpgradeBanner/>` with the analytics
 *                      teaser copy + "View analytics" CTA wired to
 *                      `useUpgradeFlow()`.
 *   3. data loading  → 3 placeholder tiles with "—" so the sheet's
 *                      vertical rhythm doesn't shift on resolve.
 *   4. data resolved → 3 stat tiles (24h / 7d / 30d) with the count
 *                      and a localized label.
 *
 * Errors (e.g., the RPC raised "not_authorized" because of a stale
 * client) fall through to the placeholder branch — analytics visibility
 * is not user-actionable so we do not surface an Alert.
 *
 * Lives at `src/components/marketplace/AnalyticsCard.tsx` so future
 * consumers (a dedicated "my listing stats" screen, the seller profile
 * dashboard) can reuse the same primitive without copy-paste.
 */
export type AnalyticsCardProps = {
  productId: string;
  isOwner: boolean;
};

export function AnalyticsCard({
  productId,
  isOwner,
}: AnalyticsCardProps): React.ReactElement | null {
  const { t } = useTranslation();
  const isPro = useIsPro();
  const upgrade = useUpgradeFlow();
  const query = useProductAnalytics(productId, isOwner);

  if (!isOwner) return null;

  if (!isPro) {
    return (
      <ProUpgradeBanner
        title={t('analytics.title')}
        body={t('analytics.upgradeTeaser')}
        ctaLabel={t('analytics.upgradeCta')}
        onPressCta={() => {
          void upgrade();
        }}
        emphasis="soft"
        style={styles.container}
      />
    );
  }

  const placeholder = '—';
  // Errors and "no data yet" both render the placeholder. React Query's
  // `isPending` is true on first load only; once we have any cached
  // value (even from a failed attempt) we show the cached numbers.
  const showPlaceholder = query.isPending || query.isError;
  const data = query.data;

  return (
    <Surface
      variant="surfaceElevated"
      radius="lg"
      padding="md"
      border
      style={styles.container}
    >
      <Text variant="body" weight="semibold" style={styles.heading}>
        {t('analytics.title')}
      </Text>
      <View style={styles.tilesRow}>
        <StatTile
          label={t('analytics.views24h')}
          value={
            showPlaceholder
              ? placeholder
              : String(data?.views_24h ?? 0)
          }
        />
        <StatTile
          label={t('analytics.views7d')}
          value={
            showPlaceholder
              ? placeholder
              : String(data?.views_7d ?? 0)
          }
        />
        <StatTile
          label={t('analytics.views30d')}
          value={
            showPlaceholder
              ? placeholder
              : String(data?.views_30d ?? 0)
          }
        />
      </View>
    </Surface>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.tile}>
      <Text variant="title" weight="bold" style={styles.tileValue}>
        {value}
      </Text>
      <Text variant="caption" color="secondary" style={styles.tileLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  heading: {
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    marginTop: 2,
    textAlign: 'center',
  },
});

export default AnalyticsCard;
