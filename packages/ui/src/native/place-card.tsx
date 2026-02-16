import type { PlaceWithLatestReading } from '@veevalve/core';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StatusChip } from './status-chip';

export interface NativePlaceCardProps {
  place: PlaceWithLatestReading;
}

export const NativePlaceCard = memo(({ place }: NativePlaceCardProps) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.textBlock}>
          <Text style={styles.name}>{place.nameEt}</Text>
          <Text style={styles.municipality}>{place.municipality}</Text>
        </View>
        <StatusChip status={place.latestReading?.status ?? 'UNKNOWN'} />
      </View>
      <Text style={styles.address}>
        {place.addressEt ?? 'Aadress puudub'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#06685A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textBlock: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#153233',
  },
  municipality: {
    marginTop: 2,
    fontSize: 13,
    color: '#4B5563',
  },
  address: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
  },
});
