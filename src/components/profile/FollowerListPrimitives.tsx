import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

// Skeleton row matching FollowerRow's geometry: 48px circle + two text bars
// + a 64px-ish tail rectangle for the FollowButton placeholder. Renders
// `count` of these stacked, separated by hairlines (mirrors FollowerRow).
export type FollowerListSkeletonsProps = {
  count?: number;
};

export function FollowerListSkeletons({
  count = 6,
}: FollowerListSkeletonsProps): React.ReactElement {
  return (
    <View>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={skeletonStyles.row}>
          <View style={skeletonStyles.avatar} />
          <View style={skeletonStyles.middle}>
            <View style={skeletonStyles.lineNarrow} />
            <View style={skeletonStyles.lineWide} />
          </View>
          <View style={skeletonStyles.button} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  middle: {
    flex: 1,
    gap: spacing.xs,
  },
  lineNarrow: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lineWide: {
    width: '70%',
    height: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  button: {
    width: 72,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

// Empty-state placeholder for follower / following list screens. Centered
// stack of an Ionicons glyph + headline + optional body. The icon name is
// caller-supplied so the followers / following screens can pick the
// semantically-appropriate glyph.
export type FollowerListEmptyProps = {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
};

export function FollowerListEmpty({
  iconName,
  title,
  body,
}: FollowerListEmptyProps): React.ReactElement {
  return (
    <View style={emptyStyles.wrap}>
      <Ionicons name={iconName} size={40} color="rgba(255,255,255,0.25)" />
      <Text variant="body" weight="semibold" style={emptyStyles.title}>
        {title}
      </Text>
      {body ? (
        <Text variant="caption" color="secondary" style={emptyStyles.body}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    paddingVertical: spacing.xl * 2,
  },
  title: { color: colors.text.primary, textAlign: 'center', marginTop: spacing.sm },
  body: { textAlign: 'center', lineHeight: 18 },
});
