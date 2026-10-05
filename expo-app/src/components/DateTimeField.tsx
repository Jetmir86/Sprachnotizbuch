import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { dayLabel, timeLabel } from '../format';
import { colors } from '../theme';

type Props = { value: Date; onChange: (d: Date) => void };

export function DateTimeField({ value, onChange }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          locale="de-DE"
          minuteInterval={5}
          onValueChange={(_e, d) => onChange(d)}
        />
      </View>
    );
  }

  const open = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      onValueChange: (_e, d) => {
        const next = new Date(value);
        if (mode === 'date') next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
        else next.setHours(d.getHours(), d.getMinutes(), 0, 0);
        onChange(next);
      },
    });

  return (
    <View style={styles.row}>
      <Pressable style={styles.chip} onPress={() => open('date')}>
        <Text style={styles.chipText}>📅 {dayLabel(value)}</Text>
      </Pressable>
      <Pressable style={styles.chip} onPress={() => open('time')}>
        <Text style={styles.chipText}>🕒 {timeLabel(value)} Uhr</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { fontSize: 15, color: colors.text },
});
