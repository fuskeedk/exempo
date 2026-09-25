import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Card, Kicker, Muted, Title } from "../components";
import { colors } from "../theme";
import type { Job } from "../types";

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function weekStart(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
}

function onDay(job: Job, day: Date) {
  if (!job.scheduledStart) return false;
  const start = new Date(job.scheduledStart);
  const end = job.scheduledEnd ? new Date(job.scheduledEnd) : addDays(start, 1);
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 1);
  return start < to && end > from;
}

export function CalendarScreen({ jobs, onOpen }: { jobs: Job[]; onOpen: (id: string) => void }) {
  const start = weekStart(new Date());
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Kicker>Planlægning</Kicker>
      <Title>Din uge</Title>
      <Muted>Samme kalender som på web — kun dine job. PL lægger sagerne.</Muted>
      {days.map((day) => {
        const items = jobs.filter((job) => onDay(job, day));
        return (
          <Card key={day.toISOString()}>
            <Text style={styles.day}>{dayLabel(day)}</Text>
            {items.length === 0 ? <Muted>Fri</Muted> : null}
            {items.map((job) => (
              <Pressable key={job.id} onPress={() => onOpen(job.id)} style={styles.item}>
                <Text style={styles.job}>{job.caseNumber} · {job.title}</Text>
                <Muted>{job.customerName}</Muted>
              </Pressable>
            ))}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 24 },
  day: { color: colors.pine, fontWeight: "700", marginBottom: 6, textTransform: "capitalize" },
  item: { marginTop: 8 },
  job: { color: colors.ink, fontWeight: "700" },
});
