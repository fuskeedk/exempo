import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, ErrorBanner, Field, Kicker, Muted, Title } from "../components";
import { absenceTypes, colors } from "../theme";
import type { Absence, TimeEntry } from "../types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function TimeScreen({
  entries,
  absences,
  busy,
  error,
  onAbsence,
}: {
  entries: TimeEntry[];
  absences: Absence[];
  busy: boolean;
  error: string;
  onAbsence: (input: { date: string; type: string; hours: string; note: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(today());
  const [type, setType] = useState("FERIE");
  const [hours, setHours] = useState("7,4");
  const [note, setNote] = useState("");

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Kicker>Tid</Kicker>
      <Title>Timesedler</Title>
      <Muted>Registrerede timer og fravær — samme oversigt som på web.</Muted>
      <ErrorBanner message={error} />
      <Card>
        <Text style={styles.h}>Registrerede timer</Text>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.line}>
              {entry.caseNumber ?? "Sag"} · {entry.hours} t
              {entry.note ? ` · ${entry.note}` : ""}
            </Text>
          </View>
        ))}
        {entries.length === 0 ? <Muted>Ingen timer endnu.</Muted> : null}
      </Card>
      <Card>
        <Text style={styles.h}>Fravær</Text>
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
        <Button title="Registrér fravær" onPress={() => onAbsence({ date, type, hours, note })} loading={busy} />
        {absences.map((item) => (
          <Text key={item.id} style={styles.abs}>
            {item.type} · {item.date.slice(0, 10)} · {item.hours} t
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 24 },
  h: { color: colors.ink, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  row: { marginBottom: 8 },
  line: { color: colors.ink, fontSize: 15 },
  gap: { marginBottom: 8 },
  abs: { color: colors.muted, marginTop: 10 },
});
