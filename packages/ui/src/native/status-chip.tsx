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
  prominent?: boolean;
  trailingSymbol?: string;
}

export const StatusChip = memo(
  ({ status, locale = 'et', prominent = false, trailingSymbol }: StatusChipProps) => {
  const style = styles[status];

  return (
      <View
        style={[
          chipStyles.container,
          { backgroundColor: style.backgroundColor, borderColor: style.textColor },
          prominent ? chipStyles.containerProminent : null,
        ]}
      >
        <Text
          style={[
            chipStyles.text,
            { color: style.textColor },
            prominent ? chipStyles.textProminent : null,
          ]}
        >
          {t(labelKeys[status], locale)}
        </Text>
        {trailingSymbol ? (
          <Text style={[chipStyles.trailingSymbol, { color: style.textColor }]}>{trailingSymbol}</Text>
        ) : null}
      </View>
  );
  },
);

const chipStyles = StyleSheet.create({
  container: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  containerProminent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textProminent: {
    fontSize: 13,
    fontWeight: '700',
  },
  trailingSymbol: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
