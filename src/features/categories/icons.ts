/**
 * Category icon mapping for the Categories screen.
 *
 * Keyed by the `id` field of `CATEGORIES` in
 * `src/features/marketplace/data/categories.ts`. Each entry picks an
 * icon library and glyph name; the Categories grid resolves these via
 * `getCategoryIcon` and renders with `@expo/vector-icons`.
 *
 * The legacy `iconName` field on each `CategoryDef` predates this file
 * and is still consulted by older surfaces; this map is the source of
 * truth for the new Categories page only.
 */
export type CategoryIconLib = 'Ionicons' | 'MaterialCommunityIcons';

export type CategoryIconDef = {
  lib: CategoryIconLib;
  name: string;
};

export const CATEGORY_ICONS: Record<string, CategoryIconDef> = {
  auto: { lib: 'Ionicons', name: 'car-outline' },
  immo: { lib: 'Ionicons', name: 'business-outline' },
  home: { lib: 'Ionicons', name: 'home-outline' },
  fashion: { lib: 'Ionicons', name: 'shirt-outline' },
  electronics: { lib: 'Ionicons', name: 'phone-portrait-outline' },
  sports: { lib: 'MaterialCommunityIcons', name: 'dumbbell' },
  books: { lib: 'Ionicons', name: 'book-outline' },
  other: { lib: 'Ionicons', name: 'apps-outline' },
};

export function getCategoryIcon(id: string): CategoryIconDef {
  return CATEGORY_ICONS[id] ?? CATEGORY_ICONS.other;
}
