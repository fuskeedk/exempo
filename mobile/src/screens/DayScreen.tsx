import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, ErrorBanner, Field, Kicker, Muted, Title } from "../components";
import { colors, roleLabels } from "../theme";
import type { DayPayload, Job } from "../types";

function formatWhen(value: string | null) {
  if (!value) return "Ikke planlagt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ikke planlagt";
  return date.toLocaleString("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function JobCard({
  job,
  products,
  running,
  busy,
  onOpen,
  onStart,
  onMaterial,
  onScan,
  onExtra,
}: {
  job: Job;
  products: DayPayload["products"];
  running: boolean;
  busy: boolean;
  onOpen: () => void;
  onStart: () => void;
  onMaterial: (productId: string, quantity: string) => void;
  onScan: () => void;
  onExtra: (title: string, amount: string) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <Card>
      <Pressable onPress={onOpen}>
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
      </Pressable>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title={running ? "Kører" : "Start tid"} onPress={onStart} disabled={running} loading={busy} />
        </View>
        <View style={styles.flex}>
          <Button title="Åbn arbejdsseddel" onPress={onOpen} variant="secondary" />
        </View>
      </View>
      {products.map((product) => (
        <View key={product.id} style={styles.tiny}>
          <Button
            title={`${product.sku} · ${product.name}`}
            onPress={() => setProductId(product.id)}
            variant={product.id === productId ? "primary" : "secondary"}
          />
        </View>
      ))}
      <Field label="Antal" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      <Button title="Materiale" onPress={() => onMaterial(productId, quantity)} loading={busy} disabled={!productId} />
      <View style={styles.space} />
      <Button title="Scan stregkode" onPress={onScan} variant="secondary" />
      <View style={styles.space} />
      <Field label="Ekstraarbejde" value={title} onChangeText={setTitle} placeholder="Titel" />
      <Field label="Beløb, kr." value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Button
        title="Send ekstra"
        onPress={() => {
          onExtra(title, amount);
          setTitle("");
          setAmount("");
        }}
        variant="secondary"
        loading={busy}
      />
    </Card>
  );
}

export function DayScreen({
  day,
  error,
  onOpenJob,
  onSettings,
  onStart,
  onStop,
  onMaterial,
  onScan,
  onExtra,
  busy,
}: {
  day: DayPayload;
  error: string;
  onOpenJob: (id: string) => void;
  onSettings: () => void;
  onStart: (id: string) => void;
  onStop: () => void;
  onMaterial: (caseId: string, productId: string, quantity: string) => void;
  onScan: (caseId: string) => void;
  onExtra: (caseId: string, title: string, amount: string) => void;
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
      <ErrorBanner message={error} />

      {running ? (
        <View style={styles.timer}>
          <Muted>Timer kører på</Muted>
          <Text style={styles.timerTitle}>{running.title}</Text>
          <Button title="Stop og registrér tid" onPress={onStop} loading={busy} />
        </View>
      ) : null}

      {day.jobs.length === 0 ? (
        <Card>
          <Text style={styles.jobTitle}>Ingen job i kalenderen</Text>
          <Muted>Få PL til at lægge dig på planlægningen.</Muted>
        </Card>
      ) : (
        day.jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            products={day.products}
            running={day.timer?.caseId === job.id}
            busy={busy}
            onOpen={() => onOpenJob(job.id)}
            onStart={() => onStart(job.id)}
            onMaterial={(productId, quantity) => onMaterial(job.id, productId, quantity)}
            onScan={() => onScan(job.id)}
            onExtra={(title, amount) => onExtra(job.id, title, amount)}
          />
        ))
      )}

      <Button title="Indstillinger" onPress={onSettings} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 24 },
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
  space: { height: 10 },
  tiny: { marginBottom: 8 },
});
