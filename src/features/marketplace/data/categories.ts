import type { LocalizedString } from '@/i18n/getLocalized';

export type SubcategoryDef = { id: string; label: LocalizedString };
export type CategoryDef = {
  id: string;
  label: LocalizedString;
  iconName: string;
  subcategories: SubcategoryDef[];
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'home',
    label: { fr: 'Maison & Déco', en: 'Home & Decor' },
    iconName: 'home-outline',
    subcategories: [
      { id: 'home-armchairs', label: { fr: 'Fauteuils', en: 'Armchairs' } },
      { id: 'home-tables', label: { fr: 'Tables', en: 'Tables' } },
      { id: 'home-lighting', label: { fr: 'Luminaires', en: 'Lighting' } },
      { id: 'home-decor', label: { fr: 'Décoration', en: 'Decor' } },
      { id: 'home-storage', label: { fr: 'Rangement', en: 'Storage' } },
    ],
  },
  {
    id: 'fashion',
    label: { fr: 'Mode', en: 'Fashion' },
    iconName: 'shirt-outline',
    subcategories: [
      { id: 'fashion-clothing', label: { fr: 'Vêtements', en: 'Clothing' } },
      { id: 'fashion-shoes', label: { fr: 'Chaussures', en: 'Shoes' } },
      { id: 'fashion-bags', label: { fr: 'Sacs', en: 'Bags' } },
      { id: 'fashion-accessories', label: { fr: 'Accessoires', en: 'Accessories' } },
      { id: 'fashion-jewelry', label: { fr: 'Bijoux', en: 'Jewelry' } },
    ],
  },
  {
    id: 'electronics',
    label: { fr: 'Électronique', en: 'Electronics' },
    iconName: 'phone-portrait-outline',
    subcategories: [
      { id: 'elec-phones', label: { fr: 'Téléphones', en: 'Phones' } },
      { id: 'elec-computers', label: { fr: 'Ordinateurs', en: 'Computers' } },
      { id: 'elec-audio', label: { fr: 'Audio', en: 'Audio' } },
      { id: 'elec-cameras', label: { fr: 'Photo & Vidéo', en: 'Photo & Video' } },
      { id: 'elec-gaming', label: { fr: 'Jeux vidéo', en: 'Gaming' } },
    ],
  },
  {
    id: 'sports',
    label: { fr: 'Sports & Loisirs', en: 'Sports & Leisure' },
    iconName: 'fitness-outline',
    subcategories: [
      { id: 'sports-fitness', label: { fr: 'Fitness', en: 'Fitness' } },
      { id: 'sports-outdoor', label: { fr: 'Plein air', en: 'Outdoor' } },
      { id: 'sports-bikes', label: { fr: 'Vélos', en: 'Bikes' } },
      { id: 'sports-team', label: { fr: 'Sports d\'équipe', en: 'Team sports' } },
    ],
  },
  {
    id: 'books',
    label: { fr: 'Livres & Médias', en: 'Books & Media' },
    iconName: 'book-outline',
    subcategories: [
      { id: 'books-books', label: { fr: 'Livres', en: 'Books' } },
      { id: 'books-music', label: { fr: 'Musique', en: 'Music' } },
      { id: 'books-movies', label: { fr: 'Films & Séries', en: 'Movies & Series' } },
      { id: 'books-games', label: { fr: 'Jeux & Jouets', en: 'Games & Toys' } },
    ],
  },
  {
    id: 'other',
    label: { fr: 'Autres', en: 'Other' },
    iconName: 'cube-outline',
    subcategories: [
      { id: 'other-misc', label: { fr: 'Divers', en: 'Misc' } },
    ],
  },
];

export function findCategory(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
