import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ToggleRowProps {
  label: string;
  value: boolean;
  onToggle: () => void;
}

export const ToggleRow = memo(({ label, value, onToggle }: ToggleRowProps) => {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.row, value ? styles.rowActive : styles.rowInactive]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.track, value ? styles.trackActive : styles.trackInactive]}>
        <View
          style={[
            styles.knob,
            value ? styles.knobRight : styles.knobLeft,
          ]}
        />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowActive: {
    borderColor: '#0A8F78',
    backgroundColor: '#E6F8F3',
  },
  rowInactive: {
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#153233',
  },
  track: {
    width: 40,
    height: 24,
    borderRadius: 20,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  trackActive: {
    backgroundColor: '#0A8F78',
  },
  trackInactive: {
    backgroundColor: '#CBD5E1',
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  knobLeft: {
    alignSelf: 'flex-start',
  },
  knobRight: {
    alignSelf: 'flex-end',
  },
});
