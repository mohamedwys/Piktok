import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TopFeedSwitchTab = {
  id: string;
  label: string;
};

type TopFeedSwitchProps = {
  tabs: TopFeedSwitchTab[];
  activeId: string;
  onChange: (id: string) => void;
};

export default function TopFeedSwitch({
  tabs,
  activeId,
  onChange,
}: TopFeedSwitchProps): React.ReactElement {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              pressed ? styles.tabPressed : null,
            ]}
            hitSlop={8}
          >
            <Text
              style={[styles.label, isActive ? styles.labelActive : null]}
            >
              {tab.label}
            </Text>
            {isActive ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  tab: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.6,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 17,
    fontWeight: '600',
  },
  labelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  indicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginTop: 4,
  },
});
