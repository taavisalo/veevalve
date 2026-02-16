import { Pressable, Text, View } from 'react-native';

interface ToggleRowProps {
  label: string;
  value: boolean;
  onToggle: () => void;
}

export const ToggleRow = ({ label, value, onToggle }: ToggleRowProps) => {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: value ? '#0A8F78' : '#D1D5DB',
        backgroundColor: value ? '#E6F8F3' : '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#153233' }}>{label}</Text>
      <View
        style={{
          width: 40,
          height: 24,
          borderRadius: 20,
          backgroundColor: value ? '#0A8F78' : '#CBD5E1',
          paddingHorizontal: 3,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: '#FFFFFF',
            alignSelf: value ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
    </Pressable>
  );
};
