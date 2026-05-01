import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  CATEGORIES,
  type CategoryDef,
} from '@/features/marketplace/data/categories';
import { useMarketplaceFilters } from '@/stores/useMarketplaceFilters';
import { useMainTabStore } from '@/stores/useMainTabStore';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { mediumHaptic } from '@/features/marketplace/utils/haptics';
import { getLocalized } from '@/i18n/getLocalized';

const BRAND_PRIMARY = '#FE2C55';

export default function CategoriesScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setFilters = useMarketplaceFilters((s) => s.setFilters);
  const setMainTab = useMainTabStore((s) => s.setMainTab);
  const { isTablet } = useDeviceLayout();
  const numColumns = isTablet ? 3 : 2;
  const lang = i18n.language;

  const onPressCategory = (category: CategoryDef): void => {
    void mediumHaptic();
    setFilters({ categoryId: category.id, subcategoryId: null });
    setMainTab('marketplace');
    router.push('/(protected)/(tabs)');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>{t('categories.title')}</Text>
      <FlatList
        key={numColumns}
        data={CATEGORIES}
        keyExtractor={(c) => c.id}
        numColumns={numColumns}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <CategoryCard
            category={item}
            label={getLocalized(item.label, lang)}
            onPress={() => onPressCategory(item)}
          />
        )}
      />
    </View>
  );
}

type CategoryCardProps = {
  category: CategoryDef;
  label: string;
  onPress: () => void;
};

function CategoryCard({
  category,
  label,
  onPress,
}: CategoryCardProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Ionicons
        name={category.iconName as React.ComponentProps<typeof Ionicons>['name']}
        size={48}
        color={BRAND_PRIMARY}
      />
      <Text style={styles.cardLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 12,
  },
  columnWrapper: {
    gap: 12,
  },
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
});
