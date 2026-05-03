import React from 'react';
import { Text } from '@/components/ui';
import { typography } from '@/theme';

export type ProductTitleProps = {
  title: string;
  numberOfLines?: number;
};

const TITLE_FONT_SIZE = 28;
const TITLE_LINE_HEIGHT = 32;

/**
 * The editorial Fraunces title for a product. Belt-and-suspenders the
 * `variant="display"` resolution with an explicit `fontFamily` override
 * so the typography moment cannot regress if the variant-to-family map
 * changes downstream.
 */
export default function ProductTitle({
  title,
  numberOfLines = 2,
}: ProductTitleProps): React.ReactElement {
  return (
    <Text
      variant="display"
      weight="semibold"
      color="primary"
      numberOfLines={numberOfLines}
      style={{
        fontFamily: typography.family.displaySemibold,
        fontSize: TITLE_FONT_SIZE,
        lineHeight: TITLE_LINE_HEIGHT,
        letterSpacing: -0.4,
      }}
    >
      {title}
    </Text>
  );
}
