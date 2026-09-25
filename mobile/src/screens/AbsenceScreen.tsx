import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, ErrorBanner, Field, Kicker, Title } from "../components";
import { absenceTypes } from "../theme";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AbsenceScreen({
  busy,
  error,
  onBack,
  onSave,
}: {
  busy: boolean;
  error: string;
  onBack: () => void;
  onSave: (input: { date: string; type: string; hours: string; note: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(today());
  const [type, setType] = useState("FERIE");
  const [hours, setHours] = useState("7.4");
  const [note, setNote] = useState("");

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Button title="Tilbage" onPress={onBack} variant="secondary" />
      <View style={styles.space} />
      <Kicker>Tid</Kicker>
      <Title>Registrér fravær</Title>
      <View style={styles.space} />
      <ErrorBanner message={error} />
      <Field label="Dato (ÅÅÅÅ-MM-DD)" value={date} onChangeText={setDate} />
      {absenceTypes.map((item) => (
        <View key={item.id} style={styles.gap}>
          <Button
            title={item.label}
            onPress={() => setType(item.id)}
            variant={type === item.id ? "primary" : "secondary"}
          />
        </View>
      ))}
      <Field label="Timer" value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
      <Field label="Note" value={note} onChangeText={setNote} />
      <Button title="Gem fravær" onPress={() => onSave({ date, type, hours, note })} loading={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  space: { height: 12 },
  gap: { marginBottom: 8 },
});
