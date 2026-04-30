import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Product, ProductAttribute } from '@/features/marketplace/types/product';
import { attributeIcon } from '@/features/marketplace/utils/attributeIcon';
import { getLocalized } from '@/i18n/getLocalized';
import { lightHaptic } from '@/features/marketplace/utils/haptics';

type ProductBottomPanelProps = {
  product: Product;
  expanded: boolean;
  onToggleExpanded: () => void;
};

function ChipIcon({ iconKey }: { iconKey?: string }): React.ReactElement {
  const icon = attributeIcon(iconKey);
  if (icon.family === 'ionicons') {
    return <Ionicons name={icon.name as React.ComponentProps<typeof Ionicons>['name']} size={11} color="#fff" />;
  }
  if (icon.family === 'material') {
    return <MaterialIcons name={icon.name as React.ComponentProps<typeof MaterialIcons>['name']} size={11} color="#fff" />;
  }
  return <View style={styles.dot} />;
}

function AttributeChip({
  attribute,
  lang,
}: {
  attribute: ProductAttribute;
  lang: string;
}): React.ReactElement {
  return (
    <View style={styles.chip}>
      <ChipIcon iconKey={attribute.iconKey} />
      <Text style={styles.chipText}>{` ${getLocalized(attribute.label, lang)}`}</Text>
    </View>
  );
}

export default function ProductBottomPanel({
  product,
  expanded,
  onToggleExpanded,
}: ProductBottomPanelProps): React.ReactElement {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const title = getLocalized(product.title, lang);
  const description = getLocalized(product.description, lang);
  const categoryPrimary = getLocalized(product.category.primary, lang);
  const categorySecondary = getLocalized(product.category.secondary, lang);

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          void lightHaptic();
          onToggleExpanded();
        }}
        hitSlop={12}
        style={styles.handleArea}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-up'}
          size={22}
          color="rgba(255,255,255,0.9)"
        />
      </Pressable>

      {expanded ? (
        <View style={styles.breadcrumb} pointerEvents="none">
          <Ionicons name="home" size={11} color="#fff" />
          <Text style={styles.breadcrumbText}>
            {` ${categoryPrimary} > ${categorySecondary}`}
          </Text>
        </View>
      ) : null}

      <View pointerEvents="none">
        <Text style={[styles.title, styles.titleShadow]} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {expanded ? (
        <View pointerEvents="none">
          <Text style={styles.description}>{description}</Text>
        </View>
      ) : null}

      {product.attributes.length > 0 ? (
        <View style={styles.chipsRow} pointerEvents="none">
          {product.attributes.map((attr) => (
            <AttributeChip key={attr.id} attribute={attr} lang={lang} />
          ))}
        </View>
      ) : null}

      {expanded && product.dimensions && product.dimensions.length > 0 ? (
        <View style={styles.dimensionsChip} pointerEvents="none">
          <MaterialIcons name="straighten" size={11} color="#fff" />
          <Text style={styles.chipText}>{` ${product.dimensions}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 12,
    right: '30%',
    bottom: 24,
    gap: 8,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  breadcrumbText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  handleArea: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    flexShrink: 1,
  },
  titleShadow: {
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    lineHeight: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  dimensionsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
