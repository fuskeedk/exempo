import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Kicker, Muted, Title } from "../components";
import { colors, roleLabels } from "../theme";
import type { DayPayload } from "../types";

function formatWhen(value: string | null) {
  if (!value) return "Ikke planlagt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ikke planlagt";
  return date.toLocaleString("da-DK", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function DayScreen({
  day,
  onOpenJob,
  onAbsence,
  onSettings,
  onRefresh,
  onStop,
  busy,
}: {
  day: DayPayload;
  onOpenJob: (id: string) => void;
  onAbsence: () => void;
  onSettings: () => void;
  onRefresh: () => void;
  onStop: () => void;
  busy: boolean;
}) {
  const running = day.timer ? day.jobs.find((job) => job.id === day.timer?.caseId) : null;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Kicker>I marken</Kicker>
      <Title>Min dag</Title>
      <Muted>
        {day.user.name} · {roleLabels[day.user.role] ?? day.user.role}
      </Muted>

      {running ? (
        <View style={styles.timer}>
          <Muted>Timer kører på</Muted>
          <Text style={styles.timerTitle}>{running.title}</Text>
          <Button title="Stop og registrér tid" onPress={onStop} loading={busy} />
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Fravær" onPress={onAbsence} variant="secondary" />
        </View>
        <View style={styles.flex}>
          <Button title="Opdatér" onPress={onRefresh} variant="secondary" disabled={busy} />
        </View>
      </View>

      {day.jobs.length === 0 ? (
        <Card>
          <Text style={styles.jobTitle}>Ingen sager i dag</Text>
          <Muted>PL kan lægge arbejdssedler i kalenderen på kontoret.</Muted>
        </Card>
      ) : (
        day.jobs.map((job) => (
          <Pressable key={job.id} onPress={() => onOpenJob(job.id)}>
            <Card>
              <View style={styles.jobHead}>
                <Text style={styles.jobNo}>{job.caseNumber}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{job.stateLabel}</Text>
                </View>
              </View>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Muted>
                {job.customerName}
                {job.address ? ` · ${job.address}` : ""}
              </Muted>
              <Text style={styles.when}>{formatWhen(job.scheduledStart)}</Text>
            </Card>
          </Pressable>
        ))
      )}

      <Button title="Indstillinger" onPress={onSettings} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  timer: {
    backgroundColor: colors.moss,
    borderColor: colors.pine,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    marginBottom: 8,
    gap: 8,
  },
  timerTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", marginBottom: 6 },
  row: { flexDirection: "row", gap: 8, marginVertical: 12 },
  flex: { flex: 1 },
  jobHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jobNo: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  badge: { backgroundColor: colors.moss, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.pine, fontSize: 12, fontWeight: "700" },
  jobTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", marginTop: 6, marginBottom: 4 },
  when: { color: colors.gold, marginTop: 8, fontSize: 13, fontWeight: "600" },
});
