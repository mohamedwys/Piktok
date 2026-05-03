import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import { geocodeAddress } from '@/lib/geocoding';
import type { GeoLocation } from '@/lib/geocoding/types';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

export type CitySearchInputProps = {
  onSelect: (location: GeoLocation) => void;
};

export function CitySearchInput({ onSelect }: CitySearchInputProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const myId = ++requestId.current;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      geocodeAddress(trimmed, { limit: 5, locale: i18n.language || 'en' })
        .then((items) => {
          if (requestId.current !== myId) return;
          setResults(items);
        })
        .catch((err: unknown) => {
          if (requestId.current !== myId) return;
          setResults([]);
          setError(
            err instanceof Error ? err.message : t('common.errorGeneric'),
          );
        })
        .finally(() => {
          if (requestId.current !== myId) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, i18n.language, t]);

  const showEmpty =
    !loading &&
    !error &&
    query.trim().length >= MIN_QUERY_LENGTH &&
    results.length === 0;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.inputRow}>
        <Ionicons
          name="search"
          size={16}
          color={colors.text.tertiary}
          style={{ marginRight: spacing.sm }}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('location.searchCity')}
          placeholderTextColor={colors.text.tertiary}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          style={styles.input}
        />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.text.secondary}
            style={{ marginLeft: spacing.sm }}
          />
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" color="tertiary">
          {error}
        </Text>
      ) : null}

      {showEmpty ? (
        <Text variant="caption" color="tertiary">
          {t('location.noResults')}
        </Text>
      ) : null}

      {results.length > 0 ? (
        <View style={styles.resultList}>
          {results.map((loc, idx) => (
            <Pressable
              key={`${loc.latitude},${loc.longitude}-${idx}`}
              haptic="light"
              onPress={() => onSelect(loc)}
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={loc.displayName}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={colors.text.secondary}
              />
              <Text
                variant="caption"
                color="primary"
                numberOfLines={2}
                style={{ flex: 1 }}
              >
                {loc.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: 4,
  },
  resultList: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

export default CitySearchInput;
