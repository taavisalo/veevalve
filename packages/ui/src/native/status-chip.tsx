import { t, type AppLocale, type QualityStatus } from '@veevalve/core';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const styles: Record<QualityStatus, { backgroundColor: string; textColor: string }> = {
  GOOD: { backgroundColor: '#D8F7E3', textColor: '#126436' },
  BAD: { backgroundColor: '#FFE0DE', textColor: '#8F2A24' },
  UNKNOWN: { backgroundColor: '#E9EDF2', textColor: '#4F5B66' },
};

const labelKeys: Record<QualityStatus, 'qualityGood' | 'qualityBad' | 'qualityUnknown'> = {
  GOOD: 'qualityGood',
  BAD: 'qualityBad',
  UNKNOWN: 'qualityUnknown',
};

export interface StatusChipProps {
  status: QualityStatus;
  locale?: AppLocale;
}

export const StatusChip = memo(({ status, locale = 'et' }: StatusChipProps) => {
  const style = styles[status];

  return (
    <View style={[chipStyles.container, { backgroundColor: style.backgroundColor }]}>
      <Text style={[chipStyles.text, { color: style.textColor }]}>{t(labelKeys[status], locale)}</Text>
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
