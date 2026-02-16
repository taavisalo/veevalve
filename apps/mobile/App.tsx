import { t, type AppLocale, type PlaceType } from '@veevalve/core';
import { NativePlaceCard } from '@veevalve/ui/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { mobileMockPlaces } from './src/mock-places';
import { ToggleRow } from './src/components/toggle-row';

const App = () => {
  const [locale, setLocale] = useState<AppLocale>('et');
  const [typeFilter, setTypeFilter] = useState<PlaceType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'GOOD' | 'BAD' | 'ALL'>('ALL');
  const [qualityAlertsEnabled, setQualityAlertsEnabled] = useState(true);
  const [locationAlertsEnabled, setLocationAlertsEnabled] = useState(false);

  const places = useMemo(() => {
    return mobileMockPlaces.filter((place) => {
      const typeMatches = typeFilter === 'ALL' ? true : place.type === typeFilter;
      const statusMatches =
        statusFilter === 'ALL'
          ? true
          : (place.latestReading?.status ?? 'UNKNOWN') === statusFilter;

      return typeMatches && statusMatches;
    });
  }, [typeFilter, statusFilter]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>
            {t('appName', locale)}
          </Text>
          <Text style={styles.heroTitle}>
            {locale === 'et'
              ? 'Ujumiskohtade vee kvaliteet Eestis'
              : 'Water quality for swimming places in Estonia'}
          </Text>
          <Text style={styles.heroSubtitle}>{t('subtitle', locale)}</Text>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => setLocale('et')}
              style={[
                styles.filterButton,
                locale === 'et' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  locale === 'et'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                EST
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('en')}
              style={[
                styles.filterButton,
                locale === 'en' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  locale === 'en'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                ENG
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>
            {locale === 'et' ? 'Filtreeri' : 'Filter'}
          </Text>
          <View style={styles.filterWrap}>
            <Pressable
              style={[
                styles.filterButton,
                typeFilter === 'ALL' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setTypeFilter('ALL')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'ALL'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {locale === 'et' ? 'Kõik' : 'All'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                typeFilter === 'BEACH' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setTypeFilter('BEACH')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'BEACH'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('beaches', locale)}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                typeFilter === 'POOL' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setTypeFilter('POOL')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'POOL'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('pools', locale)}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                statusFilter === 'GOOD' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setStatusFilter('GOOD')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'GOOD'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('qualityGood', locale)}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                statusFilter === 'BAD' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setStatusFilter('BAD')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'BAD'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('qualityBad', locale)}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.notificationsCard}>
          <Text style={styles.notificationsTitle}>
            {locale === 'et' ? 'Teavitused' : 'Notifications'}
          </Text>
          <ToggleRow
            label={
              locale === 'et'
                ? 'Saada teavitus kvaliteedi muutumisel'
                : 'Notify when water quality changes'
            }
            value={qualityAlertsEnabled}
            onToggle={() => setQualityAlertsEnabled((value) => !value)}
          />
          <ToggleRow
            label={
              locale === 'et'
                ? 'Asukohapõhine teavitus läheduses'
                : 'Location alerts when nearby'
            }
            value={locationAlertsEnabled}
            onToggle={() => setLocationAlertsEnabled((value) => !value)}
          />
        </View>

        {places.map((place) => (
          <NativePlaceCard key={place.id} place={place} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F7F5',
  },
  scroll: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#06685A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    marginBottom: 18,
  },
  heroLabel: {
    color: '#0A8F78',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 8,
    color: '#153233',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: 10,
    color: '#4B5563',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  filterSection: {
    marginBottom: 14,
  },
  filterTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#0A8F78',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    borderColor: '#0A8F78',
    backgroundColor: '#0A8F78',
  },
  filterButtonInactive: {
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButtonTextInactive: {
    color: '#153233',
  },
  notificationsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E5',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 16,
  },
  notificationsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#153233',
    marginBottom: 10,
  },
});
