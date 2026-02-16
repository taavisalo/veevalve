import type { QualityStatus } from '@veevalve/core';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const styles: Record<QualityStatus, { backgroundColor: string; textColor: string; label: string }> = {
  GOOD: { backgroundColor: '#D8F7E3', textColor: '#126436', label: 'Hea' },
  BAD: { backgroundColor: '#FFE0DE', textColor: '#8F2A24', label: 'Halb' },
  UNKNOWN: { backgroundColor: '#E9EDF2', textColor: '#4F5B66', label: 'Teadmata' },
};

export interface StatusChipProps {
  status: QualityStatus;
}

export const StatusChip = memo(({ status }: StatusChipProps) => {
  const style = styles[status];

  return (
    <View style={[chipStyles.container, { backgroundColor: style.backgroundColor }]}>
      <Text style={[chipStyles.text, { color: style.textColor }]}>{style.label}</Text>
    </View>
  );
});

const chipStyles = StyleSheet.create({
  container: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
