import type { QualityStatus } from '@veevalve/core';
import { Text, View } from 'react-native';

const styles: Record<QualityStatus, { backgroundColor: string; textColor: string; label: string }> = {
  GOOD: { backgroundColor: '#D8F7E3', textColor: '#126436', label: 'Hea' },
  BAD: { backgroundColor: '#FFE0DE', textColor: '#8F2A24', label: 'Halb' },
  UNKNOWN: { backgroundColor: '#E9EDF2', textColor: '#4F5B66', label: 'Teadmata' },
};

export interface StatusChipProps {
  status: QualityStatus;
}

export const StatusChip = ({ status }: StatusChipProps) => {
  const style = styles[status];

  return (
    <View
      style={{
        backgroundColor: style.backgroundColor,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: style.textColor, fontSize: 12, fontWeight: '600' }}>{style.label}</Text>
    </View>
  );
};
