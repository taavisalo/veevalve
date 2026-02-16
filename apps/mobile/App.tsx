import { t, type AppLocale, type PlaceType } from '@veevalve/core';
import { NativePlaceCard } from '@veevalve/ui/native';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { mobileMockPlaces } from './src/mock-places';
import { ToggleRow } from './src/components/toggle-row';

const buttonStyle = (active: boolean) => ({
  borderRadius: 999,
  borderWidth: 1,
  borderColor: active ? '#0A8F78' : '#CDE6DF',
  backgroundColor: active ? '#0A8F78' : '#FFFFFF',
  paddingHorizontal: 12,
  paddingVertical: 8,
});

const buttonTextStyle = (active: boolean) => ({
  color: active ? '#FFFFFF' : '#153233',
  fontSize: 13,
  fontWeight: '600' as const,
});

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F7F5' }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View
          style={{
            borderRadius: 24,
            backgroundColor: '#FFFFFF',
            padding: 18,
            shadowColor: '#06685A',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.18,
            shadowRadius: 28,
            marginBottom: 18,
          }}
        >
          <Text style={{ color: '#0A8F78', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>
            {t('appName', locale)}
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: '#153233',
              fontSize: 28,
              fontWeight: '700',
              lineHeight: 34,
            }}
          >
            {locale === 'et'
              ? 'Ujumiskohtade vee kvaliteet Eestis'
              : 'Water quality for swimming places in Estonia'}
          </Text>
          <Text style={{ marginTop: 10, color: '#4B5563', fontSize: 14 }}>{t('subtitle', locale)}</Text>

          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            <Pressable
              onPress={() => setLocale('et')}
              style={buttonStyle(locale === 'et')}
            >
              <Text style={buttonTextStyle(locale === 'et')}>EST</Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('en')}
              style={buttonStyle(locale === 'en')}
            >
              <Text style={buttonTextStyle(locale === 'en')}>ENG</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ marginBottom: 14 }}>
          <Text style={{ marginBottom: 8, fontSize: 12, fontWeight: '700', color: '#0A8F78' }}>
            {locale === 'et' ? 'Filtreeri' : 'Filter'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable style={buttonStyle(typeFilter === 'ALL')} onPress={() => setTypeFilter('ALL')}>
              <Text style={buttonTextStyle(typeFilter === 'ALL')}>{locale === 'et' ? 'Kõik' : 'All'}</Text>
            </Pressable>
            <Pressable style={buttonStyle(typeFilter === 'BEACH')} onPress={() => setTypeFilter('BEACH')}>
              <Text style={buttonTextStyle(typeFilter === 'BEACH')}>{t('beaches', locale)}</Text>
            </Pressable>
            <Pressable style={buttonStyle(typeFilter === 'POOL')} onPress={() => setTypeFilter('POOL')}>
              <Text style={buttonTextStyle(typeFilter === 'POOL')}>{t('pools', locale)}</Text>
            </Pressable>
            <Pressable style={buttonStyle(statusFilter === 'GOOD')} onPress={() => setStatusFilter('GOOD')}>
              <Text style={buttonTextStyle(statusFilter === 'GOOD')}>{t('qualityGood', locale)}</Text>
            </Pressable>
            <Pressable style={buttonStyle(statusFilter === 'BAD')} onPress={() => setStatusFilter('BAD')}>
              <Text style={buttonTextStyle(statusFilter === 'BAD')}>{t('qualityBad', locale)}</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#D9E9E5',
            backgroundColor: '#FFFFFF',
            padding: 14,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#153233', marginBottom: 10 }}>
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
