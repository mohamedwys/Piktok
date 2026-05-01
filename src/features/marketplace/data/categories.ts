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
    id: 'auto',
    label: { fr: 'Auto & Moto', en: 'Vehicles' },
    iconName: 'car-outline',
    subcategories: [
      { id: 'auto-cars', label: { fr: 'Voitures', en: 'Cars' } },
      { id: 'auto-motorcycles', label: { fr: 'Motos & Scooters', en: 'Motorcycles & Scooters' } },
      { id: 'auto-utility', label: { fr: 'Utilitaires', en: 'Commercial vehicles' } },
      { id: 'auto-rv', label: { fr: 'Caravanes & Camping-cars', en: 'RVs & Caravans' } },
      { id: 'auto-parts', label: { fr: 'Pièces & Accessoires', en: 'Parts & Accessories' } },
      { id: 'auto-tires', label: { fr: 'Pneus & Jantes', en: 'Tires & Wheels' } },
    ],
  },
  {
    id: 'immo',
    label: { fr: 'Immobilier', en: 'Real Estate' },
    iconName: 'business-outline',
    subcategories: [
      { id: 'immo-apartments-sale', label: { fr: 'Appartements à vendre', en: 'Apartments for sale' } },
      { id: 'immo-houses-sale', label: { fr: 'Maisons à vendre', en: 'Houses for sale' } },
      { id: 'immo-rentals', label: { fr: 'Locations', en: 'Rentals' } },
      { id: 'immo-shared', label: { fr: 'Colocations', en: 'Shared housing' } },
      { id: 'immo-land', label: { fr: 'Terrains', en: 'Land' } },
      { id: 'immo-commercial', label: { fr: 'Locaux commerciaux', en: 'Commercial spaces' } },
      { id: 'immo-parking', label: { fr: 'Parkings & Garages', en: 'Parking & Garages' } },
    ],
  },
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
