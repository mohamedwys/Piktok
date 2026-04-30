export type AttributeIcon =
  | { family: 'ionicons'; name: string }
  | { family: 'material'; name: string }
  | { family: 'dot' };

export function attributeIcon(iconKey?: string): AttributeIcon {
  if (!iconKey) {
    return { family: 'dot' };
  }
  const key = iconKey.toLowerCase();
  switch (key) {
    case 'wood':
      return { family: 'ionicons', name: 'leaf' };
    case 'fabric':
    case 'textile':
      return { family: 'ionicons', name: 'sparkles' };
    case 'color':
      return { family: 'dot' };
    case 'dimensions':
      return { family: 'material', name: 'straighten' };
    default:
      return { family: 'dot' };
  }
}
