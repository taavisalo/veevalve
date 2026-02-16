import type { AppLocale, PlaceType, PlaceWithLatestReading } from '@veevalve/core';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusChip } from './status-chip';

export interface NativePlaceCardProps {
  place: PlaceWithLatestReading;
  locale?: AppLocale;
  referenceTimeIso?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (placeId: string) => void;
}

const GOOGLE_MAPS_SEARCH_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';
const TERVISEAMET_REPORT_BASE_URL = 'https://vtiav.sm.ee/frontpage/show';

const toValidDate = (value: string): Date | undefined => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const buildGoogleMapsSearchUrl = (address: string): string =>
  `${GOOGLE_MAPS_SEARCH_BASE_URL}${encodeURIComponent(address)}`;

const isSafeGoogleMapsSearchUrl = (url: string): boolean =>
  url.startsWith(GOOGLE_MAPS_SEARCH_BASE_URL);

const toTerviseametTabId = (placeType: PlaceType): string =>
  placeType === 'POOL' ? 'U' : 'A';

const buildTerviseametReportUrl = (externalId: string, placeType: PlaceType): string =>
  `${TERVISEAMET_REPORT_BASE_URL}?id=${encodeURIComponent(externalId)}&active_tab_id=${toTerviseametTabId(placeType)}`;

const isSafeTerviseametReportUrl = (url: string): boolean =>
  url.startsWith(`${TERVISEAMET_REPORT_BASE_URL}?`);

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

const mergeUniqueDetails = (details: string[], fallbackDetail: string | undefined): string[] => {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const candidate of details) {
    const detail = candidate.trim();
    if (!detail) {
      continue;
    }

    const key = detail.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(detail);
  }

  if (merged.length > 0) {
    return merged;
  }

  const fallback = fallbackDetail?.trim() ?? '';
  if (!fallback) {
    return merged;
  }

  merged.push(fallback);
  return merged;
};

