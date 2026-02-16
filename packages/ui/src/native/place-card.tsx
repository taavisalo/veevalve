import type { AppLocale, PlaceWithLatestReading } from '@veevalve/core';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusChip } from './status-chip';

export interface NativePlaceCardProps {
  place: PlaceWithLatestReading;
  locale?: AppLocale;
  referenceTimeIso?: string;
}

const GOOGLE_MAPS_SEARCH_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';

const toValidDate = (value: string): Date | undefined => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const buildGoogleMapsSearchUrl = (address: string): string =>
  `${GOOGLE_MAPS_SEARCH_BASE_URL}${encodeURIComponent(address)}`;

const isSafeGoogleMapsSearchUrl = (url: string): boolean =>
  url.startsWith(GOOGLE_MAPS_SEARCH_BASE_URL);

const formatSampledAtRelative = (
  sampledAtIso: string,
  locale: AppLocale,
  referenceTimeIso: string | undefined,
): string => {
  const sampledDate = toValidDate(sampledAtIso);
  if (!sampledDate) {
    return sampledAtIso;
  }

  const referenceDate = toValidDate(referenceTimeIso ?? '') ?? new Date();
  const diffMs = sampledDate.getTime() - referenceDate.getTime();
  const absDiffMs = Math.abs(diffMs);

  const relativeUnits = [
    { unit: 'year', milliseconds: 365 * 24 * 60 * 60 * 1000 },
    { unit: 'month', milliseconds: 30 * 24 * 60 * 60 * 1000 },
    { unit: 'week', milliseconds: 7 * 24 * 60 * 60 * 1000 },
    { unit: 'day', milliseconds: 24 * 60 * 60 * 1000 },
    { unit: 'hour', milliseconds: 60 * 60 * 1000 },
    { unit: 'minute', milliseconds: 60 * 1000 },
    { unit: 'second', milliseconds: 1000 },
  ] as const;

  const matchedUnit = relativeUnits.find(({ milliseconds }) => absDiffMs >= milliseconds);
  const formatter = new Intl.RelativeTimeFormat(locale === 'en' ? 'en-GB' : 'et-EE', {
    numeric: 'always',
    style: 'long',
  });

  if (!matchedUnit) {
    return formatter.format(0, 'second');
  }

  const amount = Math.round(diffMs / matchedUnit.milliseconds);
  return formatter.format(amount, matchedUnit.unit);
};

export const NativePlaceCard = ({
  place,
  locale = 'et',
  referenceTimeIso,
}: NativePlaceCardProps) => {
  const placeName = locale === 'en' ? place.nameEn : place.nameEt;
  const placeAddress = locale === 'en' ? place.addressEn : place.addressEt;
  const missingAddressText = locale === 'en' ? 'Address unavailable' : 'Aadress puudub';
  const latestSampleLabel = locale === 'en' ? 'Last sample:' : 'Viimane proov:';
  const mapsSearchQuery =
    place.type === 'BEACH'
      ? [placeName, place.municipality].filter((part) => part.trim().length > 0).join(', ')
      : (placeAddress ?? placeName);
  const [showExactSampledAt, setShowExactSampledAt] = useState(false);

  const sampledDate = place.latestReading ? toValidDate(place.latestReading.sampledAt) : undefined;
  const exactSampledAtIso = place.latestReading
    ? (sampledDate?.toISOString() ?? place.latestReading.sampledAt)
    : undefined;
  const relativeSampledAt = place.latestReading
    ? formatSampledAtRelative(place.latestReading.sampledAt, locale, referenceTimeIso)
    : undefined;
  const openAddressLabel = locale === 'en' ? 'Open in Google Maps' : 'Ava Google Mapsis';
  const openAddressHint =
    locale === 'en'
      ? 'Opens the address in Google Maps in another app.'
      : 'Avab aadressi Google Mapsis eraldi rakenduses.';

  const openAddressInMaps = async (query: string): Promise<void> => {
    const url = buildGoogleMapsSearchUrl(query);
    if (!isSafeGoogleMapsSearchUrl(url)) {
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.textBlock}>
          <Text style={styles.name}>{placeName}</Text>
          <Text style={styles.municipality}>{place.municipality}</Text>
        </View>
        <StatusChip status={place.latestReading?.status ?? 'UNKNOWN'} />
      </View>
      {mapsSearchQuery ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={openAddressLabel}
          accessibilityHint={openAddressHint}
          style={styles.addressLink}
          onPress={() => {
            void openAddressInMaps(mapsSearchQuery);
          }}
        >
          <Text style={styles.addressLinkText}>{placeAddress ?? placeName}</Text>
          <Text aria-hidden style={styles.addressExternalIcon}>
            ↗
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.address}>{missingAddressText}</Text>
      )}
      <View style={styles.latestSampleRow}>
        <Text style={styles.latestSampleLabel}>{latestSampleLabel} </Text>
        {place.latestReading && exactSampledAtIso && relativeSampledAt ? (
          <View style={styles.latestSampleInline}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={exactSampledAtIso}
              onPress={() => setShowExactSampledAt((value) => !value)}
            >
              <Text style={styles.latestSampleLink}>{relativeSampledAt}</Text>
            </Pressable>
            {showExactSampledAt ? (
              <Text style={styles.latestSampleIso}>{exactSampledAtIso}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.latestSampleValue}>—</Text>
        )}
      </View>
    </View>
  );
};

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
  addressLink: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressLinkText: {
    flex: 1,
    fontSize: 13,
    color: '#0A8F78',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  addressExternalIcon: {
    marginLeft: 6,
    marginTop: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0A8F78',
  },
  latestSampleRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  latestSampleInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  latestSampleLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  latestSampleLink: {
    fontSize: 12,
    color: '#0A8F78',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  latestSampleValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  latestSampleIso: {
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 11,
    color: '#334155',
    overflow: 'hidden',
  },
});
