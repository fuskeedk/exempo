import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Kicker, Muted, Title } from "../components";
import { colors } from "../theme";
import type { Job } from "../types";

export function CasesScreen({ cases, onOpen }: { cases: Job[]; onOpen: (id: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Kicker>Sager</Kicker>
      <Title>Arbejdssedler</Title>
      <Muted>Dine sager — samme liste som på web, uden at oprette nye.</Muted>
      {cases.map((job) => (
        <Pressable key={job.id} onPress={() => onOpen(job.id)}>
          <Card>
            <View style={styles.head}>
              <Text style={styles.no}>{job.caseNumber}</Text>
              <Text style={styles.state}>{job.stateLabel}</Text>
            </View>
            <Text style={styles.title}>{job.title}</Text>
            <Muted>{job.customerName}</Muted>
          </Card>
        </Pressable>
      ))}
      {cases.length === 0 ? (
        <Card>
          <Muted>Ingen sager tildelt.</Muted>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 24 },
  head: { flexDirection: "row", justifyContent: "space-between" },
  no: { color: colors.muted, fontWeight: "600" },
  state: { color: colors.pine, fontWeight: "700", fontSize: 12 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700", marginTop: 6, marginBottom: 4 },
});