export const NativePlaceCard = ({
  place,
  locale = 'et',
  referenceTimeIso,
  isFavorite = false,
  onToggleFavorite,
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
  const [showBadDetails, setShowBadDetails] = useState(false);

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
  const toggleFavoriteLabel =
    locale === 'en'
      ? (isFavorite ? 'Remove from favorites' : 'Add to favorites')
      : (isFavorite ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse');
  const isBadStatus = place.latestReading?.status === 'BAD';
  const badDetailCandidates =
    locale === 'en'
      ? (place.latestReading?.badDetailsEn ?? place.latestReading?.badDetailsEt ?? [])
      : (place.latestReading?.badDetailsEt ?? place.latestReading?.badDetailsEn ?? []);
  const statusReason =
    place.latestReading
      ? (locale === 'en' ? place.latestReading.statusReasonEn : place.latestReading.statusReasonEt)
      : undefined;
  const badDetails = mergeUniqueDetails(badDetailCandidates, statusReason);
  const badDetailsToggleLabel =
    locale === 'en'
      ? (showBadDetails ? 'Hide bad quality details' : 'Show bad quality details')
      : (showBadDetails ? 'Peida halva kvaliteedi detailid' : 'Näita halva kvaliteedi detaile');
  const badDetailsTitle = locale === 'en' ? 'Why is this marked bad?' : 'Miks on see märgitud halvaks?';
  const badDetailsFallbackText =
    locale === 'en'
      ? 'The source did not include additional detailed reasons.'
      : 'Allikandmed ei sisaldanud täpsemaid põhjuseid.';
  const fullReportLabel =
    locale === 'en'
      ? 'Open full report on Terviseamet'
      : 'Ava täielik raport Terviseameti lehel';
  const reportExternalId = place.externalId.trim();
  const fullReportUrl =
    reportExternalId.length > 0
      ? buildTerviseametReportUrl(reportExternalId, place.type)
      : undefined;

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

  const openFullReport = async (url: string): Promise<void> => {
    if (!isSafeTerviseametReportUrl(url)) {
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
    <View style={[styles.card, showExactSampledAt ? styles.cardOverlay : null]}>
      <View style={styles.headerRow}>
        <View style={styles.textBlock}>
          <Text style={styles.name}>{placeName}</Text>
          <Text style={styles.municipality}>{place.municipality}</Text>
        </View>
        <View style={styles.actionsColumn}>
          {onToggleFavorite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toggleFavoriteLabel}
              style={({ pressed }) => [
                styles.favoriteButton,
                isFavorite ? styles.favoriteButtonActive : null,
                pressed ? styles.favoriteButtonPressed : null,
              ]}
              onPress={() => onToggleFavorite(place.id)}
            >
              <Text style={[styles.favoriteButtonText, isFavorite ? styles.favoriteButtonTextActive : null]}>
                {isFavorite ? '★' : '☆'}
              </Text>
            </Pressable>
          ) : null}
          {isBadStatus ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={badDetailsToggleLabel}
              accessibilityState={{ expanded: showBadDetails }}
              style={({ pressed }) => [styles.statusChipButton, pressed ? styles.statusChipButtonPressed : null]}
              onPress={() => setShowBadDetails((value) => !value)}
            >
              <StatusChip
                status={place.latestReading?.status ?? 'UNKNOWN'}
                locale={locale}
                prominent
                trailingSymbol={showBadDetails ? '▾' : '▸'}
              />
            </Pressable>
          ) : (
            <StatusChip status={place.latestReading?.status ?? 'UNKNOWN'} locale={locale} prominent />
          )}
        </View>
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
              <View style={styles.latestSampleIsoTooltip}>
                <Text style={styles.latestSampleIso} numberOfLines={1}>
                  {exactSampledAtIso}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.latestSampleValue}>—</Text>
        )}
      </View>
      {isBadStatus && showBadDetails ? (
        <View style={styles.badDetailsContainer}>
          <View style={styles.badDetailsBody}>
            <Text style={styles.badDetailsTitle}>{badDetailsTitle}</Text>
            {badDetails.length > 0 ? (
              <View style={styles.badDetailsList}>
                {badDetails.map((detail) => (
                  <View key={`${place.id}-bad-detail-${detail}`} style={styles.badDetailsItem}>
                    <Text style={styles.badDetailsBullet}>•</Text>
                    <Text style={styles.badDetailsItemText}>{detail}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.badDetailsFallback}>{badDetailsFallbackText}</Text>
            )}
            {fullReportUrl ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={fullReportLabel}
                style={({ pressed }) => [styles.reportLink, pressed ? styles.reportLinkPressed : null]}
                onPress={() => {
                  void openFullReport(fullReportUrl);
                }}
              >
                <Text style={styles.reportLinkText}>{fullReportLabel}</Text>
                <Text aria-hidden style={styles.reportLinkIcon}>
                  ↗
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
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
  cardOverlay: {
    zIndex: 30,
    elevation: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionsColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusChipButton: {
    borderRadius: 999,
  },
  statusChipButtonPressed: {
    opacity: 0.85,
  },
  favoriteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  favoriteButtonPressed: {
    opacity: 0.8,
  },
  favoriteButtonText: {
    fontSize: 17,
    color: '#64748B',
    lineHeight: 19,
  },
  favoriteButtonTextActive: {
    color: '#D97706',
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
    position: 'relative',
    flexDirection: 'row',
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
  latestSampleIsoTooltip: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    zIndex: 20,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  latestSampleIso: {
    fontSize: 11,
    color: '#334155',
    flexShrink: 0,
  },
  badDetailsContainer: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F8C6C3',
    backgroundColor: '#FFF1F1',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badDetailsBody: {
    marginTop: 2,
  },
  badDetailsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  badDetailsList: {
    marginTop: 4,
    gap: 4,
  },
  badDetailsItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badDetailsBullet: {
    marginTop: 1,
    marginRight: 6,
    fontSize: 12,
    color: '#7F1D1D',
  },
  badDetailsItemText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#7F1D1D',
  },
  badDetailsFallback: {
    marginTop: 4,
    fontSize: 12,
    color: '#9F1239',
  },
  reportLink: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  reportLinkPressed: {
    opacity: 0.8,
  },
  reportLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A92F27',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  reportLinkIcon: {
    marginLeft: 5,
    marginTop: 1,
    fontSize: 12,
    color: '#A92F27',
    fontWeight: '700',
  },
});
