import type { PlaceWithLatestReading } from '@veevalve/core';
import { Text, View } from 'react-native';

import { StatusChip } from './status-chip';

export interface NativePlaceCardProps {
  place: PlaceWithLatestReading;
}

export const NativePlaceCard = ({ place }: NativePlaceCardProps) => {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 12,
        shadowColor: '#06685A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#153233' }}>{place.nameEt}</Text>
          <Text style={{ marginTop: 2, fontSize: 13, color: '#4B5563' }}>{place.municipality}</Text>
        </View>
        <StatusChip status={place.latestReading?.status ?? 'UNKNOWN'} />
      </View>
      <Text style={{ marginTop: 10, fontSize: 13, color: '#374151' }}>
        {place.addressEt ?? 'Aadress puudub'}
      </Text>
    </View>
  );
};
